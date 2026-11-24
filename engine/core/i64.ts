/**
 * Signed i64 as two limbs: value = hi * 2^32 + lo.
 * hi is a signed int32, lo is a uint32. No BigInt and no division operator.
 */

export interface I64 {
  readonly hi: number;
  readonly lo: number;
}

export function i64(hi: number, lo: number): I64 {
  return { hi: hi | 0, lo: lo >>> 0 };
}

export function negI64(x: I64): I64 {
  const lo = (~x.lo + 1) >>> 0;
  const carry = x.lo === 0 ? 1 : 0;
  return { hi: (~x.hi + carry) | 0, lo };
}

export function addI64(a: I64, b: I64): I64 {
  const sum = a.lo + b.lo;
  return { hi: (a.hi + b.hi + (sum > 0xffffffff ? 1 : 0)) | 0, lo: sum >>> 0 };
}

export function subI64(a: I64, b: I64): I64 {
  return addI64(a, negI64(b));
}

/** Unsigned 32×32 → 64 via a 16-bit split. Every partial product fits in uint32. */
export function mulU32ToI64(a: number, b: number): I64 {
  const aLo = a & 0xffff;
  const aHi = (a >>> 16) & 0xffff;
  const bLo = b & 0xffff;
  const bHi = (b >>> 16) & 0xffff;
  const p00 = Math.imul(aLo, bLo) >>> 0;
  const p01 = Math.imul(aLo, bHi) >>> 0;
  const p10 = Math.imul(aHi, bLo) >>> 0;
  const p11 = Math.imul(aHi, bHi) >>> 0;
  const midSum = p01 + p10;
  const midOverflow = midSum > 0xffffffff ? 1 : 0;
  const mid = midSum >>> 0;
  // Multiply, not << : a 16-bit shift of a value ≥ 0x8000 sets the int32 sign bit and drops the carry.
  const loSum = p00 + (mid & 0xffff) * 65536;
  const loOverflow = loSum > 0xffffffff ? 1 : 0;
  const hi = (p11 + (mid >>> 16) + midOverflow * 65536 + loOverflow) >>> 0;
  return { hi: hi | 0, lo: loSum >>> 0 };
}

/** Signed int32×int32 → exact i64. The product always fits. */
export function mulI32ToI64(a: number, b: number): I64 {
  const aa = a | 0;
  const bb = b | 0;
  const aNeg = aa < 0;
  const bNeg = bb < 0;
  const aMag = aNeg ? (aa === -2147483648 ? 2147483648 : (-aa) >>> 0) : aa >>> 0;
  const bMag = bNeg ? (bb === -2147483648 ? 2147483648 : (-bb) >>> 0) : bb >>> 0;
  const mag = mulU32ToI64(aMag, bMag);
  return aNeg !== bNeg ? negI64(mag) : mag;
}

/** Arithmetic shift right by 16. Floor-divides a signed i64 by 2^16. */
export function asr16I64(x: I64): I64 {
  const lo = ((x.lo >>> 16) | ((x.hi & 0xffff) << 16)) >>> 0;
  return { hi: x.hi >> 16, lo };
}

/** Mathematical a * 2^16 for an int32, as i64. */
export function shl16I32(a: number): I64 {
  const v = a | 0;
  return { hi: v >> 16, lo: (v << 16) >>> 0 };
}

/**
 * Floor of n / d for a non-negative n up to 2^32 and a divisor in 1..2^32.
 * Restoring division, so the remainder stays exact in a JS number.
 */
export function udivmod(n: number, d: number): { q: number; r: number } {
  if (d === 0) throw new Error('udivmod by zero');
  if (n < d) return { q: 0, r: n };
  if (d === 1) return { q: n, r: 0 };
  let q = 0;
  let r = 0;
  for (let i = 32; i >= 0; i--) {
    const bit = i === 32 ? (n > 0xffffffff ? 1 : 0) : (n >>> i) & 1;
    r = r + r + bit;
    if (r >= d) {
      r = r - d;
      q = q + q + 1;
    } else {
      q = q + q;
    }
  }
  return { q, r };
}

function divU64byU32(n: I64, d: number): { q: I64; r: number } {
  if (d === 0) throw new Error('div0');
  let r = 0;
  let qHi = 0;
  let qLo = 0;
  const nHi = n.hi >>> 0;
  const nLo = n.lo >>> 0;
  for (let i = 63; i >= 0; i--) {
    const bit = i >= 32 ? (nHi >>> (i - 32)) & 1 : (nLo >>> i) & 1;
    r = r + r + bit;
    const sub = r >= d;
    if (sub) r = r - d;
    if (i >= 32) qHi = ((qHi << 1) | (sub ? 1 : 0)) >>> 0;
    else qLo = ((qLo << 1) | (sub ? 1 : 0)) >>> 0;
  }
  return { q: { hi: qHi | 0, lo: qLo >>> 0 }, r };
}

/** floor(n / d) for signed i64 dividend and signed i32 divisor. d must not be 0. */
export function divFloorI64byI32(n: I64, d: number): I64 {
  const d0 = d | 0;
  if (d0 === 0) throw new Error('div0');
  const nNeg = n.hi < 0;
  const dNeg = d0 < 0;
  const nAbs = nNeg ? negI64(n) : n;
  const dAbs = dNeg ? (d0 === -2147483648 ? 2147483648 : (-d0) >>> 0) : d0 >>> 0;
  const u = divU64byU32(nAbs, dAbs);
  if (nNeg === dNeg) return u.q;
  if (u.r === 0) return negI64(u.q);
  return addI64(negI64(u.q), { hi: -1, lo: 0xffffffff });
}
