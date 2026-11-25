import { describe, expect, it } from 'vitest';
import {
  clampReinforceAmount,
  formatFacingList,
  selectFacing,
  toggleAllFacings,
} from './shield-select.ts';

describe('shield facing selection', () => {
  it('replaces the selection on a plain pick and toggles membership when additive', () => {
    expect(selectFacing([], 0, false)).toEqual([0]);
    expect(selectFacing([0], 3, false)).toEqual([3]);
    expect(selectFacing([0], 3, true)).toEqual([0, 3]);
    expect(selectFacing([0, 3], 0, true)).toEqual([3]);
    expect(selectFacing([3], 9, true)).toEqual([3]);
    expect(selectFacing([3], 1.5, false)).toEqual([3]);
  });

  it('selects every facing, then none, on successive all-toggles', () => {
    expect(toggleAllFacings([])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(toggleAllFacings([0, 3])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(toggleAllFacings([0, 1, 2, 3, 4, 5])).toEqual([]);
    expect(toggleAllFacings([0, 0, 1, 2, 3, 4, 5, 9])).toEqual([]);
  });

  it('clamps the pending amount to integer energy points in 0..100', () => {
    expect(clampReinforceAmount(6)).toBe(6);
    expect(clampReinforceAmount(-1)).toBe(0);
    expect(clampReinforceAmount(101)).toBe(100);
    expect(clampReinforceAmount(1.5)).toBe(0);
    expect(clampReinforceAmount(Number.NaN)).toBe(0);
  });

  it('names the current selection for the readout', () => {
    expect(formatFacingList([])).toBe('None');
    expect(formatFacingList([0, 3])).toBe('Bow, Stern');
    expect(formatFacingList([0, 1, 2, 3, 4, 5])).toBe('All');
  });
});
