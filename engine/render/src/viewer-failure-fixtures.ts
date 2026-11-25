/**
 * Synthetic install for the four viewer-check failure classes.
 * Built in memory. Not a game file, and never written to disk.
 */

import { encodeBmp } from '@sfc2js/formats';
import type { PickedFile } from '@sfc2js/platform';

const SHIPLIST = [
  'Race\tHull Type\tClass\tGeometry',
  'Neutral\tPlanet\tCY\t',
  'Neutral\tUNKNOWN\tCR\tAssets/Models/missing/Nope.mod',
  'neutral\tBS\tcw\t',
  'Federation\tCA\tTEST-CASE\tAssets/Models/fed/variant/Case.mod',
  'Klingon\tCA\tTEST-PATH\tAssets/Models/kli/Path.mod',
  'Lyran\tCA\tTEST-MISS\tAssets/Models/lyr/Miss.mod',
  'Hydran\tCA\tTEST-GLOW\tAssets/Models/hyd/Glow.mod',
  'Neutral\tBS\tTEST-TINY\tAssets/Models/neu/Tiny.mod',
  'Neutral\tBS\tTEST-DUMMY\tAssets/Models/neu/Dummy.mod',
  'Orion\tCA\tTEST-STILL\tAssets/Models/missing/Nope.mod',
].join('\n');

export function viewerFailureFiles(): PickedFile[] {
  const base = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([12, 34, 56]) });
  const panel = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([70, 80, 90]) });
  const body = encodeBmp({ width: 1, height: 1, bitCount: 24, pixels: rgb([1, 2, 3]) });
  const shiplist = new TextEncoder().encode(SHIPLIST);
  return [
    picked('Starfleet2CE.exe', Uint8Array.of(0)),
    picked('Assets/Specs/shiplist.txt', shiplist),
    picked('Assets/Models/fed/HULL_1.BMP', base),
    picked('Assets/Models/fed/variant/Case.mod', texturedMod('hull_1.tga')),
    picked('Assets/Models/kli/shared/panel.bmp', panel),
    picked('Assets/Models/kli/Path.mod', texturedMod('shared|panel')),
    picked('Assets/Models/lyr/Miss.mod', texturedMod('not-there')),
    picked('Assets/Models/hyd/body.bmp', body),
    picked('Assets/Models/hyd/Glow.mod', texturedMod('body', { luminance: '' })),
    picked('Assets/Models/neu/Tiny.mod', plainMod([500, 0, 0, 501, 0, 0, 500, 1, 0], 10000)),
    picked('Assets/Models/neu/Dummy.mod', plainMod([0, 0, 0, 0, 0, 0, 0, 0, 0], 10)),
  ];
}

function picked(path: string, bytes: Uint8Array): PickedFile {
  return { path, size: bytes.length, read: () => Promise.resolve(bytes) };
}

function rgb(color: [number, number, number]): Uint8Array {
  return Uint8Array.of(color[0], color[1], color[2]);
}

function texturedMod(diffuse: string, options?: { luminance?: string | null }): Uint8Array {
  const luminance = options?.luminance === undefined ? null : options.luminance;
  const names = [cString(diffuse)];
  let cursor = diffuse.length + 1;
  let luminanceOffset = 0;
  if (luminance !== null) {
    luminanceOffset = cursor;
    names.push(cString(luminance));
    cursor += luminance.length + 1;
  }
  const flags = luminance === null ? 0x0001 | 0x0002 : 0x0001 | 0x0002 | 0x0020;
  const material = new Uint8Array(luminance === null ? 28 : 36);
  const view = new DataView(material.buffer);
  view.setUint32(0, flags, true);
  material[4] = 200;
  material[5] = 200;
  material[6] = 210;
  view.setInt32(24, 0, true);
  if (luminance !== null) {
    view.setInt32(28, 1, true);
    view.setInt32(32, luminanceOffset, true);
  }
  return chunk(
    'MDLS',
    concat([header(1, 4), chunk('STRS', concat(names)), chunk('MATS', material), triangle([0, 0, 0, 2, 0, 0, 0, 2, 0])]),
  );
}

function plainMod(positions: number[], radius: number): Uint8Array {
  const material = new Uint8Array(28);
  const view = new DataView(material.buffer);
  view.setUint32(0, 0x0002, true);
  material[4] = 220;
  material[5] = 220;
  material[6] = 230;
  return chunk(
    'MDLS',
    concat([header(1, radius), chunk('STRS', Uint8Array.of(0)), chunk('MATS', material), triangle(positions)]),
  );
}

function triangle(positions: number[]): Uint8Array {
  const face = new Uint8Array(20 + 3 * 28);
  const view = new DataView(face.buffer);
  view.setInt32(0, 3, true);
  view.setFloat32(12, 1, true);
  for (let i = 0; i < 3; i++) {
    const at = 20 + i * 28;
    view.setUint16(at, i, true);
    view.setFloat32(at + 8, 1, true);
  }
  return chunk('MOD0', concat([i32([3, 1]), chunk('VTXS', f32s(positions)), chunk('POLY', face)]));
}

function header(lodCount: number, radius: number): Uint8Array {
  const out = new Uint8Array(36);
  const view = new DataView(out.buffer);
  view.setUint32(0, 1, true);
  view.setFloat32(4, radius, true);
  view.setInt32(8, lodCount, true);
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
