/**
 * In-browser virtual file system. Parsers read bytes from here.
 * Keys are install-relative. Reads return a copy and never touch the network.
 */

import { installRelativeFile } from '@sfc2js/formats';

export interface VfsEntry {
  readonly path: string;
  readonly size: number;
}

export interface Vfs {
  list(): readonly VfsEntry[];
  /** Case-insensitive. Returns the indexed spelling, or null. */
  resolve(path: string): string | null;
  exists(path: string): boolean;
  /** Case-insensitive. Null when the path is not indexed. */
  read(path: string): Promise<Uint8Array | null>;
}

export interface VfsSourceFile {
  path: string;
  size: number;
  read: () => Promise<Uint8Array>;
}

export function createVfs(files: readonly VfsSourceFile[]): Vfs {
  const byLower = new Map<string, VfsSourceFile>();
  for (const file of files) {
    if (installRelativeFile(file.path) === undefined) {
      throw new Error('Vfs path must be install-relative');
    }
    const key = file.path.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, file);
  }
  const entries: VfsEntry[] = [...byLower.values()]
    .map((file) => ({ path: file.path, size: file.size }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    list: () => entries,
    resolve: (path) => byLower.get(path.toLowerCase())?.path ?? null,
    exists: (path) => byLower.has(path.toLowerCase()),
    read: async (path) => {
      const file = byLower.get(path.toLowerCase());
      if (file === undefined) return null;
      const bytes = await file.read();
      return bytes.slice();
    },
  };
}
