/**
 * Find a ship texture in the install index.
 *
 * Names in a `.mod` are often a basename, sometimes a relative path, and
 * the spelling of the extension and the separators is not stable. The
 * search stays inside the install: a drive letter, a leading slash, or a
 * `..` that would leave the root is rejected and the text is not kept.
 */

import { installRelativeFile } from '@sfc2js/formats';
import type { Vfs } from '@sfc2js/platform';

const IMAGE_EXT = new Set(['.bmp', '.dib', '.tga', '.png', '.jpg', '.jpeg']);
const SHARED_DIRS = ['common', 'shared', 'textures'] as const;

export type TextureResolution =
  | { path: string }
  | { reason: 'empty-name' | 'texture-name' | 'absent' };

/**
 * Why a texture name became a placeholder. Counts of these classes are
 * safe to log. The name and the path are not.
 */
export const TEXTURE_MISS_CLASSES = [
  'missingFile',
  'unsupportedExtension',
  'differentEmpire',
  'unusualName',
  'decodeFailed',
] as const;
export type TextureMissClass = (typeof TEXTURE_MISS_CLASSES)[number];

const USUAL_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Classify a name the search already missed. A supported image with the
 * same stem outside the model search is `differentEmpire` (another empire
 * or model folder the lookup does not walk). A stem that exists only with
 * some other extension is `unsupportedExtension`. A name with characters
 * outside the usual token set is `unusualName`. Otherwise nothing in the
 * install uses that stem (`missingFile`). `decodeFailed` is assigned by
 * the mesh builder when a file was found and did not decode.
 */
export function classifyTextureMiss(vfs: Vfs, rawName: string): TextureMissClass {
  const parsed = parseTextureName(rawName);
  if (parsed.kind === 'empty') return 'missingFile';
  if (parsed.kind === 'rejected') return 'unusualName';
  const stem = stemOf(parsed.file);
  let supported = false;
  let unsupported = false;
  for (const entry of vfs.list()) {
    const slash = entry.path.lastIndexOf('/');
    const base = slash >= 0 ? entry.path.slice(slash + 1) : entry.path;
    const match = stemMatch(base, stem);
    if (match === 'supported') supported = true;
    else if (match === 'unsupported') unsupported = true;
  }
  if (supported) return 'differentEmpire';
  if (unsupported) return 'unsupportedExtension';
  if (unusualSegments(parsed.dirParts, parsed.file)) return 'unusualName';
  return 'missingFile';
}

export function resolveShipTexture(vfs: Vfs, modelPath: string, rawName: string): TextureResolution {
  const parsed = parseTextureName(rawName);
  if (parsed.kind !== 'ok') return { reason: parsed.kind === 'empty' ? 'empty-name' : 'texture-name' };

  const modelDir = directoryOf(modelPath);
  const variants = extensionVariants(parsed.file);
  if (parsed.dirParts.length > 0) {
    const relative = joinInside(modelDir, parsed.dirParts);
    if (relative === null) return { reason: 'texture-name' };
    const hit = firstExisting(vfs, relative, variants);
    if (hit !== null) return { path: hit };
    if (modelDir.length > 0) {
      const fromRoot = joinInside('', parsed.dirParts);
      if (fromRoot !== null && fromRoot !== relative) {
        const rooted = firstExisting(vfs, fromRoot, variants);
        if (rooted !== null) return { path: rooted };
      }
    }
  }

  for (const root of textureSearchRoots(modelDir)) {
    const hit = firstExisting(vfs, root, variants);
    if (hit !== null) return { path: hit };
  }
  return { reason: 'absent' };
}

/**
 * Ship folder, then `common` / `shared` / `textures` beside it, then the
 * same pair for each parent up to the install root.
 */
export function textureSearchRoots(modelDir: string): string[] {
  const roots: string[] = [];
  const add = (dir: string) => {
    if (!roots.includes(dir)) roots.push(dir);
  };
  let cursor = modelDir;
  for (;;) {
    add(cursor);
    for (const name of SHARED_DIRS) add(cursor.length > 0 ? `${cursor}/${name}` : name);
    if (cursor.length === 0) break;
    const slash = cursor.lastIndexOf('/');
    cursor = slash >= 0 ? cursor.slice(0, slash) : '';
  }
  return roots;
}

function parseTextureName(
  raw: string,
): { kind: 'empty' } | { kind: 'rejected' } | { kind: 'ok'; dirParts: string[]; file: string } {
  let name = raw.trim();
  if (
    name.length >= 2 &&
    ((name.startsWith('"') && name.endsWith('"')) || (name.startsWith("'") && name.endsWith("'")))
  ) {
    name = name.slice(1, -1).trim();
  }
  if (name.length === 0) return { kind: 'empty' };
  if (name.includes('\0')) return { kind: 'rejected' };
  name = name.replace(/[\\|/]+/g, '/').replace(/\/{2,}/g, '/');
  if (name.startsWith('/')) return { kind: 'rejected' };
  if (/^[a-zA-Z]:/.test(name)) return { kind: 'rejected' };
  const parts = name
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.');
  if (parts.length === 0) return { kind: 'empty' };
  if (parts.some((part) => part.includes(':') || part.includes('\0'))) return { kind: 'rejected' };
  const file = parts[parts.length - 1];
  if (file === undefined || file === '..') return { kind: 'rejected' };
  return { kind: 'ok', dirParts: parts.slice(0, -1), file };
}

function extensionVariants(fileName: string): string[] {
  const variants: string[] = [];
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (variants.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
    variants.push(trimmed);
  };
  add(fileName);
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase() : '';
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  if (ext === '.bmp') return variants;
  if (ext.length === 0 || IMAGE_EXT.has(ext)) add(`${stem}.bmp`);
  else {
    add(`${fileName}.bmp`);
    add(`${stem}.bmp`);
  }
  return variants;
}

function joinInside(baseDir: string, dirParts: readonly string[]): string | null {
  const stack = baseDir.length > 0 ? baseDir.split('/') : [];
  for (const part of dirParts) {
    if (part === '..') {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function firstExisting(vfs: Vfs, dir: string, variants: readonly string[]): string | null {
  for (const variant of variants) {
    const path = dir.length > 0 ? `${dir}/${variant}` : variant;
    if (installRelativeFile(path) === undefined) continue;
    const resolved = vfs.resolve(path);
    if (resolved !== null) return resolved;
  }
  return null;
}

function directoryOf(modelPath: string): string {
  const slash = modelPath.lastIndexOf('/');
  return slash >= 0 ? modelPath.slice(0, slash) : '';
}

function stemOf(file: string): string {
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(0, dot) : file;
}

function stemMatch(fileName: string, stem: string): 'supported' | 'unsupported' | 'no' {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase() : '';
  const fileStem = dot > 0 ? fileName.slice(0, dot) : fileName;
  if (fileStem.toLowerCase() !== stem.toLowerCase()) return 'no';
  if (ext.length > 0 && IMAGE_EXT.has(ext)) return 'supported';
  return 'unsupported';
}

function unusualSegments(dirParts: readonly string[], file: string): boolean {
  for (const segment of [...dirParts, file]) {
    if (!USUAL_SEGMENT.test(segment)) return true;
  }
  return false;
}
