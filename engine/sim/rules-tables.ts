/**
 * Duel-slice tables. Weapon and arc rows are the JSON key order of
 * docs/rules/data/weapon-arcs.json, which this module reads directly.
 * Numeric costs stay integer rule-points. Empty cost rows stay 0.
 */
import constants from '../../docs/rules/data/constants.json' with { type: 'json' };
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

function buildWeapons(): readonly WeaponDef[] {
  const ship = table.ship.weapons as Record<string, WeaponJson>;
  const fighter = table.fighter.weapons as Record<string, WeaponJson>;
  const out: WeaponDef[] = [];
  for (const code of WEAPON_CODES) {
    const row = ship[code] ?? fighter[code];
    if (!row) throw new Error(`missing weapon ${code}`);
    const bands: (readonly [number, number])[] = [];
    for (const band of row.rangeBands ?? []) {
      bands.push([num(band.maxRange), num(band.damage)]);
    }
    const reload = row.reloadCounted === true || row.omnidirectional === true;
    out.push({
      code,
      internal: internalId(row.internal),
      chargeCost: num(row.chargeCost),
      holdCost: num(row.holdCost),
      armCost: num(row.armCost),
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

export function turnModeId(letter: string): number {
  if (letter === 'TEST-A') return TURN_TEST_A;
  if (letter === 'TEST-C') return TURN_TEST_C;
  if (letter === 'H') return TURN_H;
  if (
    letter === 'AA' || letter === 'A' || letter === 'B' || letter === 'C' ||
    letter === 'D' || letter === 'E' || letter === 'F' || letter === 'G'
  ) {
    return TURN_UNVERIFIED;
  }
  return TURN_UNVERIFIED;
}

export function turnImmobile(mode: number): number {
  return mode === TURN_H ? 1 : 0;
}

/** -1 when the letter has no playtest rate. */
export function turnHasRate(mode: number): number {
  return mode === TURN_TEST_A || mode === TURN_TEST_C || mode === TURN_H ? 1 : 0;
}
