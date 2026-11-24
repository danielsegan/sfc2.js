/**
 * xoshiro128** and the named sim streams.
 * Seeding: SplitMix32 expansion of xxHash32(u32le(matchSeed) ‖ utf8(streamName)), seed 0.
 */
import { ByteBuf } from './bytes.ts';
import { udivmod } from './i64.ts';
import { xxhash32 } from './xxhash32.ts';

export const STREAM_NAMES = ['ai', 'combat', 'mission'] as const;
export type RegisteredStream = (typeof STREAM_NAMES)[number];

/**
 * Stuck all-zero xoshiro state is replaced with these four words
 * (fractional bits of the golden ratio, pi, e, and sqrt(2)).
 */
export const XOSHIRO_ZERO_REMAP: readonly [number, number, number, number] = [
  0x9e3779b9, 0x243f6a88, 0xb7e15162, 0x6a09e667,
];

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** One xoshiro128** draw. Mutates `s` in place. */
export function xoshiro128ss(s: Uint32Array): number {
  const result = Math.imul(rotl(Math.imul(s[1]!, 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1]! << 9) >>> 0;
  s[2] ^= s[0]!;
  s[3] ^= s[1]!;
  s[1] ^= s[2]!;
  s[0] ^= s[3]!;
  s[2] ^= t;
  s[3] = rotl(s[3]!, 11);
  return result;
}

/**
 * SplitMix32, MurmurHash3 fmix finalizer.
 * state = (state + 0x9E3779B9) >>> 0, then the fmix32 mix, four draws for a stream.
 */
export function expandSplitMix32(seed: number): [number, number, number, number] {
  let x = seed >>> 0;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    out[i] = (z ^ (z >>> 16)) >>> 0;
  }
  return out;
}

export function normalizeXoshiroState(
  words: readonly [number, number, number, number],
): [number, number, number, number] {
  if (words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0) {
    return [XOSHIRO_ZERO_REMAP[0], XOSHIRO_ZERO_REMAP[1], XOSHIRO_ZERO_REMAP[2], XOSHIRO_ZERO_REMAP[3]];
  }
  return [words[0] >>> 0, words[1] >>> 0, words[2] >>> 0, words[3] >>> 0];
}

export function streamSeed(matchSeed: number, name: string): [number, number, number, number] {
  const buf = new ByteBuf();
  buf.u32(matchSeed);
  buf.ascii(name);
  return normalizeXoshiroState(expandSplitMix32(xxhash32(buf.toUint8(), 0)));
}

/** Largest multiple of n that is ≤ 2^32. Samples ≥ this limit are rejected. */
export function unbiasedLimit(n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) throw new Error('unbiasedLimit');
  const rem = udivmod(0x100000000, n).r;
  return 0x100000000 - rem;
}

export interface StreamRng {
  u32(): number;
  int(n: number): number;
  dice(k: number, sides: number): number;
  chance(num: number, den: number): boolean;
  state(): readonly [number, number, number, number];
}

export interface RngStreams {
  stream(name: RegisteredStream): StreamRng;
  /** Opens a registered stream. Unregistered names throw in every build. */
  fork(name: string): StreamRng;
  states(): readonly (readonly [number, number, number, number])[];
  restore(states: readonly (readonly [number, number, number, number])[]): void;
}

class XoshiroStream implements StreamRng {
  private readonly s: Uint32Array;

  constructor(state: readonly [number, number, number, number]) {
    this.s = Uint32Array.from(state);
  }

  u32(): number {
    return xoshiro128ss(this.s);
  }

  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) throw new Error('int(n) domain');
    if (n === 1) return 0;
    const limit = unbiasedLimit(n);
    const rem = 0x100000000 - limit;
    let x = 0;
    do {
      x = this.u32();
    } while (rem !== 0 && x >= limit);
    return udivmod(x, n).r;
  }

  dice(k: number, sides: number): number {
    if (!Number.isInteger(k) || k < 0 || k > 1000000) throw new Error('dice count');
    if (!Number.isInteger(sides) || sides <= 0) throw new Error('dice sides');
    let sum = 0;
    for (let i = 0; i < k; i++) sum += this.int(sides) + 1;
    return sum;
  }

  chance(num: number, den: number): boolean {
    if (!Number.isInteger(num) || !Number.isInteger(den) || den <= 0) throw new Error('chance');
    if (num <= 0) return false;
    if (num >= den) return true;
    return this.int(den) < num;
  }

  state(): readonly [number, number, number, number] {
    return [this.s[0]!, this.s[1]!, this.s[2]!, this.s[3]!];
  }

  load(state: readonly [number, number, number, number]): void {
    this.s[0] = state[0];
    this.s[1] = state[1];
    this.s[2] = state[2];
    this.s[3] = state[3];
  }
}

function isRegistered(name: string): name is RegisteredStream {
  for (let i = 0; i < STREAM_NAMES.length; i++) {
    if (STREAM_NAMES[i] === name) return true;
  }
  return false;
}

export function createRngStreams(matchSeed: number): RngStreams {
  if (!Number.isInteger(matchSeed) || matchSeed < 0 || matchSeed > 0xffffffff) {
    throw new Error('match seed must be a uint32');
  }
  const streams: Record<RegisteredStream, XoshiroStream> = {
    ai: new XoshiroStream(streamSeed(matchSeed, 'ai')),
    combat: new XoshiroStream(streamSeed(matchSeed, 'combat')),
    mission: new XoshiroStream(streamSeed(matchSeed, 'mission')),
  };
  return {
    stream(name: RegisteredStream): StreamRng {
      return streams[name];
    },
    fork(name: string): StreamRng {
      if (!isRegistered(name)) throw new Error(`unregistered RNG stream: ${name}`);
      return streams[name];
    },
    states(): readonly (readonly [number, number, number, number])[] {
      const out: (readonly [number, number, number, number])[] = [];
      for (let i = 0; i < STREAM_NAMES.length; i++) out.push(streams[STREAM_NAMES[i]!]!.state());
      return out;
    },
    restore(next: readonly (readonly [number, number, number, number])[]): void {
      if (next.length !== STREAM_NAMES.length) throw new Error('rng restore width');
      for (let i = 0; i < STREAM_NAMES.length; i++) streams[STREAM_NAMES[i]!]!.load(next[i]!);
    },
  };
}

/** A bare generator from four words. Used by the golden-vector test and by WASM comparisons. */
export function createStreamFromState(state: readonly [number, number, number, number]): StreamRng {
  return new XoshiroStream(normalizeXoshiroState(state));
}
