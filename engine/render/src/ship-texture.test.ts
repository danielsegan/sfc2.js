import { describe, expect, it, vi } from 'vitest';
import { encodeBmp, machinePathLeak } from '@sfc2js/formats';
import { createVfs, importInstall, memoryDirectoryPicker, type PickedFile } from '@sfc2js/platform';
import { MeshLambertMaterial, MeshStandardMaterial, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { HD_SELF_ILLUM_BLOOM_THRESHOLD, loadShipTexture } from './ship-texture.ts';

describe('loadShipTexture', () => {
  it('builds a period material with a self-illum map sampled at its own size', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const base = encodeBmp({
      width: 2,
      height: 2,
      bitCount: 24,
      pixels: rgbFill(2, 2, [20, 30, 40]),
    });
    const glow = encodeBmp({
      width: 4,
      height: 4,
      bitCount: 8,
      pixels: new Uint8Array(16).fill(1),
      palette: Uint8Array.of(0, 0, 0, 10, 20, 30),
      clrUsed: 2,
    });
    const vfs = createVfs([
      { path: 'Assets/Models/test/Hull_1.bmp', size: base.length, read: async () => base },
      { path: 'Assets/Models/test/Hull_1i.bmp', size: glow.length, read: async () => glow },
    ]);
    const loaded = await loadShipTexture(
      vfs,
      { basePath: 'Assets/Models/test/Hull_1.bmp', selfIllumPath: 'Assets/Models/test/Hull_1i.bmp' },
      { tier: 'period' },
    );

    expect(loaded.data.material).toBeInstanceOf(MeshLambertMaterial);
    const material = loaded.data.material as MeshLambertMaterial;
    expect(material.map).toBe(loaded.data.baseTexture);
    expect(material.emissiveMap).toBe(loaded.data.selfIllumTexture);
    expect(material.emissive.getHex()).toBe(0xffffff);
    expect(material.emissiveIntensity).toBe(1);
    expect(loaded.data.baseTexture?.flipY).toBe(true);
    expect(loaded.data.baseTexture?.colorSpace).toBe(SRGBColorSpace);
    expect(loaded.data.selfIllumTexture?.colorSpace).toBe(SRGBColorSpace);
    expect(loaded.data.baseTexture?.generateMipmaps).toBe(true);
    expect(loaded.data.baseTexture?.minFilter).toBe(LinearFilter);
    expect(imageSize(loaded.data.baseTexture)).toEqual([2, 2]);
    expect(imageSize(loaded.data.selfIllumTexture)).toEqual([4, 4]);
    expect(loaded.diagnostics.map((item) => item.code)).toContain('selfIllumSizeMismatch');
    expect(pixel(loaded.data.selfIllumTexture, 0)).toEqual([10, 20, 30, 255]);
    expect(loaded.data.material?.userData.selfIllumBloomThreshold).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(machinePathLeak(loaded)).toBeNull();
    fetchSpy.mockRestore();
  });

  it('uses a standard material and a bloom hint for the HD tier', async () => {
    const base = encodeBmp({
      width: 2,
      height: 2,
      bitCount: 24,
      pixels: rgbFill(2, 2, [1, 2, 3]),
    });
    const glow = encodeBmp({
      width: 2,
      height: 2,
      bitCount: 24,
      pixels: rgbFill(2, 2, [0, 0, 0]),
    });
    const vfs = createVfs([
      { path: 'Assets/Models/test/Hull_1.bmp', size: base.length, read: async () => base },
      { path: 'Assets/Models/test/Hull_1i.bmp', size: glow.length, read: async () => glow },
    ]);
    const loaded = await loadShipTexture(
      vfs,
      { basePath: 'Assets/Models/test/Hull_1.bmp', selfIllumPath: 'Assets/Models/test/Hull_1i.bmp' },
      { tier: 'hd' },
    );
    expect(loaded.data.material).toBeInstanceOf(MeshStandardMaterial);
    const material = loaded.data.material as MeshStandardMaterial;
    expect(material.roughness).toBe(0.6);
    expect(material.metalness).toBe(0);
    expect(material.emissiveMap).toBe(loaded.data.selfIllumTexture);
    expect(loaded.data.selfIllumTexture?.minFilter).toBe(LinearMipmapLinearFilter);
    expect(loaded.data.selfIllumTexture?.anisotropy).toBe(8);
    expect(material.userData.selfIllumBloomThreshold).toBe(HD_SELF_ILLUM_BLOOM_THRESHOLD);
    expect(pixel(loaded.data.selfIllumTexture, 0)).toEqual([0, 0, 0, 255]);
    expect(loaded.diagnostics.find((item) => item.code === 'selfIllumSizeMismatch')).toBeUndefined();
  });

  it('expands a 4-bit glow map and leaves the base keyed independently', async () => {
    const base = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(255, 0, 255),
    });
    const glow = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 4,
      pixels: Uint8Array.of(1),
      palette: Uint8Array.of(0, 0, 0, 255, 0, 255),
      clrUsed: 2,
    });
    const vfs = createVfs([
      { path: 'models/Ksd_1_3.bmp', size: base.length, read: async () => base },
      { path: 'models/Ksd_1_3i.bmp', size: glow.length, read: async () => glow },
    ]);
    const loaded = await loadShipTexture(
      vfs,
      { basePath: 'models/Ksd_1_3.bmp', selfIllumPath: 'models/Ksd_1_3i.bmp' },
      { colorKey: 'magenta' },
    );
    expect(pixel(loaded.data.baseTexture, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(loaded.data.selfIllumTexture, 0)).toEqual([255, 0, 255, 255]);
    expect(loaded.data.decodedBase?.bitCount).toBe(24);
    expect(loaded.data.decodedSelfIllum?.bitCount).toBe(4);
  });

  it('reports a missing base or a missing glow map without throwing', async () => {
    const base = encodeBmp({
      width: 2,
      height: 2,
      bitCount: 24,
      pixels: rgbFill(2, 2, [4, 5, 6]),
    });
    const vfs = createVfs([{ path: 'Assets/Models/test/Hull_1.bmp', size: base.length, read: async () => base }]);

    const missingGlow = await loadShipTexture(vfs, {
      basePath: 'Assets/Models/test/Hull_1.bmp',
      selfIllumPath: 'Assets/Models/test/Hull_1i.bmp',
    });
    expect(missingGlow.data.material).toBeInstanceOf(MeshLambertMaterial);
    expect((missingGlow.data.material as MeshLambertMaterial).emissive.getHex()).toBe(0x000000);
    expect((missingGlow.data.material as MeshLambertMaterial).emissiveMap).toBeNull();
    expect(missingGlow.diagnostics.map((item) => item.code)).toContain('missingTexture');
    expect(missingGlow.diagnostics.find((item) => item.code === 'missingTexture')?.location?.file).toBe(
      'Assets/Models/test/Hull_1i.bmp',
    );

    const missingBase = await loadShipTexture(vfs, { basePath: 'Assets/Models/test/missing.bmp' });
    expect(missingBase.data.material).toBeNull();
    expect(missingBase.diagnostics[0]?.code).toBe('missingTexture');
    expect(machinePathLeak(missingBase)).toBeNull();
    expect(machinePathLeak(missingGlow)).toBeNull();
  });

  it('loads a pair discovered by the install importer', async () => {
    const base = encodeBmp({
      width: 2,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(8, 0, 0, 0, 8, 0),
    });
    const glow = encodeBmp({
      width: 2,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(0, 0, 0, 255, 255, 255),
    });
    const shiplist = new TextEncoder().encode('Race\tClass\nTest\tTEST-01\n');
    const picked = await memoryDirectoryPicker([
      pickedFile('Starfleet2CE.exe', Uint8Array.of(0x4d, 0x5a)),
      pickedFile('Assets/Specs/shiplist.txt', shiplist),
      pickedFile('Assets/Models/test/Hull_1.mod', Uint8Array.of(0)),
      pickedFile('Assets/Models/test/Hull_1.bmp', base),
      pickedFile('Assets/Models/test/Hull_1i.bmp', glow),
    ]).pick();
    expect(picked.status).toBe('picked');
    if (picked.status !== 'picked') return;
    const imported = await importInstall(picked.files);
    expect(imported.ok).toBe(true);
    const pair = imported.texturePairs[0];
    expect(pair).toBeDefined();
    if (pair === undefined || imported.vfs === null) return;
    const loaded = await loadShipTexture(imported.vfs, pair, { tier: 'hd' });
    expect(loaded.data.material).toBeInstanceOf(MeshStandardMaterial);
    expect(pixel(loaded.data.baseTexture, 1)).toEqual([0, 8, 0, 255]);
    expect(pixel(loaded.data.selfIllumTexture, 1)).toEqual([255, 255, 255, 255]);
    expect(loaded.data.baseTexture?.userData.installPath).toBe('Assets/Models/test/Hull_1.bmp');
  });
});

function rgbFill(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }
  return out;
}

function pickedFile(path: string, bytes: Uint8Array): PickedFile {
  return { path, size: bytes.length, read: async () => bytes };
}

function imageSize(texture: { image?: unknown } | null): [number, number] | null {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  if (image?.width === undefined || image.height === undefined) return null;
  return [image.width, image.height];
}

function pixel(texture: { image?: unknown } | null, index: number): number[] {
  const image = texture?.image as { data?: Uint8Array } | undefined;
  const data = image?.data;
  const start = index * 4;
  return [data?.[start] ?? 0, data?.[start + 1] ?? 0, data?.[start + 2] ?? 0, data?.[start + 3] ?? 0];
}
