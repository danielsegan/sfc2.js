/**
 * Pair a base BMP with its self-illumination map.
 *
 * The CE 2.670 inventory counted glow maps whose stem matches
 * `_<token>i`, where the token starts with a digit (`_1i`, `_3i`,
 * and the wider `_512ai` form). The base file is the same name
 * without that final `i`, in the same directory.
 */

import { diagnostic, installRelativeFile, type Diagnostic } from './diagnostic.ts';

export const SELF_ILLUM_STEM = /^(?<base>.*)_(?<token>[0-9][0-9A-Za-z]*)i$/i;

export interface TexturePairRef {
  basePath: string;
  selfIllumPath?: string;
}

export interface SelfIllumIndex {
  pairs: TexturePairRef[];
  diagnostics: Diagnostic[];
}

export function pairSelfIllumination(paths: readonly string[]): SelfIllumIndex {
  const diagnostics: Diagnostic[] = [];
  const bmpPaths: string[] = [];
  const byLower = new Map<string, string>();

  for (const path of paths) {
    if (!path.toLowerCase().endsWith('.bmp')) continue;
    if (installRelativeFile(path) === undefined) continue;
    const key = path.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, path);
    bmpPaths.push(path);
  }

  const illumByBase = new Map<string, string>();
  const illumPaths = new Set<string>();

  for (const path of bmpPaths) {
    const parsed = splitBmp(path);
    if (parsed === null) continue;
    const match = SELF_ILLUM_STEM.exec(parsed.stem);
    const base = match?.groups?.base;
    const token = match?.groups?.token;
    if (match === null || base === undefined || token === undefined) continue;

    illumPaths.add(path.toLowerCase());
    const baseName = `${base}_${token}${parsed.ext}`;
    const basePath = parsed.dir.length > 0 ? `${parsed.dir}/${baseName}` : baseName;
    const found = byLower.get(basePath.toLowerCase());
    if (found === undefined) {
      diagnostics.push(
        diagnostic('orphanSelfIllum', 'bmp', 'warning', {
          details: { illumPath: path },
          location: { file: path },
        }),
      );
      continue;
    }
    illumByBase.set(found.toLowerCase(), path);
  }

  const pairs: TexturePairRef[] = [];
  const seenBase = new Set<string>();
  for (const path of bmpPaths) {
    const key = path.toLowerCase();
    if (illumPaths.has(key) || seenBase.has(key)) continue;
    seenBase.add(key);
    const illum = illumByBase.get(key);
    if (illum !== undefined) pairs.push({ basePath: path, selfIllumPath: illum });
    else pairs.push({ basePath: path });
  }

  pairs.sort((a, b) => (a.basePath < b.basePath ? -1 : a.basePath > b.basePath ? 1 : 0));
  diagnostics.sort((a, b) => {
    const left = a.location?.file ?? '';
    const right = b.location?.file ?? '';
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return { pairs, diagnostics };
}

function splitBmp(path: string): { dir: string; stem: string; ext: string } | null {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash) : '';
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  return { dir, stem: file.slice(0, dot), ext: file.slice(dot) };
}
