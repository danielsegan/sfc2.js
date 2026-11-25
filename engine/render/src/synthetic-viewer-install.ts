/**
 * Invented install for the ship viewer check.
 * Built in memory at test time. Not a game file, and never written to disk.
 */

import { encodeBmp } from '@sfc2js/formats';
import type { PickedFile } from '@sfc2js/platform';

const SHIPLIST = [
  '\tSynthetic fixture row. Not a ship.\t',
  'Race\tHull Type\tClass\tGeometry',
  'Federation\tCA\tTEST-CA-01\tAssets/Models/test/Good.mod',
  'Klingon\tCL\tTEST-CL-02\tAssets/Models/test/Missing.mod',
  'Romulan\tDN\tTEST-DN-03\tAssets/Models/test/Bad.mod',
  'Gorn\tFF\tTEST-FF-04\t',
  'Neutral\tBS\tTEST-BS-05\tAssets/Models/test/Plain.mod',
  'Hydran\tCA\tTEST-CA-06\tC:/Games/Nope.mod',
  'Lyran\tCA\tTEST-CA-07\tAssets\\Models\\test\\Good.mod',
  'ISC\tCA\tTEST-CA-08\tAssets/Models/test/Quad.mod',
].join('\n');

export function syntheticViewerFiles(): PickedFile[] {
  const shiplist = new TextEncoder().encode(SHIPLIST);
  const base = encodeBmp({
    width: 2,
    height: 2,
    bitCount: 24,
    pixels: rgb([30, 90, 160], 4),
  });
  const glow = encodeBmp({
    width: 2,
    height: 2,
    bitCount: 24,
    pixels: new Uint8Array([240, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  });
  const good = texturedModel();
  const plain = plainModel();
  const quad = quadModel();
  const bad = Uint8Array.of(1, 2, 3, 4, 0, 0, 0, 0);
  return [
    picked('Starfleet2CE.exe', Uint8Array.of(0)),
    picked('Assets/Specs/shiplist.txt', shiplist),
    picked('Assets/Models/test/Good.mod', good),
    picked('Assets/Models/test/Bad.mod', bad),
    picked('Assets/Models/test/Plain.mod', plain),
    picked('Assets/Models/test/Quad.mod', quad),
    picked('Assets/Models/test/Hull_1.bmp', base),
    picked('Assets/Models/test/Hull_1i.bmp', glow),
  ];
}

/** Invented hulls whose geometry is a point, a line, or contains a non-finite position. */
export function syntheticLoadFaultFiles(): PickedFile[] {
  const shiplist = new TextEncoder().encode(
    [
      'Race\tHull Type\tClass\tGeometry',
      'Federation\tCA\tTEST-PT-01\tAssets/Models/test/Point.mod',
      'Klingon\tCA\tTEST-LN-02\tAssets/Models/test/Line.mod',
      'Romulan\tCA\tTEST-NF-03\tAssets/Models/test/Nan.mod',
    ].join('\n'),
  );
  return [
    picked('Starfleet2CE.exe', Uint8Array.of(0)),
    picked('Assets/Specs/shiplist.txt', shiplist),
    picked('Assets/Models/test/Point.mod', triangleModel([0, 0, 0, 0, 0, 0, 0, 0, 0])),
    picked('Assets/Models/test/Line.mod', triangleModel([0, 0, 0, 1, 0, 0, 2, 0, 0])),
    picked('Assets/Models/test/Nan.mod', triangleModel([0, 0, 0, 1, 0, 0, 0, 1, Number.NaN])),
  ];
}

function triangleModel(positions: number[]): Uint8Array {
  const material = new Uint8Array(28);
  const view = new DataView(material.buffer);
  view.setUint32(0, 0x0002, true);
  material[4] = 180;
  material[5] = 180;
  material[6] = 190;
  return chunk(
    'MDLS',
    concat([
      header(1, 2),
      chunk('STRS', Uint8Array.of(0)),
      chunk('MATS', material),
      mesh(positions, [triangle([0, 1, 2], [[0, 0], [1, 0], [0, 1]])]),
    ]),
  );
}

function picked(path: string, bytes: Uint8Array): PickedFile {
  return { path, size: bytes.length, read: () => Promise.resolve(bytes) };
}

function rgb(color: [number, number, number], count: number): Uint8Array {
  const out = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = color[0];
    out[i * 3 + 1] = color[1];
    out[i * 3 + 2] = color[2];
  }
  return out;
}

function texturedModel(): Uint8Array {
  const names = [cString('Hull_1'), cString('Hull_1i')];
  const material = new Uint8Array(36);
  const view = new DataView(material.buffer);
  view.setUint32(0, 0x0001 | 0x0002 | 0x0020, true);
  material[4] = 255;
  material[5] = 255;
  material[6] = 255;
  view.setFloat32(8, 0.5, true);
  view.setFloat32(12, 0.5, true);
  view.setFloat32(16, 1, true);
  view.setInt32(20, 1, true);
  view.setInt32(24, 0, true);
  view.setInt32(28, 2, true);
  view.setInt32(32, 'Hull_1'.length + 1, true);
  const vertices = [0, 0, 0, 2, 0, 0, 1, 0, 2, 1, 2, 0];
  const faces = [
    triangle([0, 1, 3], [[0, 0], [1, 0], [0, 1]]),
    triangle([0, 3, 2], [[0, 0], [0, 1], [1, 1]]),
    triangle([0, 2, 1], [[0, 0], [1, 1], [1, 0]]),
    triangle([1, 2, 3], [[1, 0], [1, 1], [0, 1]]),
  ];
  return chunk(
    'MDLS',
    concat([header(1, 2.5), chunk('STRS', concat(names)), chunk('MATS', material), mesh(vertices, faces)]),
  );
}

function plainModel(): Uint8Array {
  const material = new Uint8Array(28);
  const view = new DataView(material.buffer);
  view.setUint32(0, 0x0002, true);
  material[4] = 180;
  material[5] = 180;
  material[6] = 190;
  return chunk(
    'MDLS',
    concat([
      header(1, 2),
      chunk('STRS', Uint8Array.of(0)),
      chunk('MATS', material),
      mesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [triangle([0, 1, 2], [[0, 0], [1, 0], [0, 1]])]),
    ]),
  );
}

function quadModel(): Uint8Array {
  const face = new Uint8Array(20 + 4 * 28);
  const view = new DataView(face.buffer);
  view.setInt32(0, 4, true);
  for (let i = 0; i < 4; i++) view.setUint16(20 + i * 28, i, true);
  return chunk(
    'MDLS',
    concat([
      header(1, 2),
      chunk('STRS', Uint8Array.of(0)),
      chunk('MATS', new Uint8Array(28)),
      chunk('MOD0', concat([i32([4, 1]), chunk('VTXS', f32s([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])), chunk('POLY', face)])),
    ]),
  );
}

function mesh(positions: number[], faces: Uint8Array[]): Uint8Array {
  return chunk('MOD0', concat([i32([positions.length / 3, faces.length]), chunk('VTXS', f32s(positions)), ...faces.map((face) => chunk('POLY', face))]));
}

function triangle(indices: [number, number, number], uvs: [number, number][]): Uint8Array {
  const face = new Uint8Array(20 + 3 * 28);
  const view = new DataView(face.buffer);
  view.setInt32(0, 3, true);
  view.setFloat32(12, 1, true);
  for (let i = 0; i < 3; i++) {
    const at = 20 + i * 28;
    view.setUint16(at, indices[i], true);
    view.setFloat32(at + 8, 1, true);
    const uv = uvs[i] ?? [0, 0];
    view.setFloat32(at + 16, uv[0], true);
    view.setFloat32(at + 20, uv[1], true);
  }
  return face;
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
