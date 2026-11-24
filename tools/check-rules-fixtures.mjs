#!/usr/bin/env node
/**
 * Spec checker for docs/rules fixtures.
 *
 * This is a test double for the Phase 2 duel slice. It is not the sim.
 * The engine must not import it. Behaviour is defined in docs/rules/.
 *
 * Run from the repo root: node tools/check-rules-fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

const CONSTANTS = readJson("docs/rules/data/constants.json");
const SCALE = readJson("docs/rules/data/scale-factors.json");
const WEAPONS = readJson("docs/rules/data/weapon-arcs.json");
const TURNS = readJson("docs/rules/data/turn-modes.json");
const REASONS = readJson("docs/rules/data/reason-codes.json");
const HET = readJson("docs/rules/data/het.json");

const reasonByCode = new Map(REASONS.codes.map((c) => [c.code, c]));
const FX_SHIFT = 16;
const FX = 1 << FX_SHIFT;

const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function toMilli(n) {
  const m = n * FX;
  const r = Math.round(m);
  if (Math.abs(m - r) > 1e-6) return null;
  return r;
}

function fromMilli(m) {
  return Math.round(m) / FX;
}

function mod16(n) {
  return ((n % 65536) + 65536) % 65536;
}

/** Facing 0 is centred on heading 0. Boundary headings belong to the clockwise-next facing. */
function facingForRelative(rel) {
  return Math.floor((mod16(rel) * 6 + 32768) / 65536) % 6;
}

function inArc(rel, arcDef) {
  if (!arcDef) return false;
  if (arcDef.full) return true;
  const r = mod16(rel);
  return arcDef.spans.some((span) => {
    const from = mod16(span.from16);
    const to = mod16(span.to16);
    if (from === to) return false;
    if (from < to) return r >= from && r < to;
    return r >= from || r < to;
  });
}

function fnv1a(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStream(seed, name) {
  let s = fnv1a(name, seed >>> 0);
  if (s === 0) s = 1;
  return mulberry32(s);
}

function tickShare(total, index, period) {
  return Math.floor((total * (index + 1)) / period) - Math.floor((total * index) / period);
}

function bearing16(dx, dy) {
  if (dx === 0 && dy === 0) return 0;
  const turns = Math.atan2(dy, dx) / (2 * Math.PI);
  return mod16(Math.round(turns * 65536));
}

function rangeBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function weaponDef(code) {
  return WEAPONS.ship.weapons[code] || WEAPONS.fighter.weapons[code] || null;
}

function arcDef(code) {
  return WEAPONS.ship.arcs[code] || WEAPONS.fighter.arcs[code] || null;
}

function turnDef(letter) {
  if (Object.prototype.hasOwnProperty.call(TURNS.modes, letter)) {
    return { known: true, unverified: false, ...TURNS.modes[letter] };
  }
  const fallback = TURNS.fallbackMaxYawPerTick;
  if (!Number.isInteger(fallback) || fallback <= 0) {
    throw new Error("fallback yaw");
  }
  return { known: true, unverified: true, maxYawPerTick: fallback, immobile: false };
}

function mergeConstants(over) {
  const merged = { ...CONSTANTS, ...(over || {}) };
  if (merged.rulesTurnTicks == null) {
    const ticks = merged.rulesTurnSeconds * merged.tickHz;
    if (!Number.isInteger(ticks)) {
      throw new Error("rules turn must convert to a whole number of ticks");
    }
    merged.rulesTurnTicks = ticks;
  }
  return merged;
}

function phaserEnergyCost(mount, def) {
  if (mount.fixtureChargeCost != null) return mount.fixtureChargeCost;
  return def.chargeCost;
}

function loadShip(spec) {
  if (!spec || typeof spec.className !== "string" || !spec.className.startsWith("test-")) {
    throw new Error(`ship className must start with test-: ${spec && spec.className}`);
  }
  const klass = spec.class || "ship";
  const ship = {
    spawnKey: spec.spawnKey,
    className: spec.className,
    race: spec.race,
    class: klass,
    destroyed: Boolean(spec.destroyed),
    disabled: Boolean(spec.disabled),
    fcPaid: Boolean(spec.fcPaid),
    x: spec.movement?.x ?? spec.x ?? 0,
    y: spec.movement?.y ?? spec.y ?? 0,
    heading16: spec.movement?.heading16 ?? 0,
    speed: spec.movement?.speed ?? spec.speed ?? 0,
    moveCost: spec.movement?.moveCost ?? 0,
    turnMode: spec.movement?.turnMode ?? spec.turnMode ?? "TEST-C",
    acceleration: spec.movement?.acceleration ?? spec.acceleration ?? 0,
    shields: [0, 0, 0, 0, 0, 0],
    shieldsMax: [0, 0, 0, 0, 0, 0],
    power: {
      warp: toMilli(spec.power?.warp ?? 0),
      impulse: toMilli(spec.power?.impulse ?? 0),
      apr: toMilli(spec.power?.apr ?? 0),
      battery: toMilli(spec.power?.battery ?? 0),
      batteryCapacity: toMilli(spec.power?.batteryCapacity ?? spec.power?.battery ?? 0),
    },
    systems: { ...(spec.systems || {}) },
    systemsMax: { ...(spec.systemsMax || spec.systems || {}) },
    crew: {
      crewUnits: spec.crew?.crewUnits ?? 0,
      boardingParties: spec.crew?.boardingParties ?? 0,
      minCrew: spec.crew?.minCrew ?? 0,
    },
    weapons: [],
    capacitor: toMilli(spec.capacitor ?? 0),
    projectiles: [],
    plan: null,
    lastHit: null,
    damagePoints: spec.damagePoints ?? null,
    ecm: spec.ecm ?? null,
    bay: spec.bay ?? null,
    speedRating: spec.speed ?? null,
    het: { mode: "none", remainingTurn16: 0, hetDelayTicksLeft: 0 },
  };
  const shields = spec.shields || [0, 0, 0, 0, 0, 0];
  const shieldsMax = spec.shieldsMax || shields;
  for (let i = 0; i < 6; i += 1) {
    ship.shields[i] = toMilli(shields[i] ?? 0);
    ship.shieldsMax[i] = toMilli(shieldsMax[i] ?? shields[i] ?? 0);
  }
  for (const w of spec.weapons || []) {
    const def = weaponDef(w.weapon);
    ship.weapons.push({
      slotIndex: w.slotIndex,
      weapon: w.weapon,
      arc: w.arc ?? null,
      reloads: w.reloads ?? null,
      load: w.load ?? null,
      count: w.count ?? null,
      charge: toMilli(w.charge ?? 0),
      ticksCharging: w.ticksCharging ?? 0,
      mode: w.mode || "normal",
      boxes: w.boxes ?? 1,
      boxesMax: w.boxesMax ?? w.boxes ?? 1,
      budget: 0,
      fixtureChargeCost: w.fixtureChargeCost ?? null,
      internal: def ? def.internal : null,
    });
  }
  if (spec.movement && spec.movement.speed != null) ship.speed = spec.movement.speed;
  return ship;
}

function exportShip(ship) {
  const view = {
    spawnKey: ship.spawnKey,
    className: ship.className,
    class: ship.class,
    destroyed: ship.destroyed,
    disabled: ship.disabled,
    fcPaid: ship.fcPaid,
    heading16: ship.heading16,
    helm: { ...ship.het },
    speed: ship.speed,
    shields: ship.shields.map(fromMilli),
    capacitor: fromMilli(ship.capacitor),
    crew: { ...ship.crew },
    systems: { ...ship.systems },
    weapons: ship.weapons.map((w) => ({
      slotIndex: w.slotIndex,
      weapon: w.weapon,
      arc: w.arc,
      reloads: w.reloads,
      charge: fromMilli(w.charge),
      ticksCharging: w.ticksCharging,
      mode: w.mode,
      boxes: w.boxes,
      ready: mountReady(w),
    })),
    projectiles: ship.projectiles.filter((p) => p.alive).map((p) => ({
      target: p.target,
      remaining: fromMilli(p.remaining),
      mode: p.mode,
    })),
  };
  if (ship.lastHit) {
    view.lastHit = {
      facing: ship.lastHit.facing,
      damage: ship.lastHit.damage,
      shieldAbsorbed: ship.lastHit.shieldAbsorbed,
      penetrating: ship.lastHit.penetrating,
    };
  }
  return view;
}

function mountReady(mount) {
  const def = weaponDef(mount.weapon);
  if (!def) return false;
  if (def.internal === "phaser") {
    const cost = phaserEnergyCost(mount, def);
    if (cost == null) return false;
    return mount.charge >= toMilli(cost);
  }
  if (def.internal === "photon") {
    const cost = mount.mode === "overload" ? def.overloadArmCost : def.armCost;
    const ticks = mount.mode === "overload" ? def.overloadArmTicks : def.armTicks;
    if (cost == null || ticks == null) return false;
    return mount.charge >= toMilli(cost) && mount.ticksCharging >= ticks;
  }
  return false;
}

function result(status, reason, appliedValue, extra) {
  const entry = reasonByCode.get(reason);
  if (!entry) throw new Error(`unregistered reason ${reason}`);
  if (entry.status !== status) {
    throw new Error(`reason ${reason} is ${entry.status}, used as ${status}`);
  }
  return {
    status,
    reason,
    appliedValue,
    source: "rules",
    logSeverity: entry.logSeverity,
    ...(extra || {}),
  };
}

function identity(world, key) {
  const ship = world.ships[key];
  if (!ship) return { error: result("rejected", "noSuchShip", null) };
  if (ship.class === "fighter") return { error: result("rejected", "notAShip", null) };
  if (ship.destroyed) return { error: result("rejected", "shipDestroyed", null) };
  return { ship };
}

function requireMilli(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return { error: "precisionExceeded" };
  const m = toMilli(n);
  if (m == null) return { error: "precisionExceeded" };
  return { milli: m };
}

function systemBoxes(ship, key) {
  if (key.startsWith("weapon:")) {
    const slot = Number(key.slice(7));
    const mount = ship.weapons.find((w) => w.slotIndex === slot);
    return mount ? mount.boxes : null;
  }
  if (!Object.prototype.hasOwnProperty.call(ship.systems, key)) return null;
  return ship.systems[key];
}

function setSystemBoxes(ship, key, value) {
  if (key.startsWith("weapon:")) {
    const slot = Number(key.slice(7));
    const mount = ship.weapons.find((w) => w.slotIndex === slot);
    if (mount) mount.boxes = value;
    return;
  }
  ship.systems[key] = value;
}

function hasSystem(ship, key) {
  return systemBoxes(ship, key) != null;
}

function hullKey(constants, facing) {
  return constants.hullStruckByFacing[String(facing)] || "hullForward";
}

function generationMilli(ship) {
  return ship.power.warp + ship.power.impulse + ship.power.apr;
}

function splitGeneralPoints(points) {
  const whole = Math.trunc(points);
  const base = Math.floor(whole / 6);
  const rem = whole % 6;
  const out = [];
  for (let i = 0; i < 6; i += 1) out.push(base + (i < rem ? 1 : 0));
  return out;
}

function settleAllocation(ship, allocation, constants) {
  const allowed = new Set(["speed", "lifeSupport", "fireControl", "shields", "weapons"]);
  for (const key of Object.keys(allocation)) {
    if (!allowed.has(key)) return result("rejected", "unknownDraw", null, { details: { draw: key } });
  }
  const speedReq = allocation.speed ?? 0;
  if (typeof speedReq !== "number" || speedReq < 0) return result("rejected", "negativeValue", null);
  const speedMilliCheck = requireMilli(speedReq);
  if (speedMilliCheck.error) return result("rejected", speedMilliCheck.error, null);

  let lifeOn = Boolean(allocation.lifeSupport);
  let fcOn = Boolean(allocation.fireControl);
  const shieldReq = allocation.shields || {};
  const generalReq = shieldReq.general ?? 0;
  if (generalReq < 0) return result("rejected", "negativeValue", null);
  const generalMilli = requireMilli(generalReq);
  if (generalMilli.error) return result("rejected", generalMilli.error, null);
  const specific = {};
  for (const [face, amount] of Object.entries(shieldReq.specific || {})) {
    const idx = Number(face);
    if (!Number.isInteger(idx) || idx < 0 || idx > 5) return result("rejected", "badFacing", null);
    if (amount < 0) return result("rejected", "negativeValue", null);
    const milli = requireMilli(amount);
    if (milli.error) return result("rejected", milli.error, null);
    specific[idx] = amount;
  }

  const weaponAsks = [];
  for (const ask of allocation.weapons || []) {
    const mount = ship.weapons.find((w) => w.slotIndex === ask.slotIndex);
    if (!mount) return result("rejected", "unknownWeaponSlot", null, { details: { slotIndex: ask.slotIndex } });
    const def = weaponDef(mount.weapon);
    if (!def || (def.internal !== "phaser" && def.internal !== "photon")) {
      return result("rejected", "notInDuelSlice", null, { details: { slotIndex: ask.slotIndex } });
    }
    const mode = ask.mode || mount.mode || "normal";
    if (!["normal", "overload", "proximity"].includes(mode)) {
      return result("rejected", "notInDuelSlice", null);
    }
    if (def.internal === "phaser" && mode !== "normal") return result("rejected", "notInDuelSlice", null);
    if ((ask.request ?? 0) < 0) return result("rejected", "negativeValue", null);
    const reqMilli = requireMilli(ask.request ?? 0);
    if (reqMilli.error) return result("rejected", reqMilli.error, null);
    weaponAsks.push({ mount, def, mode, request: ask.request ?? 0 });
  }

  const turn = turnDef(ship.turnMode);

  let speed = speedReq;
  let immobileClamp = false;
  let accelClamp = false;
  if (turn.immobile) {
    if (speed > 0) immobileClamp = true;
    speed = 0;
  } else if (ship.acceleration != null && Math.abs(speed - ship.speed) > ship.acceleration) {
    const dir = speed > ship.speed ? 1 : -1;
    speed = ship.speed + dir * ship.acceleration;
    accelClamp = true;
  }

  const moveCostMilli = toMilli(ship.moveCost) ?? 0;
  const speedMilli = toMilli(speed) ?? 0;
  let movementMilli = Math.round((moveCostMilli * speedMilli) / FX);

  const lifeMilli = lifeOn ? toMilli(constants.lifeSupportCost) : 0;
  const fcMilli = fcOn ? toMilli(constants.fireControlCost) : 0;

  const generalPoints = Math.floor((generalMilli.milli || 0) / FX);
  const facingPoints = splitGeneralPoints(generalPoints);
  for (let i = 0; i < 6; i += 1) facingPoints[i] += Math.floor(specific[i] || 0);
  let uncappedShieldPoints = facingPoints.reduce((a, b) => a + b, 0);
  let reinforceCapped = false;
  for (let i = 0; i < 6; i += 1) {
    const room = Math.max(0, Math.floor((ship.shieldsMax[i] - ship.shields[i]) / FX));
    const capped = Math.min(facingPoints[i], constants.reinforceCapPerTurn, room);
    if (capped < facingPoints[i]) reinforceCapped = true;
    facingPoints[i] = capped;
  }
  const shieldPoints = facingPoints.reduce((a, b) => a + b, 0);
  const shieldMilli = shieldPoints * FX;

  let chargeCapped = false;
  const weaponMilli = [];
  let weaponTotal = 0;
  for (const ask of weaponAsks) {
    const need = energyStillAccepted(ship, ask.mount, ask.def, ask.mode, constants);
    const req = toMilli(ask.request);
    const accepted = Math.min(req, need);
    if (accepted < req) chargeCapped = true;
    weaponMilli.push({ slotIndex: ask.mount.slotIndex, milli: accepted, mode: ask.mode });
    weaponTotal += accepted;
  }

  const desired = {
    lifeSupport: lifeMilli,
    fireControl: fcMilli,
    movement: movementMilli,
    shields: shieldMilli,
    weapons: weaponTotal,
  };
  let pool = generationMilli(ship) + ship.power.battery;
  const paid = {};
  for (const key of constants.payOrder) {
    const give = Math.min(desired[key], pool);
    paid[key] = give;
    pool -= give;
  }
  if (paid.movement < desired.movement && moveCostMilli > 0) {
    const affordable = Math.floor((paid.movement * FX) / (moveCostMilli * FX) * FX);
    // speed in rule units: paid movement milli / moveCost milli
    const affordableSpeedMilli = Math.floor((paid.movement * FX) / moveCostMilli);
    const used = Math.round((moveCostMilli * affordableSpeedMilli) / FX);
    pool += paid.movement - used;
    paid.movement = used;
    speed = fromMilli(affordableSpeedMilli);
    // give the leftover milli to later categories that were shorted: shields then weapons
    const extraShield = Math.min(desired.shields - paid.shields, pool);
    paid.shields += extraShield;
    pool -= extraShield;
    const extraWeapon = Math.min(desired.weapons - paid.weapons, pool);
    paid.weapons += extraWeapon;
    pool -= extraWeapon;
    void affordable;
  }

  const paidTotal =
    paid.lifeSupport + paid.fireControl + paid.movement + paid.shields + paid.weapons;
  const gen = generationMilli(ship);
  const fromBattery = Math.max(0, paidTotal - gen);
  ship.power.battery -= fromBattery;
  const surplus = gen - Math.min(gen, paidTotal);
  const room = ship.power.batteryCapacity - ship.power.battery;
  const recharge = Math.min(room, surplus, ship.power.batteryCapacity);
  ship.power.battery += recharge;

  // If shields were short-paid, shrink facing points from the highest index backward.
  let shieldBudgetPoints = Math.floor(paid.shields / FX);
  if (shieldBudgetPoints < shieldPoints) {
    let over = shieldPoints - shieldBudgetPoints;
    for (let i = 5; i >= 0 && over > 0; i -= 1) {
      const cut = Math.min(facingPoints[i], over);
      facingPoints[i] -= cut;
      over -= cut;
    }
  }

  let weaponBudgetLeft = paid.weapons;
  for (const row of weaponMilli) {
    const give = Math.min(row.milli, weaponBudgetLeft);
    row.milli = give;
    weaponBudgetLeft -= give;
  }

  ship.speed = speed;
  ship.fcPaid = fcOn && paid.fireControl >= fcMilli;
  for (const row of weaponMilli) {
    const mount = ship.weapons.find((w) => w.slotIndex === row.slotIndex);
    if (mount.mode !== row.mode) {
      mount.charge = 0;
      mount.ticksCharging = 0;
    }
    mount.mode = row.mode;
    mount.budget = row.milli;
  }
  const lsUnpaid = lifeOn && paid.lifeSupport < lifeMilli;
  ship.plan = {
    facingPoints,
    ticksLeft: constants.rulesTurnTicks,
    period: constants.rulesTurnTicks,
    lsUnpaid,
    indexBase: 0,
  };

  const short =
    paid.lifeSupport < desired.lifeSupport ||
    paid.fireControl < desired.fireControl ||
    paid.movement < movementMilli ||
    paid.shields < shieldMilli ||
    paid.weapons < weaponTotal;

  // movementMilli was the post-accel desired. A power cut to speed is overDraw.
  const applied = fromMilli(paidTotal);
  const details = {
    unpaid: constants.payOrder.filter((k) => paid[k] < desired[k]),
    speed,
  };
  if (short) return result("clamped", "overDraw", applied, { details });
  if (accelClamp) return result("clamped", "speedClamped", applied, { details });
  if (immobileClamp) return result("clamped", "immobile", applied, { details });
  if (reinforceCapped && uncappedShieldPoints > shieldPoints) {
    return result("clamped", "reinforceCapped", applied, { details });
  }
  if (chargeCapped) return result("clamped", "chargeCapped", applied, { details });
  return result("applied", "ok", applied, { details });
}

function energyStillAccepted(ship, mount, def, mode, constants) {
  if (def.internal === "phaser") {
    const cost = phaserEnergyCost(mount, def);
    if (cost == null) return 0;
    const need = Math.max(0, toMilli(cost) - mount.charge);
    const capRoom = Math.max(0, capacitorMaxMilli(ship, constants) - ship.capacitor);
    return need + capRoom;
  }
  const cost = mode === "overload" ? def.overloadArmCost : def.armCost;
  if (cost == null) return 0;
  return Math.max(0, toMilli(cost) - mount.charge);
}

function capacitorMaxMilli(ship, constants) {
  let sum = 0;
  for (const mount of ship.weapons) {
    const def = weaponDef(mount.weapon);
    if (!def || def.internal !== "phaser") continue;
    const cost = phaserEnergyCost(mount, def);
    if (cost == null) continue;
    sum += toMilli(cost);
  }
  return sum;
}

function applyReinforcementAndCharge(ship, constants) {
  if (!ship.plan || ship.plan.ticksLeft <= 0) return;
  const index = ship.plan.period - ship.plan.ticksLeft;
  for (let i = 0; i < 6; i += 1) {
    const share = tickShare(ship.plan.facingPoints[i], index, ship.plan.period);
    const room = ship.shieldsMax[i] - ship.shields[i];
    ship.shields[i] += Math.min(room, share * FX * constants.reinforcePerEnergy);
  }
  for (const mount of ship.weapons) {
    if (!mount.budget) continue;
    const share = tickShare(mount.budget, index, ship.plan.period);
    const def = weaponDef(mount.weapon);
    if (!def) continue;
    if (share > 0) mount.ticksCharging += 1;
    const cost =
      def.internal === "photon"
        ? mount.mode === "overload"
          ? def.overloadArmCost
          : def.armCost
        : phaserEnergyCost(mount, def);
    if (cost == null) continue;
    const room = Math.max(0, toMilli(cost) - mount.charge);
    const toMount = Math.min(share, room);
    mount.charge += toMount;
    let overflow = share - toMount;
    if (overflow > 0 && def.internal === "phaser") {
      const capRoom = Math.max(0, capacitorMaxMilli(ship, constants) - ship.capacitor);
      const stored = Math.min(overflow, capRoom);
      ship.capacitor += stored;
      overflow -= stored;
    }
  }
  ship.plan.ticksLeft -= 1;
  if (ship.plan.ticksLeft === 0 && ship.plan.lsUnpaid) {
    ship.crew.crewUnits = Math.max(0, ship.crew.crewUnits - constants.crewLossIfLifeSupportUnpaid);
    if (ship.crew.crewUnits < ship.crew.minCrew) ship.disabled = true;
    ship.plan.lsUnpaid = false;
  }
}

function placeChartPoint(ship, startIndex, facing, constants, queues, details) {
  const chart = constants.damageChart;
  for (let k = 0; k < chart.length; k += 1) {
    const row = chart[(startIndex + k) % chart.length];
    if (row === "excess") {
      if ((ship.systems.extraDamage || 0) > 0) {
        ship.systems.extraDamage -= 1;
        return { stop: false };
      }
      ship.destroyed = true;
      return { stop: true };
    }
    const key = row === "hullStruck" ? hullKey(constants, facing) : row;
    const boxes = systemBoxes(ship, key);
    if (boxes == null || boxes <= 0) continue;
    setSystemBoxes(ship, key, boxes - 1);
    maybeWarhead(ship, key, constants, queues, details);
    return { stop: false };
  }
  ship.destroyed = true;
  return { stop: true };
}

function maybeWarhead(ship, key, constants, queues, details) {
  if (!key.startsWith("weapon:")) return;
  const slot = Number(key.slice(7));
  const mount = ship.weapons.find((w) => w.slotIndex === slot);
  if (!mount || mount.mode !== "overload" || mount.charge <= 0 || mount.warheadUsed) return;
  mount.warheadUsed = true;
  let roll;
  if (queues.warheadRolls.length) roll = queues.warheadRolls.shift();
  else roll = 1 + Math.floor(queues.rng() * constants.warheadRollSides);
  details.warheadRolls.push(roll);
  if (roll <= constants.warheadThreshold) {
    queues.extra += constants.warheadExtraPoints;
    details.warhead = true;
    details.extraPoints += constants.warheadExtraPoints;
  }
}

function runInternalDamage(ship, system, boxes, facing, constants, queues) {
  const details = { draws: [], warhead: false, extraPoints: 0, warheadRolls: [] };
  if (system !== "any" && !hasSystem(ship, system)) {
    return result("rejected", "noSuchSystem", null, { location: { field: system } });
  }
  let requestedLeft = boxes;
  let consumed = 0;
  const armor = ship.systems.armor || 0;
  const absorb = Math.min(armor, requestedLeft);
  if (absorb) {
    ship.systems.armor = armor - absorb;
    requestedLeft -= absorb;
    consumed += absorb;
  }
  if (system !== "any") {
    while (requestedLeft > 0 && !ship.destroyed && (systemBoxes(ship, system) || 0) > 0) {
      setSystemBoxes(ship, system, systemBoxes(ship, system) - 1);
      maybeWarhead(ship, system, constants, queues, details);
      requestedLeft -= 1;
      consumed += 1;
    }
  }
  while ((requestedLeft > 0 || queues.extra > 0) && !ship.destroyed) {
    const fromRequest = requestedLeft > 0;
    if (fromRequest) requestedLeft -= 1;
    else queues.extra -= 1;
    let draw;
    if (queues.draws.length) draw = queues.draws.shift();
    else draw = Math.floor(queues.rng() * constants.damageChart.length);
    details.draws.push(draw);
    const placed = placeChartPoint(ship, draw, facing, constants, queues, details);
    if (fromRequest) consumed += 1;
    if (placed.stop) break;
  }
  if (requestedLeft > 0) return result("clamped", "excessDamage", consumed, { details });
  return result("applied", "ok", consumed, { details });
}

function applyHit(target, facing, damagePoints, constants, queues) {
  const milli = toMilli(damagePoints);
  const absorbed = Math.min(target.shields[facing], milli);
  target.shields[facing] -= absorbed;
  const penMilli = milli - absorbed;
  const penPoints = Math.floor(penMilli / (constants.chartPointSize * FX));
  target.lastHit = {
    facing,
    damage: damagePoints,
    shieldAbsorbed: fromMilli(absorbed),
    penetrating: penPoints,
  };
  if (penPoints > 0) runInternalDamage(target, "any", penPoints, facing, constants, queues);
  return target.lastHit;
}

function relativeBearing(attacker, target) {
  const abs = bearing16(attacker.x - target.x, attacker.y - target.y);
  return mod16(abs - target.heading16);
}

function shotBearingFromAttacker(attacker, target) {
  return mod16(bearing16(target.x - attacker.x, target.y - attacker.y) - attacker.heading16);
}

function commandSetShields(world, cmd) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  const ship = found.ship;
  const snap = clone(ship);
  if (!Number.isInteger(cmd.facing) || cmd.facing < 0 || cmd.facing > 5) {
    return result("rejected", "badFacing", null);
  }
  const parsed = requireMilli(cmd.value);
  if (parsed.error) return result("rejected", parsed.error, null);
  if (parsed.milli < 0) return result("rejected", "negativeValue", null);
  if (parsed.milli > ship.shieldsMax[cmd.facing]) {
    ship.shields[cmd.facing] = ship.shieldsMax[cmd.facing];
    return result("clamped", "shieldAboveMax", fromMilli(ship.shieldsMax[cmd.facing]));
  }
  ship.shields[cmd.facing] = parsed.milli;
  void snap;
  return result("applied", "ok", fromMilli(parsed.milli));
}

function commandDamageShield(world, cmd) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  const ship = found.ship;
  if (!Number.isInteger(cmd.facing) || cmd.facing < 0 || cmd.facing > 5) {
    return result("rejected", "badFacing", null);
  }
  const parsed = requireMilli(cmd.points);
  if (parsed.error) return result("rejected", parsed.error, null);
  if (parsed.milli < 0) return result("rejected", "negativeValue", null);
  const removed = Math.min(ship.shields[cmd.facing], parsed.milli);
  ship.shields[cmd.facing] -= removed;
  if (removed < parsed.milli) return result("clamped", "shieldDepleted", fromMilli(removed));
  return result("applied", "ok", fromMilli(removed));
}

function commandRepair(world, cmd) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  const ship = found.ship;
  if (!Number.isInteger(cmd.boxes)) return result("rejected", "nonIntegerBoxes", null);
  if (cmd.boxes < 0) return result("rejected", "negativeValue", null);
  if (!hasSystem(ship, cmd.system)) {
    return result("rejected", "noSuchSystem", null, { location: { field: cmd.system } });
  }
  if (cmd.boxes === 0) return result("applied", "ok", 0);
  const max = cmd.system.startsWith("weapon:")
    ? ship.weapons.find((w) => w.slotIndex === Number(cmd.system.slice(7))).boxesMax
    : ship.systemsMax[cmd.system];
  const missing = max - systemBoxes(ship, cmd.system);
  if (missing <= 0) return result("clamped", "nothingToRepair", 0);
  const restored = Math.min(cmd.boxes, missing);
  setSystemBoxes(ship, cmd.system, systemBoxes(ship, cmd.system) + restored);
  if (restored < cmd.boxes) return result("clamped", "repairCapped", restored);
  return result("applied", "ok", restored);
}

function commandDamageSystem(world, cmd, constants, rng) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  const ship = found.ship;
  if (!Number.isInteger(cmd.boxes)) return result("rejected", "nonIntegerBoxes", null);
  if (cmd.boxes < 0) return result("rejected", "negativeValue", null);
  if (cmd.boxes === 0) return result("applied", "ok", 0);
  const queues = {
    draws: [...(cmd.scriptedDraws || [])],
    warheadRolls: [...(cmd.warheadRolls || [])],
    extra: 0,
    rng,
  };
  for (const mount of ship.weapons) mount.warheadUsed = false;
  return runInternalDamage(ship, cmd.system, cmd.boxes, cmd.facing ?? 0, constants, queues);
}

function commandSetEnergy(world, cmd, constants) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  return settleAllocation(found.ship, cmd.allocation || {}, constants);
}

function commandHelm(world, cmd) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  const ship = found.ship;
  if (ship.disabled) return result("rejected", "crewDisabled", null);
  const turn = turnDef(ship.turnMode);
  const yaw = cmd.yaw16 ?? 0;
  if (!Number.isInteger(yaw)) return result("rejected", "precisionExceeded", null);
  if (turn.immobile) {
    if (yaw !== 0) return result("clamped", "immobile", 0);
    return result("applied", "ok", 0);
  }
  const limit = turn.maxYawPerTick;
  const sign = yaw < 0 ? -1 : 1;
  const mag = Math.abs(yaw);
  if (mag > limit) {
    ship.heading16 = mod16(ship.heading16 + sign * limit);
    return result("clamped", "yawClamped", limit, { details: { signedYaw: sign * limit } });
  }
  ship.heading16 = mod16(ship.heading16 + yaw);
  return result("applied", "ok", mag);
}


function commandHet(world, cmd) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  const ship = found.ship;
  if (ship.disabled) return result("rejected", "crewDisabled", null);
  const turn = turnDef(ship.turnMode);
  const delta = cmd.delta16 ?? HET.defaultTurnAngle16;
  if (!Number.isInteger(delta)) return result("rejected", "precisionExceeded", null);
  if (delta === 0) return result("rejected", "negativeValue", null);
  if (turn.immobile) return result("clamped", "immobile", 0);
  if (ship.het.mode === "het") return result("rejected", "hetActive", null);
  if (ship.speed > HET.maxSpeed) return result("rejected", "hetTooFast", null);
  ship.het = { mode: "het", remainingTurn16: delta, hetDelayTicksLeft: HET.delayTicks };
  return result("applied", "ok", delta);
}

function stepHet(world) {
  for (const ship of Object.values(world.ships)) {
    if (ship.het.mode !== "het") continue;
    if (ship.destroyed || ship.disabled) {
      ship.het = { mode: "none", remainingTurn16: 0, hetDelayTicksLeft: 0 };
      continue;
    }
    if (ship.het.hetDelayTicksLeft > 0) {
      ship.het.hetDelayTicksLeft -= 1;
      continue;
    }
    const rem = ship.het.remainingTurn16;
    if (rem === 0) {
      ship.het.mode = "none";
      continue;
    }
    const mag = Math.abs(rem);
    const stepMag = Math.min(mag, HET.turnRate16PerTick);
    const step = rem < 0 ? -stepMag : stepMag;
    ship.heading16 = mod16(ship.heading16 + step);
    ship.het.remainingTurn16 -= step;
    if (ship.het.remainingTurn16 === 0) ship.het.mode = "none";
  }
}

function commandFire(world, cmd, constants, rng) {
  const found = identity(world, cmd.ship);
  if (found.error) return found.error;
  const ship = found.ship;
  if (ship.disabled) return result("rejected", "crewDisabled", null);
  const mount = ship.weapons.find((w) => w.slotIndex === cmd.slotIndex);
  if (!mount) return result("rejected", "unknownWeaponSlot", null, { details: { slotIndex: cmd.slotIndex } });
  const def = weaponDef(mount.weapon);
  if (!def || (def.internal !== "phaser" && def.internal !== "photon")) {
    return result("rejected", "notInDuelSlice", null);
  }
  if (mount.boxes <= 0) return result("rejected", "weaponDestroyed", null);
  if (!mountReady(mount)) return result("rejected", "notCharged", null);
  if (!ship.fcPaid) return result("rejected", "noFireControl", null);
  const target = world.ships[cmd.target];
  if (!target) return result("rejected", "noSuchShip", null);
  if (target.destroyed) return result("rejected", "shipDestroyed", null);
  const rel = shotBearingFromAttacker(ship, target);
  const arc = arcDef(mount.arc);
  if (!inArc(rel, arc)) return result("rejected", "outOfArc", null, { details: { rel } });
  const range = rangeBetween(ship, target);
  if (def.internal === "phaser") {
    const band = def.rangeBands.find((b) => range <= b.maxRange);
    if (!band) return result("rejected", "outOfRange", null, { details: { range } });
    mount.charge = 0;
    mount.ticksCharging = 0;
    const queues = {
      draws: [...(cmd.scriptedDraws || [])],
      warheadRolls: [...(cmd.warheadRolls || [])],
      extra: 0,
      rng,
    };
    const hitFacing = facingForRelative(relativeBearing(ship, target));
    const hit = applyHit(target, hitFacing, band.damage, constants, queues);
    return result("applied", "ok", band.damage, { details: { ...hit, range } });
  }
  if (def.maxRange != null && range > def.maxRange) return result("rejected", "outOfRange", null);
  const damage =
    mount.mode === "overload" ? def.overloadDamage : mount.mode === "proximity" ? def.proxDamage : def.directDamage;
  mount.charge = 0;
  mount.ticksCharging = 0;
  ship.projectiles.push({
    target: cmd.target,
    remaining: toMilli(range),
    speed: toMilli(def.projectileSpeed),
    mode: mount.mode,
    damage,
    proxRadius: toMilli(def.proxRadius),
    alive: true,
    scriptedDraws: [...(cmd.scriptedDraws || [])],
    warheadRolls: [...(cmd.warheadRolls || [])],
  });
  return result("applied", "ok", damage, { details: { launched: true, mode: mount.mode } });
}

function flyProjectiles(world, constants, rng) {
  for (const ship of Object.values(world.ships)) {
    for (const shot of ship.projectiles) {
      if (!shot.alive) continue;
      shot.remaining -= shot.speed;
      const prox = shot.mode === "proximity" && shot.remaining <= shot.proxRadius;
      const direct = shot.mode !== "proximity" && shot.remaining <= 0;
      if (!prox && !direct) continue;
      shot.alive = false;
      const target = world.ships[shot.target];
      if (!target || target.destroyed) continue;
      const hitFacing = facingForRelative(relativeBearing(ship, target));
      const queues = {
        draws: shot.scriptedDraws,
        warheadRolls: shot.warheadRolls,
        extra: 0,
        rng,
      };
      applyHit(target, hitFacing, shot.damage, constants, queues);
    }
  }
}

function dispatch(world, cmd, constants, rng) {
  switch (cmd.entry) {
    case "setShields":
      return commandSetShields(world, cmd);
    case "damageShield":
      return commandDamageShield(world, cmd);
    case "repairSystem":
      return commandRepair(world, cmd);
    case "damageSystem":
      return commandDamageSystem(world, cmd, constants, rng);
    case "setEnergy":
      return commandSetEnergy(world, cmd, constants);
    case "orderHelm":
      return commandHelm(world, cmd);
    case "orderHet":
      return commandHet(world, cmd);
    case "fire":
      return commandFire(world, cmd, constants, rng);
    default:
      throw new Error(`unknown entry ${cmd.entry}`);
  }
}

function buildWorld(test) {
  const world = { ships: {} };
  for (const spec of test.ships || []) {
    const ship = loadShip(spec);
    world.ships[ship.spawnKey] = ship;
  }
  return world;
}

function subset(actual, expected, pathName, file) {
  if (expected === null || typeof expected !== "object") {
    if (actual !== expected) {
      fail(file, `${pathName}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
    }
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      fail(
        file,
        `${pathName}: expected array length ${expected.length} got ${Array.isArray(actual) ? actual.length : typeof actual}`,
      );
      return;
    }
    expected.forEach((item, i) => subset(actual[i], item, `${pathName}[${i}]`, file));
    return;
  }
  if (actual == null || typeof actual !== "object") {
    fail(file, `${pathName}: expected object got ${JSON.stringify(actual)}`);
    return;
  }
  for (const key of Object.keys(expected)) {
    subset(actual[key], expected[key], `${pathName}.${key}`, file);
  }
}

function applyScale(raw) {
  const factor = Object.fromEntries(SCALE.factors.map((row) => [row.source, row.factor]));
  const shieldFactor = factor.shieldFileValue;
  const cells = {
    front: raw.shieldFront,
    forwardSide: raw.shieldForwardSide,
    aftSide: raw.shieldAftSide,
    rear: raw.shieldRear,
  };
  const shields = SCALE.shieldFanOut.map((name) => cells[name] * shieldFactor);
  const warp = raw.warpSide * factor.warpSide + raw.warpCenter * factor.warpCenter;
  return {
    shields,
    power: {
      warp,
      impulse: raw.impulse * factor.impulse,
      apr: raw.apr * factor.apr,
      battery: raw.battery * factor.battery,
      batteryCapacity: raw.battery * factor.battery,
    },
    movement: { moveCost: raw.moveCost * factor.default },
  };
}

function interpretArc(def, arc) {
  const text = arc == null || arc === "" ? null : String(arc);
  const numeric = text != null && /^[0-9]+$/.test(text);
  if (def && def.reloadCounted === true) {
    if (numeric) return { arc: null, reloads: Number(text), unknown: false };
    return { arc: text, reloads: null, unknown: true };
  }
  if (text == null) return { arc: null, reloads: null, unknown: false };
  if (numeric) return { arc: text, reloads: null, unknown: true };
  if (!arcDef(text)) return { arc: text, reloads: null, unknown: true };
  return { arc: text, reloads: null, unknown: false };
}

function loadDiagnostics(shipSpec) {
  const diags = [];
  for (const w of shipSpec.weapons || []) {
    if (w.weapon == null) continue;
    const def = weaponDef(w.weapon);
    if (!def) {
      diags.push({
        code: "unknownWeapon",
        source: "loader",
        severity: "warning",
        details: { weapon: w.weapon, slotIndex: w.slotIndex, spawnKey: shipSpec.spawnKey },
      });
    }
    const interp = interpretArc(def, w.arc);
    if (interp.unknown) {
      diags.push({
        code: "unknownArc",
        source: "loader",
        severity: "warning",
        details: { arc: interp.arc, slotIndex: w.slotIndex, spawnKey: shipSpec.spawnKey },
      });
    }
  }
  return diags;
}

function runPure(test, file) {
  const actual = [];
  for (const step of test.cases) {
    if (step.op === "facing") {
      actual.push({ op: "facing", rel: step.rel, facing: facingForRelative(step.rel) });
    } else if (step.op === "inArc") {
      actual.push({
        op: "inArc",
        arc: step.arc,
        rel: step.rel,
        inside: inArc(step.rel, arcDef(step.arc)),
      });
    } else {
      fail(file, `unknown pure op ${step.op}`);
    }
  }
  subset(actual, test.expect, "expect", file);
}

function runScale(test, file) {
  subset(applyScale(test.raw), test.expect, "expect", file);
}

function runLoad(test, file) {
  const diags = [];
  const mapped = [];
  for (const spec of test.ships) {
    if (!spec.className.startsWith("test-")) fail(file, `className ${spec.className} must start with test-`);
    diags.push(...loadDiagnostics(spec));
    for (const w of spec.weapons || []) {
      const def = weaponDef(w.weapon);
      if (!def) continue;
      const interp = interpretArc(def, w.arc);
      mapped.push({
        slotIndex: w.slotIndex,
        weapon: w.weapon,
        internal: def.internal,
        weaponId: def.weaponId ?? null,
        arc: interp.arc,
        reloads: def.reloadCounted === true ? interp.reloads : (interp.reloads ?? w.reloads ?? null),
      });
    }
  }
  subset({ diagnostics: diags, mapped }, test.expect, "expect", file);
}

function runResolve(test, file) {
  const constants = mergeConstants(test.constants);
  const world = buildWorld(test);
  const rng = makeStream(test.seed ?? 1, "combat");
  const results = [];
  let token = 1;
  for (const cmd of test.commands) {
    const out = dispatch(world, cmd, constants, rng);
    results.push({ token, ...out });
    token += 1;
  }
  subset(results, test.expect.results, "results", file);
  if (test.expect.state) {
    const state = {};
    for (const [key, ship] of Object.entries(world.ships)) state[key] = exportShip(ship);
    subset(state, test.expect.state, "state", file);
  }
}

function runTicks(test, file) {
  const constants = mergeConstants(test.constants);
  const world = buildWorld(test);
  const rng = makeStream(test.seed ?? 1, "combat");
  const byTick = new Map();
  for (const row of test.timeline || []) {
    byTick.set(row.tick, row.commands || []);
  }
  const results = [];
  let token = 1;
  const last = test.endTick;
  for (let tick = 0; tick <= last; tick += 1) {
    for (const cmd of byTick.get(tick) || []) {
      const out = dispatch(world, cmd, constants, rng);
      results.push({ tick, token, ...out });
      token += 1;
    }
    for (const ship of Object.values(world.ships)) applyReinforcementAndCharge(ship, constants);
    flyProjectiles(world, constants, rng);
    stepHet(world);
  }
  subset(results, test.expect.results, "results", file);
  if (test.expect.state) {
    const state = {};
    for (const [key, ship] of Object.entries(world.ships)) state[key] = exportShip(ship);
    subset(state, test.expect.state, "state", file);
  }
}

function checkReasonDocs() {
  const md = fs.readFileSync(path.join(root, "docs/rules/reason-codes.md"), "utf8");
  if (!md.includes("docs/engine/diagnostics.md")) {
    fail("docs/rules/reason-codes.md", "must point at docs/engine/diagnostics.md");
  }
  for (const code of REASONS.codes) {
    if (!md.includes(`\`${code.code}\``)) {
      fail("docs/rules/reason-codes.md", `missing code ${code.code}`);
    }
  }
  const fidelity = fs.readFileSync(path.join(root, "docs/rules/fidelity-risk.md"), "utf8");
  if (!fidelity.includes("#34") || !fidelity.includes("#37")) {
    fail("docs/rules/fidelity-risk.md", "must cite issues #34 and #37");
  }
}

function checkMappingShape() {
  const shiplistCodes = [
    "ADD12", "ADD6", "Dis1", "Dis2", "Dis3", "Dis4",
    "DroA", "DroB", "DroC", "DroF", "DroG",
    "ESG", "Fus", "HB", "PPD", "Phot",
    "Ph1", "Ph2", "Ph3", "Ph4", "PhG",
    "PlaD", "PlaF", "PlaG", "PlaI", "PlaR", "PlaS",
    "PLaF", "PLaG", "PLaR", "PLaS",
  ];
  const fighterOnly = ["DisF", "DroI", "DroVI", "FusF", "HellF", "PhoF"];
  const letterArcs = [
    "ALL", "FA", "FAL", "FAR", "FH", "FHL", "FHR", "FLL", "FLLX", "FRR", "FRRX", "FX",
    "LLR", "LP", "LS", "LW", "RA", "RAL", "RAR", "RH", "RP", "RRR", "RS", "RW", "RX",
  ];
  const gotShip = Object.keys(WEAPONS.ship.weapons).filter((code) => !code.startsWith("TEST-")).sort();
  if (gotShip.join(",") !== [...shiplistCodes].sort().join(",")) {
    fail("docs/rules/data/weapon-arcs.json", `shiplist weapon codes changed: ${gotShip.join(", ")}`);
  }
  const gotFighter = Object.keys(WEAPONS.fighter.weapons).sort();
  if (gotFighter.join(",") !== fighterOnly.join(",")) {
    fail("docs/rules/data/weapon-arcs.json", `fighter-only weapon codes changed: ${gotFighter.join(", ")}`);
  }
  const pla = Object.keys(WEAPONS.ship.weapons).filter((code) => /pla/i.test(code)).sort();
  const plaExpected = ["PLaF", "PLaG", "PLaR", "PLaS", "PlaD", "PlaF", "PlaG", "PlaI", "PlaR", "PlaS"];
  if (pla.join(",") !== plaExpected.join(",")) {
    fail("docs/rules/data/weapon-arcs.json", `Pla spellings changed: ${pla.join(", ")}`);
  }
  const aliases = [["PlaF", "PLaF"], ["PlaG", "PLaG"], ["PlaR", "PLaR"], ["PlaS", "PLaS"]];
  for (const [canon, alt] of aliases) {
    const a = WEAPONS.ship.weapons[canon];
    const b = WEAPONS.ship.weapons[alt];
    if (!a || !b || a.weaponId !== b.weaponId || a.internal !== "plasma") {
      fail("docs/rules/data/weapon-arcs.json", `${alt} must point at the same plasma weapon as ${canon}`);
    }
  }
  for (const code of ["DroA", "DroB", "DroC", "DroF", "DroG", "ADD6", "ADD12", "TEST-DRN"]) {
    const def = weaponDef(code);
    if (!def || def.reloadCounted !== true) {
      fail("docs/rules/data/weapon-arcs.json", `${code} must be reloadCounted`);
    }
  }
  for (const code of ["DroI", "DroVI"]) {
    const def = weaponDef(code);
    if (!def || def.reloadCounted === true) {
      fail("docs/rules/data/weapon-arcs.json", `${code} is a fighter drone with a letter arc, not reloadCounted`);
    }
  }
  for (const code of letterArcs) {
    const def = WEAPONS.ship.arcs[code];
    if (!def || def.verification !== "to-verify") {
      fail("docs/rules/data/weapon-arcs.json", `${code} facing definition must stay to-verify`);
    }
    if (!def.full && !(def.spans && def.spans.length)) {
      fail("docs/rules/data/weapon-arcs.json", `${code} needs a uint16 span`);
    }
  }
  if (WEAPONS.reloadCountTokens.join(",") !== "1,2,3") {
    fail("docs/rules/data/weapon-arcs.json", "reload-count tokens must stay 1, 2, 3");
  }
  if (CONSTANTS.longestWeaponRange != null || CONSTANTS.photonMaxRange != null) {
    fail("docs/rules/data/constants.json", "a longest weapon range is a fixture probe, not a constant");
  }
}

function runBounds(test, file) {
  const limit = CONSTANTS.mapBound;
  if (limit !== 8192) fail(file, "map bound must be 8192 range units");
  if (test.provisionalLongestWeaponRange !== 75) {
    fail(file, "the 75-unit probe belongs in the fixture, marked to-verify");
  }
  if (test.verification !== "to-verify") fail(file, "the range probe must stay to-verify");
  for (const pair of test.positions || []) {
    const [x, y] = pair;
    if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > limit || Math.abs(y) > limit) {
      fail(file, `position ${x},${y} is outside ±${limit}`);
    }
  }
  subset({ positionMath: "i64", mapBound: limit }, test.expect, "expect", file);
}

function main() {
  checkMappingShape();
  checkReasonDocs();
  const dir = path.join(root, "docs/rules/tests");
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json") && name !== "schema.json")
    .sort();
  const allow = fs.readFileSync(path.join(root, "tools/allowed-fixtures.txt"), "utf8");
  for (const name of names) {
    const rel = `docs/rules/tests/${name}`;
    if (!allow.split("\n").some((line) => line.trim() === rel)) {
      fail(rel, "not listed in tools/allowed-fixtures.txt");
    }
    let test;
    try {
      test = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    } catch (err) {
      fail(rel, `invalid JSON: ${err.message}`);
      continue;
    }
    if (!test.id || !test.mode) {
      fail(rel, "id and mode are required");
      continue;
    }
    try {
      if (test.mode === "pure") runPure(test, rel);
      else if (test.mode === "scale") runScale(test, rel);
      else if (test.mode === "load") runLoad(test, rel);
      else if (test.mode === "resolve") runResolve(test, rel);
      else if (test.mode === "ticks") runTicks(test, rel);
      else if (test.mode === "bounds") runBounds(test, rel);
      else fail(rel, `unknown mode ${test.mode}`);
    } catch (err) {
      fail(rel, err.stack || err.message);
    }
  }
  if (failures.length) {
    console.error(`FAILED ${failures.length} check(s):`);
    for (const line of failures) console.error(`- ${line}`);
    process.exit(1);
  }
  console.log(`OK: ${names.length} rules fixture(s) matched the Phase 2 duel slice.`);
}

main();
