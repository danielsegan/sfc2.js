import { describe, expect, it } from 'vitest';
import { machinePathLeak } from './diagnostic.ts';
import {
  MOD_MAX_FILE_BYTES,
  MOD_MAX_VERTICES,
  breakupModelPath,
  parseMod,
  type ModModel,
} from './mod.ts';

describe('parseMod', () => {
  it('reads a two-LOD mesh, a luminance material, and a named point', () => {
    const sample = sampleMod();
    const copy = new ArrayBuffer(sample.byteLength);
    new Uint8Array(copy).set(sample);
    const parsed = parseMod(copy, { file: 'Assets\\MODELS\\test\\Hull.mod' });
    expect(codes(parsed.diagnostics)).toEqual([]);
    expect(parsed.diagnostics[0]?.location).toBeUndefined();
    const model = parsed.data;
    expect(model.version).toBe(1);
    expect(model.radius).toBe(12.5);
    expect(model.lodCount).toBe(2);
    expect(model.lodHysteresis).toBe(0.25);
    expect(model.lodTransitions).toEqual([100, 200, 400, 0, 0]);
    expect(model.materials).toHaveLength(1);
    const material = model.materials[0];
    expect(material?.textured).toBe(true);
    expect(material?.gouraud).toBe(true);
    expect(material?.luminance).toBe(true);
    expect(material?.flat).toBe(false);
    expect(material?.additive).toBe(false);
    expect(material?.wire).toBe(false);
    expect(material?.color).toEqual({ r: 255, g: 128, b: 64, pad: 9 });
    expect(material?.ambient).toBe(0.5);
    expect(material?.diffuse).toBe(0.25);
    expect(material?.emittance).toBe(1);
    expect(material?.diffuseTexture).toEqual({ texId: 3, nameOffset: 0, name: 'Hull_1' });
    expect(material?.luminanceTexture).toEqual({ texId: 4, nameOffset: 7, name: 'Hull_1i' });
    expect(model.namedPoints).toEqual([{ name: 'TEST-HP', nameOffset: 15, x: 2, y: 3, z: 4 }]);
    expect(model.lods).toHaveLength(2);
    expect(Array.from(model.lods[0]?.vertices ?? [])).toEqual([0, 0, 0, 1, 0, 0, 0, 2, 0]);
    const face = model.lods[0]?.faces[0];
    expect(face?.materialIndex).toBe(0);
    expect(face?.normal).toEqual([0, 1, 0]);
    expect(face?.vertices.map((corner) => corner.vertexIndex)).toEqual([0, 1, 2]);
    expect(face?.vertices.map((corner) => corner.flags)).toEqual([1, 2, 3]);
    expect(face?.vertices.map((corner) => [corner.u, corner.v, corner.light])).toEqual([
      [0, 0, 0.5],
      [1, 0, 0.5],
      [0, 1, 0.5],
    ]);
    expect(model.lods[1]?.vertices[0]).toBe(5);
    expect(model.unknownChunks).toEqual([]);
    expect(machinePathLeak(parsed.diagnostics)).toBeNull();
  });

  it('reads the same bytes from a view with a non-zero byte offset', () => {
    const sample = sampleMod();
    const holder = new Uint8Array(sample.length + 8);
    holder.set(sample, 4);
    const parsed = parseMod(holder.subarray(4, 4 + sample.length));
    expect(codes(parsed.diagnostics)).toEqual([]);
    expect(parsed.data.radius).toBe(12.5);
    expect(parsed.data.namedPoints[0]?.name).toBe('TEST-HP');
  });

  it('keeps an unknown chunk and still reads the mesh after it', () => {
    const nested = concat([
      header({ version: 1, radius: 1, lodCount: 1 }),
      chunk('ZZZZ', Uint8Array.of(1, 2)),
      meshChunk([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    ]);
    const parsed = parseMod(chunk('MDLS', nested), { file: 'Assets/MODELS/test/Hull.mod' });
    expect(codes(parsed.diagnostics)).toEqual(['unknownChunk', 'materialIndexOutOfRange']);
    expect(parsed.diagnostics[0]?.location).toEqual({ file: 'Assets/MODELS/test/Hull.mod', offset: 8 + 36 });
    expect(parsed.data.unknownChunks[0]).toMatchObject({ type: 'ZZZZ', size: 2 });
    expect(parsed.data.lods[0]?.faces).toHaveLength(1);
  });

  it('does not throw on an empty file, a bad signature, or a short header', () => {
    expect(codes(parseMod(new Uint8Array()).diagnostics)).toEqual(['emptyFile']);
    expect(parseMod(new Uint8Array()).diagnostics[0]?.location).toBeUndefined();
    expect(parseMod(new Uint8Array(), { file: 'Assets/MODELS/test/Hull.mod' }).diagnostics[0]?.location).toBeUndefined();

    const garbage = parseMod(Uint8Array.of(1, 2, 3, 4, 0, 0, 0, 0));
    expect(codes(garbage.diagnostics)).toEqual(['badSignature', 'missingHeader']);
    expect(garbage.data.lods).toEqual([]);

    const short = parseMod(chunk('MDLS', new Uint8Array(8)), { file: 'Assets\\MODELS\\test\\Hull.mod' });
    expect(codes(short.diagnostics)).toContain('truncated');
    expect(short.data.version).toBe(0);
    expect(short.diagnostics[0]?.location?.file).toBe('Assets/MODELS/test/Hull.mod');
  });

  it('drops a drive letter and dot-dot from location.file', () => {
    const bytes = chunk('MDLS', new Uint8Array(4));
    expect(parseMod(bytes, { file: 'C:/Games/Hull.mod' }).diagnostics.every((item) => item.location?.file === undefined)).toBe(true);
    expect(parseMod(bytes, { file: 'Assets/MODELS/../Hull.mod' }).diagnostics.every((item) => item.location?.file === undefined)).toBe(true);
    expect(machinePathLeak(parseMod(bytes, { file: 'C:\\Games\\Hull.mod' }).diagnostics)).toBeNull();
  });

  it('warns when the declared LOD count and the MOD0 count disagree', () => {
    const nested = concat([header({ version: 1, radius: 1, lodCount: 3 }), meshChunk([0, 0, 0, 1, 0, 0, 0, 1, 0])]);
    const parsed = parseMod(chunk('MDLS', nested));
    expect(codes(parsed.diagnostics)).toEqual(['lodCountMismatch', 'materialIndexOutOfRange']);
    expect(parsed.diagnostics[0]?.details).toEqual({ declared: 3, meshes: 1 });
  });

  it('stores a four-corner face and does not draw it as a guessed quad', () => {
    const face = poly([0, 1, 2, 0], 4);
    const mesh = chunk('MOD0', concat([i32([3, 1]), chunk('VTXS', f32s([0, 0, 0, 1, 0, 0, 0, 1, 0])), face]));
    const parsed = parseMod(chunk('MDLS', concat([header({ version: 1, radius: 1, lodCount: 1 }), mesh])));
    expect(codes(parsed.diagnostics)).toEqual(['faceVertexCount', 'materialIndexOutOfRange']);
    expect(parsed.data.lods[0]?.faces[0]?.vertices).toHaveLength(4);
    expect(parsed.diagnostics[0]?.details).toMatchObject({ count: 1, min: 4, max: 4 });
  });

  it('reports a vertex index past the vertex array and a hostile vertex count without allocating it', () => {
    const badIndex = chunk(
      'MOD0',
      concat([i32([1, 1]), chunk('VTXS', f32s([0, 0, 0])), poly([9], 3)]),
    );
    const indexed = parseMod(chunk('MDLS', concat([header({ version: 1, radius: 1, lodCount: 1 }), badIndex])));
    expect(codes(indexed.diagnostics)).toContain('vertexIndexOutOfRange');

    const huge = chunk('MOD0', i32([MOD_MAX_VERTICES + 1, 0]));
    const capped = parseMod(chunk('MDLS', concat([header({ version: 1, radius: 1, lodCount: 1 }), huge])));
    expect(codes(capped.diagnostics)).toContain('badCount');
    expect(capped.data.lods[0]?.vertices).toHaveLength(0);
  });

  it('skips padding after a short string pool and keeps the first pool', () => {
    const strings = chunk('STRS', Uint8Array.of(0x41));
    const again = chunk('STRS', cString('Other'));
    const point = chunk('PNTS', concat([f32s([1, 2, 3]), u32([0])]));
    const parsed = parseMod(chunk('MDLS', concat([header({ version: 4, radius: 2, lodCount: 0 }), strings, point, again])));
    expect(parsed.data.stringPoolBytes).toBe(1);
    expect(codes(parsed.diagnostics)).toContain('duplicateChunk');
    expect(parsed.data.namedPoints[0]?.name).toBe('A');
    expect(codes(parsed.diagnostics)).toContain('badStringOffset');
  });

  it('reports a ragged point chunk and a non-finite radius', () => {
    const points = chunk('PNTS', concat([f32s([1, 2, 3]), u32([0]), Uint8Array.of(1, 2, 3, 4)]));
    const ragged = parseMod(chunk('MDLS', concat([header({ version: 1, radius: 1, lodCount: 0 }), chunk('STRS', cString('P')), points])));
    expect(codes(ragged.diagnostics)).toContain('raggedChunk');
    expect(ragged.data.namedPoints).toHaveLength(1);

    const nanHeader = header({ version: 1, radius: Number.NaN, lodCount: 0 });
    const nan = parseMod(chunk('MDLS', nanHeader));
    expect(codes(nan.diagnostics)).toContain('badNumber');
    expect(Number.isNaN(nan.data.radius)).toBe(true);
  });

  it('refuses a file over the defensive size cap', () => {
    const huge = new Uint8Array(MOD_MAX_FILE_BYTES + 1);
    const parsed = parseMod(huge, { file: 'Assets/MODELS/test/Hull.mod' });
    expect(codes(parsed.diagnostics)).toEqual(['fileTooLarge']);
    expect(parsed.data).toEqual(emptyShape());
  });

  it('does not throw on random bytes', () => {
    const next = lcg(0x4d0d);
    for (let i = 0; i < 32; i++) {
      const length = next() % 128;
      const bytes = new Uint8Array(length);
      for (let b = 0; b < length; b++) bytes[b] = next() & 0xff;
      const parsed = parseMod(bytes, { file: 'Assets/MODELS/test/fuzz.mod' });
      expect(parsed.data.lods).toBeInstanceOf(Array);
      expect(parsed.diagnostics.every((item) => item.source === 'mod')).toBe(true);
      expect(machinePathLeak(parsed.diagnostics)).toBeNull();
    }
  });

  it('throws only when the argument is not bytes', () => {
    expect(() => parseMod('nope' as unknown as ArrayBuffer)).toThrow(TypeError);
  });
});

describe('breakupModelPath', () => {
  it('inserts _brk before the extension and leaves an existing breakup path alone', () => {
    expect(breakupModelPath('Assets/MODELS/test/Hull.mod')).toBe('Assets/MODELS/test/Hull_brk.mod');
    expect(breakupModelPath('Assets/MODELS/test/Hull.MOD')).toBe('Assets/MODELS/test/Hull_brk.MOD');
    expect(breakupModelPath('Assets\\MODELS\\test\\Hull.mod')).toBe('Assets/MODELS/test/Hull_brk.mod');
    expect(breakupModelPath('Assets/MODELS/test/Hull_brk.mod')).toBe('Assets/MODELS/test/Hull_brk.mod');
    expect(breakupModelPath('Assets/MODELS/test/Hull_BRK.mod')).toBe('Assets/MODELS/test/Hull_BRK.mod');
    expect(breakupModelPath('C:/Games/Hull.mod')).toBeUndefined();
    expect(breakupModelPath('Assets/MODELS/../Hull.mod')).toBeUndefined();
  });
});

function emptyShape(): ModModel {
  return {
    version: 0,
    radius: 0,
    lodCount: 0,
    lodHysteresis: 0,
    lodTransitions: [],
    stringPoolBytes: 0,
    materials: [],
    namedPoints: [],
    lods: [],
    unknownChunks: [],
  };
}

function sampleMod(): Uint8Array {
  const pool = concat([cString('Hull_1'), cString('Hull_1i'), cString('TEST-HP')]);
  const material = new Uint8Array(36);
  const view = new DataView(material.buffer);
  view.setUint32(0, 0x0001 | 0x0002 | 0x0020, true);
  material[4] = 255;
  material[5] = 128;
  material[6] = 64;
  material[7] = 9;
  view.setFloat32(8, 0.5, true);
  view.setFloat32(12, 0.25, true);
  view.setFloat32(16, 1, true);
  view.setInt32(20, 3, true);
  view.setInt32(24, 0, true);
  view.setInt32(28, 4, true);
  view.setInt32(32, 7, true);
  const point = concat([f32s([2, 3, 4]), u32([15])]);
  const lod0 = meshChunk([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  const lod1 = meshChunk([5, 0, 0, 6, 0, 0, 5, 1, 0]);
  return chunk(
    'MDLS',
    concat([
      header({ version: 1, radius: 12.5, lodCount: 2, hysteresis: 0.25, transitions: [100, 200, 400, 0, 0] }),
      chunk('STRS', pool),
      chunk('MATS', material),
      chunk('PNTS', point),
      lod0,
      lod1,
    ]),
  );
}

function header(options: {
  version: number;
  radius: number;
  lodCount: number;
  hysteresis?: number;
  transitions?: number[];
}): Uint8Array {
  const out = new Uint8Array(36);
  const view = new DataView(out.buffer);
  view.setUint32(0, options.version, true);
  view.setFloat32(4, options.radius, true);
  view.setInt32(8, options.lodCount, true);
  view.setFloat32(12, options.hysteresis ?? 0, true);
  const transitions = options.transitions ?? [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) view.setFloat32(16 + i * 4, transitions[i] ?? 0, true);
  return out;
}

function meshChunk(positions: number[]): Uint8Array {
  return chunk('MOD0', concat([i32([3, 1]), chunk('VTXS', f32s(positions)), poly([0, 1, 2], 3)]));
}

function poly(indices: number[], corners: number): Uint8Array {
  const body = new Uint8Array(20 + corners * 28);
  const view = new DataView(body.buffer);
  view.setInt32(0, corners, true);
  view.setInt32(4, 0, true);
  view.setFloat32(12, 1, true);
  for (let i = 0; i < corners; i++) {
    const at = 20 + i * 28;
    view.setUint16(at, indices[i] ?? 0, true);
    view.setUint16(at + 2, i + 1, true);
    view.setFloat32(at + 12, 1, true);
    view.setFloat32(at + 16, i === 1 ? 1 : 0, true);
    view.setFloat32(at + 20, i === 2 ? 1 : 0, true);
    view.setFloat32(at + 24, 0.5, true);
  }
  return chunk('POLY', body);
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

function codes(diagnostics: { code: string }[]): string[] {
  return diagnostics.map((item) => item.code);
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state;
  };
}
