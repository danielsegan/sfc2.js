/**
 * Q16.16 fixed point and the N1a exact-i64 helpers.
 * Hot paths use a 16-bit split multiply. BigInt is tests-only.
 */
import type { Fx } from './brands.ts';
import {
  addI64,
  asr16I64,
  divFloorI64byI32,
  i64,
  mulI32ToI64,
  mulU32ToI64,
  shl16I32,
  subI64,
  udivmod,
  type I64,
} from './i64.ts';

export type { Fx } from './brands.ts';
export type { I64 } from './i64.ts';
export { i64 } from './i64.ts';

export const FX_SHIFT = 16;
export const FX_ONE = 1 << FX_SHIFT;
export const FX_MAX = 0x7fffffff;
export const FX_MIN = -0x80000000;

/** Whole range units. Each map axis must lie in ± this value. */
export const MAP_LIMIT = 8192;

let fxAsserts = false;
let fxTick = 0;

/** Dev builds throw on saturation and divide-by-zero. Release builds only saturate. */
export function enableFxAsserts(enabled: boolean): void {
  fxAsserts = enabled;
}

export function setFxLogTick(tick: number): void {
  fxTick = tick | 0;
}

function raise(op: string, operands: readonly number[]): void {
  if (!fxAsserts) return;
  throw new Error(`fx ${op} saturated tick=${String(fxTick)} operands=${operands.join(',')}`);
}

function narrowSat(x: I64, op: string, operands: readonly number[]): Fx {
  const lo = x.lo | 0;
  const signHi = lo < 0 ? -1 : 0;
  if (x.hi === signHi) return lo as Fx;
  raise(op, operands);
  return (x.hi >= 0 ? FX_MAX : FX_MIN) as Fx;
}

/** Integer range-unit count → Q16.16. Non-integers throw. Overflow saturates. */
export function fx(i: number): Fx {
  if (!Number.isInteger(i)) throw new Error('fx() requires an integer range-unit count');
  if (i > 32767) {
    raise('fx', [i]);
    return FX_MAX as Fx;
  }
  if (i < -32768) {
    raise('fx', [i]);
    return FX_MIN as Fx;
  }
  return (i << FX_SHIFT) as Fx;
}

/** Brand an existing Q16.16 raw int32. */
export function fxRaw(raw: number): Fx {
  if (!Number.isInteger(raw) || raw > FX_MAX || raw < FX_MIN) {
    throw new Error('fxRaw out of int32');
  }
  return (raw | 0) as Fx;
}

export function fxToRaw(value: Fx): number {
  return value as number;
}

export function add(a: Fx, b: Fx): Fx {
  const x = a as number;
  const y = b as number;
  const s = (x + y) | 0;
  if (((x ^ s) & (y ^ s)) < 0) {
    raise('add', [x, y]);
    return (x > 0 ? FX_MAX : FX_MIN) as Fx;
  }
  return s as Fx;
}

export function neg(a: Fx): Fx {
  const v = a as number;
  if (v === FX_MIN) {
    raise('neg', [v]);
    return FX_MAX as Fx;
  }
  return (-v) as Fx;
}

export function sub(a: Fx, b: Fx): Fx {
  const bb = b as number;
  if (bb === FX_MIN) {
    const aa = a as number;
    if (aa === FX_MIN) return 0 as Fx;
    if (aa < 0) return (aa + 2147483648) as Fx;
    raise('sub', [aa, bb]);
    return FX_MAX as Fx;
  }
  return add(a, neg(b));
}

/** floor(a * b / 2^16), saturating to int32. */
export function mul(a: Fx, b: Fx): Fx {
  const x = a as number;
  const y = b as number;
  return narrowSat(asr16I64(mulI32ToI64(x, y)), 'mul', [x, y]);
}

/**
 * floor(a * 2^16 / b), saturating.
 * b = 0 yields +MAX, −MAX (int32 min), or 0 when a is 0.
 */
export function div(a: Fx, b: Fx): Fx {
  const aa = a as number;
  const bb = b as number;
  if (bb === 0) {
    const result = aa > 0 ? FX_MAX : aa < 0 ? FX_MIN : 0;
    raise('div', [aa, bb]);
    return result as Fx;
  }
  return narrowSat(divFloorI64byI32(shl16I32(aa), bb), 'div', [aa, bb]);
}

/**
 * Floor division of two integers whose absolute values fit in 2^31
 * (abs(INT_MIN) included). Divide-by-zero throws in every build.
 */
export function idiv(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error('idiv requires integers');
  if (b === 0) throw new Error('idiv by zero');
  const ua = a < 0 ? -a : a;
  const ub = b < 0 ? -b : b;
  if (ua > 2147483648 || ub > 2147483648) throw new Error('idiv domain');
  const qAbs = udivmod(ua, ub).q;
  if ((a < 0) === (b < 0)) return qAbs;
  const rem = ua - qAbs * ub;
  return rem === 0 ? -qAbs : -qAbs - 1;
}

/** Floor sqrt of a uint32. The input is read as an unsigned 32-bit pattern. */
export function isqrt(x: number): number {
  return isqrt64(i64(0, x >>> 0));
}

/** i32 raw difference a − b. Defined for in-bounds coordinates (the result fits in i32). */
export function delta(a: Fx, b: Fx): number {
  const d = (a as number) - (b as number);
  const wrapped = d | 0;
  if (wrapped !== d) raise('delta', [a as number, b as number]);
  return wrapped;
}

export function distSq(dx: number, dy: number): I64 {
  const x = dx | 0;
  const y = dy | 0;
  return addI64(mulI32ToI64(x, x), mulI32ToI64(y, y));
}

export function cross(dx1: number, dy1: number, dx2: number, dy2: number): I64 {
  const prod = mulI32ToI64(dx1 | 0, dy2 | 0);
  const perp = mulI32ToI64(dy1 | 0, dx2 | 0);
  return subI64(prod, perp);
}

export function dot(dx1: number, dy1: number, dx2: number, dy2: number): I64 {
  return addI64(mulI32ToI64(dx1 | 0, dx2 | 0), mulI32ToI64(dy1 | 0, dy2 | 0));
}

/** -1, 0, or +1. Range checks use cmpI64(d², r²) and do not take a square root. */
export function cmpI64(a: I64, b: I64): number {
  if (a.hi < b.hi) return -1;
  if (a.hi > b.hi) return 1;
  if (a.lo < b.lo) return -1;
  if (a.lo > b.lo) return 1;
  return 0;
}

function avgFloor(lo: number, hi: number): number {
  return (lo >>> 1) + (hi >>> 1) + ((lo & hi) & 1);
}

/** Floor sqrt of a non-negative i64. A negative input throws in every build. */
export function isqrt64(x: I64): number {
  if (x.hi < 0) throw new Error('isqrt64 of negative');
  if (x.hi === 0 && x.lo === 0) return 0;
  let lo = 0;
  let hi = x.hi === 0 ? 65535 : 3037000499;
  let best = 0;
  while (lo <= hi) {
    const mid = avgFloor(lo, hi);
    const sq = mulU32ToI64(mid >>> 0, mid >>> 0);
    const c = cmpI64(sq, x);
    if (c <= 0) {
      best = mid;
      if (mid === hi) break;
      lo = mid + 1;
    } else {
      if (mid === lo) break;
      hi = mid - 1;
    }
  }
  return best;
}
