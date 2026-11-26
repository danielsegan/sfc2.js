/**
 * Duel-slice tables. Weapon and arc rows are the JSON key order of
 * docs/rules/data/weapon-arcs.json, which this module reads directly.
 * Numeric costs stay integer rule-points. A phaser or photon row with no
 * cost of its own takes costFallback. Every other empty cost row stays 0.
 */
import constants from '../../docs/rules/data/constants.json' with { type: 'json' };
import measured from '../../docs/rules/data/measured.json' with { type: 'json' };
import turns from '../../docs/rules/data/turn-modes.json' with { type: 'json' };
import table from '../../docs/rules/data/weapon-arcs.json' with { type: 'json' };

/** One rule point, stored as hundredths so a two-decimal move cost stays exact. */
export const ENERGY_SCALE = 100;

export const CLASS_SHIP = 1;
export const CLASS_PF = 2;
export const CLASS_FIGHTER = 3;

export const TURN_TEST_A = 1;
export const TURN_TEST_C = 2;
export const TURN_H = 3;
export const TURN_UNVERIFIED = 4;

/**
 * Yaw cap for a letter that has no measured rate.
 * Read from turn-modes.json. It is not a measured Community Edition rate.
 */
export const FALLBACK_YAW_PER_TICK = requireYaw(turns.fallbackMaxYawPerTick, 'fallback yaw');

/** Stable ids for AA and A–G so a measured value does not renumber the others. */
const MEASURED_TURN_ID: Readonly<Record<string, number>> = {
  AA: 5,
  A: 6,
  B: 7,
  C: 8,
  D: 9,
  E: 10,
  F: 11,
  G: 12,
};

function requireYaw(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(name);
  return value;
}

const MEASURED_LETTERS = ['AA', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

function measuredYawTable(raw: Readonly<Record<string, number>>): Map<number, number> {
  const out = new Map<number, number>();
  for (const letter of MEASURED_LETTERS) {
    if (!Object.prototype.hasOwnProperty.call(raw, letter)) continue;
    out.set(MEASURED_TURN_ID[letter], requireYaw(raw[letter] ?? -1, `measured turn ${letter}`));
  }
  return out;
}

const FILE_MEASURED_YAW = measuredYawTable(measured.turnYaw.measuredMaxYawPerTick);

function syntheticYaw(letter: 'TEST-A' | 'TEST-C' | 'H'): number {
  return requireYaw(turns.modes[letter].maxYawPerTick, letter);
}

export const INTERNAL_PHASER = 1;
export const INTERNAL_PHOTON = 2;
export const INTERNAL_DRONE = 3;
export const INTERNAL_OTHER = 4;
export const INTERNAL_DISRUPTOR = 5;
export const INTERNAL_PLASMA = 6;

export const MODE_NORMAL = 0;
export const MODE_OVERLOAD = 1;
export const MODE_PROXIMITY = 2;
/** Mount is powered down. It does not charge or fire. */
export const MODE_OFFLINE = 3;
/** Payload sentinel: keep the mount's current mode. */
export const MODE_KEEP = -1;

export const TICK_HZ = 30;

function tableInt(value: number | undefined, name: string, min: number, max: number): number {
  if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(name);
  return value;
}

/**
 * Length of one rules-turn, in seconds. The only copy of that length:
 * `docs/rules/data/constants.json` `rulesTurnSeconds`. 33 × 30 Hz = 990 ticks.
 * A photon's arming gate is two of these turns. A disruptor's is one.
 */
export const RULES_TURN_SECONDS = tableInt(constants.rulesTurnSeconds, 'rulesTurnSeconds', 1, 10000);
export const DEFAULT_RULES_TURN_TICKS = TICK_HZ * RULES_TURN_SECONDS;

/** Life support and fire control, in energy hundredths. 150 + 100 = 2.5 points. */
export const DEFAULT_LIFE_HUNDREDTHS = tableInt(
  constants.lifeSupportCostHundredths,
  'lifeSupportCostHundredths',
  0,
  100000,
);
export const DEFAULT_FC_HUNDREDTHS = tableInt(
  constants.fireControlCostHundredths,
  'fireControlCostHundredths',
  0,
  100000,
);

/** Synthetic EW, cloak, and tractor numbers. See docs/rules/phase3-systems.md. */
export const EW_HIT_DENOM = tableInt(constants.ewHitDenom, 'ewHitDenom', 1, 1000000);
export const EW_PENALTY_PER_POINT = tableInt(constants.ewPenaltyPerPoint, 'ewPenaltyPerPoint', 1, EW_HIT_DENOM);
export const EW_HIT_FLOOR = tableInt(constants.ewHitFloor, 'ewHitFloor', 0, EW_HIT_DENOM);
export const CLOAK_TICKS = tableInt(constants.cloakTicks, 'cloakTicks', 1, 100000);
export const CLOAK_BASE_DETECT = tableInt(constants.cloakBaseDetect, 'cloakBaseDetect', 0, 32767);
export const CLOAK_SCAN_PER_BOX = tableInt(constants.cloakScanPerBox, 'cloakScanPerBox', 0, 32767);
export const SPECIAL_SENSOR_CHANCE_PER_BOX = tableInt(
  constants.specialSensorChancePerBox,
  'specialSensorChancePerBox',
  0,
  EW_HIT_DENOM,
);
export const TRACTOR_RANGE = tableInt(constants.tractorRange, 'tractorRange', 0, 32767);
export const TRACTOR_SELF_SLOW = tableInt(constants.tractorSelfSlow, 'tractorSelfSlow', 0, 32);
export const TRACTOR_PULL_PER_POINT = tableInt(constants.tractorPullPerPoint, 'tractorPullPerPoint', 0, 32);
export const DEFAULT_REINFORCE_PER_ENERGY = 1;
export const DEFAULT_REINFORCE_CAP = 100;
export const DEFAULT_CREW_LOSS = 1;

/** Chart row codes. 0 is unused so a zeroed field is not a row. */
export const ROW_BRIDGE = 1;
export const ROW_HULL = 2;
export const ROW_SENSORS = 3;
export const ROW_EXCESS = 4;

const HULL_SECTION_NAMES = [
  'hullForward',
  'hullForward',
  'hullCenter',
  'hullAft',
  'hullCenter',
  'hullForward',
] as const;

function buildChart(): readonly number[] {
  const names = constants.damageChart;
  if (names.length < 1) throw new Error('damage chart');
  const out: number[] = [];
  for (const name of names) {
    if (name === 'bridge') out.push(ROW_BRIDGE);
    else if (name === 'hullStruck') out.push(ROW_HULL);
    else if (name === 'sensors') out.push(ROW_SENSORS);
    else if (name === 'excess') out.push(ROW_EXCESS);
    else throw new Error('damage chart row');
  }
  return out;
}

function chartPointSize(): number {
  const size = constants.chartPointSize;
  if (!Number.isInteger(size) || size <= 0) throw new Error('chart point size');
  return size;
}

export const DAMAGE_CHART: readonly number[] = buildChart();
export const CHART_POINT_SIZE = chartPointSize();

const FACING_KEYS = ['0', '1', '2', '3', '4', '5'] as const;

function assertHullMap(): void {
  const map = constants.hullStruckByFacing;
  for (let i = 0; i < FACING_KEYS.length; i++) {
    if (map[FACING_KEYS[i]!] !== HULL_SECTION_NAMES[i]) throw new Error('hull section map');
  }
}

assertHullMap();

const SHIP_WEAPON_CODES = [
  'TEST-PH', 'TEST-PHOT', 'TEST-DRN', 'Phot',
  'Dis1', 'Dis2', 'Dis3', 'Dis4',
  'PlaD', 'PlaF', 'PlaG', 'PlaI', 'PlaR', 'PlaS',
  'PLaF', 'PLaG', 'PLaR', 'PLaS',
  'DroA', 'DroB', 'DroC', 'DroF', 'DroG',
  'ESG', 'Fus', 'HB', 'PPD', 'ADD6', 'ADD12',
  'Ph1', 'Ph2', 'Ph3', 'Ph4', 'PhG',
] as const;

const FIGHTER_WEAPON_CODES = ['DisF', 'DroI', 'DroVI', 'FusF', 'HellF', 'PhoF'] as const;

export const WEAPON_CODES: readonly string[] = [...SHIP_WEAPON_CODES, ...FIGHTER_WEAPON_CODES];

export const ARC_CODES: readonly string[] = [
  'TEST-FA', 'TEST-ALL', 'TEST-STBD', 'TEST-PORT',
  'ALL', 'FH', 'FA', 'FX', 'FAL', 'FAR', 'FLL', 'FRR',
  'FHL', 'FHR', 'FLLX', 'FRRX', 'RH', 'RA', 'RX',
  'RAL', 'RAR', 'LS', 'RS', 'LP', 'RP', 'LW', 'RW', 'LLR', 'RRR',
];

interface BandJson {
  maxRange?: number;
  damage?: number;
  damageMin?: number;
  damageMax?: number;
  damageHundredths?: number;
  /** Inclusive hit chance as an integer fraction. 1/1 does not draw. */
  hitNum?: number;
  hitDen?: number;
}

interface WeaponJson {
  internal?: string;
  chargeCost?: number;
  holdCost?: number;
  armCost?: number;
  armTicks?: number;
  /** Arming gate as a count of rules-turns. Wins over `armTicks` and uses `RULES_TURN_SECONDS`. */
  armTurns?: number;
  armPerTurn?: number;
  overloadArmCost?: number;
  overloadArmTicks?: number;
  /** Overload arming gate as a count of rules-turns. */
  overloadArmTurns?: number;
  overloadArmPerTurn?: number;
  directDamage?: number;
  overloadDamage?: number;
  proxRadius?: number;
  proxDamage?: number;
  projectileSpeed?: number;
  /** Ticks the bolt lives after launch. 0 means this row does not fly. */
  flightTicks?: number;
  maxRange?: number;
  rangeBands?: readonly BandJson[];
  overloadRangeBands?: readonly BandJson[];
  reloadCounted?: boolean;
  omnidirectional?: boolean;
}

interface ArcJson {
  full?: boolean;
  spans?: readonly { from16?: number; to16?: number }[];
}

export interface RangeBand {
  readonly maxRange: number;
  /** Fixed damage when `roll` is 0. Hundredths of a point when `hundredths` is 1. */
  readonly damage: number;
  readonly min: number;
  readonly max: number;
  /** 1 = draw min..max on the combat stream. */
  readonly roll: number;
  /** 1 = `damage` / `min` / `max` are hundredths of a point. */
  readonly hundredths: number;
  /** Hit chance numerator. A value at least `hitDen` does not draw. */
  readonly hitNum: number;
  readonly hitDen: number;
}

export interface WeaponDef {
  readonly code: string;
  readonly internal: number;
  readonly chargeCost: number;
  readonly holdCost: number;
  readonly armCost: number;
  readonly armTicks: number;
  /** Energy accepted toward arming in one rules-turn. 0 means the whole remaining arm cost. */
  readonly armPerTurn: number;
  readonly overloadArmCost: number;
  readonly overloadArmTicks: number;
  readonly overloadArmPerTurn: number;
  readonly directDamage: number;
  readonly overloadDamage: number;
  readonly proxDamage: number;
  readonly proxRadius: number;
  readonly projectileSpeed: number;
  /** Ticks of flight. 0 means the weapon does not fly a decaying bolt. */
  readonly flightTicks: number;
  readonly maxRange: number;
  readonly bands: readonly RangeBand[];
  readonly overloadBands: readonly RangeBand[];
  readonly omni: number;
}

/** Measured normal disruptor cutoff. 31.0k is in range. One range unit past it is not. */
export const DISRUPTOR_MAX_RANGE = 31000;

/** Overload disruptor cutoff. Past this the overload shot does nothing. */
export const DISRUPTOR_OVERLOAD_MAX_RANGE = 9000;

/** Photon cutoff. The earlier reading puts it somewhere in 26–30k. */
export const PHOTON_MAX_RANGE = 30000;
/** Phaser-1 cutoff from the Gorn curve. Damage is 0 by 26.4k. */
export const PHASER1_MAX_RANGE = 26400;
/** Phaser-3 cutoff from the ISC reading. */
export const PHASER3_MAX_RANGE = 4200;

export interface ArcDef {
  readonly code: string;
  readonly full: number;
  readonly from16: number;
  readonly to16: number;
}

function internalId(name: string | undefined): number {
  if (name === 'phaser') return INTERNAL_PHASER;
  if (name === 'photon') return INTERNAL_PHOTON;
  if (name === 'drone') return INTERNAL_DRONE;
  if (name === 'disruptor') return INTERNAL_DISRUPTOR;
  if (name === 'plasma') return INTERNAL_PLASMA;
  return INTERNAL_OTHER;
}

function num(value: number | undefined): number {
  return value ?? 0;
}

/**
 * Tick gate for arming. `armTurns` / `overloadArmTurns` multiply the single
 * rules-turn length. A row may also name raw `armTicks` for a short fixture.
 * Naming both is an error so the length cannot fork.
 */
function armTickCount(
  turns: number | undefined,
  ticks: number | undefined,
  name: string,
): number {
  if (turns !== undefined) {
    if (ticks !== undefined) throw new Error(`${name} names both turns and ticks`);
    if (!Number.isInteger(turns) || turns < 0 || turns > 100) throw new Error(name);
    return turns * DEFAULT_RULES_TURN_TICKS;
  }
  return num(ticks);
}

interface CostFallback {
  phaser?: WeaponJson;
  photon?: WeaponJson;
  disruptor?: WeaponJson;
}

/**
 * A phaser or photon with no cost of its own uses the placeholder block.
 * The row's own fields win, including an explicit zero. Other families
 * are left at 0 so they stay outside this duel.
 */
function withCostFallback(row: WeaponJson, fallback: CostFallback | undefined): WeaponJson {
  if (row.internal === 'phaser' && row.chargeCost == null && fallback?.phaser) {
    return { ...fallback.phaser, ...row };
  }
  if (row.internal === 'photon' && row.armCost == null && fallback?.photon) {
    return { ...fallback.photon, ...row };
  }
  if (row.internal === 'disruptor' && row.armCost == null && fallback?.disruptor) {
    return { ...fallback.disruptor, ...row };
  }
  return row;
}

function bandsFrom(rows: readonly BandJson[] | undefined): RangeBand[] {
  const bands: RangeBand[] = [];
  for (const band of rows ?? []) {
    const hundredths = band.damageHundredths !== undefined ? 1 : 0;
    const fixed = hundredths === 1 ? num(band.damageHundredths) : num(band.damage);
    const rolled = band.damageMin !== undefined || band.damageMax !== undefined;
    const min = rolled ? num(band.damageMin) : fixed;
    const max = rolled ? num(band.damageMax) : fixed;
    const hitDen = band.hitDen ?? 1;
    const hitNum = band.hitNum ?? hitDen;
    if (!Number.isInteger(hitNum) || !Number.isInteger(hitDen) || hitDen <= 0) throw new Error('hit chance');
    bands.push({
      maxRange: num(band.maxRange),
      damage: rolled ? max : fixed,
      min,
      max,
      roll: rolled && max > min ? 1 : 0,
      hundredths,
      hitNum,
      hitDen,
    });
  }
  return bands;
}

function buildWeapons(): readonly WeaponDef[] {
  const ship = table.ship.weapons as Record<string, WeaponJson>;
  const fighter = table.fighter.weapons as Record<string, WeaponJson>;
  const fallback = (table as { costFallback?: CostFallback }).costFallback;
  const out: WeaponDef[] = [];
  for (const code of WEAPON_CODES) {
    const source = ship[code] ?? fighter[code];
    if (!source) throw new Error(`missing weapon ${code}`);
    const row = withCostFallback(source, fallback);
    const bands = bandsFrom(row.rangeBands);
    const overloadBands = bandsFrom(row.overloadRangeBands);
    const reload = row.reloadCounted === true || row.omnidirectional === true;
    const internal = internalId(row.internal);
    const chargeCost = num(row.chargeCost);
    const armCost = num(row.armCost);
    if (internal === INTERNAL_PHASER && chargeCost <= 0) throw new Error(`phaser ${code} has no cost`);
    if (internal === INTERNAL_PHOTON && armCost <= 0) throw new Error(`photon ${code} has no cost`);
    if (internal === INTERNAL_DISRUPTOR && armCost <= 0) throw new Error(`disruptor ${code} has no cost`);
    if (internal === INTERNAL_DISRUPTOR && bands.length > 0 && bands[bands.length - 1]!.maxRange !== num(row.maxRange)) {
      throw new Error(`disruptor ${code} band range`);
    }
    if (code === 'Dis3' && num(row.maxRange) !== DISRUPTOR_MAX_RANGE) throw new Error('disruptor-3 range');
    if (internal === INTERNAL_DISRUPTOR && overloadBands.length > 0) {
      const last = overloadBands[overloadBands.length - 1]!;
      if (last.maxRange !== DISRUPTOR_OVERLOAD_MAX_RANGE) throw new Error(`disruptor ${code} overload range`);
    }
    const lastBand = bands.length > 0 ? bands[bands.length - 1] : undefined;
    if (code === 'Phot' && (num(row.maxRange) !== PHOTON_MAX_RANGE || lastBand?.maxRange !== PHOTON_MAX_RANGE)) {
      throw new Error('photon range');
    }
    if (code === 'Ph1' && lastBand?.maxRange !== PHASER1_MAX_RANGE) throw new Error('phaser-1 range');
    if (code === 'Ph3' && lastBand?.maxRange !== PHASER3_MAX_RANGE) throw new Error('phaser-3 range');
    out.push({
      code,
      internal,
      chargeCost,
      holdCost: num(row.holdCost),
      armCost,
      armTicks: armTickCount(row.armTurns, row.armTicks, `${code} arm`),
      armPerTurn: num(row.armPerTurn),
      overloadArmCost: num(row.overloadArmCost),
      overloadArmTicks: armTickCount(row.overloadArmTurns, row.overloadArmTicks, `${code} overload arm`),
      overloadArmPerTurn: num(row.overloadArmPerTurn),
      directDamage: num(row.directDamage),
      overloadDamage: num(row.overloadDamage),
      proxDamage: num(row.proxDamage),
      proxRadius: num(row.proxRadius),
      projectileSpeed: num(row.projectileSpeed),
      flightTicks: num(row.flightTicks),
      maxRange: num(row.maxRange),
      bands,
      overloadBands,
      omni: reload ? 1 : 0,
    });
  }
  return out;
}

function buildArcs(): readonly ArcDef[] {
  const ship = table.ship.arcs as Record<string, ArcJson>;
  const out: ArcDef[] = [];
  for (const code of ARC_CODES) {
    const row = ship[code];
    if (!row) throw new Error(`missing arc ${code}`);
    const span = row.spans?.[0];
    out.push({
      code,
      full: row.full === true ? 1 : 0,
      from16: num(span?.from16),
      to16: num(span?.to16),
    });
  }
  return out;
}

const WEAPONS = buildWeapons();
const ARCS = buildArcs();

export function weaponCount(): number {
  return WEAPONS.length;
}

export function arcCount(): number {
  return ARCS.length;
}

/** 1-based. 0 means the code is not in the table. */
export function weaponId(code: string): number {
  for (let i = 0; i < WEAPONS.length; i++) {
    if (WEAPONS[i]!.code === code) return i + 1;
  }
  return 0;
}

export function arcId(code: string): number {
  for (let i = 0; i < ARCS.length; i++) {
    if (ARCS[i]!.code === code) return i + 1;
  }
  return 0;
}

export function weaponDef(id: number): WeaponDef | undefined {
  if (id <= 0 || id > WEAPONS.length) return undefined;
  return WEAPONS[id - 1];
}

export function arcDef(id: number): ArcDef | undefined {
  if (id <= 0 || id > ARCS.length) return undefined;
  return ARCS[id - 1];
}

export interface TurnLetter {
  readonly id: number;
  readonly yaw: number;
  /** 1 when the letter still uses the shared fallback and spawn emits turnModeUnverified. */
  readonly unverified: number;
}

/**
 * Resolve a turn letter. `measured` is the override table. An empty table
 * keeps every CE letter on the shared fallback.
 */
export function classifyTurnLetter(letter: string, measuredYaw: Readonly<Record<string, number>>): TurnLetter {
  if (letter === 'TEST-A') return { id: TURN_TEST_A, yaw: syntheticYaw('TEST-A'), unverified: 0 };
  if (letter === 'TEST-C') return { id: TURN_TEST_C, yaw: syntheticYaw('TEST-C'), unverified: 0 };
  if (letter === 'H') return { id: TURN_H, yaw: syntheticYaw('H'), unverified: 0 };
  const id = MEASURED_TURN_ID[letter];
  if (id !== undefined && Object.prototype.hasOwnProperty.call(measuredYaw, letter)) {
    return { id, yaw: requireYaw(measuredYaw[letter] ?? -1, letter), unverified: 0 };
  }
  return { id: TURN_UNVERIFIED, yaw: FALLBACK_YAW_PER_TICK, unverified: 1 };
}

export function turnModeId(letter: string): number {
  return classifyTurnLetter(letter, measured.turnYaw.measuredMaxYawPerTick).id;
}

/** Per-tick yaw cap. Unmeasured letters, and any other mode id, use the fallback. */
export function turnYawCap(mode: number): number {
  if (mode === TURN_TEST_A) return syntheticYaw('TEST-A');
  if (mode === TURN_TEST_C) return syntheticYaw('TEST-C');
  if (mode === TURN_H) return syntheticYaw('H');
  const measuredCap = FILE_MEASURED_YAW.get(mode);
  if (measuredCap !== undefined) return measuredCap;
  return FALLBACK_YAW_PER_TICK;
}

export function turnImmobile(mode: number): number {
  return mode === TURN_H ? 1 : 0;
}

/**
 * 1 when speed and yaw may proceed.
 * Unverified letters use FALLBACK_YAW_PER_TICK rather than refusing the order.
 * A letter with a measured cap uses that cap.
 */
export function turnHasRate(mode: number): number {
  if (mode === TURN_TEST_A || mode === TURN_TEST_C || mode === TURN_H || mode === TURN_UNVERIFIED) return 1;
  return FILE_MEASURED_YAW.has(mode) ? 1 : 0;
}
