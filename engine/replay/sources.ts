import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { SourceFile } from '../core/version.ts';

const SIM_ROOTS = ['engine/core', 'engine/sim'];

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
}

/** Repo-relative POSIX paths of sim-package sources. Tests are not included. */
export function listSimSourcePaths(root: string): string[] {
  const paths: string[] = [];
  for (const folder of SIM_ROOTS) {
    const files: string[] = [];
    walk(join(root, folder), files);
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      paths.push(relative(root, file).split(sep).join('/'));
    }
  }
  paths.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return paths;
}

export function readSourceFiles(root: string, paths: readonly string[]): SourceFile[] {
  const out: SourceFile[] = [];
  const seen: string[] = [];
  for (const path of paths) {
    for (const previous of seen) {
      if (previous === path) throw new Error(`duplicate source ${path}`);
    }
    seen.push(path);
    if (path.includes('\\') || path.startsWith('/') || path.includes('..')) {
      throw new Error(`source path ${path}`);
    }
    const bytes = readFileSync(join(root, path));
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    out.push({ path, bytes: copy });
  }
  return out;
}
