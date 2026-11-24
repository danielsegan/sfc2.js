/**
 * Decode one interface BMP from the player's install.
 * The bytes stay in memory. This is not a 3D texture: HUD sprites do not
 * get mipmaps (docs/ui/asset-pipeline.md). The caller paints the pixels.
 */
import { diagnostic, parseBmp, type Diagnostic, type ParseResult } from '@sfc2js/formats';
import type { Vfs } from '@sfc2js/platform';

export interface InterfaceBitmap {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  /** Premultiplied RGBA, top-down, as parseBmp returns it. */
  readonly rgba: Uint8ClampedArray;
}

export async function loadInterfaceBitmap(
  vfs: Vfs,
  path: string,
): Promise<ParseResult<InterfaceBitmap | null>> {
  const diagnostics: Diagnostic[] = [];
  const resolved = vfs.resolve(path);
  if (resolved === null) {
    diagnostics.push(
      diagnostic('missingTexture', 'bmp', 'error', {
        details: { path },
        location: { file: path },
      }),
    );
    return { data: null, diagnostics };
  }
  let bytes: Uint8Array | null = null;
  try {
    bytes = await vfs.read(resolved);
  } catch {
    diagnostics.push(diagnostic('permissionDenied', 'importer', 'error', { location: { file: resolved } }));
    return { data: null, diagnostics };
  }
  if (bytes === null) {
    diagnostics.push(
      diagnostic('missingTexture', 'bmp', 'error', {
        details: { path: resolved },
        location: { file: resolved },
      }),
    );
    return { data: null, diagnostics };
  }
  const decoded = parseBmp(bytes, { file: resolved, colorKey: 'none' });
  diagnostics.push(...decoded.diagnostics);
  if (decoded.data.width < 1 || diagnostics.some((item) => item.severity === 'error')) {
    return { data: null, diagnostics };
  }
  return {
    data: {
      path: resolved,
      width: decoded.data.width,
      height: decoded.data.height,
      rgba: decoded.data.rgba,
    },
    diagnostics,
  };
}
