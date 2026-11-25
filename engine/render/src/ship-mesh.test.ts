import { describe, expect, it } from 'vitest';
import { encodeBmp, machinePathLeak, parseMod } from '@sfc2js/formats';
import { createVfs } from '@sfc2js/platform';
import { Color, Mesh, MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { HD_SELF_ILLUM_BLOOM_THRESHOLD } from './ship-texture.ts';
import { buildShipMesh, showShipLod } from './ship-mesh.ts';

const MODEL = 'Assets/MODELS/test/Hull.mod';

describe('buildShipMesh', () => {
  it('binds the diffuse and luminance names through the BMP loader and flips winding', async () => {
    const parsed = parseMod(texturedMod(), { file: MODEL });
    expect(parsed.diagnostics).toEqual([]);
    const base = encodeBmp({ width: 2, height: 2, bitCount: 24, pixels: rgb([20, 30, 40]) });
    const glow = encodeBmp({ width: 2, height: 2, bitCount: 24, pixels: rgb([9, 8, 7]) });
    const other = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([1, 2, 3]) });
    const vfs = createVfs([
      { path: 'Assets/MODELS/test/Hull_1.bmp', size: base.length, read: async () => base },
      { path: 'Assets/MODELS/test/Hull_1i.bmp', size: glow.length, read: async () => glow },
      { path: 'Assets/MODELS/test/Other.bmp', size: other.length, read: async () => other },
    ]);
    const built = await buildShipMesh(parsed.data, { vfs, modelPath: MODEL, tier: 'period' });
    expect(built.diagnostics.map((item) => item.code)).toEqual([]);
    expect(built.data.root.userData.sfc2Role).toBe('ship');
    expect(built.data.root.userData.modelPath).toBe(MODEL);
    expect(built.data.root.userData.radius).toBe(12.5);
    expect(built.data.lods[0]?.visible).toBe(true);
    expect(built.data.lods[1]?.visible).toBe(false);
    const mesh = built.data.lods[0]?.children[0];
    expect(mesh).toBeInstanceOf(Mesh);
    const material = (mesh as Mesh).material as MeshLambertMaterial;
    expect(material).toBeInstanceOf(MeshLambertMaterial);
    expect(material.map).not.toBeNull();
    expect(material.emissiveMap).not.toBeNull();
    expect(material.color.r).toBeCloseTo(1);
    expect(material.color.g).toBeCloseTo(128 / 255);
    expect(material.color.b).toBeCloseTo(64 / 255);
    const position = (mesh as Mesh).geometry.getAttribute('position');
    expect(position.getX(0)).toBe(0);
    expect(position.getY(0)).toBe(2);
    expect(position.getZ(0)).toBe(0);
    const uv = (mesh as Mesh).geometry.getAttribute('uv');
    expect(uv.getX(0)).toBe(0);
    expect(uv.getY(0)).toBe(1);
    expect(built.data.attachments).toHaveLength(1);
    expect(built.data.attachments[0]?.name).toBe('TEST-HP');
    expect(built.data.attachments[0]?.position.toArray()).toEqual([2, 3, 4]);
    expect(built.data.attachments[0]?.userData.sfc2Role).toBe('attachment');
    expect(showShipLod(built.data, 1)).toBe(true);
    expect(built.data.lods[0]?.visible).toBe(false);
    expect(built.data.lods[1]?.visible).toBe(true);
    expect(showShipLod(built.data, 4)).toBe(false);
    expect(machinePathLeak(built.diagnostics)).toBeNull();
    expect(machinePathLeak(built.data.root.userData)).toBeNull();
  });

  it('uses an explicit luminance name ahead of the suffix pair, and the HD tier', async () => {
    const parsed = parseMod(texturedMod({ luminance: 'GlowX' }));
    const base = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([4, 5, 6]) });
    const suffix = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([0, 0, 1]) });
    const named = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([0, 9, 0]) });
    const vfs = createVfs([
      { path: 'Assets/MODELS/test/Hull_1.bmp', size: base.length, read: async () => base },
      { path: 'Assets/MODELS/test/Hull_1i.bmp', size: suffix.length, read: async () => suffix },
      { path: 'Assets/MODELS/test/GlowX.bmp', size: named.length, read: async () => named },
    ]);
    const built = await buildShipMesh(parsed.data, { vfs, modelPath: MODEL, tier: 'hd', lod: 0 });
    const material = built.data.materials[0] as MeshStandardMaterial;
    expect(material).toBeInstanceOf(MeshStandardMaterial);
    expect(material.roughness).toBe(0.6);
    expect(material.metalness).toBe(0);
    expect(material.userData.selfIllumBloomThreshold).toBe(HD_SELF_ILLUM_BLOOM_THRESHOLD);
    expect(pixel(material.emissiveMap, 0)).toEqual([0, 9, 0, 255]);
  });

  it('pairs a glow map by suffix when the material has no luminance name', async () => {
    const parsed = parseMod(texturedMod({ luminance: null }));
    const base = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([4, 5, 6]) });
    const glow = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([8, 0, 0]) });
    const vfs = createVfs([
      { path: 'Assets/MODELS/test/Hull_1.bmp', size: base.length, read: async () => base },
      { path: 'Assets/MODELS/test/Hull_1i.bmp', size: glow.length, read: async () => glow },
    ]);
    const built = await buildShipMesh(parsed.data, { vfs, modelPath: MODEL });
    const material = built.data.materials[0] as MeshLambertMaterial;
    expect(material.emissive.getHex()).toBe(0xffffff);
    expect(pixel(material.emissiveMap, 0)).toEqual([8, 0, 0, 255]);
    expect(built.diagnostics.map((item) => item.code)).not.toContain('missingTexture');
  });

  it('still returns a mesh when the texture name is unsafe or the file is missing', async () => {
    const parsed = parseMod(texturedMod({ diffuse: '../../../../secret' }));
    const vfs = createVfs([]);
    const built = await buildShipMesh(parsed.data, { vfs, modelPath: MODEL });
    expect(built.diagnostics.map((item) => item.code)).toContain('textureNameRejected');
    expect(built.diagnostics.find((item) => item.code === 'textureNameRejected')?.details).toEqual({ reason: 'texture-name' });
    expect(machinePathLeak(built.diagnostics)).toBeNull();
    expect(built.data.lods[0]?.children[0]).toBeInstanceOf(Mesh);
    const material = (built.data.lods[0]?.children[0] as Mesh).material as MeshLambertMaterial;
    expect(material.map).toBeNull();

    const missing = await buildShipMesh(parseMod(texturedMod()).data, {
      vfs,
      modelPath: 'C:/Games/Hull.mod',
    });
    expect(missing.diagnostics.map((item) => item.code)).toContain('modelPathRejected');
    expect(missing.data.root.userData.modelPath).toBeUndefined();
    expect(machinePathLeak(missing.diagnostics)).toBeNull();
    expect(machinePathLeak(missing.data.root.userData)).toBeNull();
  });

  it('binds a texture found by case, extension, parent folder, or an odd path separator', async () => {
    const parsed = parseMod(texturedMod({ diffuse: 'hull_1.tga', luminance: 'shared|glow' }));
    const base = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([11, 22, 33]) });
    const glow = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([44, 55, 66]) });
    const vfs = createVfs([
      { path: 'Assets/MODELS/HULL_1.BMP', size: base.length, read: async () => base },
      { path: 'Assets/MODELS/test/shared/glow.bmp', size: glow.length, read: async () => glow },
    ]);
    const built = await buildShipMesh(parsed.data, { vfs, modelPath: MODEL });
    const material = built.data.materials[0] as MeshLambertMaterial;
    expect(pixel(material.map, 0)).toEqual([11, 22, 33, 255]);
    expect(pixel(material.emissiveMap, 0)).toEqual([44, 55, 66, 255]);
    expect(built.diagnostics.map((item) => item.code)).not.toContain('missingTexture');
    expect(built.diagnostics.map((item) => item.code)).not.toContain('texturePlaceholder');
  });

  it('uses a neutral placeholder when the texture is absent after the full search', async () => {
    const parsed = parseMod(texturedMod({ luminance: null }));
    const built = await buildShipMesh(parsed.data, { vfs: createVfs([]), modelPath: MODEL });
    expect(built.diagnostics.map((item) => item.code)).toEqual(['texturePlaceholder']);
    expect(built.diagnostics[0]?.details).toEqual({ which: 'diffuse' });
    expect(built.diagnostics.map((item) => item.code)).not.toContain('missingTexture');
    const material = built.data.materials[0] as MeshLambertMaterial;
    expect(material.map).toBeNull();
    expect(material.userData.texturePlaceholder).toBe(true);
    expect(material.color.getHex()).toBe(new Color(0x9aa3ad).getHex());
    expect(machinePathLeak(built.diagnostics)).toBeNull();
  });

  it('treats an empty luminance name as no self-illum layer', async () => {
    const parsed = parseMod(texturedMod({ luminance: '' }));
    expect(parsed.diagnostics.map((item) => item.code)).not.toContain('missingTextureName');
    expect(parsed.data.materials[0]?.luminanceTexture?.name).toBe('');
    const base = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([4, 5, 6]) });
    const glow = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([8, 0, 0]) });
    const withSuffix = await buildShipMesh(parsed.data, {
      vfs: createVfs([
        { path: 'Assets/MODELS/test/Hull_1.bmp', size: base.length, read: async () => base },
        { path: 'Assets/MODELS/test/Hull_1i.bmp', size: glow.length, read: async () => glow },
      ]),
      modelPath: MODEL,
    });
    expect((withSuffix.data.materials[0] as MeshLambertMaterial).emissive.getHex()).toBe(0xffffff);
    expect(withSuffix.diagnostics.map((item) => item.code)).not.toContain('missingTextureName');

    const bare = await buildShipMesh(parsed.data, {
      vfs: createVfs([{ path: 'Assets/MODELS/test/Hull_1.bmp', size: base.length, read: async () => base }]),
      modelPath: MODEL,
    });
    const material = bare.data.materials[0] as MeshLambertMaterial;
    expect(material.emissive.getHex()).toBe(0x000000);
    expect(material.emissiveMap).toBeNull();
    expect(bare.diagnostics.map((item) => item.code)).not.toContain('texturePlaceholder');
    expect(bare.diagnostics.map((item) => item.code)).not.toContain('missingTextureName');
  });

  it('skips a non-triangle and warns when the requested LOD is absent', async () => {
    const quad = parseMod(quadMod());
    expect(quad.diagnostics.map((item) => item.code)).toContain('faceVertexCount');
    const built = await buildShipMesh(quad.data, { vfs: createVfs([]), modelPath: MODEL, lod: 3 });
    expect(built.data.lods[0]?.children).toHaveLength(0);
    expect(built.diagnostics.map((item) => item.code)).toContain('lodOutOfRange');
    expect(built.data.attachments[0]?.name).toBe('TEST-HP');
  });
});

function texturedMod(options?: { diffuse?: string; luminance?: string | null }): Uint8Array {
  const diffuse = options?.diffuse ?? 'Hull_1';
  const luminance = options?.luminance === undefined ? 'Hull_1i' : options.luminance;
  const names = [cString(diffuse)];
  const diffuseOffset = 0;
  let cursor = diffuse.length + 1;
  let luminanceOffset = 0;
  if (luminance !== null) {
    luminanceOffset = cursor;
    names.push(cString(luminance));
    cursor += luminance.length + 1;
  }
  const pointOffset = cursor;
  names.push(cString('TEST-HP'));
  const flags = luminance === null ? 0x0001 | 0x0002 : 0x0001 | 0x0002 | 0x0020;
  const material = new Uint8Array(luminance === null ? 28 : 36);
  const view = new DataView(material.buffer);
  view.setUint32(0, flags, true);
  material[4] = 255;
  material[5] = 128;
  material[6] = 64;
  view.setFloat32(8, 0.5, true);
  view.setFloat32(12, 0.25, true);
  view.setFloat32(16, 1, true);
  view.setInt32(20, 3, true);
  view.setInt32(24, diffuseOffset, true);
  if (luminance !== null) {
    view.setInt32(28, 4, true);
    view.setInt32(32, luminanceOffset, true);
  }
  const lod0 = mesh([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  const lod1 = mesh([5, 0, 0, 6, 0, 0, 5, 1, 0]);
  return chunk(
    'MDLS',
    concat([
      header(2),
      chunk('STRS', concat(names)),
      chunk('MATS', material),
      chunk('PNTS', concat([f32s([2, 3, 4]), u32([pointOffset])])),
      lod0,
      lod1,
    ]),
  );
}

function quadMod(): Uint8Array {
  const face = new Uint8Array(20 + 4 * 28);
  const view = new DataView(face.buffer);
  view.setInt32(0, 4, true);
  const meshBody = concat([i32([4, 1]), chunk('VTXS', f32s([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])), chunk('POLY', face)]);
  return chunk(
    'MDLS',
    concat([
      header(1),
      chunk('STRS', cString('TEST-HP')),
      chunk('PNTS', concat([f32s([0, 1, 0]), u32([0])])),
      chunk('MOD0', meshBody),
    ]),
  );
}

function header(lodCount: number): Uint8Array {
  const out = new Uint8Array(36);
  const view = new DataView(out.buffer);
  view.setUint32(0, 1, true);
  view.setFloat32(4, 12.5, true);
  view.setInt32(8, lodCount, true);
  return out;
}

function mesh(positions: number[]): Uint8Array {
  const face = new Uint8Array(20 + 3 * 28);
  const view = new DataView(face.buffer);
  view.setInt32(0, 3, true);
  view.setFloat32(12, 1, true);
  for (let i = 0; i < 3; i++) {
    const at = 20 + i * 28;
    view.setUint16(at, i, true);
    view.setFloat32(at + 12, 1, true);
    view.setFloat32(at + 16, i === 1 ? 1 : 0, true);
    view.setFloat32(at + 20, i === 2 ? 1 : 0, true);
  }
  return chunk('MOD0', concat([i32([3, 1]), chunk('VTXS', f32s(positions)), chunk('POLY', face)]));
}

function pixel(texture: { image?: unknown } | null, index: number): number[] {
  const image = texture?.image as { data?: Uint8Array } | undefined;
  const data = image?.data;
  const start = index * 4;
  return [data?.[start] ?? 0, data?.[start + 1] ?? 0, data?.[start + 2] ?? 0, data?.[start + 3] ?? 0];
}

function rgb(color: [number, number, number]): Uint8Array {
  const out = new Uint8Array(4 * 3);
  for (let i = 0; i < 4; i++) {
    out[i * 3] = color[0];
    out[i * 3 + 1] = color[1];
    out[i * 3 + 2] = color[2];
  }
  return out;
}

function cString(text: string): Uint8Array {
  const out = new Uint8Array(text.length + 1);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

function chunk(type: string, payload: Uint8Array): Uint8Array {
  const padded = (payload.length + 3) & ~3;
  const out = new Uint8Array(8 + padded);
  const view = new DataView(out.buffer);
  out[0] = type.charCodeAt(0);
  out[1] = type.charCodeAt(1);
  out[2] = type.charCodeAt(2);
  out[3] = type.charCodeAt(3);
  view.setInt32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function f32s(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return out;
}

function i32(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((value, index) => view.setInt32(index * 4, value, true));
  return out;
}

function u32(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return out;
}
