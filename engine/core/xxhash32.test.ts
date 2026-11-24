import { describe, expect, it } from 'vitest';
import { xxhash32 } from './xxhash32.ts';

describe('xxhash32', () => {
  it('matches the public xxHash32 vectors', () => {
    const enc = new TextEncoder();
    expect(xxhash32(enc.encode(''), 0)).toBe(0x02cc5d05);
    expect(xxhash32(enc.encode('a'), 0)).toBe(0x550d7456);
    expect(xxhash32(enc.encode('ab'), 0)).toBe(0x4999fc53);
    expect(xxhash32(enc.encode('abc'), 0)).toBe(0x32d153ff);
    expect(xxhash32(enc.encode('abcd'), 0)).toBe(0xa3643705);
    expect(xxhash32(enc.encode('1234567890abcdef'), 0)).toBe(0x17fddd25);
    expect(xxhash32(Uint8Array.from({ length: 32 }, (_, i) => i), 0)).toBe(0x830741c1);
    expect(xxhash32(enc.encode(''), 0x12345678)).toBe(0xbd209070);
    expect(xxhash32(enc.encode('abc'), 0x12345678)).toBe(0x11364062);
  });
});
