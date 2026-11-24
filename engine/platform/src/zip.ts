/**
 * Minimal ZIP reader for an archive the player already has.
 * Store and raw deflate only. Bytes stay in memory; nothing is uploaded.
 */

import { diagnostic, type Diagnostic } from '@sfc2js/formats';
import type { PickedFile } from './picker.ts';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

export interface ZipRead {
  files: PickedFile[];
  diagnostics: Diagnostic[];
}

export async function readZip(bytes: Uint8Array): Promise<ZipRead> {
  const diagnostics: Diagnostic[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  if (eocd === null) {
    diagnostics.push(archiveDiagnostic('not-zip'));
    return { files: [], diagnostics };
  }

  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || centralOffset === 0xffffffff) {
    diagnostics.push(archiveDiagnostic('zip64'));
    return { files: [], diagnostics };
  }
  if (centralOffset + centralSize > bytes.length) {
    diagnostics.push(archiveDiagnostic('corrupt'));
    return { files: [], diagnostics };
  }

  const files: PickedFile[] = [];
  let cursor = centralOffset;
  let total = 0;
  const end = centralOffset + centralSize;

  for (let n = 0; n < entryCount; n++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== CENTRAL) {
      diagnostics.push(archiveDiagnostic('corrupt'));
      break;
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/') || name.endsWith('\\')) continue;
    if ((flags & 0x1) !== 0) {
      diagnostics.push(archiveDiagnostic('encrypted'));
      continue;
    }
    if (method !== 0 && method !== 8) {
      diagnostics.push(archiveDiagnostic('compression', { method }));
      continue;
    }
    if (
      uncompressedSize > MAX_ENTRY_BYTES ||
      compressedSize > MAX_ENTRY_BYTES ||
      total + uncompressedSize > MAX_TOTAL_BYTES
    ) {
      diagnostics.push(archiveDiagnostic('too-large'));
      continue;
    }
    const payload = localPayload(bytes, view, localOffset, compressedSize);
    if (payload === null) {
      diagnostics.push(archiveDiagnostic('corrupt'));
      continue;
    }
    total += uncompressedSize;
    const storedName = name;
    const storedSize = uncompressedSize;
    files.push({
      path: storedName,
      size: storedSize,
      read: async () => {
        if (method === 0) return payload.slice();
        return inflateRaw(payload);
      },
    });
  }

  return { files, diagnostics };
}

function findEocd(view: DataView): number | null {
  const min = Math.max(0, view.byteLength - 22 - 65535);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD) return i;
  }
  return null;
}

function localPayload(
  bytes: Uint8Array,
  view: DataView,
  localOffset: number,
  compressedSize: number,
): Uint8Array | null {
  if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== LOCAL) return null;
  const nameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const start = localOffset + 30 + nameLength + extraLength;
  const end = start + compressedSize;
  if (end > bytes.length) return null;
  return bytes.subarray(start, end);
}

async function inflateRaw(payload: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('deflate zip entries need DecompressionStream');
  }
  const copy = payload.slice();
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function archiveDiagnostic(reason: string, details?: Record<string, unknown>): Diagnostic {
  return diagnostic('archiveUnsupported', 'importer', 'error', {
    details: { reason, ...details },
  });
}
