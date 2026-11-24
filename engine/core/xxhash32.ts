import { readU32 } from './bytes.ts';

/** xxHash32 primes. Seed 0 is the contract default unless a caller passes another. */
const P1 = 0x9e3779b1;
const P2 = 0x85ebca77;
const P3 = 0xc2b2ae3d;
const P4 = 0x27d4eb2f;
const P5 = 0x165667b1;

function rotl(x: number, r: number): number {
  return ((x << r) | (x >>> (32 - r))) >>> 0;
}

function round(acc: number, input: number): number {
  const added = (acc + Math.imul(input, P2)) >>> 0;
  return Math.imul(rotl(added, 13), P1) >>> 0;
}

/** xxHash32 over raw bytes. All arithmetic is uint32 via Math.imul. */
export function xxhash32(data: Uint8Array, seed = 0): number {
  const len = data.length;
  const s = seed >>> 0;
  let i = 0;
  let h = 0;
  if (len >= 16) {
    let acc1 = (s + P1 + P2) >>> 0;
    let acc2 = (s + P2) >>> 0;
    let acc3 = s;
    let acc4 = (s - P1) >>> 0;
    while (i + 16 <= len) {
      acc1 = round(acc1, readU32(data, i));
      i += 4;
      acc2 = round(acc2, readU32(data, i));
      i += 4;
      acc3 = round(acc3, readU32(data, i));
      i += 4;
      acc4 = round(acc4, readU32(data, i));
      i += 4;
    }
    h =
      (rotl(acc1, 1) + rotl(acc2, 7) + rotl(acc3, 12) + rotl(acc4, 18)) >>> 0;
  } else {
    h = (s + P5) >>> 0;
  }
  h = (h + len) >>> 0;
  while (i + 4 <= len) {
    h = (h + Math.imul(readU32(data, i), P3)) >>> 0;
    h = Math.imul(rotl(h, 17), P4) >>> 0;
    i += 4;
  }
  while (i < len) {
    h = (h + Math.imul(data[i]!, P5)) >>> 0;
    h = Math.imul(rotl(h, 11), P1) >>> 0;
    i += 1;
  }
  h = Math.imul(h ^ (h >>> 15), P2) >>> 0;
  h = Math.imul(h ^ (h >>> 13), P3) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}
