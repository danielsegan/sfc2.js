import { describe, expect, it } from 'vitest';
import { LARGE_TURN_16, remainingArc16, wedgeColor } from './heading-wedge.ts';

describe('heading wedge', () => {
  it('colors by remaining angle, with the dark band at about 150 degrees', () => {
    expect(wedgeColor(0)).toBe(0xe08a2e);
    expect(wedgeColor(LARGE_TURN_16 - 1)).toBe(0xe08a2e);
    expect(wedgeColor(LARGE_TURN_16)).toBe(0x7a1e1e);
    expect(wedgeColor(-LARGE_TURN_16)).toBe(0x7a1e1e);
    expect(wedgeColor(32768)).toBe(0x7a1e1e);
  });

  it('takes the short way and ignores how long the turn will take', () => {
    expect(remainingArc16(0, 6000)).toBe(6000);
    expect(remainingArc16(0, 50000)).toBe(50000 - 65536);
    expect(remainingArc16(100.4, 100.4)).toBe(0);
  });
});
