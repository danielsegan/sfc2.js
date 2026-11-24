import { describe, expect, it } from 'vitest';
import { Allocator } from './allocator.ts';

describe('allocator', () => {
  it('hands out the lowest free index and bumps the generation on reuse', () => {
    const alloc = new Allocator();
    const a = alloc.alloc();
    const b = alloc.alloc();
    const c = alloc.alloc();
    expect(a).toBe(0x00010000);
    expect(b).toBe(0x00010001);
    expect(c).toBe(0x00010002);
    alloc.free(b);
    expect(alloc.isLive(b)).toBe(false);
    expect(alloc.isLive(a)).toBe(true);
    const reused = alloc.alloc();
    expect(reused & 0xffff).toBe(1);
    expect(reused >>> 16).toBe(2);
    expect(alloc.isLive(b)).toBe(false);
    expect(alloc.isLive(reused)).toBe(true);
    expect(() => alloc.free(b)).toThrow(/dead/);
  });
});
