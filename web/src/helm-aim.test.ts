import { describe, expect, it } from 'vitest';
import { compassHeading, headingToward } from './helm-aim.ts';

describe('helm aim', () => {
  it('points along the axes and the short diagonal', () => {
    expect(headingToward(0, 0, 4, 0)).toBe(0);
    expect(headingToward(0, 0, 0, 4)).toBe(16384);
    expect(headingToward(0, 0, -4, 0)).toBe(32768);
    expect(headingToward(0, 0, 0, -4)).toBe(49152);
    expect(headingToward(1, 1, 3, 3)).toBe(8192);
  });

  it('ignores a click on the ship', () => {
    expect(headingToward(2, 2, 2, 2)).toBeNull();
  });

  it('reads the compass with 0 to the right and positive heading up', () => {
    expect(compassHeading(10, 0)).toBe(0);
    expect(compassHeading(0, 10)).toBe(16384);
    expect(compassHeading(0, 0)).toBeNull();
  });
});
