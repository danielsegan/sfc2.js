import { describe, expect, it } from 'vitest';
import { mapOffset, nearestContact } from './map-geom.ts';

describe('sensor map', () => {
  it('puts the bow at the top of a heading-up map', () => {
    const self = { x: 0, y: 0, heading16: 0 };
    const ahead = mapOffset({ x: 10, y: 0 }, self, true);
    expect(ahead.x).toBeCloseTo(0, 5);
    expect(ahead.y).toBeCloseTo(10, 5);
    const north = mapOffset({ x: 10, y: 0 }, self, false);
    expect(north).toEqual({ x: 10, y: 0 });
  });

  it('picks the contact under the cursor', () => {
    const self = { x: 0, y: 0, heading16: 0 };
    const contacts = [
      { id: 1, x: 0, y: 0, kind: 'ship' },
      { id: 2, x: 4, y: 0, kind: 'ship' },
    ];
    expect(nearestContact(contacts, self, false, 6, 24, 0)).toBe(2);
    expect(nearestContact(contacts, self, false, 6, 0, 0)).toBe(1);
  });
});
