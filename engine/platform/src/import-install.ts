/**
 * Index a player-supplied SFC2 install into a virtual file system.
 * The original files stay on the machine. Diagnostics never carry an
 * absolute or machine-local path.
 */

import {
  diagnostic,
  pairSelfIllumination,
  type Diagnostic,
  type TexturePairRef,
} from '@sfc2js/formats';
import { comparePath, normalizeInstallPath, type PathRejectReason } from './paths.ts';
import type { DirectoryPicker, PickedFile } from './picker.ts';
import { createVfs, type Vfs } from './vfs.ts';
import { readZip } from './zip.ts';

export interface BuildInfo {
  readonly exe: 'Starfleet2CE.exe' | 'Starfleet2.exe' | 'unknown';
}

export interface ImportResult {
  readonly ok: boolean;
  readonly vfs: Vfs | null;
  readonly build: BuildInfo;
  readonly diagnostics: readonly Diagnostic[];
  readonly shiplist: {
    readonly assets: string | null;
    readonly metaassets: string | null;
  };
  readonly modelPaths: readonly string[];
  readonly texturePairs: readonly TexturePairRef[];
}

export async function pickAndImport(
  picker: DirectoryPicker,
): Promise<
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'imported'; readonly result: ImportResult }
> {
  const picked = await picker.pick();
  if (picked.status === 'cancelled') return { status: 'cancelled' };
  if (picked.status === 'unavailable') return { status: 'unavailable' };
  return { status: 'imported', result: await importInstall(picked.files) };
}

export async function importZipArchive(bytes: Uint8Array): Promise<ImportResult> {
  const zip = await readZip(bytes);
  if (zip.files.length === 0 && zip.diagnostics.length > 0) {
    return emptyResult(zip.diagnostics);
  }
  const imported = await importInstall(zip.files);
  return {
    ...imported,
    diagnostics: [...zip.diagnostics, ...imported.diagnostics],
    ok: ![...zip.diagnostics, ...imported.diagnostics].some((item) => item.severity === 'error'),
  };
}

export async function importInstall(files: readonly PickedFile[]): Promise<ImportResult> {
  const diagnostics: Diagnostic[] = [];
  const accepted: { path: string; size: number; read: () => Promise<Uint8Array> }[] = [];
  const rejected = new Map<PathRejectReason, number>();

  for (const file of files) {
    const normalized = normalizeInstallPath(file.path);
    if (!normalized.ok) {
      rejected.set(normalized.reason, (rejected.get(normalized.reason) ?? 0) + 1);
      continue;
    }
    accepted.push({ path: normalized.path, size: file.size, read: () => file.read() });
  }

  for (const [reason, count] of rejected) {
    diagnostics.push(
      diagnostic('pathRejected', 'importer', 'error', { details: { reason, count } }),
    );
  }

  const rooted = chooseRoot(accepted.map((file) => file.path));
  if (rooted.status === 'none') {
    diagnostics.push(
      diagnostic('installNotRecognized', 'importer', 'error', {
        details: { fileCount: accepted.length },
      }),
    );
    return emptyResult(diagnostics);
  }
  if (rooted.status === 'multiple') {
    diagnostics.push(
      diagnostic('multipleInstalls', 'importer', 'error', {
        details: { count: rooted.roots.length, roots: rooted.roots },
      }),
    );
    return emptyResult(diagnostics);
  }

  const rebased: { path: string; size: number; read: () => Promise<Uint8Array> }[] = [];
  for (const file of accepted) {
    const path = stripPrefix(file.path, rooted.prefix);
    if (path === null) continue;
    rebased.push({ path, size: file.size, read: file.read });
  }

  const collisions = new Map<string, string>();
  const unique: typeof rebased = [];
  for (const file of rebased) {
    const key = file.path.toLowerCase();
    const previous = collisions.get(key);
    if (previous === undefined) {
      collisions.set(key, file.path);
      unique.push(file);
    } else if (previous !== file.path) {
      diagnostics.push(
        diagnostic('caseConflict', 'importer', 'warning', {
          details: { path: previous, other: file.path },
          location: { file: previous },
        }),
      );
    }
  }

  const vfs = createVfs(unique);
  const paths = unique.map((file) => file.path);
  const build = detectBuild(paths);
  if (build.exe === 'unknown') {
    diagnostics.push(diagnostic('buildUnknown', 'importer', 'warning'));
  }

  const assets =
    findByMarker(paths, 'assets/specs/shiplist.txt') ?? findByMarker(paths, 'specs/shiplist.txt');
  const metaassets = findByMarker(paths, 'metaassets/shiplist.txt');
  if (assets === null && metaassets === null) {
    diagnostics.push(
      diagnostic('missingShiplist', 'importer', 'error', {
        details: { expected: 'Assets/Specs/shiplist.txt' },
        location: { file: 'Assets/Specs/shiplist.txt' },
      }),
    );
  } else if (assets !== null && metaassets !== null) {
    const differ = await bytesDiffer(vfs, assets, metaassets, diagnostics);
    if (differ) {
      diagnostics.push(
        diagnostic('specsMetaassetsDiffer', 'shiplist', 'warning', {
          details: { assets, metaassets },
          location: { file: assets },
        }),
      );
    }
  }

  const modelPaths = paths.filter((path) => path.toLowerCase().endsWith('.mod')).sort(comparePath);
  if (modelPaths.length === 0) {
    diagnostics.push(diagnostic('missingModels', 'importer', 'warning'));
  }

  const pairing = pairSelfIllumination(paths);
  diagnostics.push(...pairing.diagnostics);
  if (!paths.some((path) => path.toLowerCase().endsWith('.bmp'))) {
    diagnostics.push(diagnostic('noTextures', 'importer', 'warning'));
  }

  const ok = !diagnostics.some((item) => item.severity === 'error');
  return {
    ok,
    vfs,
    build,
    diagnostics,
    shiplist: { assets, metaassets },
    modelPaths,
    texturePairs: pairing.pairs,
  };
}

async function bytesDiffer(
  vfs: Vfs,
  left: string,
  right: string,
  diagnostics: Diagnostic[],
): Promise<boolean> {
  const a = await readSafe(vfs, left, diagnostics);
  const b = await readSafe(vfs, right, diagnostics);
  if (a === null || b === null) return false;
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

async function readSafe(vfs: Vfs, path: string, diagnostics: Diagnostic[]): Promise<Uint8Array | null> {
  try {
    const bytes = await vfs.read(path);
    if (bytes === null) {
      diagnostics.push(
        diagnostic('permissionDenied', 'importer', 'error', { location: { file: path } }),
      );
    }
    return bytes;
  } catch {
    diagnostics.push(
      diagnostic('permissionDenied', 'importer', 'error', { location: { file: path } }),
    );
    return null;
  }
}

function detectBuild(paths: readonly string[]): BuildInfo {
  const roots = new Set(
    paths.filter((path) => !path.includes('/')).map((path) => path.toLowerCase()),
  );
  if (roots.has('starfleet2ce.exe')) return { exe: 'Starfleet2CE.exe' };
  if (roots.has('starfleet2.exe')) return { exe: 'Starfleet2.exe' };
  return { exe: 'unknown' };
}

function findByMarker(paths: readonly string[], marker: string): string | null {
  for (const path of paths) {
    const lower = path.toLowerCase();
    if (lower === marker || lower.endsWith(`/${marker}`)) return path;
  }
  return null;
}

function chooseRoot(
  paths: readonly string[],
): { status: 'none' } | { status: 'one'; prefix: string } | { status: 'multiple'; roots: string[] } {
  const candidates = new Map<string, string>();
  const add = (prefix: string) => {
    const key = prefix.toLowerCase();
    if (!candidates.has(key)) candidates.set(key, prefix);
  };

  for (const path of paths) {
    const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
    if (base === 'starfleet2ce.exe' || base === 'starfleet2.exe') {
      add(directoryName(path));
    }
    const shiplist = shiplistPrefix(path);
    if (shiplist !== null) add(shiplist);
  }

  if (candidates.size === 0) return { status: 'none' };

  const scored = [...candidates.values()].map((prefix) => ({
    prefix,
    score: scorePrefix(prefix, paths),
  }));
  const best = Math.max(...scored.map((item) => item.score));
  const top = scored.filter((item) => item.score === best);
  top.sort((a, b) => a.prefix.length - b.prefix.length || comparePath(a.prefix, b.prefix));
  const winner = top[0];
  if (winner === undefined) return { status: 'none' };
  const tied = top.filter((item) => item.prefix.length === winner.prefix.length);
  if (tied.length > 1) {
    return { status: 'multiple', roots: tied.map((item) => item.prefix) };
  }
  return { status: 'one', prefix: winner.prefix };
}

function scorePrefix(prefix: string, paths: readonly string[]): number {
  let score = 0;
  for (const path of paths) {
    if (!contains(prefix, path)) continue;
    const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
    if (base === 'starfleet2ce.exe' || base === 'starfleet2.exe') score += 2;
    if (shiplistPrefix(path) !== null) score += 1;
  }
  return score;
}

function contains(prefix: string, path: string): boolean {
  if (prefix.length === 0) return true;
  const lowerPrefix = prefix.toLowerCase();
  const lowerPath = path.toLowerCase();
  return lowerPath === lowerPrefix || lowerPath.startsWith(`${lowerPrefix}/`);
}

function stripPrefix(path: string, prefix: string): string | null {
  if (prefix.length === 0) return path;
  const lowerPrefix = prefix.toLowerCase();
  const lowerPath = path.toLowerCase();
  if (lowerPath === lowerPrefix) return null;
  if (!lowerPath.startsWith(`${lowerPrefix}/`)) return null;
  return path.slice(prefix.length + 1);
}

function directoryName(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}

function shiplistPrefix(path: string): string | null {
  const lower = path.toLowerCase();
  const markers = ['assets/specs/shiplist.txt', 'metaassets/shiplist.txt', 'specs/shiplist.txt'];
  for (const marker of markers) {
    if (marker === 'specs/shiplist.txt' && lower.endsWith('assets/specs/shiplist.txt')) continue;
    if (lower === marker) return '';
    const suffix = `/${marker}`;
    if (lower.endsWith(suffix)) return path.slice(0, path.length - suffix.length);
  }
  return null;
}

function emptyResult(diagnostics: readonly Diagnostic[]): ImportResult {
  return {
    ok: !diagnostics.some((item) => item.severity === 'error'),
    vfs: null,
    build: { exe: 'unknown' },
    diagnostics,
    shiplist: { assets: null, metaassets: null },
    modelPaths: [],
    texturePairs: [],
  };
}
