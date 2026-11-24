import { deflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { encodeBmp, machinePathLeak } from '@sfc2js/formats';
import {
  directoryPickerKind,
  fileSystemAccessPicker,
  filesFromDirectoryInput,
  importInstall,
  importZipArchive,
  inputDirectoryPicker,
  memoryDirectoryPicker,
  pickAndImport,
  preferredDirectoryPicker,
  type DirectoryInputFile,
  type PickedFile,
  type ReadableDirectoryHandle,
  type ReadableFileHandle,
} from './index.ts';

describe('importInstall', () => {
  it('indexes a picked install and does not upload or read the executable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const exeReads = { n: 0 };
    const shiplist = new TextEncoder().encode('Race\tClass\nFed\tTEST-CA-01\n');
    const picker = memoryDirectoryPicker([
      tracked('Starfleet2CE.exe', Uint8Array.of(0x4d, 0x5a), exeReads),
      file('Assets/Specs/shiplist.txt', shiplist),
      file('MetaAssets/shiplist.txt', shiplist),
      file('Assets/Models/test/Hull_1.mod', Uint8Array.of(1, 2, 3)),
      file('Assets/Models/test/Hull_1.bmp', tinyBmp([9, 9, 9])),
      file('Assets/Models/test/Hull_1i.bmp', tinyBmp([1, 2, 3])),
      file('Assets/Models/test/Hull_9i.bmp', tinyBmp([4, 4, 4])),
    ]);

    const picked = await picker.pick();
    expect(picked.status).toBe('picked');
    if (picked.status !== 'picked') return;
    const result = await importInstall(picked.files);

    expect(result.ok).toBe(true);
    expect(result.build.exe).toBe('Starfleet2CE.exe');
    expect(result.shiplist.assets).toBe('Assets/Specs/shiplist.txt');
    expect(result.shiplist.metaassets).toBe('MetaAssets/shiplist.txt');
    expect(result.modelPaths).toEqual(['Assets/Models/test/Hull_1.mod']);
    expect(result.texturePairs).toEqual([
      {
        basePath: 'Assets/Models/test/Hull_1.bmp',
        selfIllumPath: 'Assets/Models/test/Hull_1i.bmp',
      },
    ]);
    expect(result.diagnostics.map((item) => item.code)).toEqual(['orphanSelfIllum']);
    expect(result.vfs?.resolve('assets/specs/shiplist.txt')).toBe('Assets/Specs/shiplist.txt');
    expect(exeReads.n).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(machinePathLeak(result)).toBeNull();
    fetchSpy.mockRestore();
  });

  it('rebases a parent folder onto the install root', async () => {
    const shiplist = new TextEncoder().encode('same');
    const result = await importInstall([
      file('Game/Starfleet2.exe', Uint8Array.of(1)),
      file('Game/Assets/Specs/shiplist.txt', shiplist),
      file('Game/MetaAssets/shiplist.txt', shiplist),
      file('Game/Assets/Models/test/Hull_1.bmp', tinyBmp([1, 1, 1])),
    ]);
    expect(result.ok).toBe(true);
    expect(result.build.exe).toBe('Starfleet2.exe');
    expect(result.shiplist.assets).toBe('Assets/Specs/shiplist.txt');
    expect(result.vfs?.list().map((entry) => entry.path)).toEqual([
      'Assets/Models/test/Hull_1.bmp',
      'Assets/Specs/shiplist.txt',
      'MetaAssets/shiplist.txt',
      'Starfleet2.exe',
    ]);
    expect(machinePathLeak(result)).toBeNull();
  });

  it('accepts an Assets folder whose shiplist path is Specs/shiplist.txt', async () => {
    const result = await importInstall([
      file('Specs/shiplist.txt', new TextEncoder().encode('specs')),
      file('Models/test/Hull_1.bmp', tinyBmp([2, 2, 2])),
    ]);
    expect(result.ok).toBe(true);
    expect(result.build.exe).toBe('unknown');
    expect(result.diagnostics.map((item) => item.code)).toContain('buildUnknown');
    expect(result.shiplist.assets).toBe('Specs/shiplist.txt');
    expect(result.diagnostics.find((item) => item.code === 'missingShiplist')).toBeUndefined();
  });

  it('reports a missing or incomplete install without throwing', async () => {
    const empty = await importInstall([file('readme.txt', new TextEncoder().encode('hello'))]);
    expect(empty.ok).toBe(false);
    expect(empty.vfs).toBeNull();
    expect(empty.diagnostics.map((item) => item.code)).toContain('installNotRecognized');

    const exeOnly = await importInstall([file('Starfleet2CE.exe', Uint8Array.of(1))]);
    expect(exeOnly.ok).toBe(false);
    expect(exeOnly.vfs).not.toBeNull();
    expect(exeOnly.build.exe).toBe('Starfleet2CE.exe');
    expect(exeOnly.diagnostics.map((item) => item.code)).toContain('missingShiplist');
    expect(exeOnly.diagnostics.find((item) => item.code === 'missingShiplist')?.location?.file).toBe(
      'Assets/Specs/shiplist.txt',
    );
    expect(machinePathLeak(empty)).toBeNull();
    expect(machinePathLeak(exeOnly)).toBeNull();
  });

  it('warns when the two shiplist copies differ', async () => {
    const result = await importInstall([
      file('Starfleet2CE.exe', Uint8Array.of(1)),
      file('Assets/Specs/shiplist.txt', new TextEncoder().encode('alpha')),
      file('MetaAssets/shiplist.txt', new TextEncoder().encode('beta')),
      file('Assets/Models/test/Hull_1.bmp', tinyBmp([1, 0, 0])),
    ]);
    const differ = result.diagnostics.find((item) => item.code === 'specsMetaassetsDiffer');
    expect(differ?.source).toBe('shiplist');
    expect(differ?.severity).toBe('warning');
    expect(differ?.location?.file).toBe('Assets/Specs/shiplist.txt');
    expect(result.ok).toBe(true);
  });

  it('refuses absolute paths and parent segments without echoing them', async () => {
    const result = await importInstall([
      file('C:/Users/me/Games/SFC2/Starfleet2CE.exe', Uint8Array.of(1)),
      file('\\\\server\\share\\shiplist.txt', new TextEncoder().encode('x')),
      file('../secret/shiplist.txt', new TextEncoder().encode('x')),
      file('Assets/Specs/shiplist.txt', new TextEncoder().encode('ok')),
      file('Starfleet2CE.exe', Uint8Array.of(1)),
    ]);
    expect(result.ok).toBe(false);
    const reasons = result.diagnostics
      .filter((item) => item.code === 'pathRejected')
      .map((item) => item.details?.reason);
    expect(reasons).toEqual(expect.arrayContaining(['absolute', 'parent-segment']));
    expect(result.vfs?.list().some((entry) => entry.path.includes('secret'))).toBe(false);
    expect(result.vfs?.resolve('Assets/Specs/shiplist.txt')).toBe('Assets/Specs/shiplist.txt');
    expect(machinePathLeak(result)).toBeNull();
  });

  it('keeps the first spelling when two paths differ only by case', async () => {
    const result = await importInstall([
      file('Assets/Specs/shiplist.txt', new TextEncoder().encode('first')),
      file('assets/specs/shiplist.txt', new TextEncoder().encode('second')),
    ]);
    expect(result.diagnostics.map((item) => item.code)).toContain('caseConflict');
    const bytes = await result.vfs?.read('ASSETS/SPECS/SHIPlist.txt');
    expect(decode(bytes)).toBe('first');
  });

  it('turns a read failure into permissionDenied and does not copy the error text', async () => {
    const result = await importInstall([
      file('Starfleet2CE.exe', Uint8Array.of(1)),
      {
        path: 'Assets/Specs/shiplist.txt',
        size: 4,
        read: () => Promise.reject(new Error('EACCES /home/player/secret/shiplist.txt')),
      },
      {
        path: 'MetaAssets/shiplist.txt',
        size: 4,
        read: () => Promise.reject(new Error('EACCES /home/player/secret/meta.txt')),
      },
    ]);
    expect(result.diagnostics.map((item) => item.code)).toContain('permissionDenied');
    expect(machinePathLeak(result)).toBeNull();
  });

  it('reports two installs instead of guessing', async () => {
    const result = await importInstall([
      file('A/Starfleet2CE.exe', Uint8Array.of(1)),
      file('A/Assets/Specs/shiplist.txt', new TextEncoder().encode('a')),
      file('B/Starfleet2CE.exe', Uint8Array.of(1)),
      file('B/Assets/Specs/shiplist.txt', new TextEncoder().encode('b')),
    ]);
    expect(result.ok).toBe(false);
    expect(result.vfs).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain('multipleInstalls');
    expect(machinePathLeak(result)).toBeNull();
  });
});

describe('directory pickers', () => {
  it('uses an in-memory picker and the directory-input fallback', async () => {
    const imported = await pickAndImport(
      memoryDirectoryPicker([
        file('Specs/shiplist.txt', new TextEncoder().encode('specs')),
        file('Models/Hull_1.bmp', tinyBmp([3, 3, 3])),
      ]),
    );
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;
    expect(imported.result.shiplist.assets).toBe('Specs/shiplist.txt');

    const stripped = filesFromDirectoryInput([
      inputFile('MyInstall/Assets/Specs/shiplist.txt', new TextEncoder().encode('from-input')),
      inputFile('MyInstall/Starfleet2CE.exe', Uint8Array.of(0x4d, 0x5a)),
    ]);
    expect(stripped.map((item) => item.path)).toEqual([
      'Assets/Specs/shiplist.txt',
      'Starfleet2CE.exe',
    ]);
    const fromInput = await importInstall(stripped);
    expect(fromInput.build.exe).toBe('Starfleet2CE.exe');
    expect(decode(await fromInput.vfs?.read('Assets/Specs/shiplist.txt'))).toBe('from-input');

    const fallback = await inputDirectoryPicker(async () => [
      inputFile('Folder/Specs/shiplist.txt', new TextEncoder().encode('folder')),
    ]).pick();
    expect(fallback.status).toBe('picked');
    if (fallback.status === 'picked') {
      expect(fallback.files[0]?.path).toBe('Specs/shiplist.txt');
    }
    expect((await inputDirectoryPicker(async () => null).pick()).status).toBe('cancelled');
  });

  it('walks a File System Access handle and treats cancel as cancel', async () => {
    const shiplist = new TextEncoder().encode('walked');
    const handle = directory('root', [
      fileHandle('Starfleet2CE.exe', Uint8Array.of(0x4d, 0x5a)),
      directory('Assets', [
        directory('Specs', [fileHandle('shiplist.txt', shiplist)]),
        directory('Models', [fileHandle('Hull_1.bmp', tinyBmp([5, 5, 5]))]),
      ]),
    ]);
    const picked = await fileSystemAccessPicker(async () => handle).pick();
    expect(picked.status).toBe('picked');
    if (picked.status !== 'picked') return;
    const result = await importInstall(picked.files);
    expect(result.ok).toBe(true);
    expect(result.shiplist.assets).toBe('Assets/Specs/shiplist.txt');
    expect(decode(await result.vfs?.read('assets/specs/shiplist.txt'))).toBe('walked');

    const cancelled = await fileSystemAccessPicker(async () => {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }).pick();
    expect(cancelled.status).toBe('cancelled');

    expect(directoryPickerKind()).toBe('input-directory');
    expect((await preferredDirectoryPicker().pick()).status).toBe('unavailable');
    expect((await fileSystemAccessPicker().pick()).status).toBe('unavailable');
  });
});

describe('importZipArchive', () => {
  it('loads a stored archive and a deflated archive', async () => {
    const shiplist = new TextEncoder().encode('zipped');
    const stored = buildZip([
      entry('Starfleet2CE.exe', Uint8Array.of(0x4d, 0x5a)),
      entry('Assets/Specs/shiplist.txt', shiplist),
      entry('Assets/Models/test/Hull_1.bmp', tinyBmp([6, 6, 6])),
      entry('Assets/Models/test/Hull_1i.bmp', tinyBmp([7, 7, 7])),
    ]);
    const result = await importZipArchive(stored);
    expect(result.ok).toBe(true);
    expect(result.texturePairs).toEqual([
      {
        basePath: 'Assets/Models/test/Hull_1.bmp',
        selfIllumPath: 'Assets/Models/test/Hull_1i.bmp',
      },
    ]);
    expect(decode(await result.vfs?.read('Assets/Specs/shiplist.txt'))).toBe('zipped');

    const deflated = buildZip([
      entry('Specs/shiplist.txt', shiplist, 8),
      entry('Models/Hull_1.bmp', tinyBmp([1, 2, 3])),
    ]);
    const inflated = await importZipArchive(deflated);
    expect(inflated.ok).toBe(true);
    expect(decode(await inflated.vfs?.read('Specs/shiplist.txt'))).toBe('zipped');
  });

  it('rejects zip-slip and non-zip bytes without leaking paths', async () => {
    const slipped = buildZip([
      entry('../secret.txt', new TextEncoder().encode('nope')),
      entry('C:/Windows/note.txt', new TextEncoder().encode('nope')),
      entry('Assets/Specs/shiplist.txt', new TextEncoder().encode('kept')),
    ]);
    const result = await importZipArchive(slipped);
    expect(result.ok).toBe(false);
    expect(result.vfs?.resolve('Assets/Specs/shiplist.txt')).toBe('Assets/Specs/shiplist.txt');
    expect(result.vfs?.list().some((item) => item.path.includes('secret'))).toBe(false);
    expect(machinePathLeak(result)).toBeNull();

    const garbage = await importZipArchive(new TextEncoder().encode('not a zip'));
    expect(garbage.ok).toBe(false);
    expect(garbage.vfs).toBeNull();
    expect(garbage.diagnostics[0]?.code).toBe('archiveUnsupported');
    expect(garbage.diagnostics[0]?.details).toEqual({ reason: 'not-zip' });
  });
});

function decode(bytes: Uint8Array | null | undefined): string {
  if (bytes == null) throw new Error('expected file bytes');
  return new TextDecoder().decode(bytes);
}

function file(path: string, bytes: Uint8Array): PickedFile {
  return {
    path,
    size: bytes.length,
    read: async () => bytes,
  };
}

function tracked(path: string, bytes: Uint8Array, reads: { n: number }): PickedFile {
  return {
    path,
    size: bytes.length,
    read: async () => {
      reads.n += 1;
      return bytes;
    },
  };
}

function tinyBmp(rgb: [number, number, number]): Uint8Array {
  return encodeBmp({
    width: 1,
    height: 1,
    bitCount: 24,
    pixels: Uint8Array.from(rgb),
  });
}

function inputFile(relativePath: string, bytes: Uint8Array): DirectoryInputFile {
  return {
    name: relativePath.slice(relativePath.lastIndexOf('/') + 1),
    webkitRelativePath: relativePath,
    size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

function directory(name: string, entries: Array<ReadableFileHandle | ReadableDirectoryHandle>): ReadableDirectoryHandle {
  return {
    kind: 'directory',
    name,
    values: async function* () {
      for (const entry of entries) yield entry;
    },
  };
}

function fileHandle(name: string, bytes: Uint8Array): ReadableFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => ({
      size: bytes.length,
      arrayBuffer: async () => bytes.slice().buffer,
    }),
  };
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  method: number;
  compressed: Uint8Array;
  flags: number;
}

function entry(name: string, data: Uint8Array, method = 0): ZipEntry {
  const compressed = method === 8 ? deflateRawSync(data) : data;
  return { name, data, method, compressed, flags: 0 };
}

function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const item of entries) {
    const name = new TextEncoder().encode(item.name);
    const local = new Uint8Array(30 + name.length + item.compressed.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, item.flags, true);
    view.setUint16(8, item.method, true);
    view.setUint32(18, item.compressed.length, true);
    view.setUint32(22, item.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(item.compressed, 30 + name.length);
    parts.push(local);

    const record = new Uint8Array(46 + name.length);
    const centralView = new DataView(record.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, item.flags, true);
    centralView.setUint16(10, item.method, true);
    centralView.setUint32(20, item.compressed.length, true);
    centralView.setUint32(24, item.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);
    offset += local.length;
  }
  const centralBytes = concat(central);
  const eocd = new Uint8Array(22);
  const end = new DataView(eocd.buffer);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralBytes.length, true);
  end.setUint32(16, offset, true);
  return concat([...parts, centralBytes, eocd]);
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}
