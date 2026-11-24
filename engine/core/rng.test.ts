import { describe, expect, it } from 'vitest';
import {
  createRngStreams,
  createStreamFromState,
  expandSplitMix32,
  normalizeXoshiroState,
  streamSeed,
  unbiasedLimit,
  XOSHIRO_ZERO_REMAP,
  xoshiro128ss,
} from './rng.ts';

describe('xoshiro128**', () => {
  it('matches the published state {1,2,3,4} vector', () => {
    const state = Uint32Array.from([1, 2, 3, 4]);
    const expected = [0x00002d00, 0x00000000, 0x005a7080, 0x04389d80, 0x79199d9b, 0x61963b24];
    for (const word of expected) expect(xoshiro128ss(state)).toBe(word);
  });

  it('expands SplitMix32 from an independent vector and remaps the zero state', () => {
    expect(expandSplitMix32(0x12345678)).toEqual([0x047660ea, 0x6072b3dc, 0x49dccea9, 0x3bc1e822]);
    expect(expandSplitMix32(0)).toEqual([0x92ca2f0e, 0x3cd6e3f3, 0x1b147dcc, 0x4c081dbf]);
    expect(normalizeXoshiroState([0, 0, 0, 0])).toEqual([...XOSHIRO_ZERO_REMAP]);
    expect(normalizeXoshiroState([1, 0, 0, 0])).toEqual([1, 0, 0, 0]);
  });
});

describe('named streams', () => {
  it('rejects an unregistered fork and keeps streams independent', () => {
    const streams = createRngStreams(7);
    expect(() => streams.fork('particles')).toThrow(/unregistered/);
    const combat = streams.stream('combat').u32();
    const other = createRngStreams(7);
    other.stream('ai').u32();
    other.fork('mission').dice(3, 6);
    expect(other.stream('combat').u32()).toBe(combat);
    expect(streamSeed(1, 'combat')).not.toEqual(streamSeed(1, 'ai'));
    expect(streamSeed(1, 'combat')).toEqual(streamSeed(1, 'combat'));
  });

  it('draws dice as summed int rolls and does not consume a certain chance', () => {
    const left = createRngStreams(4).stream('combat');
    const right = createRngStreams(4).stream('combat');
    expect(left.dice(2, 6)).toBe(right.int(6) + right.int(6) + 2);
    const before = createRngStreams(4).stream('ai');
    const after = createRngStreams(4).stream('ai');
    expect(before.chance(0, 5)).toBe(false);
    expect(before.chance(5, 5)).toBe(true);
    expect(before.u32()).toBe(after.u32());
    expect(before.chance(1, 2)).toBe(after.int(2) < 1);
  });

  it('uses rejection so int(n) matches the low bits of a power of two', () => {
    const full = createRngStreams(11).stream('mission');
    const masked = createRngStreams(11).stream('mission');
    for (let i = 0; i < 24; i++) {
      expect(masked.int(8)).toBe(full.u32() & 7);
    }
    expect(createStreamFromState([1, 2, 3, 4]).int(1)).toBe(0);
    expect(() => createStreamFromState([1, 2, 3, 4]).int(0)).toThrow(/domain/);
  });

  it('sets the rejection limit to the largest multiple of n at or below 2^32', () => {
    const samples = [1, 2, 3, 5, 7, 100, 1024, 65536, 0x7fffffff, 0x80000000, 0xffffffff, 0x100000000];
    for (const n of samples) {
      const limit = BigInt(unbiasedLimit(n));
      const width = 1n << 32n;
      const expected = width - (width % BigInt(n));
      expect(limit).toBe(expected);
    }
    const stream = createRngStreams(3).stream('ai');
    for (let i = 0; i < 300; i++) {
      const roll = stream.int(3);
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(3);
    }
  });

  it('restores stream words in name order', () => {
    const streams = createRngStreams(99);
    streams.stream('ai').u32();
    streams.stream('combat').dice(2, 6);
    const saved = streams.states();
    const again = createRngStreams(99);
    again.restore(saved);
    expect(again.stream('mission').u32()).toBe(streams.stream('mission').u32());
    expect(again.states()).toEqual(streams.states());
  });
});
