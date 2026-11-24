/**
 * Directory pickers. Chromium uses the File System Access API.
 * Other browsers get a directory file input (`webkitdirectory`).
 * Tests pass an in-memory picker and never touch a real disk.
 */

export interface PickedFile {
  /** Path relative to the picked directory, before install-root rebasing. */
  readonly path: string;
  readonly size: number;
  read(): Promise<Uint8Array>;
}

export type PickResult =
  | { readonly status: 'picked'; readonly files: readonly PickedFile[] }
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable' };

export interface DirectoryPicker {
  readonly kind: 'file-system-access' | 'input-directory' | 'memory';
  pick(): Promise<PickResult>;
}

export interface ReadableFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<{ size: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}

export interface ReadableDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  values(): AsyncIterable<ReadableFileHandle | ReadableDirectoryHandle>;
}

export type ShowDirectoryPicker = () => Promise<ReadableDirectoryHandle>;

export function memoryDirectoryPicker(files: readonly PickedFile[]): DirectoryPicker {
  return {
    kind: 'memory',
    pick: () => Promise.resolve({ status: 'picked', files }),
  };
}

export function directoryPickerKind(
  scope: { showDirectoryPicker?: unknown } = globalThis as { showDirectoryPicker?: unknown },
): 'file-system-access' | 'input-directory' {
  return typeof scope.showDirectoryPicker === 'function' ? 'file-system-access' : 'input-directory';
}

export function fileSystemAccessPicker(showDirectoryPicker?: ShowDirectoryPicker): DirectoryPicker {
  const show =
    showDirectoryPicker ??
    ((globalThis as { showDirectoryPicker?: ShowDirectoryPicker }).showDirectoryPicker);
  return {
    kind: 'file-system-access',
    pick: async () => {
      if (typeof show !== 'function') return { status: 'unavailable' };
      try {
        const root = await show();
        const files = await collectHandleFiles(root, '');
        return { status: 'picked', files };
      } catch (error) {
        if (isDomException(error, 'AbortError')) return { status: 'cancelled' };
        if (isDomException(error, 'NotAllowedError')) return { status: 'unavailable' };
        throw error;
      }
    },
  };
}

export interface DirectoryInputFile {
  readonly name: string;
  readonly webkitRelativePath?: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * `webkitdirectory` paths look like `FolderName/Assets/Specs/shiplist.txt`.
 * The first segment is the picked folder, so it is stripped when every
 * file shares it. What remains is relative to that folder.
 */
export function filesFromDirectoryInput(files: readonly DirectoryInputFile[]): PickedFile[] {
  const raw = files.map((file) => {
    const relative = file.webkitRelativePath && file.webkitRelativePath.length > 0
      ? file.webkitRelativePath
      : file.name;
    return { file, relative };
  });
  const stripped = stripSharedRoot(raw.map((item) => item.relative));
  return raw.map((item, index) => ({
    path: stripped[index] ?? item.file.name,
    size: item.file.size,
    read: async () => new Uint8Array(await item.file.arrayBuffer()),
  }));
}

export function inputDirectoryPicker(
  requestFiles?: () => Promise<readonly DirectoryInputFile[] | null>,
): DirectoryPicker {
  return {
    kind: 'input-directory',
    pick: async () => {
      const request = requestFiles ?? requestFilesFromDocument;
      if (request === requestFilesFromDocument && typeof document === 'undefined') {
        return { status: 'unavailable' };
      }
      const files = await request();
      if (files === null) return { status: 'cancelled' };
      return { status: 'picked', files: filesFromDirectoryInput(files) };
    },
  };
}

export function preferredDirectoryPicker(): DirectoryPicker {
  return directoryPickerKind() === 'file-system-access'
    ? fileSystemAccessPicker()
    : inputDirectoryPicker();
}

async function collectHandleFiles(
  directory: ReadableDirectoryHandle,
  prefix: string,
): Promise<PickedFile[]> {
  const files: PickedFile[] = [];
  for await (const entry of directory.values()) {
    const path = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      files.push(...(await collectHandleFiles(entry, path)));
      continue;
    }
    try {
      const meta = await entry.getFile();
      files.push({
        path,
        size: meta.size,
        read: async () => new Uint8Array(await (await entry.getFile()).arrayBuffer()),
      });
    } catch {
      files.push({
        path,
        size: 0,
        read: () => Promise.reject(new Error('unreadable')),
      });
    }
  }
  return files;
}

function stripSharedRoot(paths: readonly string[]): string[] {
  if (paths.length === 0) return [];
  const normalized = paths.map((path) => path.replaceAll('\\', '/'));
  const firstSegments = normalized.map((path) => path.split('/')[0] ?? '');
  const root = firstSegments[0] ?? '';
  const shared =
    root.length > 0 &&
    firstSegments.every((segment) => segment === root) &&
    normalized.every((path) => path.includes('/'));
  if (!shared) return normalized;
  return normalized.map((path) => path.slice(root.length + 1));
}

function requestFilesFromDocument(): Promise<readonly DirectoryInputFile[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.addEventListener('change', () => {
      const list = input.files;
      if (list === null || list.length === 0) {
        resolve(null);
        return;
      }
      resolve(Array.from(list));
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

function isDomException(error: unknown, name: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === name
  );
}
