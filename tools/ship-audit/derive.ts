/**
 * Derived hull values and the three consistency checks.
 * Shield identity uses the measured 1:1 formula. Engine facings still
 * come from bindShiplistRow, which applies the current ×2 fallbacks.
 */
import measured from "../../docs/rules/data/measured.json" with { type: "json" };
import { ENERGY_SCALE, TICK_HZ, classifyTurnLetter, weaponId } from "../../engine/sim/rules-tables.ts";
import { rulesDiv } from "../../engine/sim/rules-div.ts";
import {
  bindShiplistRow,
  parseHundredths,
  parseWhole,
  shieldMaxFromCells,
  type ShipSetup,
} from "../../engine/sim/bind-shiplist.ts";
import type { ShiplistRow } from "../../tools/formats/shiplist.ts";

export type CheckStatus = "pass" | "fail" | "skip";

export interface CheckResult {
  status: CheckStatus;
  /** Local diagnostic codes. Not printed on stdout. */
  reasons: string[];
}

export interface DerivedWeapon {
  slotIndex: number;
  fileSlot: number;
  weapon: string;
  arc: string | null;
  reloads: number | null;
  count: number | null;
  boxes: number | null;
  known: boolean;
}

export interface PowerBlock {
  warp: number;
  impulse: number;
  apr: number;
  battery: number;
  batteryCapacity: number;
  generation: number;
}

export interface HullAudit {
  spawnKey: string;
  line: number;
  /** Engine facings, index 0 = front. Empty when the loader throws. */
  shields: number[];
  /** Measured 1:1 facings. Empty when a shield cell is missing or not a whole number. */
  shieldsMeasured: number[];
  shieldFile: {
    front: number;
    forwardSide: number;
    aftSide: number;
    rear: number;
    total: number;
  } | null;
  turn: {
    letter: string;
    mode: number | null;
    yawPerTick: number | null;
    degPerGameSecond: number | null;
    unverified: boolean;
  };
  speed: number | null;
  cruiseSpeed: number | null;
  acceleration: number | null;
  moveCost100: number | null;
  power: PowerBlock | null;
  weapons: DerivedWeapon[];
  hull: { armor: number; forward: number; center: number; aft: number };
  simHull: { armor: number; forward: number; center: number; aft: number };
  crew: { crew: number; minCrew: number };
  checks: {
    shieldTotal: CheckResult;
    powerSum: CheckResult;
    weaponCount: CheckResult;
  };
  bindError: boolean;
  shieldScaleDivergent: boolean;
}

function normHeader(raw: string): string {
  let out = "";
  let prevSpace = false;
  for (let i = 0; i < raw.length; i++) {
    let c = raw.charCodeAt(i);
    if (c >= 65 && c <= 90) c += 32;
    if (c === 32 || c === 9) {
      if (!prevSpace && out.length > 0) out += " ";
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    out += String.fromCharCode(c);
  }
  while (out.length > 0 && out.charCodeAt(out.length - 1) === 95) out = out.slice(0, -1);
  return out;
}

function cell(columns: readonly string[], raw: readonly string[], aliases: readonly string[]): string | undefined {
  for (let i = 0; i < columns.length; i++) {
    const name = normHeader(columns[i] ?? "");
    for (const alias of aliases) {
      if (name === alias) return raw[i] ?? "";
    }
  }
  return undefined;
}

function whole(columns: readonly string[], raw: readonly string[], aliases: readonly string[]): { present: boolean; value: number | null } {
  const text = cell(columns, raw, aliases);
  if (text === undefined) return { present: false, value: null };
  return { present: true, value: parseWhole(text) };
}

function presentWhole(read: { present: boolean; value: number | null }): number {
  return read.present && read.value !== null ? read.value : 0;
}

const SHIELD_FRONT = ["shield 1", "shield front", "front shield"];
const SHIELD_FORWARD = ["shield 2", "shield 2 _ 6", "shield forward side", "forward side"];
const SHIELD_AFT = ["shield 3", "shield 3 _ 5", "shield aft side", "aft side"];
const SHIELD_REAR = ["shield 4", "shield rear", "rear shield"];
const SHIELD_TOTAL = ["shield total", "shieldtotal", "total shields"];
const WARP_SIDE = ["warp side", "side warp", "r_l_warp"];
const WARP_CENTER = ["warp center", "warp centre", "c_warp"];

export function yawToDegPerGameSecond(yawPerTick: number): number {
  return (yawPerTick * TICK_HZ * 360) / 65536;
}

function pass(): CheckResult {
  return { status: "pass", reasons: [] };
}

function fail(reasons: string[]): CheckResult {
  return { status: "fail", reasons };
}

function checkShield(columns: readonly string[], raw: readonly string[]): {
  check: CheckResult;
  file: HullAudit["shieldFile"];
  measured: number[];
} {
  const front = whole(columns, raw, SHIELD_FRONT);
  const forward = whole(columns, raw, SHIELD_FORWARD);
  const aft = whole(columns, raw, SHIELD_AFT);
  const rear = whole(columns, raw, SHIELD_REAR);
  const total = whole(columns, raw, SHIELD_TOTAL);
  const parts = [front, forward, aft, rear, total];
  if (parts.some((part) => !part.present)) return { check: { status: "skip", reasons: ["missingColumn"] }, file: null, measured: [] };
  if (parts.some((part) => part.value === null)) return { check: fail(["badInteger"]), file: null, measured: [] };
  const s1 = front.value ?? 0;
  const s2 = forward.value ?? 0;
  const s3 = aft.value ?? 0;
  const s4 = rear.value ?? 0;
  const expected = s1 + 2 * s2 + 2 * s3 + s4;
  const file = { front: s1, forwardSide: s2, aftSide: s3, rear: s4, total: total.value ?? 0 };
  const measured = shieldMaxFromCells(s1, s2, s3, s4, { sideColumnFactor: 1, endFactor: 1, pairing: null });
  if (expected !== file.total) return { check: fail(["shieldTotal"]), file, measured };
  return { check: pass(), file, measured };
}

function checkPower(
  columns: readonly string[],
  raw: readonly string[],
  setup: ShipSetup | null,
  bindError: boolean,
): { check: CheckResult; power: PowerBlock | null } {
  const side = whole(columns, raw, WARP_SIDE);
  const center = whole(columns, raw, WARP_CENTER);
  const impulse = whole(columns, raw, ["impulse"]);
  const apr = whole(columns, raw, ["apr"]);
  const battery = whole(columns, raw, ["battery"]);
  const reads = [side, center, impulse, apr, battery];
  const reasons: string[] = [];
  if (reads.some((read) => read.present && read.value === null)) reasons.push("badInteger");
  const sideN = presentWhole(side);
  const centerN = presentWhole(center);
  const impulseN = presentWhole(impulse);
  const aprN = presentWhole(apr);
  const batteryN = presentWhole(battery);
  if ([sideN, centerN, impulseN, aprN, batteryN].some((value) => value < 0)) reasons.push("negative");
  const warp = sideN * 2 + centerN;
  const power: PowerBlock = {
    warp,
    impulse: impulseN,
    apr: aprN,
    battery: batteryN,
    batteryCapacity: batteryN,
    generation: warp + impulseN + aprN,
  };
  if (setup) {
    if (setup.warp !== power.warp) reasons.push("warp");
    if (setup.impulse !== power.impulse) reasons.push("impulse");
    if (setup.apr !== power.apr) reasons.push("apr");
    if (setup.battery !== power.battery) reasons.push("battery");
    if (setup.batteryCapacity !== power.batteryCapacity) reasons.push("batteryCapacity");
    if (setup.warp + setup.impulse + setup.apr !== power.generation) reasons.push("generation");
  }
  if (bindError) reasons.push("bind");
  return { check: reasons.length === 0 ? pass() : fail(reasons), power: reasons.includes("badInteger") ? null : power };
}

function checkWeapons(row: ShiplistRow, setup: ShipSetup | null): { check: CheckResult; weapons: DerivedWeapon[] } {
  const weapons: DerivedWeapon[] = [];
  const reasons: string[] = [];
  let known = 0;
  for (const slot of row.hardpoints) {
    if (slot.weapon == null || slot.weapon === "") {
      if (slot.count != null && slot.count !== 0) reasons.push("countWithoutWeapon");
      continue;
    }
    const isKnown = weaponId(slot.weapon) !== 0;
    const fileCount = slot.count ?? 0;
    const boxes = isKnown ? (fileCount > 0 ? fileCount : 1) : null;
    weapons.push({
      slotIndex: slot.slotIndex,
      fileSlot: slot.slotIndex + 1,
      weapon: slot.weapon,
      arc: slot.arc,
      reloads: slot.reloads,
      count: slot.count,
      boxes,
      known: isKnown,
    });
    if (!isKnown) {
      reasons.push("unknownWeapon");
      continue;
    }
    known += 1;
    if (fileCount !== boxes) reasons.push("countMismatch");
    if (setup) {
      const mount = setup.mounts.find((item) => item.slotIndex === slot.slotIndex);
      if (!mount) reasons.push("notMounted");
      else if (mount.boxes !== boxes) reasons.push("boxesMismatch");
    }
  }
  if (setup && setup.mounts.length !== known) reasons.push("mountCount");
  if (!setup) reasons.push("bind");
  return { check: reasons.length === 0 ? pass() : fail(reasons), weapons };
}

function cruiseSpeed(power: PowerBlock | null, moveCost100: number | null, acceleration: number | null, letter: string): number | null {
  if (power === null || moveCost100 === null || acceleration === null) return null;
  if (power.generation < 0) return null;
  if (acceleration < 0 || letter === "H" || letter === "") return 0;
  if (moveCost100 <= 0) return 0;
  return rulesDiv(power.generation * ENERGY_SCALE, moveCost100);
}

export function auditRow(row: ShiplistRow, columns: readonly string[]): HullAudit {
  const raw = row.raw;
  let setup: ShipSetup | null = null;
  let bindError = false;
  try {
    setup = bindShiplistRow(row, columns);
  } catch {
    bindError = true;
    setup = null;
  }
  const shield = checkShield(columns, raw);
  const power = checkPower(columns, raw, setup, bindError);
  const weapons = checkWeapons(row, setup);
  const turnText = (cell(columns, raw, ["turn mode"]) ?? "").trim();
  const letter = turnText === "" ? "H" : turnText;
  const yawTable = measured.turnYaw.measuredMaxYawPerTick as Readonly<Record<string, number>>;
  const classified = classifyTurnLetter(letter, yawTable);
  const mode = classified.id;
  const yaw = classified.yaw;
  const moveText = cell(columns, raw, ["move cost"]);
  const moveCost100 = moveText === undefined ? 0 : parseHundredths(moveText);
  const accelRead = whole(columns, raw, ["acceleration"]);
  let acceleration: number | null = -1;
  if (!accelRead.present) acceleration = -1;
  else if (accelRead.value === null) acceleration = null;
  else if ((cell(columns, raw, ["acceleration"]) ?? "").trim() === "") acceleration = -1;
  else acceleration = accelRead.value;
  const crewRead = whole(columns, raw, ["crew", "regular crew"]);
  const minRead = whole(columns, raw, ["min crew"]);
  const armor = presentWhole(whole(columns, raw, ["armor"]));
  const forward = presentWhole(whole(columns, raw, ["forward hull", "hull forward"]));
  const center = presentWhole(whole(columns, raw, ["center hull", "hull center", "hull centre", "centre hull"]));
  const aft = presentWhole(whole(columns, raw, ["aft hull", "hull aft"]));
  const simHull = {
    armor: setup?.systems?.armor ?? 0,
    forward: setup?.systems?.hullForward ?? 0,
    center: setup?.systems?.hullCenter ?? 0,
    aft: setup?.systems?.hullAft ?? 0,
  };
  const shields = setup ? setup.shieldsMax.slice() : [];
  let divergent = false;
  if (shields.length === 6 && shield.measured.length === 6) {
    for (let i = 0; i < 6; i++) {
      if (shields[i] !== shield.measured[i]) divergent = true;
    }
  }
  return {
    spawnKey: row.spawnKey,
    line: row.line,
    shields,
    shieldsMeasured: shield.measured,
    shieldFile: shield.file,
    turn: {
      letter,
      mode,
      yawPerTick: yaw,
      degPerGameSecond: yawToDegPerGameSecond(yaw),
      unverified: classified.unverified === 1,
    },
    speed: setup ? setup.speed : null,
    cruiseSpeed: cruiseSpeed(power.power, moveCost100, acceleration, letter),
    acceleration,
    moveCost100,
    power: power.power,
    weapons: weapons.weapons,
    hull: { armor, forward, center, aft },
    simHull,
    crew: {
      crew: presentWhole(crewRead),
      minCrew: presentWhole(minRead),
    },
    checks: {
      shieldTotal: shield.check,
      powerSum: power.check,
      weaponCount: weapons.check,
    },
    bindError,
    shieldScaleDivergent: divergent,
  };
}

/** Flat numeric fields the harness diff compares. */
export function derivedFields(hull: HullAudit): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < hull.shields.length; i++) out[`shields.${i}`] = hull.shields[i] ?? 0;
  for (let i = 0; i < hull.shieldsMeasured.length; i++) out[`shieldsMeasured.${i}`] = hull.shieldsMeasured[i] ?? 0;
  if (hull.shieldFile) out["shield.total"] = hull.shieldFile.total;
  if (hull.turn.mode !== null) out["turn.mode"] = hull.turn.mode;
  if (hull.turn.yawPerTick !== null) out["turn.yawPerTick"] = hull.turn.yawPerTick;
  if (hull.turn.degPerGameSecond !== null) out["turn.degPerGameSecond"] = hull.turn.degPerGameSecond;
  if (hull.speed !== null) out.speed = hull.speed;
  if (hull.cruiseSpeed !== null) out.cruiseSpeed = hull.cruiseSpeed;
  if (hull.acceleration !== null) out.acceleration = hull.acceleration;
  if (hull.moveCost100 !== null) out.moveCost100 = hull.moveCost100;
  if (hull.power) {
    out["power.warp"] = hull.power.warp;
    out["power.impulse"] = hull.power.impulse;
    out["power.apr"] = hull.power.apr;
    out["power.battery"] = hull.power.battery;
    out["power.batteryCapacity"] = hull.power.batteryCapacity;
    out["power.generation"] = hull.power.generation;
  }
  out["weapons.count"] = hull.weapons.filter((weapon) => weapon.known).length;
  out["weapons.filled"] = hull.weapons.length;
  out.armor = hull.hull.armor;
  out["hull.forward"] = hull.hull.forward;
  out["hull.center"] = hull.hull.center;
  out["hull.aft"] = hull.hull.aft;
  out["sim.armor"] = hull.simHull.armor;
  out["sim.hullForward"] = hull.simHull.forward;
  out["sim.hullCenter"] = hull.simHull.center;
  out["sim.hullAft"] = hull.simHull.aft;
  out.crew = hull.crew.crew;
  out.minCrew = hull.crew.minCrew;
  return out;
}
