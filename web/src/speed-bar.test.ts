import { describe, expect, it } from 'vitest';
import { barFractionFromClientX, speedBarGesture, speedFromBarFraction } from './speed-bar.ts';

describe('speed bar mapping', () => {
  it('rounds a click or drag position to a whole speed in 0..max', () => {
    expect(speedFromBarFraction(0, 32)).toBe(0);
    expect(speedFromBarFraction(1, 32)).toBe(32);
    expect(speedFromBarFraction(0.5, 32)).toBe(16);
    expect(speedFromBarFraction(0.51, 32)).toBe(16);
    expect(speedFromBarFraction(-0.2, 32)).toBe(0);
    expect(speedFromBarFraction(1.4, 32)).toBe(32);
    expect(speedFromBarFraction(0.5, 0)).toBe(0);
    expect(speedFromBarFraction(Number.NaN, 32)).toBe(0);
  });

  it('converts a client X into a 0–1 fraction of the bar', () => {
    expect(barFractionFromClientX(50, 0, 100)).toBe(0.5);
    expect(barFractionFromClientX(0, 10, 0)).toBe(0);
  });

  it('starts a left-button capture drag and only moves while captured', () => {
    expect(speedBarGesture('pointerdown', 0, false)).toBe('start');
    expect(speedBarGesture('pointerdown', 2, false)).toBe('ignore');
    expect(speedBarGesture('pointermove', 0, false)).toBe('ignore');
    expect(speedBarGesture('pointermove', 0, true)).toBe('move');
    expect(speedBarGesture('pointerup', 0, true)).toBe('end');
    expect(speedBarGesture('pointercancel', 0, true)).toBe('end');
    expect(speedBarGesture('pointerup', 0, false)).toBe('ignore');
  });
});
