/**
 * Load a local install through the dev server. The page never writes those
 * files, and the server only reads them.
 */
import type { PickedFile } from '@sfc2js/platform';
import { devInstallUrl } from '../dev-install-shared.ts';

interface ManifestFile {
  readonly path: string;
  readonly size: number;
}

export async function filesFromDevInstall(root: string | null): Promise<readonly PickedFile[] | null> {
  let response: Response;
  try {
    response = await fetch(devInstallUrl('manifest', root));
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = (await response.json()) as { files?: ManifestFile[] };
  const files = body.files;
  if (!files || files.length === 0) return null;
  return files.map((file) => ({
    path: file.path,
    size: file.size,
    read: async () => {
      const got = await fetch(devInstallUrl('file', root, file.path));
      if (!got.ok) throw new Error('install file');
      return new Uint8Array(await got.arrayBuffer());
    },
  }));
}
