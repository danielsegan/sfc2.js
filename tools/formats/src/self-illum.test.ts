import { describe, expect, it } from 'vitest';
import { machinePathLeak } from './diagnostic.ts';
import { pairSelfIllumination } from './self-illum.ts';

describe('pairSelfIllumination', () => {
  it('pairs a base with the _<n>i map in the same directory', () => {
    const indexed = pairSelfIllumination([
      'Assets/Models/test/panel.bmp',
      'Assets/Models/test/Hull_1.bmp',
      'Assets/Models/test/Hull_1i.bmp',
      'Assets/Models/test/Hull_2.bmp',
      'notes.txt',
    ]);
    expect(indexed.diagnostics).toEqual([]);
    expect(indexed.pairs).toEqual([
      { basePath: 'Assets/Models/test/Hull_1.bmp', selfIllumPath: 'Assets/Models/test/Hull_1i.bmp' },
      { basePath: 'Assets/Models/test/Hull_2.bmp' },
      { basePath: 'Assets/Models/test/panel.bmp' },
    ]);
  });

  it('matches case-insensitively and allows a token with trailing letters', () => {
    const indexed = pairSelfIllumination([
      'Assets/Models/test/Glow_512a.bmp',
      'Assets/Models/test/glow_512ai.BMP',
      'Assets/Models/test/HULL_1.BMP',
      'assets/models/test/hull_1i.bmp',
    ]);
    expect(indexed.diagnostics).toEqual([]);
    expect(indexed.pairs).toEqual([
      { basePath: 'Assets/Models/test/Glow_512a.bmp', selfIllumPath: 'Assets/Models/test/glow_512ai.BMP' },
      { basePath: 'Assets/Models/test/HULL_1.BMP', selfIllumPath: 'assets/models/test/hull_1i.bmp' },
    ]);
  });

  it('warns when a glow map has no base and does not pair across directories', () => {
    const indexed = pairSelfIllumination([
      'Assets/Models/a/Hull_9i.bmp',
      'Assets/Models/b/Hull_9.bmp',
      'C:/Users/me/Hull_1i.bmp',
    ]);
    expect(indexed.pairs).toEqual([{ basePath: 'Assets/Models/b/Hull_9.bmp' }]);
    expect(indexed.diagnostics.map((item) => item.code)).toEqual(['orphanSelfIllum']);
    expect(indexed.diagnostics[0]?.location?.file).toBe('Assets/Models/a/Hull_9i.bmp');
    expect(indexed.diagnostics[0]?.details).toEqual({ illumPath: 'Assets/Models/a/Hull_9i.bmp' });
    expect(machinePathLeak(indexed.diagnostics)).toBeNull();
  });
});
