import { describe, expect, it } from 'vitest';
import { validateAuthoredPosition, validateMapBounds } from './map-bounds.ts';

describe('badMapBounds', () => {
  it('accepts the closed ±8192 box, including the fixture range 75', () => {
    expect(validateMapBounds({ minX: -8192, maxX: 8192, minY: 0, maxY: 75 })).toEqual([]);
    expect(validateAuthoredPosition(8192, -8192, 'x', 'y')).toEqual([]);
  });

  it('emits one mission diagnostic per bad axis and does not invent a message', () => {
    const diags = validateMapBounds({ minX: -8193, maxX: 1.5, minY: Number.NaN, maxY: 8192 }, 'missions/skirmish.json');
    expect(diags.map((d) => d.location?.field)).toEqual(['minX', 'maxX', 'minY']);
    for (const diag of diags) {
      expect(diag).toMatchObject({ code: 'badMapBounds', source: 'mission', severity: 'error' });
      expect(diag.location?.file).toBe('missions/skirmish.json');
      expect(diag).not.toHaveProperty('message');
    }
    const position = validateAuthoredPosition(0, 8193, 'spawnX', 'spawnY');
    expect(position).toHaveLength(1);
    expect(position[0]?.location?.field).toBe('spawnY');
    expect(position[0]?.location).not.toHaveProperty('file');
  });
});
