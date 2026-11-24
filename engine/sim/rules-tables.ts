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

export const MODE_NORMAL = 0;
export const MODE_OVERLOAD = 1;
export const MODE_PROXIMITY = 2;
/** Payload sentinel: keep the mount's current mode. */
export const MODE_KEEP = -1;

export const TICK_HZ = 30;
export const RULES_TURN_SECONDS = 30;
export const DEFAULT_RULES_TURN_TICKS = TICK_HZ * RULES_TURN_SECONDS;

export const DEFAULT_LIFE_SUPPORT = 1;
export const DEFAULT_FIRE_CONTROL = 1;
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

interface WeaponJson {
  internal?: string;
  chargeCost?: number;
  holdCost?: number;
  armCost?: number;
  armTicks?: number;
  overloadArmCost?: number;
  overloadArmTicks?: number;
  directDamage?: number;
  overloadDamage?: number;
  proxRadius?: number;
  proxDamage?: number;
  projectileSpeed?: number;
  maxRange?: number;
  rangeBands?: readonly { maxRange?: number; damage?: number }[];
  reloadCounted?: boolean;
  omnidirectional?: boolean;
}

interface ArcJson {
  full?: boolean;
  spans?: readonly { from16?: number; to16?: number }[];
}

export interface WeaponDef {
  readonly code: string;
  readonly internal: number;
  readonly chargeCost: number;
  readonly holdCost: number;
  readonly armCost: number;
  readonly armTicks: number;
  readonly overloadArmCost: number;
  readonly overloadArmTicks: number;
  readonly directDamage: number;
  readonly overloadDamage: number;
  readonly proxDamage: number;
  readonly proxRadius: number;
  readonly projectileSpeed: number;
  readonly maxRange: number;
  readonly bands: readonly (readonly [number, number])[];
  readonly omni: number;
}

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
  return INTERNAL_OTHER;
}

function num(value: number | undefined): number {
  return value ?? 0;
}

interface CostFallback {
  phaser?: WeaponJson;
  photon?: WeaponJson;
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
  return row;
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
    const bands: (readonly [number, number])[] = [];
    for (const band of row.rangeBands ?? []) {
      bands.push([num(band.maxRange), num(band.damage)]);
    }
    const reload = row.reloadCounted === true || row.omnidirectional === true;
    const internal = internalId(row.internal);
    const chargeCost = num(row.chargeCost);
    const armCost = num(row.armCost);
    if (internal === INTERNAL_PHASER && chargeCost <= 0) throw new Error(`phaser ${code} has no cost`);
    if (internal === INTERNAL_PHOTON && armCost <= 0) throw new Error(`photon ${code} has no cost`);
    out.push({
      code,
      internal,
      chargeCost,
      holdCost: num(row.holdCost),
      armCost,
      armTicks: num(row.armTicks),
      overloadArmCost: num(row.overloadArmCost),
      overloadArmTicks: num(row.overloadArmTicks),
      directDamage: num(row.directDamage),
      overloadDamage: num(row.overloadDamage),
      proxDamage: num(row.proxDamage),
      proxRadius: num(row.proxRadius),
      projectileSpeed: num(row.projectileSpeed),
      maxRange: num(row.maxRange),
      bands,
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
