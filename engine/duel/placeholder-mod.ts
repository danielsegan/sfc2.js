/**
 * Original placeholder hull. The bytes follow the public .mod chunk
 * layout so parseMod and buildShipMesh can load them. Nothing here is
 * copied from a game file. The extension is not used on disk: CI blocks
 * .mod, and this builder runs in memory.
 */
import { encodeBmp } from '@sfc2js/formats';

export const FIXTURE_MODEL_DIR = 'Assets/MODELS/fixture';

export interface HullTint {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function placeholderTexture(): Uint8Array {
  const width = 8;
  const height = 8;
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const stripe = x === 1 || x === 2;
      const at = (y * width + x) * 3;
      pixels[at] = stripe ? 210 : 36;
      pixels[at + 1] = stripe ? 214 : 48;
      pixels[at + 2] = stripe ? 220 : 58;
    }
  }
  return encodeBmp({ width, height, bitCount: 24, pixels });
}

export function placeholderGlow(): Uint8Array {
  const width = 8;
  const height = 8;
  const pixels = new Uint8Array(width * height * 3);
  const mark = (x: number, y: number) => {
    const at = (y * width + x) * 3;
    pixels[at] = 232;
    pixels[at + 1] = 236;
    pixels[at + 2] = 214;
  };
  mark(1, 3);
  mark(2, 3);
  return encodeBmp({ width, height, bitCount: 24, pixels });
}

export function placeholderHullMod(tint: HullTint): Uint8Array {
  const names = concat([cString('Wedge1'), cString('Wedge1i'), cString('NOSE')]);
  const diffuseAt = 0;
  const glowAt = 'Wedge1'.length + 1;
  const noseAt = glowAt + 'Wedge1i'.length + 1;
  const material = new Uint8Array(36);
  const view = new DataView(material.buffer);
  view.setUint32(0, 0x0001 | 0x0002 | 0x0020, true);
  material[4] = tint.r;
  material[5] = tint.g;
  material[6] = tint.b;
  material[7] = 0;
  view.setFloat32(8, 0.4, true);
  view.setFloat32(12, 0.7, true);
  view.setFloat32(16, 0.2, true);
  view.setInt32(20, 1, true);
  view.setInt32(24, diffuseAt, true);
  view.setInt32(28, 2, true);
  view.setInt32(32, glowAt, true);

  const vertices = [
    1.15, 0, 0,
    -0.7, 0.22, 0.38,
    -0.7, 0.22, -0.38,
    -0.45, -0.24, 0,
  ];
  const faces = [
    [0, 1, 2],
    [0, 3, 1],
    [0, 2, 3],
    [1, 3, 2],
  ];
  const polys: Uint8Array[] = [];
  for (const face of faces) polys.push(chunk('POLY', poly(face)));
  const mesh = chunk(
    'MOD0',
    concat([i32([vertices.length / 3, faces.length]), chunk('VTXS', f32s(vertices)), ...polys]),
  );
  return chunk(
    'MDLS',
    concat([
      header(1.2),
      chunk('STRS', names),
      chunk('MATS', material),
      chunk('PNTS', concat([f32s([1.15, 0, 0]), u32([noseAt])])),
      mesh,
    ]),
  );
}

function header(radius: number): Uint8Array {
  const out = new Uint8Array(36);
  const view = new DataView(out.buffer);
  view.setUint32(0, 1, true);
  view.setFloat32(4, radius, true);
  view.setInt32(8, 1, true);
  return out;
}

function poly(indices: readonly number[]): Uint8Array {
  const out = new Uint8Array(20 + 3 * 28);
  const view = new DataView(out.buffer);
  view.setInt32(0, 3, true);
  view.setInt32(4, 0, true);
  view.setFloat32(8, 0, true);
  view.setFloat32(12, 1, true);
  view.setFloat32(16, 0, true);
  const uvs = [
    [0.5, 0.15],
    [0.85, 0.8],
    [0.15, 0.8],
  ];
  for (let i = 0; i < 3; i++) {
    const at = 20 + i * 28;
    view.setUint16(at, indices[i] ?? 0, true);
    view.setFloat32(at + 4, 0, true);
    view.setFloat32(at + 8, 1, true);
    view.setFloat32(at + 12, 0, true);
    view.setFloat32(at + 16, uvs[i]?.[0] ?? 0, true);
    view.setFloat32(at + 20, uvs[i]?.[1] ?? 0, true);
    view.setFloat32(at + 24, 1, true);
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
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function f32s(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < values.length; i++) view.setFloat32(i * 4, values[i] ?? 0, true);
  return out;
}

function i32(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < values.length; i++) view.setInt32(i * 4, values[i] ?? 0, true);
  return out;
}

function u32(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < values.length; i++) view.setUint32(i * 4, values[i] ?? 0, true);
  return out;
}
