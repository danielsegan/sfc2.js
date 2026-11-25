import { describe, expect, it } from 'vitest';
import { barFractionFromClientX, formatSpeed, orderedSpeedFromField, SPEED_ORDER_STEP, speedBarGesture, speedFromBarFraction } from './speed-bar.ts';

describe('speed bar mapping', () => {
  it('maps a click or drag position to 0..max at tenths', () => {
    expect(SPEED_ORDER_STEP).toBe(0.1);
    expect(speedFromBarFraction(0, 32)).toBe(0);
    expect(speedFromBarFraction(1, 32)).toBe(32);
    expect(speedFromBarFraction(0.5, 32)).toBe(16);
    expect(speedFromBarFraction(0.51, 32)).toBeCloseTo(16.3, 10);
    expect(speedFromBarFraction(15.4 / 32, 32)).toBeCloseTo(15.4, 10);
    expect(speedFromBarFraction(-0.2, 32)).toBe(0);
    expect(speedFromBarFraction(1.4, 32)).toBe(32);
    expect(speedFromBarFraction(0.5, 0)).toBe(0);
    expect(speedFromBarFraction(Number.NaN, 32)).toBe(0);
  });

  it('ignores an empty ordered-speed field and keeps an explicit zero', () => {
    expect(orderedSpeedFromField('')).toBeNull();
    expect(orderedSpeedFromField('   ')).toBeNull();
    expect(orderedSpeedFromField('nope')).toBeNull();
    expect(orderedSpeedFromField('0')).toBe(0);
    expect(orderedSpeedFromField('4.2')).toBe(4.2);
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

  it('formats current and ordered speed with one decimal', () => {
    expect(formatSpeed(0)).toBe('0.0');
    expect(formatSpeed(4)).toBe('4.0');
    expect(formatSpeed(15.4)).toBe('15.4');
    expect(formatSpeed(Number.NaN)).toBe('0.0');
  });
});
