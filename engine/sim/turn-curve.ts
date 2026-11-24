/**
 * Speed-keyed turn tables for the sim: the normal-turn curve
 * (docs/rules/data/turn-normal.json) and the High-Energy Turn table
 * (docs/rules/data/het.json). Both are read here, checked, and turned into
 * integer rows. Lookup is integer-only: linear interpolation on
 * speed hundredths with rulesDiv nearest rounding, clamped to the end points.
 *
 * Hull rows are numbered by their position in each file's `hullOrder` list.
 * A hull with no row of its own uses `default`. Replacing a row's speed
 * points is a data edit; nothing here names a hull.
 *
 * The `turnCurve` table is opt-in. A sim that does not register it keeps the
 * per-letter caps from turn-modes.json (the replay corpus does this).
 */
import normalJson from '../../docs/rules/data/turn-normal.json' with { type: 'json' };
import hetJson from '../../docs/rules/data/het.json' with { type: 'json' };
import type { EntityId } from '../core/brands.ts';
import type { TableSpec, World, WorldSnap } from './world.ts';
import { H } from './hull.ts';
import { rulesDiv } from './rules-div.ts';
import { turnYawCap } from './rules-tables.ts';

export const TURN_CURVE = 'turnCurve';

/** enabled (1 when the setup named a turn hull), normal row, HET row, start delay left. */
export const TC = {
  enabled: 0,
  normal: 1,
  het: 2,
  delayLeft: 3,
} as const;

export const TURN_CURVE_FIELDS = 4;

export const TURN_CURVE_TABLE: TableSpec = { id: TURN_CURVE, fieldCount: TURN_CURVE_FIELDS };

interface PointJson {
  speed?: number;
  speedHundredths?: number;
  delayTicks?: number;
  turnRate16PerTick?: number;
  turnAngle16?: number;
}

interface HullJson {
  speedPoints?: readonly PointJson[];
}

interface TableJson {
  hullOrder?: readonly string[];
  hulls: Readonly<Record<string, HullJson | undefined>>;
}

/** One compiled speed point. `angle` is 0 for the normal curve. */
export interface CurvePoint {
  readonly q: number;
  readonly delay: number;
  readonly rate: number;
  readonly angle: number;
}

export interface CurveRow {
  readonly key: string;
  readonly points: readonly CurvePoint[];
}

export interface CurveTable {
  readonly rows: readonly CurveRow[];
  readonly defaultId: number;
}

/** Largest speed key used for lookup. Keeps speed × 100 well inside i32. */
const MAX_SPEED = 100000;

function int(value: number | undefined, name: string, min: number, max: number): number {
  if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(name);
  return value;
}

function pointQ(point: PointJson, name: string): number {
  if (point.speedHundredths !== undefined) return int(point.speedHundredths, `${name} speedHundredths`, 0, MAX_SPEED * 100);
  return int(point.speed, `${name} speed`, 0, MAX_SPEED) * 100;
}

/** Interpolation multiplies a value step by a speed step. Keep that inside rulesDiv's domain. */
function spanFits(a: CurvePoint, b: CurvePoint, where: string): void {
  const dx = b.q - a.q;
  const steps = [b.delay - a.delay, b.rate - a.rate, b.angle - a.angle];
  for (const dy of steps) {
    const mag = dy < 0 ? -dy : dy;
    if (mag * dx > 1073741824) throw new Error(`${where} interpolation span`);
  }
}

/** Build and check one table. `het` requires a sweep on every point. */
export function compileCurveTable(raw: TableJson, het: boolean, name: string): CurveTable {
  const order = raw.hullOrder;
  if (!order || order.length < 1) throw new Error(`${name} hullOrder`);
  const rows: CurveRow[] = [];
  let defaultId = -1;
  for (let i = 0; i < order.length; i++) {
    const key = order[i]!;
    for (let j = 0; j < i; j++) {
      if (order[j] === key) throw new Error(`${name} duplicate hull ${key}`);
    }
    if (!Object.prototype.hasOwnProperty.call(raw.hulls, key)) throw new Error(`${name} missing hull ${key}`);
    const hull = raw.hulls[key];
    const pts = hull?.speedPoints;
    if (!pts || pts.length < 1) throw new Error(`${name} ${key} speedPoints`);
    const points: CurvePoint[] = [];
    for (const pt of pts) {
      const where = `${name} ${key}`;
      const q = pointQ(pt, where);
      const prev = points[points.length - 1];
      if (prev && q <= prev.q) throw new Error(`${where} speed order`);
      const next: CurvePoint = {
        q,
        delay: int(pt.delayTicks, `${where} delayTicks`, 0, 100000),
        rate: int(pt.turnRate16PerTick, `${where} turnRate16PerTick`, het ? 1 : 0, 32768),
        angle: het ? int(pt.turnAngle16, `${where} turnAngle16`, 1, 32768) : 0,
      };
      if (prev) spanFits(prev, next, where);
      points.push(next);
    }
    if (key === 'default') defaultId = i;
    rows.push({ key, points });
  }
  if (defaultId < 0) throw new Error(`${name} default hull`);
  return { rows, defaultId };
}

export const NORMAL_CURVE: CurveTable = compileCurveTable(normalJson as TableJson, false, 'turn-normal');
export const HET_CURVE: CurveTable = compileCurveTable(hetJson as TableJson, true, 'het');

/** Row id for a hull key. Unknown keys get the default row. */
export function curveId(table: CurveTable, key: string): number {
  for (let i = 0; i < table.rows.length; i++) {
    if (table.rows[i]!.key === key) return i;
  }
  return table.defaultId;
}

/** Same rounding as docs/rules/het.md §4: symmetric nearest, via rulesDiv. */
export function interpInt(s: number, s0: number, y0: number, s1: number, y1: number): number {
  const dx = s1 - s0;
  const num = (y1 - y0) * (s - s0);
  const half = dx >> 1;
  return num >= 0 ? y0 + rulesDiv(num + half, dx) : y0 - rulesDiv(-num + half, dx);
}

/** Interpolated or clamped point at speed hundredths `q`. Out-of-range ids use the default row. */
export function curvePoint(table: CurveTable, id: number, q: number): CurvePoint {
  const row = table.rows[id] ?? table.rows[table.defaultId]!;
  const pts = row.points;
  const first = pts[0]!;
  if (q <= first.q) return first;
  const last = pts[pts.length - 1]!;
  if (q >= last.q) return last;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (q === a.q) return a;
    if (q > a.q && q < b.q) {
      return {
        q,
        delay: interpInt(q, a.q, a.delay, b.q, b.delay),
        rate: interpInt(q, a.q, a.rate, b.q, b.rate),
        angle: interpInt(q, a.q, a.angle, b.q, b.angle),
      };
    }
  }
  return last;
}

/** Speed the curve is keyed on: the cruise override when set, else the ordered speed. Hundredths. */
export function speedKey(fields: readonly number[]): number {
  const override = fields[H.speedOverride] ?? -1;
  const speed = override >= 0 ? override : (fields[H.speed] ?? 0);
  const clamped = speed < 0 ? 0 : speed > MAX_SPEED ? MAX_SPEED : speed;
  return clamped * 100;
}

/**
 * Normal-turn rate cap for a hull row. The curve supplies the rate and the
 * turn letter's cap stays an upper bound, so the lower of the two wins.
 * Without a curve row the letter cap is returned unchanged.
 */
export function rateFromRow(row: readonly number[] | null, fields: readonly number[]): number {
  const cap = turnYawCap(fields[H.turnMode]!);
  if (!row || row[TC.enabled] !== 1) return cap;
  const rate = curvePoint(NORMAL_CURVE, row[TC.normal]!, speedKey(fields)).rate;
  return cap >= 0 && cap < rate ? cap : rate;
}

export function curveRow(world: World, id: EntityId): number[] | null {
  if (!world.hasTable(TURN_CURVE)) return null;
  return world.getFields(id, TURN_CURVE);
}

/** Per-tick yaw cap for a live hull, curve first. */
export function turnRateFor(world: World, id: EntityId, fields: readonly number[]): number {
  return rateFromRow(curveRow(world, id), fields);
}

/** 1 when this hull turns on the measured curve rather than its letter cap. */
export function usesCurve(world: World, id: EntityId): number {
  const row = curveRow(world, id);
  return row && row[TC.enabled] === 1 ? 1 : 0;
}

/** Start delay for a fresh normal turn, in ticks. 0 without a curve row. */
export function normalDelayFor(world: World, id: EntityId, fields: readonly number[]): number {
  const row = curveRow(world, id);
  if (!row || row[TC.enabled] !== 1) return 0;
  return curvePoint(NORMAL_CURVE, row[TC.normal]!, speedKey(fields)).delay;
}

export function setCurveDelay(world: World, id: EntityId, ticks: number): void {
  const row = curveRow(world, id);
  if (!row) return;
  row[TC.delayLeft] = ticks | 0;
  world.setFields(id, TURN_CURVE, row);
}

/** HET row for a hull. Hulls with no curve row use the HET default. */
export function hetIdFor(world: World, id: EntityId): number {
  const row = curveRow(world, id);
  if (!row || row[TC.enabled] !== 1) return HET_CURVE.defaultId;
  return row[TC.het]!;
}

/** Write the curve row at spawn. A missing key leaves the hull on its letter cap. No-op without the table. */
export function stampCurve(world: World, id: EntityId, turnHull: string | undefined): void {
  if (!world.hasTable(TURN_CURVE)) return;
  if (turnHull === undefined) {
    world.setFields(id, TURN_CURVE, [0, NORMAL_CURVE.defaultId, HET_CURVE.defaultId, 0]);
    return;
  }
  world.setFields(id, TURN_CURVE, [1, curveId(NORMAL_CURVE, turnHull), curveId(HET_CURVE, turnHull), 0]);
}

/** Snapshot read for the view. Null when the table is absent or the slot is out of range. */
export function curveRowOf(snap: WorldSnap, index: number): number[] | null {
  for (const table of snap.tables) {
    if (table.id !== TURN_CURVE) continue;
    if (table.fieldCount < TURN_CURVE_FIELDS || index < 0) return null;
    const base = index * table.fieldCount;
    const out: number[] = [];
    for (let f = 0; f < TURN_CURVE_FIELDS; f++) out.push(table.data[base + f] ?? 0);
    return out;
  }
  return null;
}

/** High-Energy Turn state. Opt-in like the curve table; see engine/sim/het.ts. */
export const HET_STATE = 'het';

/** active (0 or 1), signed turn still to go, delay ticks left, locked rate per tick. */
export const HS = {
  active: 0,
  remaining: 1,
  delayLeft: 2,
  rate: 3,
} as const;

export const HET_FIELDS = 4;

export const HET_TABLE: TableSpec = { id: HET_STATE, fieldCount: HET_FIELDS };

/** 1 while a HET is in its delay or turn phase. 0 without the table. */
export function hetActive(world: World, id: EntityId): number {
  if (!world.hasTable(HET_STATE)) return 0;
  return world.getFields(id, HET_STATE)[HS.active] === 1 ? 1 : 0;
}

/** Snapshot read for the view. Null when the table is absent. */
export function hetRowOf(snap: WorldSnap, index: number): number[] | null {
  for (const table of snap.tables) {
    if (table.id !== HET_STATE) continue;
    if (table.fieldCount < HET_FIELDS || index < 0) return null;
    const base = index * table.fieldCount;
    const out: number[] = [];
    for (let f = 0; f < HET_FIELDS; f++) out.push(table.data[base + f] ?? 0);
    return out;
  }
  return null;
}
