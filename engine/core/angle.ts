/**
 * uint16 BAM angles. sin/cos read the committed quarter-wave LUT.
 * atan2 is CORDIC over that same integer circle. LUT size is the open
 * 4096-step proposal, plus the exact 90° endpoint.
 */
import type { Angle16, Fx } from './brands.ts';
import { ATAN_CORDIC_BAM, SIN_QUARTER_LUT, SIN_QUARTER_STEPS } from './angle-lut.ts';

export type { Angle16 } from './brands.ts';

const QUARTER = 16384;
const HALF = 32768;
const FULL = 65536;
const CORDIC_LIMIT = 1000000000;

export function angle16(bam: number): Angle16 {
  return (bam & 0xffff) as Angle16;
}

/**
 * Signed shortest turn from `from` to `to`, in BAM, range −32768..32767.
 * A half-turn tie breaks toward −32768.
 */
export function shortestArc(from: Angle16, to: Angle16): number {
  const d = ((to as number) - (from as number)) & 0xffff;
  if (d > 32767) return d - FULL;
  return d;
}

function quarterSin(bamInQuarter: number): number {
  if (bamInQuarter <= 0) return 0;
  if (bamInQuarter >= QUARTER) return SIN_QUARTER_LUT[SIN_QUARTER_STEPS]!;
  return SIN_QUARTER_LUT[bamInQuarter >>> 2]!;
}

export function sin16(a: Angle16): Fx {
  const bam = (a as number) & 0xffff;
  const q = bam >>> 14;
  const r = bam & 0x3fff;
  let s = 0;
  if (q === 0) s = quarterSin(r);
  else if (q === 1) s = quarterSin(QUARTER - r);
  else if (q === 2) s = -quarterSin(r);
  else s = -quarterSin(QUARTER - r);
  if (s === 0) s = 0; // unary minus of 0 is -0; the sim stores +0
  return s as Fx;
}

export function cos16(a: Angle16): Fx {
  return sin16(angle16((a as number) + QUARTER));
}

function absI32(n: number): number {
  const v = n | 0;
  if (v >= 0) return v;
  if (v === -2147483648) return 2147483648;
  return -v;
}

/** First-quadrant atan2(|y|, |x|) in BAM, after scaling into the CORDIC window. */
function cordicQuarter(y: number, x: number): number {
  let yy = y;
  let xx = x;
  while (xx > CORDIC_LIMIT || yy > CORDIC_LIMIT) {
    xx = xx >>> 1;
    yy = yy >>> 1;
  }
  while (xx < 268435456 && yy < 268435456) {
    if (xx === 0 && yy === 0) break;
    const nx = xx + xx;
    const ny = yy + yy;
    if (nx > CORDIC_LIMIT || ny > CORDIC_LIMIT) break;
    xx = nx;
    yy = ny;
  }
  let sx = xx | 0;
  let sy = yy | 0;
  let z = 0;
  for (let i = 0; i < ATAN_CORDIC_BAM.length; i++) {
    const dx = sx >> i;
    const dy = sy >> i;
    if (sy >= 0) {
      sx = sx + dy;
      sy = sy - dx;
      z += ATAN_CORDIC_BAM[i]!;
    } else {
      sx = sx - dy;
      sy = sy + dx;
      z -= ATAN_CORDIC_BAM[i]!;
    }
  }
  if (z < 0) return 0;
  if (z > QUARTER) return QUARTER;
  return z;
}

/** Integer atan2. Axes and exact diagonals are exact; other angles are CORDIC. */
export function atan2_16(y: number, x: number): Angle16 {
  const yy = y | 0;
  const xx = x | 0;
  if (xx === 0 && yy === 0) return angle16(0);
  if (xx === 0) return angle16(yy > 0 ? QUARTER : 49152);
  if (yy === 0) return angle16(xx > 0 ? 0 : HALF);
  const ax = absI32(xx);
  const ay = absI32(yy);
  if (ax === ay) {
    if (xx > 0 && yy > 0) return angle16(8192);
    if (xx < 0 && yy > 0) return angle16(24576);
    if (xx < 0 && yy < 0) return angle16(40960);
    return angle16(57344);
  }
  let ang = cordicQuarter(ay, ax);
  if (xx < 0 && yy >= 0) ang = HALF - ang;
  else if (xx < 0 && yy < 0) ang = HALF + ang;
  else if (yy < 0) ang = (FULL - ang) & 0xffff;
  return angle16(ang);
}
