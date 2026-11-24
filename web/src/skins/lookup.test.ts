import { describe, expect, it } from 'vitest';
import { cursorCandidates, empireSkinId, resolveEmpireSkin } from './lookup.ts';

describe('empire skin lookup', () => {
  it('maps the shiplist race tokens onto skin ids', () => {
    expect(empireSkinId('Federation')).toBe('fed');
    expect(empireSkinId('ISC')).toBe('isc');
    expect(empireSkinId('Orion Pirates')).toBe('ori');
    expect(empireSkinId('Interceptor')).toBe('ori');
    expect(empireSkinId('Monster')).toBe('neutral');
    expect(empireSkinId('something else')).toBe('neutral');
  });

  it('uses the empire reticle when the name states one, else the shared targeting reticle', () => {
    const hydran = resolveEmpireSkin(['textures/Assets/textures/HydranRedicleCircle.BMP'], 'hyd');
    expect(hydran.reticlePath).toBe('textures/Assets/textures/HydranRedicleCircle.BMP');
    const klingon = resolveEmpireSkin(
      ['Assets/textures/Klingon-splat.BMP', 'Assets/textures/TargetingRedicles.BMP'],
      'kli',
    );
    expect(klingon.reticlePath).toBe('Assets/textures/TargetingRedicles.BMP');
    const splat = klingon.hits.find((hit) => hit.id === 'klingon.splat');
    expect(splat?.role).toBe('unknown');
    expect(splat?.indexedPath).toBe('Assets/textures/Klingon-splat.BMP');
  });

  it('does not treat an unknown bitmap as a plate', () => {
    const plan = resolveEmpireSkin(['Assets/bitmaps/ui/offScr.BMP', 'Assets/textures/L-crosshair-bar.BMP'], 'lyr');
    expect(plan.reticlePath).toBeNull();
    expect(plan.hits.filter((hit) => hit.indexedPath !== null).every((hit) => hit.role === 'unknown')).toBe(true);
  });

  it('names the inventoried cursor without decoding it', () => {
    expect(cursorCandidates('isc')).toContain('cursors/Assets/mouse/ISC.cur');
    expect(cursorCandidates('ori')).toEqual([]);
  });
});
