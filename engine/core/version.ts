import { ByteBuf } from './bytes.ts';
import { xxhash32 } from './xxhash32.ts';

/**
 * Replay envelope version. Bump when the file layout in docs/engine/replay.md changes.
 * A change to canonical state bytes is caught by simSourceHash, so it does not need a bump.
 */
export const REPLAY_FORMAT = 2;
/** Previous envelope. Still decoded and played. New files are written as format 2. */
export const LEGACY_REPLAY_FORMAT = 1;

export interface SourceFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function u32le(value: number): Uint8Array {
  const buf = new ByteBuf();
  buf.u32(value);
  return buf.toUint8();
}

/**
 * xxHash32 of sim sources in sorted path order.
 * Each file is utf8(path) ‖ 0x00 ‖ fileBytes. Docs are omitted by the caller.
 */
export function simSourceHash(files: readonly SourceFile[]): number {
  const sorted = files.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();
  for (const file of sorted) {
    const pathBytes = encoder.encode(file.path);
    const chunk = new Uint8Array(pathBytes.length + 1 + file.bytes.length);
    chunk.set(pathBytes, 0);
    chunk[pathBytes.length] = 0;
    chunk.set(file.bytes, pathBytes.length + 1);
    parts.push(chunk);
  }
  return xxhash32(concat(parts), 0);
}

/** versionHash = xxHash32("sfc2-ver\\0" ‖ u32le(replayFormat) ‖ u32le(simSourceHash) ‖ u32le(dataHash)). */
export function versionHash(replayFormat: number, sourceHash: number, dataHash: number): number {
  const prefix = new TextEncoder().encode('sfc2-ver');
  const body = concat([prefix, new Uint8Array([0]), u32le(replayFormat), u32le(sourceHash), u32le(dataHash)]);
  return xxhash32(body, 0);
}
