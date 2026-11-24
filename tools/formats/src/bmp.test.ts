import { describe, expect, it } from 'vitest';
import { machinePathLeak } from './diagnostic.ts';
import { encodeBmp } from './encode-bmp.ts';
import { parseBmp } from './bmp.ts';

describe('parseBmp', () => {
  it('round-trips an 8-bit palette image to premultiplied RGBA', () => {
    const palette = rgbPalette([
      [10, 20, 30],
      [40, 50, 60],
    ]);
    const bytes = encodeBmp({
      width: 2,
      height: 2,
      bitCount: 8,
      pixels: Uint8Array.of(0, 1, 1, 0),
      palette,
      clrUsed: 2,
    });
    const parsed = parseBmp(bytes, { file: 'Assets/Models/test/Hull_1.bmp' });
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.data.width).toBe(2);
    expect(parsed.data.height).toBe(2);
    expect(parsed.data.bitCount).toBe(8);
    expect(pixel(parsed.data.rgba, 0)).toEqual([10, 20, 30, 255]);
    expect(pixel(parsed.data.rgba, 1)).toEqual([40, 50, 60, 255]);
    expect(pixel(parsed.data.rgba, 2)).toEqual([40, 50, 60, 255]);
    expect(parsed.data.hasTransparency).toBe(false);
  });

  it('treats biClrUsed 0 as a full 8-bit palette', () => {
    const palette = new Uint8Array(256 * 3);
    palette[3] = 11;
    palette[4] = 22;
    palette[5] = 33;
    const bytes = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      pixels: Uint8Array.of(1),
      palette,
      clrUsed: 0,
    });
    expect(new DataView(bytes.buffer).getUint32(46, true)).toBe(0);
    expect(pixel(parseBmp(bytes).data.rgba, 0)).toEqual([11, 22, 33, 255]);
  });

  it('expands a 4-bit image through its palette, high nibble first', () => {
    const palette = rgbPalette([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
    ]);
    const bytes = encodeBmp({
      width: 1,
      height: 2,
      bitCount: 4,
      pixels: Uint8Array.of(1, 2),
      palette,
      clrUsed: 4,
    });
    const parsed = parseBmp(bytes);
    expect(errorCodes(parsed.diagnostics)).toEqual([]);
    expect(pixel(parsed.data.rgba, 0)).toEqual([4, 5, 6, 255]);
    expect(pixel(parsed.data.rgba, 1)).toEqual([7, 8, 9, 255]);
  });

  it('reads 24-bit BGR with row padding and keeps the top row first', () => {
    const bytes = manualBmp({
      width: 1,
      height: 2,
      bitCount: 24,
      topDown: false,
      rowsBottomFirst: [
        [0, 0, 255],
        [0, 255, 0],
      ],
    });
    const parsed = parseBmp(bytes);
    expect(parsed.data.topDown).toBe(false);
    expect(pixel(parsed.data.rgba, 0)).toEqual([0, 255, 0, 255]);
    expect(pixel(parsed.data.rgba, 1)).toEqual([0, 0, 255, 255]);
  });

  it('honours a negative height as a top-down bitmap', () => {
    const bytes = manualBmp({
      width: 1,
      height: 2,
      bitCount: 24,
      topDown: true,
      rowsTopFirst: [
        [0, 255, 0],
        [0, 0, 255],
      ],
    });
    const parsed = parseBmp(bytes);
    expect(parsed.data.topDown).toBe(true);
    expect(pixel(parsed.data.rgba, 0)).toEqual([0, 255, 0, 255]);
    expect(pixel(parsed.data.rgba, 1)).toEqual([0, 0, 255, 255]);
  });

  it('round-trips 24-bit and 32-bit pixels', () => {
    const color = encodeBmp({
      width: 2,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(255, 0, 0, 0, 255, 0),
    });
    expect(pixel(parseBmp(color).data.rgba, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(parseBmp(color).data.rgba, 1)).toEqual([0, 255, 0, 255]);

    const withAlpha = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 32,
      pixels: Uint8Array.of(255, 128, 0, 128),
    });
    const decoded = parseBmp(withAlpha);
    expect(pixel(decoded.data.rgba, 0)).toEqual([128, 64, 0, 128]);
    expect(decoded.data.hasTransparency).toBe(true);
  });

  it('treats an all-zero 32-bit alpha channel as opaque', () => {
    const bytes = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 32,
      pixels: Uint8Array.of(8, 16, 24, 0),
    });
    expect(pixel(parseBmp(bytes).data.rgba, 0)).toEqual([8, 16, 24, 255]);
  });

  it('decodes a BITMAPCOREHEADER and a longer V4 header', () => {
    const palette = rgbPalette([[9, 8, 7]]);
    const core = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      pixels: Uint8Array.of(0),
      palette,
      clrUsed: 1,
      infoHeaderSize: 12,
    });
    expect(pixel(parseBmp(core).data.rgba, 0)).toEqual([9, 8, 7, 255]);

    const v4 = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(1, 2, 3),
      infoHeaderSize: 108,
    });
    expect(pixel(parseBmp(v4).data.rgba, 0)).toEqual([1, 2, 3, 255]);
  });

  it('keys magenta only when asked, and premultiplies the cleared pixel', () => {
    const bytes = encodeBmp({
      width: 2,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(255, 0, 255, 1, 2, 3),
    });
    const keyed = parseBmp(bytes, { colorKey: 'magenta' });
    expect(pixel(keyed.data.rgba, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(keyed.data.rgba, 1)).toEqual([1, 2, 3, 255]);
    expect(keyed.data.hasTransparency).toBe(true);

    const kept = parseBmp(bytes, { colorKey: 'none' });
    expect(pixel(kept.data.rgba, 0)).toEqual([255, 0, 255, 255]);
  });

  it('keys palette index 0 without affecting later indexes', () => {
    const palette = rgbPalette([
      [255, 0, 0],
      [0, 0, 255],
    ]);
    const bytes = encodeBmp({
      width: 2,
      height: 1,
      bitCount: 8,
      pixels: Uint8Array.of(0, 1),
      palette,
      clrUsed: 2,
    });
    const parsed = parseBmp(bytes, { colorKey: 'paletteIndex0' });
    expect(pixel(parsed.data.rgba, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(parsed.data.rgba, 1)).toEqual([0, 0, 255, 255]);
  });

  it('reports a non-power-of-two size and still returns pixels', () => {
    const bytes = encodeBmp({
      width: 3,
      height: 2,
      bitCount: 24,
      pixels: new Uint8Array(3 * 2 * 3).fill(12),
    });
    const parsed = parseBmp(bytes, { file: 'Assets/Models/test/wide.bmp' });
    expect(parsed.data.width).toBe(3);
    expect(codes(parsed.diagnostics)).toContain('nonPowerOfTwo');
    expect(parsed.diagnostics.find((item) => item.code === 'nonPowerOfTwo')?.severity).toBe('info');
    expect(parsed.diagnostics[0]?.location?.file).toBe('Assets/Models/test/wide.bmp');
  });

  it('returns diagnostics instead of throwing on bad input', () => {
    expect(parseBmp(new Uint8Array()).diagnostics[0]?.code).toBe('emptyFile');
    expect(parseBmp(Uint8Array.of(0, 1, 2)).diagnostics[0]?.code).toBe('badSignature');
    expect(parseBmp(Uint8Array.of(0x42, 0x4d)).diagnostics[0]?.code).toBe('truncated');

    const rle = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      pixels: Uint8Array.of(0),
      palette: rgbPalette([[1, 1, 1]]),
      clrUsed: 1,
      compression: 1,
    });
    const compressed = parseBmp(rle);
    expect(compressed.diagnostics[0]?.code).toBe('unsupportedCompression');
    expect(compressed.diagnostics[0]?.details).toMatchObject({ compression: 1, compressionName: 'BI_RLE8' });
    expect(compressed.data.width).toBe(0);

    const deep = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      pixels: Uint8Array.of(0),
      palette: rgbPalette([[1, 1, 1]]),
      clrUsed: 1,
    });
    deep[28] = 16;
    expect(parseBmp(deep).diagnostics[0]?.code).toBe('unsupportedBitDepth');

    const huge = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(0, 0, 0),
    });
    const view = new DataView(huge.buffer);
    view.setInt32(18, 9000, true);
    const oversized = parseBmp(huge);
    expect(oversized.diagnostics[0]?.code).toBe('badDimensions');
    expect(oversized.data.rgba.length).toBe(0);

    const short = encodeBmp({
      width: 4,
      height: 4,
      bitCount: 24,
      pixels: new Uint8Array(4 * 4 * 3),
    });
    expect(parseBmp(short.slice(0, short.length - 1)).diagnostics[0]?.code).toBe('truncated');

    for (let i = 0; i < 40; i++) {
      const junk = new Uint8Array(i * 5);
      for (let j = 0; j < junk.length; j++) junk[j] = (i * 19 + j * 7) & 255;
      expect(() => parseBmp(junk)).not.toThrow();
      expect(() => parseBmp(junk.buffer)).not.toThrow();
    }
  });

  it('warns when a palette index does not exist', () => {
    const bytes = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      pixels: Uint8Array.of(5),
      palette: rgbPalette([[9, 9, 9]]),
      clrUsed: 1,
    });
    const parsed = parseBmp(bytes);
    expect(parsed.diagnostics[0]?.code).toBe('paletteIndexOutOfRange');
    expect(pixel(parsed.data.rgba, 0)).toEqual([9, 9, 9, 255]);
  });

  it('drops an unsafe file path instead of copying it onto the diagnostic', () => {
    const parsed = parseBmp(new Uint8Array(), { file: 'C:/Users/me/install/Assets/x.bmp' });
    expect(parsed.diagnostics[0]?.code).toBe('emptyFile');
    expect(parsed.diagnostics[0]?.location?.file).toBeUndefined();
    expect(machinePathLeak(parsed.diagnostics)).toBeNull();
  });
});

function rgbPalette(colors: ReadonlyArray<readonly [number, number, number]>): Uint8Array {
  const out = new Uint8Array(colors.length * 3);
  colors.forEach((color, index) => {
    out[index * 3] = color[0];
    out[index * 3 + 1] = color[1];
    out[index * 3 + 2] = color[2];
  });
  return out;
}

function pixel(rgba: Uint8ClampedArray, index: number): number[] {
  const start = index * 4;
  return [rgba[start] ?? 0, rgba[start + 1] ?? 0, rgba[start + 2] ?? 0, rgba[start + 3] ?? 0];
}

function codes(diagnostics: { code: string }[]): string[] {
  return diagnostics.map((item) => item.code);
}

function errorCodes(diagnostics: { code: string; severity: string }[]): string[] {
  return diagnostics.filter((item) => item.severity === 'error').map((item) => item.code);
}

function manualBmp(options: {
  width: number;
  height: number;
  bitCount: 24;
  topDown: boolean;
  rowsBottomFirst?: ReadonlyArray<readonly [number, number, number]>;
  rowsTopFirst?: ReadonlyArray<readonly [number, number, number]>;
}): Uint8Array {
  const stride = Math.floor((options.width * options.bitCount + 31) / 32) * 4;
  const pixelBytes = stride * options.height;
  const pixelOffset = 54;
  const out = new Uint8Array(pixelOffset + pixelBytes);
  const view = new DataView(out.buffer);
  out[0] = 0x42;
  out[1] = 0x4d;
  view.setUint32(2, out.length, true);
  view.setUint32(10, pixelOffset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, options.width, true);
  view.setInt32(22, options.topDown ? -options.height : options.height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, options.bitCount, true);
  const rows = options.topDown ? options.rowsTopFirst : options.rowsBottomFirst;
  if (rows === undefined) throw new Error('rows required');
  rows.forEach((row, y) => {
    const dst = pixelOffset + y * stride;
    out[dst] = row[2];
    out[dst + 1] = row[1];
    out[dst + 2] = row[0];
  });
  return out;
}
