import { describe, expect, it } from 'vitest';
import { bitmapPlateTier, fitUiScale, formatUiScale, uiScaleQuarters } from './scale.ts';

describe('ui scale', () => {
  it('lists 1.0 through 4.0 in quarter steps', () => {
    const labels = uiScaleQuarters().map((quarter) => formatUiScale(quarter));
    expect(labels[0]).toBe('1');
    expect(labels).toContain('1.25');
    expect(labels).toContain('2.5');
    expect(labels[labels.length - 1]).toBe('4');
    expect(labels).toHaveLength(13);
  });

  it('picks the largest step that fits 1024 by 768', () => {
    expect(formatUiScale(fitUiScale(1024, 768))).toBe('1');
    expect(formatUiScale(fitUiScale(1600, 1200))).toBe('1.5');
    expect(formatUiScale(fitUiScale(4096, 3072))).toBe('4');
  });

  it('samples bitmap plates from the nearest larger tier', () => {
    expect(bitmapPlateTier(4)).toBe(2);
    expect(bitmapPlateTier(8)).toBe(2);
    expect(bitmapPlateTier(9)).toBe(4);
    expect(bitmapPlateTier(16)).toBe(4);
  });
});