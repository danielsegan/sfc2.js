import { describe, expect, it } from 'vitest';
import { mapOffset, mapWorldAt, nearestContact } from './map-geom.ts';

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

  it('turns a map click back into a world point', () => {
    const self = { x: 2, y: -3, heading16: 0 };
    const world = mapWorldAt(self, false, 4, 8, -12);
    expect(world.x).toBeCloseTo(4, 5);
    expect(world.y).toBeCloseTo(0, 5);
    const back = mapOffset(world, self, true);
    const round = mapWorldAt(self, true, 5, back.x * 5, -back.y * 5);
    expect(round.x).toBeCloseTo(world.x, 4);
    expect(round.y).toBeCloseTo(world.y, 4);
  });
});
