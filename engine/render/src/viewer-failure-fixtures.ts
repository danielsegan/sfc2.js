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
  'Neutral\tBS\tTEST-AXES\tAssets/Models/neu/Axes.mod',
  'Neutral\tBS\tTEST-QUAD\tAssets/Models/neu/Quad.mod',
  'Neutral\tBS\tTEST-SPECK\tAssets/Models/neu/Speck.mod',
  'Neutral\tBS\tTEST-INVIS\tAssets/Models/neu/Invis.mod',
  'Neutral\tBS\tTEST-ALPHA\tAssets/Models/neu/Alpha.mod',
  'Neutral\tBS\tTEST-DARK\tAssets/Models/neu/Dark.mod',
  'Neutral\tBS\tTEST-BLEND\tAssets/Models/neu/Blend.mod',
  'Neutral\tBS\tTEST-ODD\tAssets/Models/neu/Odd.mod',
  'Lyran\tCA\tTEST-EXT\tAssets/Models/lyr/Ext.mod',
  'Federation\tCA\tTEST-EMP\tAssets/Models/fed/Emp.mod',
  'Neutral\tBS\tTEST-BAD\tAssets/Models/neu/Bad.mod',
  'Neutral\tBS\tTEST-BALL\tAssets/Models/neu/Ball.mod',
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
    picked('Assets/Models/neu/Axes.mod', solidMod({ lods: [{ positions: AXES, faces: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] }] })),
    picked('Assets/Models/neu/Quad.mod', solidMod({
      lods: [
        { positions: [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0], faces: [[0, 1, 2, 3]] },
        { positions: [0, 0, 0, 2, 0, 0, 0, 2, 0], faces: [[0, 1, 2]] },
      ],
    })),
    picked('Assets/Models/neu/Speck.mod', solidMod({
      lods: [{ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 20000, 0, 0, 40000, 0, 0], faces: [[0, 1, 2], [3, 4, 5]] }],
    })),
    picked('Assets/Models/neu/Invis.mod', solidMod({ flags: 0, color: [0, 0, 0] })),
    picked('Assets/Models/neu/Alpha.mod', solidMod({ flags: 0x0004, color: [0, 0, 0] })),
    picked('Assets/Models/neu/Dark.mod', solidMod({ flags: 0x0010, color: [0, 0, 0] })),
    picked('Assets/Models/neu/Blend.mod', solidMod({ flags: 0x0010, color: [240, 180, 40] })),
    picked('Assets/Models/neu/Odd.mod', solidMod({ flags: 0x0001 | 0x0002, diffuse: 'glow#1' })),
    picked('Assets/Models/lyr/Ext.mod', solidMod({ flags: 0x0001 | 0x0002, diffuse: 'mark' })),
    picked('Assets/Models/lyr/mark.pcx', Uint8Array.of(0x0a, 0, 0, 0)),
    picked('Assets/MODELS/rom/panel.bmp', panel),
    picked('Assets/Models/fed/Emp.mod', solidMod({ flags: 0x0001 | 0x0002, diffuse: 'panel' })),
    picked('Assets/Models/neu/bad.bmp', Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8)),
    picked('Assets/Models/neu/Bad.mod', solidMod({ flags: 0x0001 | 0x0002, diffuse: 'bad' })),
    picked('Assets/Models/neu/Ball.mod', solidMod({ lods: [sphereLod()], radialNormals: true, color: [180, 190, 210] })),
  ];
}

const AXES = [0, 0, 0, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 5, 0, 0, 3, 0, 0, 0, 0, 0, 0, 6, 0, 0, 1];

const TRI = {
  positions: [0, 0, 0, 2, 0, 0, 0, 2, 0],
  faces: [[0, 1, 2]],
};

interface SolidLod {
  positions: number[];
  faces: number[][];
}

function solidMod(options: {
  flags?: number;
  color?: [number, number, number];
  diffuse?: string;
  lods?: SolidLod[];
  radialNormals?: boolean;
}): Uint8Array {
  const flags = options.flags ?? 0x0002;
  const color = options.color ?? [220, 220, 230];
  const lods = options.lods ?? [TRI];
  const names = options.diffuse === undefined ? Uint8Array.of(0) : cString(options.diffuse);
  const material = new Uint8Array(28);
  const view = new DataView(material.buffer);
  view.setUint32(0, flags, true);
  material[4] = color[0];
  material[5] = color[1];
  material[6] = color[2];
  if (options.diffuse !== undefined) view.setInt32(24, 0, true);
  return chunk(
    'MDLS',
    concat([
      header(lods.length, 4),
      chunk('STRS', names),
      chunk('MATS', material),
      ...lods.map((lod) => lodChunk(lod, options.radialNormals === true)),
    ]),
  );
}

function sphereLod(): SolidLod {
  const stacks = 6;
  const slices = 10;
  const radius = 1.5;
  const positions: number[] = [];
  for (let stack = 0; stack <= stacks; stack += 1) {
    const phi = (stack / stacks) * Math.PI;
    for (let slice = 0; slice < slices; slice += 1) {
      const theta = (slice / slices) * Math.PI * 2;
      positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    }
  }
  const at = (stack: number, slice: number) => stack * slices + (slice % slices);
  const faces: number[][] = [];
  for (let stack = 0; stack < stacks; stack += 1) {
    for (let slice = 0; slice < slices; slice += 1) {
      const a = at(stack, slice);
      const b = at(stack + 1, slice);
      const c = at(stack + 1, slice + 1);
      const d = at(stack, slice + 1);
      if (stack > 0) faces.push([a, b, d]);
      if (stack < stacks - 1) faces.push([b, c, d]);
    }
  }
  return { positions, faces };
}

function lodChunk(lod: SolidLod, radial: boolean): Uint8Array {
  const vertexCount = lod.positions.length / 3;
  const faces = lod.faces.map((indices) => polyFace(indices, lod.positions, radial));
  return chunk('MOD0', concat([i32([vertexCount, lod.faces.length]), chunk('VTXS', f32s(lod.positions)), ...faces]));
}

function polyFace(indices: number[], positions: number[], radial: boolean): Uint8Array {
  const face = new Uint8Array(20 + indices.length * 28);
  const view = new DataView(face.buffer);
  view.setInt32(0, indices.length, true);
  view.setFloat32(12, 1, true);
  indices.forEach((index, corner) => {
    const at = 20 + corner * 28;
    view.setUint16(at, index, true);
    const x = positions[index * 3] ?? 0;
    const y = positions[index * 3 + 1] ?? 0;
    const z = positions[index * 3 + 2] ?? 0;
    const length = Math.hypot(x, y, z) || 1;
    view.setFloat32(at + 4, radial ? x / length : 0, true);
    view.setFloat32(at + 8, radial ? y / length : 1, true);
    view.setFloat32(at + 12, radial ? z / length : 0, true);
  });
  return chunk('POLY', face);
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
