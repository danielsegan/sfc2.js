import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import * as fx from './fx.ts';

afterEach(() => {
  fx.enableFxAsserts(false);
  fx.setFxLogTick(0);
});

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;
const C = 536870912;
const D = 1073741824;

function i64ToBig(value: { hi: number; lo: number }): bigint {
  const bits = (BigInt(value.hi >>> 0) << 32n) | BigInt(value.lo >>> 0);
  return bits >= 1n << 63n ? bits - (1n << 64n) : bits;
}

function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  if (r !== 0n && (n < 0n) !== (d < 0n)) return q - 1n;
  return q;
}

function satI32(v: bigint): number {
  if (v > BigInt(I32_MAX)) return I32_MAX;
  if (v < BigInt(I32_MIN)) return I32_MIN;
  return Number(v);
}

describe('fx Q16.16', () => {
  it('uses shift 16 and keeps map corners inside int32', () => {
    expect(fx.FX_SHIFT).toBe(16);
    expect(fx.FX_ONE).toBe(65536);
    expect(fx.MAP_LIMIT).toBe(8192);
    expect(fx.fxToRaw(fx.fx(8192))).toBe(C);
    expect(fx.fxToRaw(fx.fx(-8192))).toBe(-C);
    expect(fx.fxToRaw(fx.fx(1))).toBe(65536);
  });

  it('rejects non-integers and saturates a shift that does not fit', () => {
    expect(() => fx.fx(1.5)).toThrow(/integer/);
    fx.enableFxAsserts(false);
    expect(fx.fx(32768)).toBe(fx.FX_MAX);
    expect(fx.fx(-32769)).toBe(fx.FX_MIN);
    expect(fx.fx(-32768)).toBe(fx.FX_MIN);
  });

  it('adds and subtracts with saturation', () => {
    expect(fx.add(fx.fxRaw(1), fx.fxRaw(-1))).toBe(0);
    expect(fx.add(fx.fxRaw(fx.FX_MAX), fx.fxRaw(1))).toBe(fx.FX_MAX);
    expect(fx.add(fx.fxRaw(fx.FX_MIN), fx.fxRaw(-1))).toBe(fx.FX_MIN);
    expect(fx.sub(fx.fxRaw(fx.FX_MIN), fx.fxRaw(fx.FX_MIN))).toBe(0);
    expect(fx.sub(fx.fxRaw(0), fx.fxRaw(fx.FX_MIN))).toBe(fx.FX_MAX);
    expect(fx.neg(fx.fxRaw(fx.FX_MIN))).toBe(fx.FX_MAX);
    expect(fx.neg(fx.fxRaw(4))).toBe(-4);
  });

  it('floors mul and div for every sign, including the div-by-zero rule', () => {
    expect(fx.mul(fx.fx(2), fx.fx(3))).toBe(fx.fxToRaw(fx.fx(6)));
    expect(fx.mul(fx.fxRaw(-1), fx.fxRaw(1))).toBe(-1);
    expect(fx.div(fx.fx(1), fx.fx(2))).toBe(32768);
    expect(fx.div(fx.fxRaw(-1), fx.fxRaw(65537))).toBe(-1);
    expect(fx.div(fx.fxRaw(0), fx.fxRaw(0))).toBe(0);
    expect(fx.div(fx.fx(1), fx.fx(0))).toBe(fx.FX_MAX);
    expect(fx.div(fx.fx(-1), fx.fx(0))).toBe(fx.FX_MIN);
  });

  it('throws in dev on saturation and still saturates when asserts are off', () => {
    fx.enableFxAsserts(true);
    fx.setFxLogTick(42);
    expect(() => fx.div(fx.fx(1), fx.fx(0))).toThrow(/fx div saturated tick=42 operands=65536,0/);
    fx.enableFxAsserts(false);
    expect(fx.div(fx.fx(1), fx.fx(0))).toBe(fx.FX_MAX);
    expect(fx.mul(fx.fxRaw(fx.FX_MAX), fx.fxRaw(fx.FX_MAX))).toBe(fx.FX_MAX);
  });

  it('idiv floors and matches a right shift on powers of two', () => {
    expect(fx.idiv(5, 2)).toBe(2);
    expect(fx.idiv(-5, 2)).toBe(-3);
    expect(fx.idiv(5, -2)).toBe(-3);
    expect(fx.idiv(-5, -2)).toBe(2);
    expect(fx.idiv(-1, 2)).toBe(-1);
    expect(fx.idiv(-3, 2)).toBe(-2);
    expect(fx.idiv(I32_MIN, 2)).toBe(-1073741824);
    expect(fx.idiv(I32_MIN, -1)).toBe(2147483648);
    expect(fx.idiv(-3, 2)).toBe(-3 >> 1);
    expect(() => fx.idiv(1, 0)).toThrow(/zero/);
  });

  it('matches a BigInt floor reference for mul, div, and idiv', () => {
    const int32 = fc.integer({ min: I32_MIN, max: I32_MAX });
    fc.assert(
      fc.property(int32, int32, (a, b) => {
        const got = fx.mul(fx.fxRaw(a), fx.fxRaw(b)) as number;
        const exp = satI32(floorDiv(BigInt(a) * BigInt(b), 65536n));
        return got === exp;
      }),
      { seed: 20261124, numRuns: 80 },
    );
    fc.assert(
      fc.property(int32, int32.filter((b) => b !== 0), (a, b) => {
        const got = fx.div(fx.fxRaw(a), fx.fxRaw(b)) as number;
        const exp = satI32(floorDiv(BigInt(a) << 16n, BigInt(b)));
        return got === exp;
      }),
      { seed: 20261124, numRuns: 40 },
    );
    fc.assert(
      fc.property(int32, int32.filter((b) => b !== 0), (a, b) => {
        return fx.idiv(a, b) === Number(floorDiv(BigInt(a), BigInt(b)));
      }),
      { seed: 20261124, numRuns: 40 },
    );
  });
});

describe('N1a golden vectors', () => {
  const sw = { x: fx.fx(-8192), y: fx.fx(-8192) };
  const se = { x: fx.fx(8192), y: fx.fx(-8192) };
  const ne = { x: fx.fx(8192), y: fx.fx(8192) };
  const nw = { x: fx.fx(-8192), y: fx.fx(8192) };
  const origin = { x: fx.fx(0), y: fx.fx(0) };

  function d(from: { x: fx.Fx; y: fx.Fx }, to: { x: fx.Fx; y: fx.Fx }): [number, number] {
    return [fx.delta(to.x, from.x), fx.delta(to.y, from.y)];
  }

  it('covers map corners, a 16384-unit delta, and the zero vector', () => {
    expect(fx.delta(fx.fx(8192), fx.fx(-8192))).toBe(D);
    expect(D).toBe(16384 * 65536);
    const corner = d(sw, ne);
    expect(corner).toEqual([D, D]);
    const squared = fx.distSq(corner[0], corner[1]);
    expect(squared).toEqual({ hi: C, lo: 0 });
    expect(i64ToBig(squared)).toBe(2305843009213693952n);
    expect(fx.isqrt64(squared)).toBe(1518500249);

    const axis = d({ x: fx.fx(-8192), y: fx.fx(0) }, { x: fx.fx(8192), y: fx.fx(0) });
    expect(axis).toEqual([D, 0]);
    const axisSq = fx.distSq(axis[0], axis[1]);
    expect(axisSq).toEqual({ hi: 268435456, lo: 0 });
    expect(i64ToBig(axisSq)).toBe(1152921504606846976n);
    expect(fx.isqrt64(axisSq)).toBe(D);

    expect(fx.distSq(0, 0)).toEqual({ hi: 0, lo: 0 });
    expect(fx.isqrt64(fx.distSq(0, 0))).toBe(0);
  });

  it('compares d² with r² at an off-by-one boundary and does not use a float square', () => {
    const radius = fx.distSq(3, 0);
    expect(radius).toEqual({ hi: 0, lo: 9 });
    expect(fx.cmpI64(fx.distSq(3, 0), radius)).toBe(0);
    expect(fx.isqrt64(fx.distSq(3, 0))).toBe(3);
    expect(fx.cmpI64(fx.distSq(2, 2), radius)).toBe(-1);
    expect(fx.isqrt64(fx.distSq(2, 2))).toBe(2);
    expect(fx.cmpI64(fx.distSq(3, 1), radius)).toBe(1);
    expect(fx.isqrt64(fx.distSq(3, 1))).toBe(3);

    expect(i64ToBig(fx.distSq(1518500250, 0))).toBe(1518500250n * 1518500250n);
    expect(i64ToBig(fx.cross(32232458, 0, 0, 478766522))).toBe(32232458n * 478766522n);
    const tricky = fx.distSq(D, 1);
    expect(tricky).toEqual({ hi: 268435456, lo: 1 });
    expect(D * D + 1).toBe(D * D);
  });

  it('returns cross-product signs at the corners, 0 when collinear, and opposite-sign products', () => {
    const swSe = d(sw, se);
    const swNw = d(sw, nw);
    const swNe = d(sw, ne);
    const swOrigin = d(sw, origin);
    const swSouth = d(sw, { x: fx.fx(0), y: fx.fx(-8192) });
    const nwSe = d(nw, se);
    const neSw = d(ne, sw);
    const seNw = d(se, nw);

    expect(swSe).toEqual([D, 0]);
    expect(swNw).toEqual([0, D]);
    expect(fx.cross(swSe[0], swSe[1], swNw[0], swNw[1])).toEqual({ hi: 268435456, lo: 0 });
    expect(fx.cmpI64(fx.cross(swSe[0], swSe[1], swNw[0], swNw[1]), fx.i64(0, 0))).toBe(1);
    expect(fx.cross(swNw[0], swNw[1], swSe[0], swSe[1])).toEqual({ hi: -268435456, lo: 0 });
    expect(fx.cmpI64(fx.cross(swNw[0], swNw[1], swSe[0], swSe[1]), fx.i64(0, 0))).toBe(-1);

    expect(fx.cross(swNe[0], swNe[1], swOrigin[0], swOrigin[1])).toEqual({ hi: 0, lo: 0 });
    expect(fx.cross(swSe[0], swSe[1], swSouth[0], swSouth[1])).toEqual({ hi: 0, lo: 0 });

    expect(nwSe).toEqual([D, -D]);
    expect(fx.cross(nwSe[0], nwSe[1], swNe[0], swNe[1])).toEqual({ hi: C, lo: 0 });
    expect(fx.cross(neSw[0], neSw[1], seNw[0], seNw[1])).toEqual({ hi: -C, lo: 0 });
  });

  it('dots the same corner vectors, including opposite signs', () => {
    const swSe = d(sw, se);
    const swNw = d(sw, nw);
    const nwSe = d(nw, se);
    const seNw = d(se, nw);
    expect(fx.dot(swSe[0], swSe[1], swNw[0], swNw[1])).toEqual({ hi: 0, lo: 0 });
    expect(fx.dot(swSe[0], swSe[1], swSe[0], swSe[1])).toEqual({ hi: 268435456, lo: 0 });
    expect(fx.dot(nwSe[0], nwSe[1], d(sw, ne)[0], d(sw, ne)[1])).toEqual({ hi: 0, lo: 0 });
    expect(fx.dot(nwSe[0], nwSe[1], nwSe[0], nwSe[1])).toEqual({ hi: C, lo: 0 });
    expect(fx.dot(nwSe[0], nwSe[1], seNw[0], seNw[1])).toEqual({ hi: -C, lo: 0 });
  });

  it('matches BigInt for distSq, cross, and dot inside the map delta', () => {
    const delta = fc.integer({ min: -D, max: D });
    fc.assert(
      fc.property(delta, delta, delta, delta, (x1, y1, x2, y2) => {
        const dist = fx.distSq(x1, y1);
        const distRef = BigInt(x1) * BigInt(x1) + BigInt(y1) * BigInt(y1);
        const cross = fx.cross(x1, y1, x2, y2);
        const crossRef = BigInt(x1) * BigInt(y2) - BigInt(y1) * BigInt(x2);
        const dot = fx.dot(x1, y1, x2, y2);
        const dotRef = BigInt(x1) * BigInt(x2) + BigInt(y1) * BigInt(y2);
        return i64ToBig(dist) === distRef && i64ToBig(cross) === crossRef && i64ToBig(dot) === dotRef;
      }),
      { seed: 20261124, numRuns: 60 },
    );
  });

  it('floors isqrt of uint32 and of random non-negative i64 values', () => {
    expect(fx.isqrt(0)).toBe(0);
    expect(fx.isqrt(1)).toBe(1);
    expect(fx.isqrt(8)).toBe(2);
    expect(fx.isqrt(9)).toBe(3);
    expect(fx.isqrt(0xffffffff)).toBe(65535);
    expect(() => fx.isqrt64(fx.i64(-1, 0))).toThrow(/negative/);

    function refIsqrt(n: bigint): bigint {
      if (n < 2n) return n;
      let x = n;
      let y = (x + 1n) / 2n;
      while (y < x) {
        x = y;
        y = (x + n / x) / 2n;
      }
      return x;
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0x1fffffff }),
        fc.integer({ min: 0, max: 0xffffffff }),
        (hi, lo) => {
          const value = fx.i64(hi, lo);
          return BigInt(fx.isqrt64(value)) === refIsqrt(i64ToBig(value));
        },
      ),
      { seed: 20261124, numRuns: 40 },
    );
  });
});
