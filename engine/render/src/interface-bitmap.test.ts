import { describe, expect, it } from 'vitest';
import { encodeBmp } from '@sfc2js/formats';
import { createVfs } from '@sfc2js/platform';
import { loadInterfaceBitmap } from './interface-bitmap.ts';

describe('loadInterfaceBitmap', () => {
  it('decodes a bitmap from the vfs and does not invent a missing one', async () => {
    const pixels = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0]);
    const file = encodeBmp({ width: 2, height: 2, bitCount: 24, pixels });
    const vfs = createVfs([
      { path: 'Assets/textures/HydranRedicleCircle.BMP', size: file.length, read: async () => file },
    ]);
    const loaded = await loadInterfaceBitmap(vfs, 'assets/textures/hydranrediclecircle.bmp');
    expect(loaded.data?.width).toBe(2);
    expect(loaded.data?.height).toBe(2);
    expect(loaded.data?.rgba.length).toBe(16);
    expect(loaded.data?.path).toBe('Assets/textures/HydranRedicleCircle.BMP');
    const missing = await loadInterfaceBitmap(vfs, 'Assets/bitmaps/ui/offScr.BMP');
    expect(missing.data).toBeNull();
    expect(missing.diagnostics.some((item) => item.code === 'missingTexture')).toBe(true);
  });
});