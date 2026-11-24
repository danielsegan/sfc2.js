import { describe, expect, it } from 'vitest';
import { atan2_16, angle16, cos16, shortestArc, sin16 } from './angle.ts';
import { SIN_QUARTER_LUT, SIN_QUARTER_STEPS } from './angle-lut.ts';
import { xxhash32 } from './xxhash32.ts';

function bamDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 65536;
  return Math.min(d, 65536 - d);
}

function lutBytes(): Uint8Array {
  const out = new Uint8Array(SIN_QUARTER_LUT.length * 4);
  for (let i = 0; i < SIN_QUARTER_LUT.length; i++) {
    const v = SIN_QUARTER_LUT[i]! >>> 0;
    out[i * 4] = v & 0xff;
    out[i * 4 + 1] = (v >>> 8) & 0xff;
    out[i * 4 + 2] = (v >>> 16) & 0xff;
    out[i * 4 + 3] = (v >>> 24) & 0xff;
  }
  return out;
}

describe('angle16', () => {
  it('pins the quarter-wave LUT and the cardinal sines', () => {
    expect(SIN_QUARTER_STEPS).toBe(4096);
    expect(SIN_QUARTER_LUT[0]).toBe(0);
    expect(SIN_QUARTER_LUT[2048]).toBe(46341);
    expect(SIN_QUARTER_LUT[4096]).toBe(65536);
    expect(xxhash32(lutBytes(), 0)).toBe(2382627561);
    expect(sin16(angle16(0))).toBe(0);
    expect(sin16(angle16(16384))).toBe(65536);
    expect(sin16(angle16(32768))).toBe(0);
    expect(sin16(angle16(49152))).toBe(-65536);
    expect(cos16(angle16(0))).toBe(65536);
    expect(sin16(angle16(8192))).toBe(46341);
    expect(cos16(angle16(8192))).toBe(46341);
  });

  it('wraps and takes the short arc, with a half-turn tie toward -32768', () => {
    expect(angle16(65537)).toBe(1);
    expect(angle16(-1)).toBe(65535);
    expect(shortestArc(angle16(0), angle16(100))).toBe(100);
    expect(shortestArc(angle16(0), angle16(40000))).toBe(40000 - 65536);
    expect(shortestArc(angle16(0), angle16(32768))).toBe(-32768);
    expect(shortestArc(angle16(10), angle16(10))).toBe(0);
  });

  it('returns exact axes and diagonals, and stays within 4 BAM of atan2 elsewhere', () => {
    expect(atan2_16(0, 0)).toBe(0);
    expect(atan2_16(1, 0)).toBe(16384);
    expect(atan2_16(0, -1)).toBe(32768);
    expect(atan2_16(-1, 0)).toBe(49152);
    expect(atan2_16(5, 5)).toBe(8192);
    expect(atan2_16(5, -5)).toBe(24576);
    expect(atan2_16(-5, -5)).toBe(40960);
    expect(atan2_16(-5, 5)).toBe(57344);
    expect(atan2_16(0, -2147483648)).toBe(32768);
    const magnitudes = [1, 2, 3, 7, 100, 1000, 65536, 1 << 20];
    for (const mag of magnitudes) {
      for (let deg = 0; deg < 360; deg += 15) {
        const rad = (deg * Math.PI) / 180;
        const x = Math.round(Math.cos(rad) * mag);
        const y = Math.round(Math.sin(rad) * mag);
        const got = atan2_16(y, x) as number;
        const expected = Math.round((Math.atan2(y, x) / (Math.PI * 2)) * 65536) & 0xffff;
        expect(bamDistance(got, expected)).toBeLessThanOrEqual(4);
      }
    }
  });

  it('recovers a LUT angle from sin and cos within 8 BAM', () => {
    for (let bam = 0; bam < 65536; bam += 256) {
      const s = sin16(angle16(bam)) as number;
      const c = cos16(angle16(bam)) as number;
      expect(bamDistance(atan2_16(s, c) as number, bam)).toBeLessThanOrEqual(8);
    }
  });
});
