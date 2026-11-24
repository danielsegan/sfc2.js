/**
 * SFC `.mod` mesh reader.
 *
 * The chunk layout follows the public sfcmod reader (Karl Robillard,
 * GPL-3.0, https://codeberg.org/wickedsmoke/sfcmod). It has not been
 * checked against a CE 2.670 file. See docs/formats/mod.md.
 */

import { diagnostic, installRelativeFile, type Diagnostic, type ParseResult } from './src/diagnostic.ts';

export const MOD_MATERIAL_FLAGS = {
  textured: 0x0001,
  gouraud: 0x0002,
  flat: 0x0004,
  wire: 0x0008,
  additive: 0x0010,
  luminance: 0x0020,
} as const;

const MAX_LODS = 8;
const MAX_VERTICES = 200_000;
const MAX_FACES = 200_000;
const MAX_FACE_VERTS = 8;

export interface ModVec3 {
  x: number;
  y: number;
  z: number;
}

export interface ModTextureRef {
  id: number;
  name: string | null;
}

export interface ModMaterial {
  flags: number;
  textured: boolean;
  gouraud: boolean;
  flat: boolean;
  wire: boolean;
  additive: boolean;
  color: { r: number; g: number; b: number };
  ambient: number;
  diffuse: number;
  emittance: number;
  diffuseTexture: ModTextureRef;
  /** Present when the luminance flag is set. This is the self-illumination map. */
  luminanceTexture: ModTextureRef | null;
}

export interface ModFaceVertex {
  index: number;
  flags: number;
  normal: ModVec3;
  u: number;
  v: number;
  light: number;
}

export interface ModFace {
  materialIndex: number;
  normal: ModVec3;
  vertices: ModFaceVertex[];
}

export interface ModMesh {
  vertices: ModVec3[];
  faces: ModFace[];
}

export interface ModNamedPoint {
  position: ModVec3;
  name: string | null;
}

export interface ModModel {
  version: number;
  radius: number;
  lodCount: number;
  lodHysteresis: number;
  /** Up to five transition distances stored after the model header. */
  lodTransitions: number[];
  materials: ModMaterial[];
  namedPoints: ModNamedPoint[];
  lods: ModMesh[];
}

export interface ParseModOptions {
  file?: string;
}

interface RawMaterial {
  flags: number;
  color: { r: number; g: number; b: number };
  ambient: number;
  diffuse: number;
  emittance: number;
  diffuseId: number;
  diffuseOffset: number;
  luminanceId: number;
  luminanceOffset: number;
  hasLuminance: boolean;
}

interface RawPoint {
  position: ModVec3;
  nameOffset: number;
}

export function parseMod(input: ArrayBuffer | Uint8Array, options?: ParseModOptions): ParseResult<ModModel> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const file = options?.file !== undefined ? installRelativeFile(options.file) : undefined;
  const diagnostics: Diagnostic[] = [];
  const model = emptyModel();

  const fail = (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => {
    diagnostics.push(
      diagnostic(code, 'mod', severity, {
        ...(details !== undefined ? { details } : {}),
        location: {
          ...(file !== undefined ? { file } : {}),
          ...(offset !== undefined ? { offset } : {}),
        },
      }),
    );
  };

  if (bytes.length === 0) {
    fail('emptyFile', 'error');
    return { data: model, diagnostics };
  }
  if (bytes.length < 8) {
    fail('truncated', 'error', undefined, 0);
    fail('missingHeader', 'error');
    return { data: model, diagnostics };
  }

  let stringPool = new Uint8Array(0);
  const rawMaterials: RawMaterial[] = [];
  const rawPoints: RawPoint[] = [];
  let sawHeader = false;

  const readTree = (start: number, end: number, mesh: ModMesh | null) => {
    let cursor = start;
    while (cursor + 8 <= end) {
      const type = fourcc(bytes, cursor);
      const size = readI32(bytes, cursor + 4);
      const payload = cursor + 8;
      if (size < 0 || payload + size > bytes.length) {
        fail('truncated', 'error', { type }, cursor);
        return;
      }
      const payloadEnd = Math.min(payload + size, end);
      const next = align4(payload + size);
      switch (type) {
        case 'MDLS':
          if (sawHeader) {
            fail('duplicateChunk', 'warning', { type }, cursor);
            break;
          }
          sawHeader = true;
          if (payload + 36 > payloadEnd) {
            fail('truncated', 'error', { type: 'MDLS' }, cursor);
            break;
          }
          readModelHeader(bytes, payload, payloadEnd, model, fail);
          readTree(payload + 36, payloadEnd, null);
          break;
        case 'STRS':
          if (stringPool.length > 0) fail('duplicateChunk', 'warning', { type }, cursor);
          const copy = new Uint8Array(payloadEnd - payload);
          copy.set(bytes.subarray(payload, payloadEnd));
          stringPool = copy;
          break;
        case 'MATS':
          readMaterials(bytes, payload, payloadEnd, rawMaterials, fail);
          break;
        case 'PNTS':
          readPoints(bytes, payload, payloadEnd, rawPoints, fail, cursor);
          break;
        case 'MOD0':
          readGeometry(bytes, payload, payloadEnd, model, fail, readTree);
          break;
        case 'VTXS':
          if (mesh === null) fail('unknownChunk', 'warning', { type }, cursor);
          else readVertices(bytes, payload, payloadEnd, mesh, fail, cursor);
          break;
        case 'POLY':
          if (mesh === null) fail('unknownChunk', 'warning', { type }, cursor);
          else readFace(bytes, payload, payloadEnd, mesh, fail, cursor);
          break;
        default:
          fail('unknownChunk', 'warning', { type }, cursor);
          break;
      }
      if (next <= cursor) return;
      cursor = next;
    }
    if (cursor < end && end - cursor >= 8) fail('truncated', 'error', undefined, cursor);
  };

  readTree(0, bytes.length, null);
  if (!sawHeader) fail('missingHeader', 'error');

  model.materials = rawMaterials.map((raw) => ({
    flags: raw.flags,
    textured: (raw.flags & MOD_MATERIAL_FLAGS.textured) !== 0,
    gouraud: (raw.flags & MOD_MATERIAL_FLAGS.gouraud) !== 0,
    flat: (raw.flags & MOD_MATERIAL_FLAGS.flat) !== 0,
    wire: (raw.flags & MOD_MATERIAL_FLAGS.wire) !== 0,
    additive: (raw.flags & MOD_MATERIAL_FLAGS.additive) !== 0,
    color: raw.color,
    ambient: raw.ambient,
    diffuse: raw.diffuse,
    emittance: raw.emittance,
    diffuseTexture: { id: raw.diffuseId, name: poolString(stringPool, raw.diffuseOffset, fail) },
    luminanceTexture: raw.hasLuminance
      ? { id: raw.luminanceId, name: poolString(stringPool, raw.luminanceOffset, fail) }
      : null,
  }));
  model.namedPoints = rawPoints.map((point) => ({
    position: point.position,
    name: poolString(stringPool, point.nameOffset, fail),
  }));

  for (const mesh of model.lods) {
    for (const face of mesh.faces) {
      if (face.materialIndex < 0 || face.materialIndex >= model.materials.length) {
        fail('badMaterialIndex', 'warning', { materialIndex: face.materialIndex });
      }
      for (const vertex of face.vertices) {
        if (vertex.index < 0 || vertex.index >= mesh.vertices.length) {
          fail('badVertexIndex', 'warning', { index: vertex.index, vertexCount: mesh.vertices.length });
        }
      }
    }
  }
  if (sawHeader && model.lods.length !== model.lodCount) {
    fail('lodCountMismatch', 'warning', { declared: model.lodCount, found: model.lods.length });
  }

  return { data: model, diagnostics };
}

/** Sibling break-up mesh. `hull.mod` becomes `hull_brk.mod`. */
export function breakupModelPath(geometryPath: string): string | null {
  const safe = installRelativeFile(geometryPath.replaceAll('\\', '/'));
  if (safe === undefined) return null;
  const slash = safe.lastIndexOf('/');
  const base = slash >= 0 ? safe.slice(slash + 1) : safe;
  const dir = slash >= 0 ? safe.slice(0, slash + 1) : '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  const stem = base.slice(0, dot);
  const ext = base.slice(dot);
  if (stem.toLowerCase().endsWith('_brk')) return null;
  return `${dir}${stem}_brk${ext}`;
}

function emptyModel(): ModModel {
  return {
    version: 0,
    radius: 0,
    lodCount: 0,
    lodHysteresis: 0,
    lodTransitions: [],
    materials: [],
    namedPoints: [],
    lods: [],
  };
}

function readModelHeader(
  bytes: Uint8Array,
  payload: number,
  payloadEnd: number,
  model: ModModel,
  fail: (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => void,
): void {
  if (payload + 36 > payloadEnd || payload + 36 > bytes.length) {
    fail('truncated', 'error', { type: 'MDLS' }, payload);
    return;
  }
  model.version = readU32(bytes, payload);
  model.radius = readF32(bytes, payload + 4);
  model.lodCount = readI32(bytes, payload + 8);
  model.lodHysteresis = readF32(bytes, payload + 12);
  const transitions: number[] = [];
  for (let i = 0; i < 5; i++) transitions.push(readF32(bytes, payload + 16 + i * 4));
  model.lodTransitions = transitions;
  if (model.lodCount < 0 || model.lodCount > MAX_LODS) {
    fail('badMeshSize', 'error', { lodCount: model.lodCount }, payload);
    model.lodCount = 0;
  }
}

function readMaterials(
  bytes: Uint8Array,
  start: number,
  end: number,
  out: RawMaterial[],
  fail: (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => void,
): void {
  let cursor = start;
  while (cursor + 28 <= end && cursor + 28 <= bytes.length) {
    const flags = readU32(bytes, cursor);
    const hasLuminance = (flags & MOD_MATERIAL_FLAGS.luminance) !== 0;
    const recordEnd = cursor + (hasLuminance ? 36 : 28);
    if (recordEnd > end || recordEnd > bytes.length) {
      fail('truncated', 'error', { type: 'MATS' }, cursor);
      return;
    }
    const material: RawMaterial = {
      flags,
      color: { r: bytes[cursor + 4] ?? 0, g: bytes[cursor + 5] ?? 0, b: bytes[cursor + 6] ?? 0 },
      ambient: readF32(bytes, cursor + 8),
      diffuse: readF32(bytes, cursor + 12),
      emittance: readF32(bytes, cursor + 16),
      diffuseId: readI32(bytes, cursor + 20),
      diffuseOffset: readI32(bytes, cursor + 24),
      luminanceId: 0,
      luminanceOffset: 0,
      hasLuminance,
    };
    if (hasLuminance) {
      material.luminanceId = readI32(bytes, cursor + 28);
      material.luminanceOffset = readI32(bytes, cursor + 32);
    }
    out.push(material);
    cursor = recordEnd;
  }
  if (cursor < end && end - cursor > 3) fail('truncated', 'error', { type: 'MATS' }, cursor);
}

function readPoints(
  bytes: Uint8Array,
  start: number,
  end: number,
  out: RawPoint[],
  fail: (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => void,
  offset: number,
): void {
  const size = end - start;
  if (size % 16 !== 0) fail('truncated', 'warning', { type: 'PNTS', size }, offset);
  const count = Math.floor(size / 16);
  for (let i = 0; i < count; i++) {
    const at = start + i * 16;
    if (at + 16 > bytes.length) {
      fail('truncated', 'error', { type: 'PNTS' }, at);
      return;
    }
    out.push({
      position: readVec3(bytes, at),
      nameOffset: readI32(bytes, at + 12),
    });
  }
}

function readGeometry(
  bytes: Uint8Array,
  payload: number,
  payloadEnd: number,
  model: ModModel,
  fail: (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => void,
  readTree: (start: number, end: number, mesh: ModMesh | null) => void,
): void {
  if (payload + 8 > bytes.length || payload + 8 > payloadEnd) {
    fail('truncated', 'error', { type: 'MOD0' }, payload);
    return;
  }
  const vertexCount = readI32(bytes, payload);
  const faceCount = readI32(bytes, payload + 4);
  if (
    vertexCount < 0 ||
    faceCount < 0 ||
    vertexCount > MAX_VERTICES ||
    faceCount > MAX_FACES
  ) {
    fail('badMeshSize', 'error', { vertexCount, faceCount }, payload);
    return;
  }
  const mesh: ModMesh = { vertices: [], faces: [] };
  mesh.vertices = Array.from({ length: vertexCount }, () => ({ x: 0, y: 0, z: 0 }));
  model.lods.push(mesh);
  readTree(payload + 8, payloadEnd, mesh);
  if (mesh.faces.length !== faceCount) {
    fail('faceCountMismatch', 'warning', {
      declaredFaces: faceCount,
      foundFaces: mesh.faces.length,
    });
  }
}

function readVertices(
  bytes: Uint8Array,
  payload: number,
  payloadEnd: number,
  mesh: ModMesh,
  fail: (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => void,
  offset: number,
): void {
  const needed = mesh.vertices.length * 12;
  if (payload + needed > bytes.length || payload + needed > payloadEnd) {
    fail('truncated', 'error', { type: 'VTXS', vertexCount: mesh.vertices.length }, offset);
    return;
  }
  for (let i = 0; i < mesh.vertices.length; i++) {
    mesh.vertices[i] = readVec3(bytes, payload + i * 12);
  }
}

function readFace(
  bytes: Uint8Array,
  payload: number,
  payloadEnd: number,
  mesh: ModMesh,
  fail: (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => void,
  offset: number,
): void {
  if (payload + 20 > bytes.length || payload + 20 > payloadEnd) {
    fail('truncated', 'error', { type: 'POLY' }, offset);
    return;
  }
  const vtxCount = readI32(bytes, payload);
  const materialIndex = readI32(bytes, payload + 4);
  if (vtxCount < 1 || vtxCount > MAX_FACE_VERTS) {
    fail('faceVertexCount', 'warning', { vtxCount }, offset);
    return;
  }
  if (vtxCount !== 3) fail('faceVertexCount', 'warning', { vtxCount }, offset);
  const body = 20 + vtxCount * 28;
  if (payload + body > bytes.length || payload + body > payloadEnd) {
    fail('truncated', 'error', { type: 'POLY', vtxCount }, offset);
    return;
  }
  const vertices: ModFaceVertex[] = [];
  for (let i = 0; i < vtxCount; i++) {
    const at = payload + 20 + i * 28;
    vertices.push({
      index: readU16(bytes, at),
      flags: readU16(bytes, at + 2),
      normal: readVec3(bytes, at + 4),
      u: readF32(bytes, at + 16),
      v: readF32(bytes, at + 20),
      light: readF32(bytes, at + 24),
    });
  }
  mesh.faces.push({
    materialIndex,
    normal: readVec3(bytes, payload + 8),
    vertices,
  });
}

function poolString(
  pool: Uint8Array,
  offset: number,
  fail: (code: string, severity: Diagnostic['severity'], details?: Record<string, unknown>, offset?: number) => void,
): string | null {
  if (offset < 0 || offset >= pool.length) {
    fail('badStringOffset', 'warning', { offset });
    return null;
  }
  let end = offset;
  while (end < pool.length && pool[end] !== 0) end += 1;
  return new TextDecoder('windows-1252').decode(pool.subarray(offset, end));
}

function fourcc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

function align4(value: number): number {
  return (value + 3) & ~3;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readI32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(offset, true);
}

function readF32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(offset, true);
}

function readVec3(bytes: Uint8Array, offset: number): ModVec3 {
  return {
    x: readF32(bytes, offset),
    y: readF32(bytes, offset + 4),
    z: readF32(bytes, offset + 8),
  };
}
