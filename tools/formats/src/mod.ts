/**
 * SFC1/SFC2 `.mod` reader.
 *
 * The chunk layout is the one documented in docs/formats/mod.md
 * (public sfcmod reader). Names the reader stores but does not
 * interpret stay on the model and are not turned into extra fields.
 * Bad input becomes a diagnostic. This function does not throw on a
 * short or corrupt file.
 */

import { diagnostic, installRelativeFile, type Diagnostic, type ParseResult } from './diagnostic.ts';
import { normalizeInstallPath } from '../text.ts';

export const MOD_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MOD_MAX_VERTICES = 65536;
export const MOD_MAX_FACES = 65536;
export const MOD_MAX_LODS = 8;
export const MOD_MAX_MATERIALS = 256;
export const MOD_MAX_POINTS = 4096;
export const MOD_MAX_CORNERS = 8;
export const MOD_PUBLISHED_LOD_MAX = 5;

export const MOD_MATERIAL_FLAGS = {
  textured: 0x0001,
  gouraud: 0x0002,
  flat: 0x0004,
  wire: 0x0008,
  additive: 0x0010,
  luminance: 0x0020,
} as const;

const HEADER_BYTES = 36;
const MATERIAL_BYTES = 28;
const POINT_BYTES = 16;
const CORNER_BYTES = 28;

export interface ParseModOptions {
  /** Install-relative path. Backslashes are rewritten to `/`. */
  file?: string;
}

export interface ModTextureRef {
  texId: number;
  nameOffset: number;
  /** Windows-1252 C string. Empty when the offset does not resolve. */
  name: string;
}

export interface ModMaterial {
  flags: number;
  textured: boolean;
  gouraud: boolean;
  flat: boolean;
  wire: boolean;
  additive: boolean;
  luminance: boolean;
  color: { r: number; g: number; b: number; pad: number };
  ambient: number;
  diffuse: number;
  emittance: number;
  diffuseTexture: ModTextureRef;
  luminanceTexture: ModTextureRef | null;
}

export interface ModNamedPoint {
  name: string;
  nameOffset: number;
  x: number;
  y: number;
  z: number;
}

export interface ModCorner {
  vertexIndex: number;
  flags: number;
  normal: readonly [number, number, number];
  u: number;
  v: number;
  light: number;
}

export interface ModFace {
  materialIndex: number;
  normal: readonly [number, number, number];
  vertices: ModCorner[];
}

export interface ModLod {
  index: number;
  declaredVertexCount: number;
  declaredFaceCount: number;
  /** xyz, xyz, … File order. Length is `readCount * 3`, which may be short of the declaration. */
  vertices: Float32Array;
  faces: ModFace[];
}

export interface ModUnknownChunk {
  type: string;
  size: number;
  offset: number;
}

export interface ModModel {
  version: number;
  radius: number;
  /** `totalLODs` from the header. 0 when the header was missing. */
  lodCount: number;
  lodHysteresis: number;
  /** Five floats when `MDLS` was long enough, otherwise empty. */
  lodTransitions: number[];
  stringPoolBytes: number;
  materials: ModMaterial[];
  namedPoints: ModNamedPoint[];
  lods: ModLod[];
  unknownChunks: ModUnknownChunk[];
}

interface Tally {
  count: number;
  offset?: number;
  min: number;
  max: number;
}

interface Ctx {
  bytes: Uint8Array;
  view: DataView;
  file?: string;
  model: ModModel;
  diagnostics: Diagnostic[];
  pool: Uint8Array;
  currentLod: ModLod | null;
  sawMdls: boolean;
  headerComplete: boolean;
  poolOrigin?: number;
  sawStrs: boolean;
  sawMats: boolean;
  sawPnts: boolean;
  mod0Count: number;
  nonFinite: number;
  once: Set<string>;
  verticesRead: WeakSet<ModLod>;
  faceVertices: Tally;
  badVertices: Tally;
  badMaterials: Tally;
  badStrings: Tally;
}

export function parseMod(input: ArrayBuffer | Uint8Array, options?: ParseModOptions): ParseResult<ModModel> {
  const bytes = asBytes(input);
  const file = options?.file === undefined ? undefined : installRelativeFile(normalizeInstallPath(options.file));
  const model = emptyModel();
  if (bytes.length === 0) {
    return { data: model, diagnostics: [diagnostic('emptyFile', 'mod', 'error')] };
  }
  if (bytes.length > MOD_MAX_FILE_BYTES) {
    return {
      data: model,
      diagnostics: [
        diagnostic('fileTooLarge', 'mod', 'error', {
          details: { size: bytes.length, limit: MOD_MAX_FILE_BYTES },
          location: file === undefined ? undefined : { file },
        }),
      ],
    };
  }

  const ctx: Ctx = {
    bytes,
    view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    file,
    model,
    diagnostics: [],
    pool: new Uint8Array(0),
    currentLod: null,
    sawMdls: false,
    headerComplete: false,
    sawStrs: false,
    sawMats: false,
    sawPnts: false,
    mod0Count: 0,
    nonFinite: 0,
    once: new Set(),
    verticesRead: new WeakSet(),
    faceVertices: freshTally(),
    badVertices: freshTally(),
    badMaterials: freshTally(),
    badStrings: freshTally(),
  };

  readChunks(ctx, 0, bytes.length, 0);
  resolveNames(ctx);
  checkCorners(ctx);
  finish(ctx);
  return { data: model, diagnostics: ctx.diagnostics };
}

/**
 * Sibling breakup mesh: `Hull.mod` → `Hull_brk.mod`.
 * A path that already ends in `_brk.mod` is returned unchanged.
 * An unsafe path returns undefined.
 */
export function breakupModelPath(modelPath: string): string | undefined {
  const safe = installRelativeFile(normalizeInstallPath(modelPath));
  if (safe === undefined) return undefined;
  const slash = safe.lastIndexOf('/');
  const dir = slash >= 0 ? safe.slice(0, slash) : '';
  const base = slash >= 0 ? safe.slice(slash + 1) : safe;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return undefined;
  const ext = base.slice(dot);
  if (ext.toLowerCase() !== '.mod') return undefined;
  const stem = base.slice(0, dot);
  if (stem.toLowerCase().endsWith('_brk')) return safe;
  const next = `${stem}_brk${ext}`;
  return dir.length > 0 ? `${dir}/${next}` : next;
}

function readChunks(ctx: Ctx, start: number, end: number, depth: number): void {
  if (depth > 4) {
    emit(ctx, 'truncated', 'error', { depth }, start);
    return;
  }
  let offset = start;
  while (offset + 8 <= end) {
    const type = fourccAt(ctx.bytes, offset);
    const size = ctx.view.getInt32(offset + 4, true);
    const payload = offset + 8;
    if (size < 0) {
      emitOnce(ctx, 'badCount:chunkSize', 'badCount', 'error', { field: 'chunkSize', value: size }, offset);
      return;
    }
    if (payload > end || size > end - payload) {
      emit(ctx, 'truncated', 'error', { size }, offset);
      return;
    }
    if (offset === 0 && depth === 0 && type === '') {
      emit(ctx, 'badSignature', 'error', undefined, 0);
      return;
    }
    dispatch(ctx, type, payload, size, offset, depth);
    const next = (payload + size + 3) & ~3;
    if (next <= offset) {
      emit(ctx, 'truncated', 'error', { size }, offset);
      return;
    }
    offset = next > end ? end : next;
  }
}

function dispatch(ctx: Ctx, type: string, payload: number, size: number, offset: number, depth: number): void {
  switch (type) {
    case 'MDLS':
      readHeader(ctx, payload, size, offset, depth);
      return;
    case 'STRS':
      readStrings(ctx, payload, size, offset);
      return;
    case 'MATS':
      readMaterials(ctx, payload, size, offset);
      return;
    case 'PNTS':
      readPoints(ctx, payload, size, offset);
      return;
    case 'MOD0':
      readMesh(ctx, payload, size, offset, depth);
      return;
    case 'VTXS':
      readVertices(ctx, payload, size, offset);
      return;
    case 'POLY':
      readFace(ctx, payload, size, offset);
      return;
    default:
      ctx.model.unknownChunks.push({ type: type === '' ? hexType(ctx, offset) : type, size, offset });
      emit(ctx, 'unknownChunk', 'warning', { type: type === '' ? hexType(ctx, offset) : type, size }, offset);
  }
}

function readHeader(ctx: Ctx, payload: number, size: number, offset: number, depth: number): void {
  if (ctx.sawMdls) {
    emit(ctx, 'duplicateChunk', 'warning', { type: 'MDLS' }, offset);
    return;
  }
  ctx.sawMdls = true;
  ctx.headerComplete = size >= HEADER_BYTES;
  if (size < HEADER_BYTES) {
    emit(ctx, 'truncated', 'error', { size, expected: HEADER_BYTES }, offset);
    readPartialHeader(ctx, payload, size);
    return;
  }
  ctx.model.version = ctx.view.getUint32(payload, true);
  ctx.model.radius = f32(ctx, payload + 4);
  ctx.model.lodCount = ctx.view.getInt32(payload + 8, true);
  ctx.model.lodHysteresis = f32(ctx, payload + 12);
  const transitions: number[] = [];
  for (let i = 0; i < MOD_PUBLISHED_LOD_MAX; i++) transitions.push(f32(ctx, payload + 16 + i * 4));
  ctx.model.lodTransitions = transitions;
  if (size > HEADER_BYTES) readChunks(ctx, payload + HEADER_BYTES, payload + size, depth + 1);
}

function readPartialHeader(ctx: Ctx, payload: number, size: number): void {
  if (size >= 4) ctx.model.version = ctx.view.getUint32(payload, true);
  if (size >= 8) ctx.model.radius = f32(ctx, payload + 4);
  if (size >= 12) ctx.model.lodCount = ctx.view.getInt32(payload + 8, true);
  if (size >= 16) ctx.model.lodHysteresis = f32(ctx, payload + 12);
  const floats = Math.floor(Math.max(0, size - 16) / 4);
  const transitions: number[] = [];
  for (let i = 0; i < floats && i < MOD_PUBLISHED_LOD_MAX; i++) transitions.push(f32(ctx, payload + 16 + i * 4));
  ctx.model.lodTransitions = transitions;
}

function readStrings(ctx: Ctx, payload: number, size: number, offset: number): void {
  if (ctx.sawStrs) {
    emit(ctx, 'duplicateChunk', 'warning', { type: 'STRS' }, offset);
    return;
  }
  ctx.sawStrs = true;
  ctx.poolOrigin = offset;
  ctx.pool = ctx.bytes.slice(payload, payload + size);
  ctx.model.stringPoolBytes = size;
}

function readMaterials(ctx: Ctx, payload: number, size: number, offset: number): void {
  if (ctx.sawMats) {
    emit(ctx, 'duplicateChunk', 'warning', { type: 'MATS' }, offset);
    return;
  }
  ctx.sawMats = true;
  let cursor = payload;
  const end = payload + size;
  let short = false;
  while (cursor + MATERIAL_BYTES <= end) {
    if (ctx.model.materials.length >= MOD_MAX_MATERIALS) {
      emitOnce(ctx, 'badCount:materials', 'badCount', 'error', { field: 'materials', value: ctx.model.materials.length + 1 }, offset);
      return;
    }
    const flags = ctx.view.getUint32(cursor, true);
    const diffuseTexture: ModTextureRef = {
      texId: ctx.view.getInt32(cursor + 20, true),
      nameOffset: ctx.view.getInt32(cursor + 24, true),
      name: '',
    };
    let luminanceTexture: ModTextureRef | null = null;
    let next = cursor + MATERIAL_BYTES;
    if ((flags & MOD_MATERIAL_FLAGS.luminance) !== 0) {
      if (next + 8 > end) {
        emit(ctx, 'truncated', 'error', { size: end - next, expected: 8 }, next);
        short = true;
        break;
      }
      luminanceTexture = {
        texId: ctx.view.getInt32(next, true),
        nameOffset: ctx.view.getInt32(next + 4, true),
        name: '',
      };
      next += 8;
    }
    ctx.model.materials.push({
      flags,
      textured: (flags & MOD_MATERIAL_FLAGS.textured) !== 0,
      gouraud: (flags & MOD_MATERIAL_FLAGS.gouraud) !== 0,
      flat: (flags & MOD_MATERIAL_FLAGS.flat) !== 0,
      wire: (flags & MOD_MATERIAL_FLAGS.wire) !== 0,
      additive: (flags & MOD_MATERIAL_FLAGS.additive) !== 0,
      luminance: luminanceTexture !== null,
      color: {
        r: ctx.bytes[cursor + 4] ?? 0,
        g: ctx.bytes[cursor + 5] ?? 0,
        b: ctx.bytes[cursor + 6] ?? 0,
        pad: ctx.bytes[cursor + 7] ?? 0,
      },
      ambient: f32(ctx, cursor + 8),
      diffuse: f32(ctx, cursor + 12),
      emittance: f32(ctx, cursor + 16),
      diffuseTexture,
      luminanceTexture,
    });
    cursor = next;
  }
  if (!short && cursor !== end) emit(ctx, 'raggedChunk', 'warning', { type: 'MATS' }, cursor);
}

function readPoints(ctx: Ctx, payload: number, size: number, offset: number): void {
  if (ctx.sawPnts) {
    emit(ctx, 'duplicateChunk', 'warning', { type: 'PNTS' }, offset);
    return;
  }
  ctx.sawPnts = true;
  if (size % POINT_BYTES !== 0) emit(ctx, 'raggedChunk', 'warning', { type: 'PNTS' }, offset);
  const count = Math.floor(size / POINT_BYTES);
  if (count > MOD_MAX_POINTS) {
    emitOnce(ctx, 'badCount:points', 'badCount', 'error', { field: 'points', value: count }, offset);
  }
  const take = Math.min(count, MOD_MAX_POINTS);
  for (let i = 0; i < take; i++) {
    const at = payload + i * POINT_BYTES;
    ctx.model.namedPoints.push({
      x: f32(ctx, at),
      y: f32(ctx, at + 4),
      z: f32(ctx, at + 8),
      nameOffset: ctx.view.getUint32(at + 12, true),
      name: '',
    });
  }
}

function readMesh(ctx: Ctx, payload: number, size: number, offset: number, depth: number): void {
  if (ctx.mod0Count >= MOD_MAX_LODS) {
    emitOnce(ctx, 'badCount:lod', 'badCount', 'error', { field: 'lod', value: ctx.mod0Count + 1 }, offset);
    return;
  }
  if (size < 8) {
    emit(ctx, 'truncated', 'error', { size, expected: 8 }, offset);
    return;
  }
  const vertexCount = ctx.view.getInt32(payload, true);
  const faceCount = ctx.view.getInt32(payload + 4, true);
  const lod: ModLod = {
    index: ctx.model.lods.length,
    declaredVertexCount: vertexCount,
    declaredFaceCount: faceCount,
    vertices: new Float32Array(0),
    faces: [],
  };
  ctx.model.lods.push(lod);
  ctx.mod0Count += 1;
  if (vertexCount < 0 || vertexCount > MOD_MAX_VERTICES) {
    emitOnce(ctx, 'badCount:vertexCount', 'badCount', 'error', { field: 'vertexCount', value: vertexCount }, offset);
  }
  if (faceCount < 0 || faceCount > MOD_MAX_FACES) {
    emitOnce(ctx, 'badCount:faceCount', 'badCount', 'error', { field: 'faceCount', value: faceCount }, offset);
  }
  const previous = ctx.currentLod;
  ctx.currentLod = lod;
  if (size > 8) readChunks(ctx, payload + 8, payload + size, depth + 1);
  ctx.currentLod = previous;
  if (faceCount >= 0 && faceCount <= MOD_MAX_FACES && lod.faces.length !== faceCount) {
    emit(ctx, 'faceCountMismatch', 'warning', { declared: faceCount, read: lod.faces.length, lod: lod.index }, offset);
  }
}

function readVertices(ctx: Ctx, payload: number, size: number, offset: number): void {
  const lod = ctx.currentLod;
  if (lod === null) {
    emit(ctx, 'orphanChunk', 'warning', { type: 'VTXS' }, offset);
    return;
  }
  if (ctx.verticesRead.has(lod)) {
    emit(ctx, 'duplicateChunk', 'warning', { type: 'VTXS' }, offset);
    return;
  }
  ctx.verticesRead.add(lod);
  const declared = lod.declaredVertexCount;
  if (declared < 0 || declared > MOD_MAX_VERTICES) return;
  const expected = declared * 12;
  if (size < expected) emit(ctx, 'truncated', 'error', { size, expected }, offset);
  else if (size !== expected) emit(ctx, 'raggedChunk', 'warning', { type: 'VTXS' }, offset);
  const readCount = Math.floor(Math.min(size, expected) / 12);
  const vertices = new Float32Array(readCount * 3);
  for (let i = 0; i < vertices.length; i++) vertices[i] = f32(ctx, payload + i * 4);
  lod.vertices = vertices;
}

function readFace(ctx: Ctx, payload: number, size: number, offset: number): void {
  const lod = ctx.currentLod;
  if (lod === null) {
    emit(ctx, 'orphanChunk', 'warning', { type: 'POLY' }, offset);
    return;
  }
  if (lod.faces.length >= MOD_MAX_FACES) {
    emitOnce(ctx, 'badCount:facesStored', 'badCount', 'error', { field: 'faceCount', value: lod.faces.length + 1 }, offset);
    return;
  }
  if (size < 8) {
    emit(ctx, 'truncated', 'error', { size, expected: 8 }, offset);
    return;
  }
  const vtxCount = ctx.view.getInt32(payload, true);
  const materialIndex = ctx.view.getInt32(payload + 4, true);
  if (vtxCount !== 3) noteTally(ctx.faceVertices, vtxCount, offset);
  if (vtxCount < 1 || vtxCount > MOD_MAX_CORNERS) return;
  const need = 20 + vtxCount * CORNER_BYTES;
  if (size < need) {
    emit(ctx, 'truncated', 'error', { size, expected: need }, offset);
    return;
  }
  const normal = tuple3(ctx, payload + 8);
  const vertices: ModCorner[] = [];
  for (let i = 0; i < vtxCount; i++) {
    const at = payload + 20 + i * CORNER_BYTES;
    vertices.push({
      vertexIndex: ctx.view.getUint16(at, true),
      flags: ctx.view.getUint16(at + 2, true),
      normal: tuple3(ctx, at + 4),
      u: f32(ctx, at + 16),
      v: f32(ctx, at + 20),
      light: f32(ctx, at + 24),
    });
  }
  lod.faces.push({ materialIndex, normal, vertices });
}

function resolveNames(ctx: Ctx): void {
  const decoder = new TextDecoder('windows-1252');
  const resolve = (offset: number): string => {
    if (!Number.isInteger(offset) || offset < 0 || offset >= ctx.pool.length) {
      noteTally(ctx.badStrings, 1, ctx.poolOrigin);
      return '';
    }
    let end = offset;
    while (end < ctx.pool.length && ctx.pool[end] !== 0) end += 1;
    if (end >= ctx.pool.length) noteTally(ctx.badStrings, 1, ctx.poolOrigin);
    return decoder.decode(ctx.pool.subarray(offset, end));
  };
  for (const material of ctx.model.materials) {
    material.diffuseTexture.name = resolve(material.diffuseTexture.nameOffset);
    if (material.textured && material.diffuseTexture.name === '' && offsetInPool(ctx, material.diffuseTexture.nameOffset)) {
      emit(ctx, 'missingTextureName', 'warning', { which: 'diffuse' });
    }
    if (material.luminanceTexture !== null) {
      material.luminanceTexture.name = resolve(material.luminanceTexture.nameOffset);
      if (material.luminanceTexture.name === '' && offsetInPool(ctx, material.luminanceTexture.nameOffset)) {
        emit(ctx, 'missingTextureName', 'warning', { which: 'luminance' });
      }
    }
  }
  for (const point of ctx.model.namedPoints) {
    point.name = resolve(point.nameOffset);
  }
}

function checkCorners(ctx: Ctx): void {
  for (const lod of ctx.model.lods) {
    const vertexCount = lod.vertices.length / 3;
    for (const face of lod.faces) {
      if (face.materialIndex < 0 || face.materialIndex >= ctx.model.materials.length) {
        noteTally(ctx.badMaterials, 1);
      }
      for (const corner of face.vertices) {
        if (corner.vertexIndex >= vertexCount) noteTally(ctx.badVertices, 1);
      }
    }
  }
}

function finish(ctx: Ctx): void {
  if (!ctx.sawMdls) emit(ctx, 'missingHeader', 'error');
  if (ctx.headerComplete && (ctx.model.lodCount < 1 || ctx.model.lodCount > MOD_PUBLISHED_LOD_MAX)) {
    emit(ctx, 'lodCountRange', 'warning', { declared: ctx.model.lodCount });
  }
  if (ctx.headerComplete && ctx.model.lodCount >= 0 && ctx.model.lodCount <= MOD_MAX_LODS && ctx.mod0Count !== ctx.model.lodCount) {
    emit(ctx, 'lodCountMismatch', 'warning', { declared: ctx.model.lodCount, meshes: ctx.mod0Count });
  }
  flushCount(ctx, ctx.faceVertices, 'faceVertexCount', { count: ctx.faceVertices.count, min: ctx.faceVertices.min, max: ctx.faceVertices.max });
  flushCount(ctx, ctx.badVertices, 'vertexIndexOutOfRange', { count: ctx.badVertices.count });
  flushCount(ctx, ctx.badMaterials, 'materialIndexOutOfRange', { count: ctx.badMaterials.count });
  flushCount(ctx, ctx.badStrings, 'badStringOffset', { count: ctx.badStrings.count });
  if (ctx.nonFinite > 0) emit(ctx, 'badNumber', 'warning', { count: ctx.nonFinite });
}

function flushCount(ctx: Ctx, tally: Tally, code: string, details: Record<string, unknown>): void {
  if (tally.count === 0) return;
  emit(ctx, code, 'warning', details, tally.offset);
}

function offsetInPool(ctx: Ctx, offset: number): boolean {
  return offset >= 0 && offset < ctx.pool.length && ctx.pool[offset] === 0;
}

function tuple3(ctx: Ctx, offset: number): readonly [number, number, number] {
  return [f32(ctx, offset), f32(ctx, offset + 4), f32(ctx, offset + 8)];
}

function f32(ctx: Ctx, offset: number): number {
  const value = ctx.view.getFloat32(offset, true);
  if (!Number.isFinite(value)) ctx.nonFinite += 1;
  return value;
}

function emit(
  ctx: Ctx,
  code: string,
  severity: Diagnostic['severity'],
  details?: Record<string, unknown>,
  offset?: number,
): void {
  ctx.diagnostics.push(
    diagnostic(code, 'mod', severity, {
      details,
      location: code === 'emptyFile' ? undefined : { file: ctx.file, offset },
    }),
  );
}

function emitOnce(
  ctx: Ctx,
  key: string,
  code: string,
  severity: Diagnostic['severity'],
  details: Record<string, unknown>,
  offset: number,
): void {
  if (ctx.once.has(key)) return;
  ctx.once.add(key);
  emit(ctx, code, severity, details, offset);
}

function fourccAt(bytes: Uint8Array, offset: number): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    const c = bytes[offset + i] ?? 0;
    if (c < 0x20 || c > 0x7e) return '';
    out += String.fromCharCode(c);
  }
  return out;
}

function hexType(ctx: Ctx, offset: number): string {
  return `0x${ctx.view.getUint32(offset, true).toString(16).padStart(8, '0')}`;
}

function freshTally(): Tally {
  return { count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
}

function noteTally(tally: Tally, value: number, offset?: number): void {
  if (tally.count === 0) tally.offset = offset;
  tally.count += 1;
  if (value < tally.min) tally.min = value;
  if (value > tally.max) tally.max = value;
}

function emptyModel(): ModModel {
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

function asBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError('parseMod input must be an ArrayBuffer or Uint8Array');
}
