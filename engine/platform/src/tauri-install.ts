/**
 * Native install folder adapter. The desktop shell opens a folder dialog
 * and reads files lazily. Browsers never take this path.
 * Tests pass a synthetic bridge. Absolute paths stay inside the shell.
 */

import { normalizeInstallPath } from './paths.ts';
import type { DirectoryPicker, PickedFile, PickResult } from './picker.ts';

export interface InstallFolderEntry {
  readonly path: string;
  readonly size: number;
}

/**
 * Opaque handle for one player-chosen folder.
 * `root` is a random token from `pickFolder`, not a filesystem path.
 * `list` and `read` must send that same token. A later pick replaces the
 * grant and the previous token is rejected.
 */
export interface InstallFolderBridge {
  /** Null when the player cancels the dialog. */
  pickFolder(): Promise<string | null>;
  /** Names and sizes only. Paths keep the install's spelling. */
  list(root: string): Promise<readonly InstallFolderEntry[]>;
  /** Whole file. Called only when something reads that path. */
  read(root: string, relativePath: string): Promise<Uint8Array>;
}

export function isTauriRuntime(scope: object = globalThis): boolean {
  const internals = (scope as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  return typeof internals === 'object' && internals !== null;
}

export function tauriDirectoryPicker(bridge?: InstallFolderBridge): DirectoryPicker {
  return {
    kind: 'tauri',
    pick: () => pickInstallFolder(bridge),
  };
}

async function pickInstallFolder(bridge: InstallFolderBridge | undefined): Promise<PickResult> {
  try {
    const resolved = bridge ?? (isTauriRuntime() ? await createTauriInstallBridge() : null);
    if (resolved === null) return { status: 'unavailable' };
    const root = await resolved.pickFolder();
    if (root === null) return { status: 'cancelled' };
    if (typeof root !== 'string' || root.length === 0) return { status: 'unavailable' };
    const entries = await resolved.list(root);
    const files: PickedFile[] = [];
    for (const entry of entries) {
      const accepted = acceptEntry(entry);
      if (accepted === null) continue;
      files.push({
        path: accepted.path,
        size: accepted.size,
        read: async () => {
          try {
            const bytes = await resolved.read(root, accepted.path);
            if (!(bytes instanceof Uint8Array)) throw new Error('unreadable');
            return bytes.slice();
          } catch (error) {
            if (error instanceof Error && error.message === 'unreadable') throw error;
            throw new Error('unreadable');
          }
        },
      });
    }
    return { status: 'picked', files };
  } catch {
    return { status: 'unavailable' };
  }
}

function acceptEntry(entry: InstallFolderEntry): { path: string; size: number } | null {
  if (typeof entry?.path !== 'string' || typeof entry.size !== 'number') return null;
  if (!Number.isSafeInteger(entry.size) || entry.size < 0) return null;
  const normalized = normalizeInstallPath(entry.path);
  if (!normalized.ok) return null;
  return { path: normalized.path, size: entry.size };
}

async function createTauriInstallBridge(): Promise<InstallFolderBridge> {
  const { invoke } = await import('@tauri-apps/api/core');
  return {
    async pickFolder() {
      const token = await invoke<string | null>('pick_install_directory');
      return typeof token === 'string' && token.length > 0 ? token : null;
    },
    list(root) {
      return invoke<InstallFolderEntry[]>('list_install_files', { token: root });
    },
    async read(root, relativePath) {
      const bytes = await invoke<ArrayBuffer | number[]>('read_install_file', {
        token: root,
        relativePath,
      });
      return bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : Uint8Array.from(bytes);
    },
  };
}
