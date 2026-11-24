import assert from 'node:assert/strict';
import { test } from 'node:test';

import { machinePathLeak } from './src/diagnostic.ts';
import { breakupModelPath, parseMod } from './mod.ts';

test('a synthetic model keeps the mesh, texture names and hardpoint', () => {
  const strings = pool(['Hull_1.bmp', 'Hull_1i.bmp', 'port']);
  const material = materialRecord({
    flags: 0x0001 | 0x0002 | 0x0020,
    diffuseOffset: 0,
    luminanceOffset: strings.offsets[1] ?? 0,
  });
  const geometry = chunk(
    'MOD0',
    concat([
      i32(3),
      i32(1),
      chunk('VTXS', concat([vec(0, 0, 0), vec(1, 0, 0), vec(0, 1, 0)])),
      chunk(
        'POLY',
        concat([
          i32(3),
          i32(0),
          vec(0, 0, 1),
          faceVertex(0, 0, 0, 1),
          faceVertex(1, 1, 0.5, 0),
          faceVertex(2, 0, 1, 0),
        ]),
      ),
    ]),
  );
  const points = chunk('PNTS', concat([vec(1, 2, 3), i32(strings.offsets[2] ?? 0)]));
  const bytes = chunk(
    'MDLS',
    concat([
      modelHeader({ version: 1, radius: 4.5, lods: 1, hysteresis: 0.25 }),
      chunk('STRS', strings.bytes),
      chunk('MATS', material),
      points,
      geometry,
    ]),
  );

  const parsed = parseMod(bytes, { file: 'Assets/Models/t/Hull_1.mod' });
  assert.equal(parsed.diagnostics.find((item) => item.severity === 'error'), undefined);
  assert.equal(parsed.data.version, 1);
  assert.equal(parsed.data.radius, 4.5);
  assert.equal(parsed.data.lodCount, 1);
  assert.equal(parsed.data.lods.length, 1);
  assert.equal(parsed.data.lods[0]?.vertices.length, 3);
  assert.equal(parsed.data.lods[0]?.vertices[1]?.x, 1);
  assert.equal(parsed.data.lods[0]?.faces.length, 1);
  assert.equal(parsed.data.lods[0]?.faces[0]?.vertices[1]?.u, 1);
  assert.equal(parsed.data.lods[0]?.faces[0]?.vertices[1]?.v, 0.5);
  assert.equal(parsed.data.materials[0]?.diffuseTexture.name, 'Hull_1.bmp');
  assert.equal(parsed.data.materials[0]?.luminanceTexture?.name, 'Hull_1i.bmp');
  assert.equal(parsed.data.materials[0]?.gouraud, true);
  assert.equal(parsed.data.namedPoints[0]?.name, 'port');
  assert.equal(parsed.data.namedPoints[0]?.position.y, 2);
  assert.equal(
    parsed.diagnostics.every((item) => item.location?.file === 'Assets/Models/t/Hull_1.mod'),
    true,
  );
  assert.equal(machinePathLeak(parsed), null);
});

test('a material without a luminance map is the shorter record', () => {
  const strings = pool(['plain.bmp']);
  const bytes = chunk(
    'MDLS',
    concat([
      modelHeader({ version: 1, radius: 1, lods: 1, hysteresis: 0 }),
      chunk('STRS', strings.bytes),
      chunk('MATS', materialRecord({ flags: 0x0001, diffuseOffset: 0, luminance: false })),
      chunk('MOD0', concat([i32(0), i32(0)])),
    ]),
  );
  const parsed = parseMod(bytes);
  assert.equal(parsed.data.materials[0]?.luminanceTexture, null);
  assert.equal(parsed.data.materials[0]?.diffuseTexture.name, 'plain.bmp');
  assert.equal(parsed.diagnostics.find((item) => item.severity === 'error'), undefined);
});

test('bad input is a diagnostic and an unknown chunk is skipped', () => {
  assert.equal(parseMod(new Uint8Array()).diagnostics[0]?.code, 'emptyFile');
  assert.equal(parseMod(Uint8Array.of(1, 2, 3, 4)).diagnostics[0]?.code, 'truncated');

  const strings = pool(['Hull_1.bmp']);
  const bytes = chunk(
    'MDLS',
    concat([
      modelHeader({ version: 1, radius: 1, lods: 1, hysteresis: 0 }),
      chunk('XXXX', i32(1)),
      chunk('STRS', strings.bytes),
      chunk('MATS', materialRecord({ flags: 0x0001, diffuseOffset: 0, luminance: false })),
      chunk(
        'MOD0',
        concat([
          i32(1),
          i32(1),
          chunk('VTXS', vec(0, 0, 0)),
          chunk('POLY', concat([i32(3), i32(4), vec(0, 0, 1), faceVertex(9, 0, 0, 0), faceVertex(0, 0, 0, 0), faceVertex(0, 0, 0, 0)])),
        ]),
      ),
    ]),
  );
  const parsed = parseMod(bytes, { file: 'C:/Games/ship.mod' });
  assert.equal(parsed.diagnostics.some((item) => item.code === 'unknownChunk'), true);
  assert.equal(parsed.diagnostics.some((item) => item.code === 'badMaterialIndex'), true);
  assert.equal(parsed.diagnostics.some((item) => item.code === 'badVertexIndex'), true);
  assert.equal(parsed.data.materials[0]?.diffuseTexture.name, 'Hull_1.bmp');
  assert.equal(parsed.diagnostics.every((item) => item.location?.file === undefined), true);
  assert.equal(machinePathLeak(parsed), null);
});

test('break-up meshes are the _brk sibling', () => {
  assert.equal(breakupModelPath('Assets/Models/t/Hull_1.mod'), 'Assets/Models/t/Hull_1_brk.mod');
  assert.equal(breakupModelPath('Assets/Models/t/Hull_1_brk.mod'), null);
  assert.equal(breakupModelPath('C:/Games/Hull_1.mod'), null);
});

function chunk(id: string, payload: Uint8Array): Uint8Array {
  const padded = (payload.length + 3) & ~3;
  const out = new Uint8Array(8 + padded);
  out.set(new TextEncoder().encode(id.slice(0, 4)), 0);
  new DataView(out.buffer).setInt32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function i32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, true);
  return out;
}

function f32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setFloat32(0, value, true);
  return out;
}

function vec(x: number, y: number, z: number): Uint8Array {
  return concat([f32(x), f32(y), f32(z)]);
}

function modelHeader(options: { version: number; radius: number; lods: number; hysteresis: number }): Uint8Array {
  return concat([
    i32(options.version),
    f32(options.radius),
    i32(options.lods),
    f32(options.hysteresis),
    f32(0),
    f32(0),
    f32(0),
    f32(0),
    f32(0),
  ]);
}

function materialRecord(options: {
  flags: number;
  diffuseOffset: number;
  luminanceOffset?: number;
  luminance?: boolean;
}): Uint8Array {
  const withLuminance = options.luminance !== false && (options.flags & 0x0020) !== 0;
  const parts = [
    i32(options.flags),
    Uint8Array.of(9, 8, 7, 0),
    f32(0.2),
    f32(0.8),
    f32(0.1),
    i32(1),
    i32(options.diffuseOffset),
  ];
  if (withLuminance) parts.push(i32(2), i32(options.luminanceOffset ?? 0));
  return concat(parts);
}

function faceVertex(index: number, u: number, v: number, light: number): Uint8Array {
  const out = new Uint8Array(28);
  const view = new DataView(out.buffer);
  view.setUint16(0, index, true);
  view.setUint16(2, 0, true);
  view.setFloat32(4, 0, true);
  view.setFloat32(8, 0, true);
  view.setFloat32(12, 1, true);
  view.setFloat32(16, u, true);
  view.setFloat32(20, v, true);
  view.setFloat32(24, light, true);
  return out;
}

function pool(values: string[]): { bytes: Uint8Array; offsets: number[] } {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  for (const value of values) {
    offsets.push(cursor);
    const bytes = concat([new TextEncoder().encode(value), Uint8Array.of(0)]);
    parts.push(bytes);
    cursor += bytes.length;
  }
  return { bytes: concat(parts), offsets };
}
