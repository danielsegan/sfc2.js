import { describe, expect, it } from 'vitest';
import { importInstall } from '@sfc2js/platform';
import { MeshLambertMaterial } from 'three';
import { disposeShipCatalog, loadShipCatalog } from './ship-catalog.ts';
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
    const glow = catalog.ships[6];
    expect(glow?.diagnostics.map((item) => item.code)).not.toContain('missingTextureName');
    expect((glow?.mesh.materials[0] as MeshLambertMaterial).emissiveMap).toBeNull();
    disposeShipCatalog(catalog);
  });
});

function pixel(texture: { image?: unknown } | null, index: number): number[] {
  const image = texture?.image as { data?: Uint8Array } | undefined;
  const data = image?.data;
  const start = index * 4;
  return [data?.[start] ?? 0, data?.[start + 1] ?? 0, data?.[start + 2] ?? 0, data?.[start + 3] ?? 0];
}
