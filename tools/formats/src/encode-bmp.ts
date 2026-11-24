/**
 * Synthetic BMP writer for tests. Builds uncompressed BI_RGB files.
 * Not a general image library.
 */

export interface BmpEncodeOptions {
  width: number;
  height: number;
  bitCount: 4 | 8 | 24 | 32;
  /**
   * Top-down pixels. 4/8-bit: one palette index per pixel.
   * 24-bit: RGB. 32-bit: RGBA.
   */
  pixels: Uint8Array;
  /** RGB triples. Required for 4-bit and 8-bit. */
  palette?: Uint8Array;
  /** Negative biHeight. Default false (bottom-up, the BMP usual). */
  topDown?: boolean;
  /** 12 writes BITMAPCOREHEADER. 40 and up write a BITMAPINFOHEADER prefix. */
  infoHeaderSize?: 12 | 40 | 52 | 56 | 108 | 124;
  /** biCompression. Default 0 (BI_RGB). */
  compression?: number;
  /** biClrUsed. Default is the full palette for indexed images. */
  clrUsed?: number;
}

export function encodeBmp(options: BmpEncodeOptions): Uint8Array {
  const infoSize = options.infoHeaderSize ?? 40;
  const compression = options.compression ?? 0;
  const topDown = options.topDown ?? false;
  const indexed = options.bitCount <= 8;
  const maxColors = indexed ? 1 << options.bitCount : 0;
  // biClrUsed 0 means the full palette. Write that header value, and still
  // emit every colour so the file matches a normal 8-bit texture.
  const fullPalette = options.clrUsed === undefined || options.clrUsed === 0;
  const clrUsed = indexed ? (fullPalette ? maxColors : Math.min(options.clrUsed ?? maxColors, maxColors)) : 0;
  const headerClrUsed = indexed && fullPalette ? 0 : clrUsed;
  const entrySize = infoSize === 12 ? 3 : 4;
  const paletteBytes = clrUsed * entrySize;
  const stride = Math.floor((options.width * options.bitCount + 31) / 32) * 4;
  const pixelBytes = stride * options.height;
  const pixelOffset = 14 + infoSize + paletteBytes;
  const fileSize = pixelOffset + pixelBytes;
  const out = new Uint8Array(fileSize);
  const view = new DataView(out.buffer);

  out[0] = 0x42;
  out[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(10, pixelOffset, true);
  view.setUint32(14, infoSize, true);

  if (infoSize === 12) {
    view.setUint16(18, options.width, true);
    view.setUint16(20, options.height, true);
    view.setUint16(22, 1, true);
    view.setUint16(24, options.bitCount, true);
  } else {
    view.setInt32(18, options.width, true);
    view.setInt32(22, topDown ? -options.height : options.height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, options.bitCount, true);
    view.setUint32(30, compression, true);
    view.setUint32(34, pixelBytes, true);
    view.setUint32(46, headerClrUsed, true);
  }

  if (indexed) {
    const src = options.palette ?? new Uint8Array(clrUsed * 3);
    for (let i = 0; i < clrUsed; i++) {
      const p = 14 + infoSize + i * entrySize;
      out[p] = src[i * 3 + 2] ?? 0;
      out[p + 1] = src[i * 3 + 1] ?? 0;
      out[p + 2] = src[i * 3] ?? 0;
    }
  }

  for (let y = 0; y < options.height; y++) {
    const srcRow = topDown ? y : options.height - 1 - y;
    const dst = pixelOffset + y * stride;
    for (let x = 0; x < options.width; x++) {
      if (options.bitCount === 24) {
        const s = (srcRow * options.width + x) * 3;
        out[dst + x * 3] = options.pixels[s + 2] ?? 0;
        out[dst + x * 3 + 1] = options.pixels[s + 1] ?? 0;
        out[dst + x * 3 + 2] = options.pixels[s] ?? 0;
      } else if (options.bitCount === 32) {
        const s = (srcRow * options.width + x) * 4;
        out[dst + x * 4] = options.pixels[s + 2] ?? 0;
        out[dst + x * 4 + 1] = options.pixels[s + 1] ?? 0;
        out[dst + x * 4 + 2] = options.pixels[s] ?? 0;
        out[dst + x * 4 + 3] = options.pixels[s + 3] ?? 0;
      } else if (options.bitCount === 8) {
        out[dst + x] = options.pixels[srcRow * options.width + x] ?? 0;
      } else {
        const index = options.pixels[srcRow * options.width + x] ?? 0;
        const byteIndex = dst + (x >> 1);
        if ((x & 1) === 0) out[byteIndex] = (index & 0x0f) << 4;
        else out[byteIndex] |= index & 0x0f;
      }
    }
  }

  return out;
}
