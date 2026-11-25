import { describe, expect, it } from 'vitest';
import { createVfs, type VfsSourceFile } from '@sfc2js/platform';
import { classifyTextureMiss, resolveShipTexture, textureSearchRoots } from './texture-resolve.ts';

const MODEL = 'Assets/MODELS/fed/variant/Hull.mod';

describe('resolveShipTexture', () => {
  it('prefers the ship folder over a parent and a shared folder', () => {
    const vfs = files([
      'Assets/MODELS/fed/variant/Hull_1.bmp',
      'Assets/MODELS/fed/Hull_1.bmp',
      'Assets/textures/Hull_1.bmp',
    ]);
    expect(resolveShipTexture(vfs, MODEL, 'Hull_1')).toEqual({ path: 'Assets/MODELS/fed/variant/Hull_1.bmp' });
  });

  it('matches a parent file when only the case and the extension differ', () => {
    const vfs = files(['Assets/MODELS/fed/HULL_1.BMP']);
    expect(resolveShipTexture(vfs, MODEL, 'hull_1.tga')).toEqual({ path: 'Assets/MODELS/fed/HULL_1.BMP' });
    expect(resolveShipTexture(vfs, MODEL, 'hull_1')).toEqual({ path: 'Assets/MODELS/fed/HULL_1.BMP' });
  });

  it('walks ship folder, then its shared folders, then parents', () => {
    expect(textureSearchRoots('Assets/MODELS/fed/variant').slice(0, 8)).toEqual([
      'Assets/MODELS/fed/variant',
      'Assets/MODELS/fed/variant/common',
      'Assets/MODELS/fed/variant/shared',
      'Assets/MODELS/fed/variant/textures',
      'Assets/MODELS/fed',
      'Assets/MODELS/fed/common',
      'Assets/MODELS/fed/shared',
      'Assets/MODELS/fed/textures',
    ]);
    const vfs = files(['Assets/MODELS/fed/common/panel.bmp', 'Assets/textures/panel.bmp']);
    expect(resolveShipTexture(vfs, MODEL, 'panel')).toEqual({ path: 'Assets/MODELS/fed/common/panel.bmp' });
    const onlyShared = files(['Assets/textures/panel.BMP']);
    expect(resolveShipTexture(onlyShared, MODEL, 'panel')).toEqual({ path: 'Assets/textures/panel.BMP' });
  });

  it('accepts a relative path with backslashes, pipes, or quotes', () => {
    const vfs = files(['Assets/MODELS/fed/variant/sub/Hull_1.bmp', 'Assets/MODELS/sibling/Hull_1.bmp']);
    expect(resolveShipTexture(vfs, MODEL, 'sub\\Hull_1')).toEqual({
      path: 'Assets/MODELS/fed/variant/sub/Hull_1.bmp',
    });
    expect(resolveShipTexture(vfs, MODEL, 'sub|Hull_1.bmp')).toEqual({
      path: 'Assets/MODELS/fed/variant/sub/Hull_1.bmp',
    });
    expect(resolveShipTexture(vfs, MODEL, '"sub//Hull_1.bmp"')).toEqual({
      path: 'Assets/MODELS/fed/variant/sub/Hull_1.bmp',
    });
    expect(resolveShipTexture(vfs, MODEL, '..\\..\\sibling\\Hull_1')).toEqual({
      path: 'Assets/MODELS/sibling/Hull_1.bmp',
    });
  });

  it('falls back to the basename when the relative directory misses', () => {
    const vfs = files(['Assets/MODELS/fed/variant/Hull_1.bmp']);
    expect(resolveShipTexture(vfs, MODEL, 'missing/Hull_1.bmp')).toEqual({
      path: 'Assets/MODELS/fed/variant/Hull_1.bmp',
    });
  });

  it('rejects a name that leaves the install and does not open the basename', () => {
    const vfs = files(['Assets/MODELS/fed/variant/secret.bmp']);
    expect(resolveShipTexture(vfs, MODEL, '../../../../../secret')).toEqual({ reason: 'texture-name' });
    expect(resolveShipTexture(vfs, MODEL, 'C:/Games/Hull_1.bmp')).toEqual({ reason: 'texture-name' });
    expect(resolveShipTexture(vfs, MODEL, '/Assets/MODELS/Hull_1.bmp')).toEqual({ reason: 'texture-name' });
    expect(resolveShipTexture(vfs, MODEL, '   ')).toEqual({ reason: 'empty-name' });
  });

  it('reports absent only after the shared folders and parents miss', () => {
    const vfs = files(['Assets/MODELS/other/Hull_1.bmp']);
    expect(resolveShipTexture(vfs, MODEL, 'Hull_1')).toEqual({ reason: 'absent' });
  });

  it('classifies a miss without keeping the texture name', () => {
    const vfs = files([
      'Assets/MODELS/rom/panel.bmp',
      'Assets/MODELS/lyr/mark.pcx',
      'Assets/MODELS/fed/variant/notes.txt',
    ]);
    expect(classifyTextureMiss(vfs, 'panel')).toBe('differentEmpire');
    expect(classifyTextureMiss(vfs, 'mark')).toBe('unsupportedExtension');
    expect(classifyTextureMiss(vfs, 'glow#1')).toBe('unusualName');
    expect(classifyTextureMiss(vfs, 'not-there')).toBe('missingFile');
    expect(classifyTextureMiss(vfs, 'C:/Games/panel.bmp')).toBe('unusualName');
    expect(JSON.stringify([
      classifyTextureMiss(vfs, 'panel'),
      classifyTextureMiss(vfs, 'mark'),
      classifyTextureMiss(vfs, 'glow#1'),
      classifyTextureMiss(vfs, 'not-there'),
    ])).toBe('["differentEmpire","unsupportedExtension","unusualName","missingFile"]');
  });
});

function files(paths: readonly string[]): ReturnType<typeof createVfs> {
  const entries: VfsSourceFile[] = paths.map((path) => ({
    path,
    size: 1,
    read: async () => Uint8Array.of(0),
  }));
  return createVfs(entries);
}
