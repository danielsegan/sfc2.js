/**
 * Shield facings and weapon arcs.
 * Bearings are uint16 BAM. A nonzero shot is inside an arc when it lies in the
 * cross/dot wedge of that arc's edge vectors. Range compares exact i64 squares.
 */
import { angle16, atan2_16, cos16, sin16 } from '../core/angle.ts';
import { cmpI64, cross, distSq, dot, type I64 } from '../core/fx.ts';
import { rulesDiv } from './rules-div.ts';
import { arcDef, type ArcDef } from './rules-tables.ts';

const FULL = 65536;
const HALF = 32768;

/** Equal 60° bins, bow centred. A boundary belongs to the clockwise-next facing. */
export function facingForRelative(rel: number): number {
  const r = rel & 0xffff;
  return rulesDiv(r * 6 + HALF, FULL) % 6;
}

/** Absolute bearing of (dx, dy), then minus heading. A zero offset is bearing 0. */
export function relativeBearing(heading: number, dx: number, dy: number): number {
  const x = dx | 0;
  const y = dy | 0;
  const abs = x === 0 && y === 0 ? 0 : (atan2_16(y, x) as number);
  return (abs - (heading | 0)) & 0xffff;
}

/** Half-open span on the uint16 circle. `full` accepts every bearing. */
export function spanContains(rel: number, from16: number, to16: number, full: number): boolean {
  if (full) return true;
  const r = rel & 0xffff;
  const from = from16 & 0xffff;
  const to = to16 & 0xffff;
  if (from === to) return false;
  if (from < to) return r >= from && r < to;
  return r >= from || r < to;
}

export function bearingInArc(rel: number, arc: ArcDef): boolean {
  return spanContains(rel, arc.from16, arc.to16, arc.full);
}

function signI64(v: I64): number {
  if (v.hi < 0) return -1;
  if (v.hi === 0 && v.lo === 0) return 0;
  return 1;
}

/** On the ray, or counterclockwise from it. The opposite ray is not included. */
function onOrCcw(ex: number, ey: number, tx: number, ty: number): boolean {
  const side = signI64(cross(ex, ey, tx, ty));
  if (side > 0) return true;
  if (side < 0) return false;
  return signI64(dot(ex, ey, tx, ty)) > 0;
}

/**
 * Nonzero (dx, dy) is inside the clockwise-increasing BAM span when the
 * cross product puts it on the included side of both edge vectors.
 * Edge vectors come from the integer sine LUT. A zero offset uses bearing 0.
 */
export function wedgeContains(
  heading: number,
  dx: number,
  dy: number,
  from16: number,
  to16: number,
): boolean {
  const sweep = (to16 - from16) & 0xffff;
  if (sweep === 0) return false;
  const sx = cos16(angle16(((heading | 0) + from16) & 0xffff)) as number;
  const sy = sin16(angle16(((heading | 0) + from16) & 0xffff)) as number;
  const ex = cos16(angle16(((heading | 0) + to16) & 0xffff)) as number;
  const ey = sin16(angle16(((heading | 0) + to16) & 0xffff)) as number;
  const tx = dx | 0;
  const ty = dy | 0;
  const startOk = onOrCcw(sx, sy, tx, ty);
  if (sweep < HALF) return startOk && signI64(cross(ex, ey, tx, ty)) < 0;
  if (sweep === HALF) return startOk && !onOrCcw(ex, ey, tx, ty);
  const inComplement = onOrCcw(ex, ey, tx, ty) && signI64(cross(sx, sy, tx, ty)) < 0;
  return !inComplement;
}

export function shotInArc(heading: number, dx: number, dy: number, arcId: number, omni: number): boolean {
  if (omni) return true;
  const arc = arcDef(arcId);
  if (!arc) return false;
  if (arc.full) return true;
  const x = dx | 0;
  const y = dy | 0;
  if (x === 0 && y === 0) return spanContains((0 - heading) & 0xffff, arc.from16, arc.to16, 0);
  return wedgeContains(heading, x, y, arc.from16, arc.to16);
}

/** Inclusive. `rangeUnits` is a whole range-unit radius. Comparison is d² ≤ r². */
export function withinRange(dx: number, dy: number, rangeUnits: number): boolean {
  if (!Number.isInteger(rangeUnits) || rangeUnits < 0 || rangeUnits > 32767) return false;
  const limit = rangeUnits << 16;
  return cmpI64(distSq(dx | 0, dy | 0), distSq(limit, 0)) <= 0;
}
