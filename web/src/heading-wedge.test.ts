import { describe, expect, it } from 'vitest';
import { LARGE_TURN_16, WEDGE_MIN_16, helmWedge, wedgeColor } from './heading-wedge.ts';

describe('heading wedge', () => {
  it('colors by remaining angle, with the dark band at about 150 degrees', () => {
    expect(wedgeColor(0)).toBe(0xe08a2e);
    expect(wedgeColor(LARGE_TURN_16 - 1)).toBe(0xe08a2e);
    expect(wedgeColor(LARGE_TURN_16)).toBe(0x7a1e1e);
    expect(wedgeColor(-LARGE_TURN_16)).toBe(0x7a1e1e);
    expect(wedgeColor(32768)).toBe(0x7a1e1e);
  });

  it('drives the wedge from HelmView values and hides it when mode is none', () => {
    expect(helmWedge({ mode: 'none', remainingTurn16: 20000 })).toBeNull();
    expect(helmWedge(null)).toBeNull();
    expect(helmWedge({ mode: 'heading', remainingTurn16: WEDGE_MIN_16 - 1 })).toBeNull();
    expect(helmWedge({ mode: 'heading', remainingTurn16: 6000 })).toEqual({
      arc16: 6000,
      color: 0xe08a2e,
    });
    expect(helmWedge({ mode: 'heading', remainingTurn16: -30000 })).toEqual({
      arc16: -30000,
      color: 0x7a1e1e,
    });
    expect(helmWedge({ mode: 'het', remainingTurn16: LARGE_TURN_16 })).toEqual({
      arc16: LARGE_TURN_16,
      color: 0x7a1e1e,
    });
  });
});
