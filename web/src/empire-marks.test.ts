import { describe, expect, it } from 'vitest';
import { EMPIRE_MARKS, empireIdForRace, empireMarkFor } from './empire-marks.ts';
import { EMPIRE_SKINS, skinForRace } from './skins/catalog.ts';

describe('shared empire marks', () => {
  it('maps race tokens, the interceptor alias and unknowns', () => {
    expect(empireIdForRace('Federation')).toBe('fed');
    expect(empireIdForRace('Orion Pirates')).toBe('ori');
    expect(empireIdForRace('Interceptor')).toBe('ori');
    expect(empireIdForRace('Monster')).toBe('neutral');
    expect(empireMarkFor('').code).toBe('NEU');
  });

  it('gives every empire a distinct mark and a 3-letter code', () => {
    const marks = Object.values(EMPIRE_MARKS);
    expect(marks).toHaveLength(10);
    expect(new Set(marks.map((mark) => mark.path)).size).toBe(marks.length);
    for (const mark of marks) expect(mark.code).toMatch(/^[A-Z]{3}$/);
  });

  it('is the one source for the console skins', () => {
    for (const skin of EMPIRE_SKINS) {
      expect(skin.glyphs.code).toBe(EMPIRE_MARKS[skin.id].code);
    }
    expect(skinForRace('Interceptor').id).toBe('ori');
    expect(skinForRace('Klingon').glyphs.code).toBe('KLI');
  });
});
