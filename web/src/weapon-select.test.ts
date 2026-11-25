import { describe, expect, it } from 'vitest';
import { assignSlotsToGroup, selectAllSlots, selectWeaponClassSlots, supportsProximity, toggleSlot } from './weapon-select.ts';

describe('weapon selection', () => {
  it('toggles a slot in or out of a multi-selection', () => {
    expect(toggleSlot([0], 2)).toEqual([0, 2]);
    expect(toggleSlot([0, 2], 0)).toEqual([2]);
    expect(toggleSlot([2], 2)).toEqual([]);
  });

  it('collects every mount once for Select All', () => {
    expect(selectAllSlots([{ slotIndex: 0 }, { slotIndex: 3 }, { slotIndex: 3 }])).toEqual([0, 3]);
    expect(selectAllSlots([])).toEqual([]);
  });

  it('assigns the whole selection to one group and removes those slots from the others', () => {
    const groups = [[0], [1], [2], [], [], []];
    assignSlotsToGroup(groups, 2, [0, 3]);
    expect(groups[0]).toEqual([]);
    expect(groups[1]).toEqual([1]);
    expect(groups[2]).toEqual([2, 0, 3]);
  });

  it('treats only photon mounts as proximity-capable in this duel', () => {
    expect(supportsProximity({ family: 'photon' })).toBe(true);
    expect(supportsProximity({ family: 'phaser' })).toBe(false);
    expect(supportsProximity({ family: 'disruptor' })).toBe(false);
    expect(supportsProximity(undefined)).toBe(false);
  });

  it('selects every mount of the clicked weapon class for schematic clicks', () => {
    const mounts = [
      { slotIndex: 0, family: 'phaser' },
      { slotIndex: 1, family: 'phaser' },
      { slotIndex: 2, family: 'photon' },
    ];
    expect(selectWeaponClassSlots(mounts, 0)).toEqual([0, 1]);
    expect(selectWeaponClassSlots(mounts, 2)).toEqual([2]);
    expect(selectWeaponClassSlots(mounts, 9)).toEqual([9]);
  });
});
