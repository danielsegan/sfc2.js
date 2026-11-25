import { describe, expect, it } from 'vitest';
import { machinePathLeak } from '@sfc2js/formats';
import { importInstall, type ImportResult, type Vfs } from '@sfc2js/platform';
import { MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { disposeShipCatalog, loadShipCatalog } from './ship-catalog.ts';
import { HD_SELF_ILLUM_BLOOM_THRESHOLD } from './ship-texture.ts';
import { syntheticViewerFiles } from './synthetic-viewer-install.ts';

describe('loadShipCatalog', () => {
  it('loads every shiplist row it can and lists the rest with a reason', async () => {
    const imported = await importInstall(syntheticViewerFiles());
    expect(imported.ok).toBe(true);
    const catalog = await loadShipCatalog(imported);

    expect(catalog.shiplistPath).toBe('Assets/Specs/shiplist.txt');
    expect(catalog.ships.map((ship) => ship.spawnKey)).toEqual([
      'Federation:TEST-CA-01',
      'Neutral:TEST-BS-05',
      'Lyran:TEST-CA-07',
    ]);
    expect(catalog.failures.map((failure) => [failure.spawnKey, failure.reason, failure.line])).toEqual([
      ['Klingon:TEST-CL-02', 'loader.missingModel', 4],
      ['Romulan:TEST-DN-03', 'mod.badSignature', 5],
      ['Gorn:TEST-FF-04', 'shiplist.missingGeometry', 6],
      ['Hydran:TEST-CA-06', 'mod.modelPathRejected', 8],
      ['ISC:TEST-CA-08', 'loader.noDrawableMesh', 10],
    ]);
    expect(catalog.ships.length + catalog.failures.length).toBe(8);

    const textured = catalog.ships[0];
    expect(textured?.textured).toBe(true);
    expect(textured?.selfIlluminated).toBe(true);
    expect(textured?.geometry).toBe('Assets/Models/test/Good.mod');
    const material = textured?.mesh.materials[0] as MeshLambertMaterial;
    expect(material).toBeInstanceOf(MeshLambertMaterial);
    expect(material.emissive.getHex()).toBe(0xffffff);
    expect(pixel(material.map, 0)).toEqual([30, 90, 160, 255]);
    expect(pixel(material.emissiveMap, 0)).toEqual([240, 20, 10, 255]);
    expect(pixel(material.emissiveMap, 3)).toEqual([0, 0, 0, 255]);

    const plain = catalog.ships[1];
    expect(plain?.textured).toBe(false);
    expect(plain?.selfIlluminated).toBe(false);
    const slash = catalog.ships[2];
    expect(slash?.geometry).toBe('Assets/Models/test/Good.mod');
    expect(slash?.selfIlluminated).toBe(true);

    const missing = catalog.failures[0];
    expect(missing?.diagnostics[0]?.location?.file).toBe('Assets/Models/test/Missing.mod');
    const rejected = catalog.failures[3];
    expect(rejected?.diagnostics[0]?.location?.file).toBe('Assets/Specs/shiplist.txt');
    expect(rejected?.diagnostics[0]?.details).toEqual({ spawnKey: 'Hydran:TEST-CA-06' });

    expect(installRelative(catalog.diagnostics)).toBe(true);
    expect(machinePathLeak(catalog.diagnostics)).toBeNull();
    expect(machinePathLeak(catalog.failures)).toBeNull();
    expect(machinePathLeak(catalog.ships.map((ship) => ship.geometry))).toBeNull();
    disposeShipCatalog(catalog);
  });

  it('keeps loading after one model read throws, and does not keep the error text', async () => {
    const imported = await importInstall(syntheticViewerFiles());
    const vfs = imported.vfs;
    expect(vfs).not.toBeNull();
    if (vfs === null) return;
    const catalog = await loadShipCatalog(withRead(imported, vfs, async (path) => {
      if (path.toLowerCase().endsWith('bad.mod')) throw new Error('C:\\Users\\secret\\Bad.mod');
      return vfs.read(path);
    }));
    expect(catalog.failures.map((failure) => failure.reason)).toContain('importer.permissionDenied');
    expect(catalog.ships.map((ship) => ship.spawnKey)).toContain('Neutral:TEST-BS-05');
    expect(catalog.ships.map((ship) => ship.spawnKey)).toContain('Lyran:TEST-CA-07');
    expect(machinePathLeak(catalog.failures)).toBeNull();
    expect(JSON.stringify(catalog.failures)).not.toContain('secret');
    disposeShipCatalog(catalog);
  });

  it('uses the HD material tier without dropping a ship that failed earlier', async () => {
    const catalog = await loadShipCatalog(await importInstall(syntheticViewerFiles()), { tier: 'hd' });
    const material = catalog.ships[0]?.mesh.materials[0] as MeshStandardMaterial;
    expect(material).toBeInstanceOf(MeshStandardMaterial);
    expect(material.emissiveMap).not.toBeNull();
    expect(material.userData.selfIllumBloomThreshold).toBe(HD_SELF_ILLUM_BLOOM_THRESHOLD);
    expect(catalog.failures[0]?.spawnKey).toBe('Klingon:TEST-CL-02');
    disposeShipCatalog(catalog);
  });

  it('shows a placeholder for neutral CY, CR, and CW hulls that have no model', async () => {
    const table = new TextEncoder().encode(
      [
        'Race\tHull Type\tClass\tGeometry',
        'Neutral\tCY\tTEST-CY-01\t',
        'Neutral\tCR\tTEST-CR-02\tAssets/Models/test/Missing.mod',
        'neutral\tcw\tTEST-CW-03\t',
        'Federation\tCA\tTEST-CA-04\t',
        'Klingon\tCY\tTEST-CY-05\t',
      ].join('\n'),
    );
    const catalog = await loadShipCatalog(
      await importInstall([
        picked('Starfleet2CE.exe', Uint8Array.of(0)),
        picked('Assets/Specs/shiplist.txt', table),
      ]),
    );
    expect(catalog.ships.map((ship) => [ship.spawnKey, ship.placeholder, ship.hullType])).toEqual([
      ['Neutral:TEST-CY-01', true, 'CY'],
      ['Neutral:TEST-CR-02', true, 'CR'],
      ['neutral:TEST-CW-03', true, 'cw'],
    ]);
    expect(catalog.ships.every((ship) => ship.mesh.lods.length === 1)).toBe(true);
    expect(catalog.failures.map((failure) => [failure.spawnKey, failure.reason])).toEqual([
      ['Federation:TEST-CA-04', 'shiplist.missingGeometry'],
      ['Klingon:TEST-CY-05', 'shiplist.missingGeometry'],
    ]);
    const noted = catalog.diagnostics.filter((item) => item.code === 'noHullModel');
    expect(catalog.ships.every((ship) => ship.expectedNoModel)).toBe(true);
    expect(noted.map((item) => item.details)).toEqual([
      { spawnKey: 'Neutral:TEST-CY-01', hullType: 'CY', race: 'Neutral', className: 'TEST-CY-01' },
      { spawnKey: 'Neutral:TEST-CR-02', hullType: 'CR', race: 'Neutral', className: 'TEST-CR-02' },
      { spawnKey: 'neutral:TEST-CW-03', hullType: 'cw', race: 'neutral', className: 'TEST-CW-03' },
    ]);
    expect(noted.every((item) => item.source === 'loader' && item.severity === 'warning')).toBe(true);
    expect(noted.every((item) => item.location?.file === 'Assets/Specs/shiplist.txt')).toBe(true);
    expect(machinePathLeak(catalog.diagnostics)).toBeNull();
    expect(machinePathLeak(catalog.ships.map((ship) => ship.geometry))).toBeNull();
    disposeShipCatalog(catalog);
  });

  it('skips neutral CY, CR, and CW class names even when the hull token is something else', async () => {
    const table = new TextEncoder().encode(
      [
        'Race\tHull Type\tClass\tGeometry',
        'Neutral\tPlanet\tCY\t',
        'Neutral\tUNKNOWN\tCR\tAssets/Models/test/Missing.mod',
        'neutral\tBS\tcw\t',
        'Federation\tPlanet\tCY\t',
        'Klingon\tCA\tTEST-CA-09\tAssets/Models/test/Missing.mod',
      ].join('\n'),
    );
    const catalog = await loadShipCatalog(
      await importInstall([
        picked('Starfleet2CE.exe', Uint8Array.of(0)),
        picked('Assets/Specs/shiplist.txt', table),
      ]),
    );
    expect(catalog.ships.map((ship) => [ship.spawnKey, ship.expectedNoModel, ship.placeholder])).toEqual([
      ['Neutral:CY', true, true],
      ['Neutral:CR', true, true],
      ['neutral:cw', true, true],
    ]);
    expect(catalog.failures.map((failure) => [failure.spawnKey, failure.reason])).toEqual([
      ['Federation:CY', 'shiplist.missingGeometry'],
      ['Klingon:TEST-CA-09', 'loader.missingModel'],
    ]);
    disposeShipCatalog(catalog);
  });

  it('reports a missing geometry column and an unrecognized install without throwing', async () => {
    const table = new TextEncoder().encode('Race\tClass\nFederation\tTEST-NO-GEO\n');
    const noColumn = await loadShipCatalog(
      await importInstall([
        picked('Starfleet2CE.exe', Uint8Array.of(0)),
        picked('Assets/Specs/shiplist.txt', table),
      ]),
    );
    expect(noColumn.ships).toEqual([]);
    expect(noColumn.diagnostics.some((item) => item.code === 'geometryColumnMissing')).toBe(true);
    expect(noColumn.diagnostics.find((item) => item.code === 'geometryColumnMissing')?.location?.file).toBe(
      'Assets/Specs/shiplist.txt',
    );
    expect(noColumn.failures.map((failure) => failure.reason)).toEqual(['shiplist.missingGeometry']);
    expect(noColumn.failures[0]?.spawnKey).toBe('Federation:TEST-NO-GEO');

    const unrecognized = await loadShipCatalog(
      await importInstall([picked('readme.txt', new TextEncoder().encode('hello'))]),
    );
    expect(unrecognized.ships).toEqual([]);
    expect(unrecognized.failures.map((failure) => failure.reason)).toEqual(['importer.installNotRecognized']);
    expect(machinePathLeak(unrecognized)).toBeNull();
  });

  it('hands each mesh to onShip and does not keep it', async () => {
    const seen: string[] = [];
    const catalog = await loadShipCatalog(await importInstall(syntheticViewerFiles()), {
      onShip(ship) {
        seen.push(ship.spawnKey);
        expect(ship.mesh.lods.length).toBeGreaterThan(0);
      },
    });
    expect(seen).toEqual(['Federation:TEST-CA-01', 'Neutral:TEST-BS-05', 'Lyran:TEST-CA-07']);
    expect(catalog.ships).toEqual([]);
    expect(catalog.failures.map((failure) => failure.spawnKey)).toContain('Klingon:TEST-CL-02');
    expect(catalog.failures.map((failure) => failure.spawnKey)).toContain('ISC:TEST-CA-08');
  });
});

function withRead(imported: ImportResult, vfs: Vfs, read: Vfs['read']): ImportResult {
  return { ...imported, vfs: { list: () => vfs.list(), resolve: (path) => vfs.resolve(path), exists: (path) => vfs.exists(path), read } };
}

function picked(path: string, bytes: Uint8Array): { path: string; size: number; read: () => Promise<Uint8Array> } {
  return { path, size: bytes.length, read: () => Promise.resolve(bytes) };
}

function pixel(texture: { image?: unknown } | null, index: number): number[] {
  const image = texture?.image as { data?: Uint8Array } | undefined;
  const data = image?.data;
  const start = index * 4;
  return [data?.[start] ?? 0, data?.[start + 1] ?? 0, data?.[start + 2] ?? 0, data?.[start + 3] ?? 0];
}

function installRelative(diagnostics: { location?: { file?: string } }[]): boolean {
  return diagnostics.every((item) => {
    const file = item.location?.file;
    if (file === undefined) return true;
    return !file.includes('\\') && !file.startsWith('/') && !/^[a-zA-Z]:/.test(file) && !file.split('/').includes('..');
  });
}
