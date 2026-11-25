import { describe, expect, it } from 'vitest';
import { encodeBmp, machinePathLeak } from '@sfc2js/formats';
import {
  directoryPickerKind,
  importInstall,
  isTauriRuntime,
  preferredDirectoryPicker,
  tauriDirectoryPicker,
  type InstallFolderBridge,
  type InstallFolderEntry,
} from './index.ts';

describe('tauri install adapter', () => {
  it('stays on the browser picker when Tauri is absent', async () => {
    expect(isTauriRuntime()).toBe(false);
    expect(directoryPickerKind()).toBe('input-directory');
    expect(preferredDirectoryPicker().kind).toBe('input-directory');
    expect((await tauriDirectoryPicker().pick()).status).toBe('unavailable');
    expect(
      directoryPickerKind({
        showDirectoryPicker: () => Promise.reject(new Error('not called')),
      }),
    ).toBe('file-system-access');
  });

  it('prefers the native picker when the Tauri runtime is present', () => {
    const scope = {
      __TAURI_INTERNALS__: {},
      showDirectoryPicker: () => Promise.reject(new Error('not called')),
    };
    expect(isTauriRuntime(scope)).toBe(true);
    expect(directoryPickerKind(scope)).toBe('tauri');
    expect(preferredDirectoryPicker(scope).kind).toBe('tauri');
  });

  it('lists a synthetic folder and reads bytes only when asked', async () => {
    const reads: string[] = [];
    const shiplist = new TextEncoder().encode('Race\tClass\nFed\tTEST-CA-01\n');
    const bridge = memoryBridge('/home/player/secret/SFC2', [
      entry('Starfleet2CE.exe', Uint8Array.of(0x4d, 0x5a)),
      entry('Assets/Specs/shiplist.txt', shiplist),
      entry('MetaAssets/shiplist.txt', shiplist),
      entry('Assets/Models/test/Hull_1.mod', Uint8Array.of(1, 2, 3)),
      entry('Assets/Models/test/Hull_1.bmp', tinyBmp([9, 9, 9])),
      entry('../secret/shiplist.txt', new TextEncoder().encode('nope')),
      entry('C:/Windows/note.txt', new TextEncoder().encode('nope')),
    ], reads);

    const picked = await tauriDirectoryPicker(bridge).pick();
    expect(picked.status).toBe('picked');
    if (picked.status !== 'picked') return;
    expect(reads).toEqual([]);
    expect(picked.files.map((file) => file.path)).toEqual([
      'Starfleet2CE.exe',
      'Assets/Specs/shiplist.txt',
      'MetaAssets/shiplist.txt',
      'Assets/Models/test/Hull_1.mod',
      'Assets/Models/test/Hull_1.bmp',
    ]);

    const result = await importInstall(picked.files);
    expect(result.ok).toBe(true);
    expect(result.build.exe).toBe('Starfleet2CE.exe');
    expect(result.shiplist.assets).toBe('Assets/Specs/shiplist.txt');
    expect(reads).toEqual(['Assets/Specs/shiplist.txt', 'MetaAssets/shiplist.txt']);
    expect(Array.from((await result.vfs?.read('assets/models/test/Hull_1.mod')) ?? [])).toEqual([
      1, 2, 3,
    ]);
    expect(reads).toEqual([
      'Assets/Specs/shiplist.txt',
      'MetaAssets/shiplist.txt',
      'Assets/Models/test/Hull_1.mod',
    ]);
    expect(machinePathLeak(result)).toBeNull();
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('treats dialog cancel as cancel and a failed listing as unavailable', async () => {
    const cancelled = await tauriDirectoryPicker({
      pickFolder: () => Promise.resolve(null),
      list: () => Promise.reject(new Error('/home/player/secret')),
      read: () => Promise.reject(new Error('/home/player/secret')),
    }).pick();
    expect(cancelled.status).toBe('cancelled');

    const failed = await tauriDirectoryPicker({
      pickFolder: () => Promise.resolve('/home/player/secret'),
      list: () => Promise.reject(new Error('EACCES /home/player/secret')),
      read: () => Promise.reject(new Error('EACCES /home/player/secret')),
    }).pick();
    expect(failed.status).toBe('unavailable');
  });

  it('keeps install spelling and binds each read to that pick token', async () => {
    const calls: string[] = [];
    let current = '';
    const bridge: InstallFolderBridge = {
      pickFolder: () => {
        current = current === 'alpha' ? 'beta' : 'alpha';
        return Promise.resolve(current);
      },
      list: (root) => {
        calls.push(`list ${root}`);
        if (root !== current) return Promise.reject(new Error('stale'));
        return Promise.resolve([{ path: 'Assets/Specs/ShipList.TXT', size: 3 }]);
      },
      read: (root, relativePath) => {
        calls.push(`read ${root} ${relativePath}`);
        if (root !== current) return Promise.reject(new Error('stale /home/player/secret'));
        return Promise.resolve(new TextEncoder().encode('abc'));
      },
    };
    const first = await tauriDirectoryPicker(bridge).pick();
    expect(first.status).toBe('picked');
    if (first.status !== 'picked') return;
    expect(first.files[0]?.path).toBe('Assets/Specs/ShipList.TXT');
    const second = await tauriDirectoryPicker(bridge).pick();
    expect(second.status).toBe('picked');
    if (second.status !== 'picked') return;
    await expect(first.files[0]?.read()).rejects.toThrow('unreadable');
    expect(Array.from((await second.files[0]?.read()) ?? [])).toEqual([97, 98, 99]);
    expect(calls).toEqual([
      'list alpha',
      'list beta',
      'read alpha Assets/Specs/ShipList.TXT',
      'read beta Assets/Specs/ShipList.TXT',
    ]);
    expect(calls.join('\n')).not.toContain('/home/player');
  });

  it('hides the bridge error text when a later read fails', async () => {
    const bridge: InstallFolderBridge = {
      pickFolder: () => Promise.resolve('token'),
      list: () =>
        Promise.resolve([
          { path: 'Assets/Specs/shiplist.txt', size: 4 },
          { path: 'MetaAssets/shiplist.txt', size: 4 },
          { path: 'Starfleet2CE.exe', size: 1 },
        ]),
      read: () => Promise.reject(new Error('EACCES /home/player/secret/shiplist.txt')),
    };
    const picked = await tauriDirectoryPicker(bridge).pick();
    expect(picked.status).toBe('picked');
    if (picked.status !== 'picked') return;
    await expect(picked.files[0]?.read()).rejects.toThrow('unreadable');
    const result = await importInstall(picked.files);
    expect(result.diagnostics.map((item) => item.code)).toContain('permissionDenied');
    expect(machinePathLeak(result)).toBeNull();
  });
});

function memoryBridge(token: string, files: readonly Entry[], reads: string[]): InstallFolderBridge {
  const bytes = new Map(files.map((file) => [file.path, file.bytes]));
  return {
    pickFolder: () => Promise.resolve(token),
    list: (root) => Promise.resolve(root === token ? files : []),
    read: (root, relativePath) => {
      if (root !== token) return Promise.reject(new Error('unreadable'));
      const file = bytes.get(relativePath);
      if (file === undefined) return Promise.reject(new Error('unreadable'));
      reads.push(relativePath);
      return Promise.resolve(file);
    },
  };
}

interface Entry extends InstallFolderEntry {
  bytes: Uint8Array;
}

function entry(path: string, bytes: Uint8Array): Entry {
  return { path, size: bytes.length, bytes };
}

function tinyBmp(rgb: [number, number, number]): Uint8Array {
  return encodeBmp({
    width: 1,
    height: 1,
    bitCount: 24,
    pixels: Uint8Array.from(rgb),
  });
}
