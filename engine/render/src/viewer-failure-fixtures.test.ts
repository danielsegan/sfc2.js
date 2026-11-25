import { describe, expect, it } from 'vitest';
import { importInstall } from '@sfc2js/platform';
import { AdditiveBlending, MeshLambertMaterial } from 'three';
import { disposeShipCatalog, loadShipCatalog } from './ship-catalog.ts';
import { measureShipFrame } from './ship-stage.ts';
import { viewerFailureFiles } from './viewer-failure-fixtures.ts';

describe('viewer failure fixtures', () => {
  it('resolves the four classes without failing a real missing model', async () => {
    const catalog = await loadShipCatalog(await importInstall(viewerFailureFiles()));
    expect(catalog.ships.map((ship) => [ship.spawnKey, ship.expectedNoModel, ship.textured, ship.selfIlluminated])).toEqual([
      ['Neutral:CY', true, false, false],
      ['Neutral:CR', true, false, false],
      ['neutral:cw', true, false, false],
      ['Federation:TEST-CASE', false, true, false],
      ['Klingon:TEST-PATH', false, true, false],
      ['Lyran:TEST-MISS', false, false, false],
      ['Hydran:TEST-GLOW', false, true, false],
      ['Neutral:TEST-TINY', false, false, false],
      ['Neutral:TEST-DUMMY', false, false, false],
      ['Neutral:TEST-AXES', false, false, false],
      ['Neutral:TEST-QUAD', false, false, false],
      ['Neutral:TEST-SPECK', false, false, false],
      ['Neutral:TEST-INVIS', false, false, false],
      ['Neutral:TEST-ALPHA', false, false, false],
      ['Neutral:TEST-DARK', false, false, false],
      ['Neutral:TEST-BLEND', false, false, false],
      ['Neutral:TEST-ODD', false, false, false],
      ['Lyran:TEST-EXT', false, false, false],
      ['Federation:TEST-EMP', false, false, false],
      ['Neutral:TEST-BAD', false, false, false],
      ['Neutral:TEST-BALL', false, false, false],
    ]);
    expect(catalog.failures.map((failure) => [failure.spawnKey, failure.reason])).toEqual([
      ['Orion:TEST-STILL', 'loader.missingModel'],
    ]);

    const found = catalog.ships[3];
    const material = found?.mesh.materials[0] as MeshLambertMaterial;
    expect(pixel(material.map, 0)).toEqual([12, 34, 56, 255]);
    const missed = catalog.ships[5];
    expect(missed?.diagnostics.map((item) => item.code)).toContain('texturePlaceholder');
    expect(missed?.diagnostics.map((item) => item.code)).not.toContain('missingTexture');
    expect(missClass(catalog, 'Lyran:TEST-MISS')).toEqual(['missingFile']);
    expect(missClass(catalog, 'Neutral:TEST-ODD')).toEqual(['unusualName']);
    expect(missClass(catalog, 'Lyran:TEST-EXT')).toEqual(['unsupportedExtension']);
    expect(missClass(catalog, 'Federation:TEST-EMP')).toEqual(['differentEmpire']);
    expect(missClass(catalog, 'Neutral:TEST-BAD')).toEqual(['decodeFailed']);
    expect(JSON.stringify(catalog.ships.flatMap((ship) => ship.diagnostics))).not.toMatch(/glow#1|mark\.pcx|panel\.bmp|bad\.bmp|not-there/);

    const invis = materialOf(catalog, 'Neutral:TEST-INVIS');
    expect(invis.visible).toBe(false);
    const alpha = materialOf(catalog, 'Neutral:TEST-ALPHA');
    expect(alpha.opacity).toBe(0);
    expect(alpha.transparent).toBe(true);
    const dark = materialOf(catalog, 'Neutral:TEST-DARK');
    expect(dark.blending).toBe(AdditiveBlending);
    const axes = catalog.ships.find((ship) => ship.spawnKey === 'Neutral:TEST-AXES');
    expect(axes === undefined ? null : measureShipFrame(axes.mesh.root).frame.degenerate).toBe(true);
    const ball = catalog.ships.find((ship) => ship.spawnKey === 'Neutral:TEST-BALL');
    expect(ball === undefined ? null : measureShipFrame(ball.mesh.root).frame.radial).toBe(true);
    const glow = catalog.ships[6];
    expect(glow?.diagnostics.map((item) => item.code)).not.toContain('missingTextureName');
    expect((glow?.mesh.materials[0] as MeshLambertMaterial).emissiveMap).toBeNull();
    disposeShipCatalog(catalog);
  });
});

function missClass(
  catalog: { ships: { spawnKey: string; diagnostics: { code: string; details?: Record<string, unknown> }[] }[] },
  spawnKey: string,
): unknown[] {
  const ship = catalog.ships.find((item) => item.spawnKey === spawnKey);
  return (ship?.diagnostics ?? []).filter((item) => item.code === 'texturePlaceholder').map((item) => item.details?.miss);
}

function materialOf(
  catalog: { ships: { spawnKey: string; mesh: { materials: unknown[] } }[] },
  spawnKey: string,
): MeshLambertMaterial {
  const ship = catalog.ships.find((item) => item.spawnKey === spawnKey);
  return ship?.mesh.materials[0] as MeshLambertMaterial;
}

function pixel(texture: { image?: unknown } | null, index: number): number[] {
  const image = texture?.image as { data?: Uint8Array } | undefined;
  const data = image?.data;
  const start = index * 4;
  return [data?.[start] ?? 0, data?.[start + 1] ?? 0, data?.[start + 2] ?? 0, data?.[start + 3] ?? 0];
}
