/**
 * Windows BMP decoder for the textures CE 2.670 is known to ship
 * (8-bit and 4-bit BI_RGB) plus 24-bit and 32-bit BI_RGB, which the
 * HUD pipeline also asks for. Pixels come back as premultiplied RGBA
 * in top-down order. See docs/formats/bmp.md.
 */

import { diagnostic, installRelativeFile, type Diagnostic, type ParseResult } from './diagnostic.ts';

export const BMP_MAX_DIMENSION = 8192;

export const BMP_COLOR_KEYS = ['none', 'magenta', 'black', 'paletteIndex0'] as const;
export type BmpColorKey = (typeof BMP_COLOR_KEYS)[number];

export interface DecodedBmp {
  width: number;
  height: number;
  /** Premultiplied RGBA, row 0 is the top of the image. */
  rgba: Uint8ClampedArray;
  bitCount: number;
  compression: number;
  /** True when the file stored the top row first (negative biHeight). */
  topDown: boolean;
  hasTransparency: boolean;
}

export interface ParseBmpOptions {
  /** Install-relative path stamped onto diagnostics when it is safe. */
  file?: string;
  /**
   * Colour-key convention. Default `none`: the CE colour key is still
   * unverified (docs/ui/asset-pipeline.md §3).
   */
  colorKey?: BmpColorKey;
}

const BI_RGB = 0;
const SUPPORTED_BITS = new Set([4, 8, 24, 32]);

const COMPRESSION_NAMES: Record<number, string> = {
  0: 'BI_RGB',
  1: 'BI_RLE8',
  2: 'BI_RLE4',
  3: 'BI_BITFIELDS',
  4: 'BI_JPEG',
  5: 'BI_PNG',
};

export function parseBmp(
  input: ArrayBuffer | Uint8Array,
  options?: ParseBmpOptions,
): ParseResult<DecodedBmp> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const file = options?.file !== undefined ? installRelativeFile(options.file) : undefined;
  const colorKey = options?.colorKey ?? 'none';
  const diagnostics: Diagnostic[] = [];

  const fail = (
    code: string,
    severity: Diagnostic['severity'],
    details?: Record<string, unknown>,
    offset?: number,
    data: DecodedBmp = emptyDecoded(),
  ): ParseResult<DecodedBmp> => {
    diagnostics.push(bmpDiagnostic(code, severity, file, details, offset));
    return { data, diagnostics };
  };

  if (bytes.length === 0) {
    return fail('emptyFile', 'error');
  }
  if (bytes.length < 2 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    return fail('badSignature', 'error', undefined, 0);
  }
  if (bytes.length < 18) {
    return fail('truncated', 'error', undefined, bytes.length);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pixelOffset = view.getUint32(10, true);
  const infoSize = view.getUint32(14, true);

  if (infoSize !== 12 && (infoSize < 40 || infoSize > 124)) {
    return fail('unsupportedHeader', 'error', { infoHeaderSize: infoSize }, 14);
  }
  const headerBytes = 14 + infoSize;
  if (bytes.length < headerBytes) {
    return fail('truncated', 'error', { infoHeaderSize: infoSize }, bytes.length);
  }

  let width: number;
  let rawHeight: number;
  let planes: number;
  let bitCount: number;
  let compression = BI_RGB;
  let clrUsed = 0;

  if (infoSize === 12) {
    width = view.getUint16(18, true);
    rawHeight = view.getUint16(20, true);
    planes = view.getUint16(22, true);
    bitCount = view.getUint16(24, true);
  } else {
    width = view.getInt32(18, true);
    rawHeight = view.getInt32(22, true);
    planes = view.getUint16(26, true);
    bitCount = view.getUint16(28, true);
    compression = view.getUint32(30, true);
    if (infoSize >= 40) clrUsed = view.getUint32(46, true);
  }

  if (planes !== 1) {
    return fail('unsupportedHeader', 'error', { infoHeaderSize: infoSize, planes }, 14);
  }

  const topDown = rawHeight < 0;
  const height = topDown ? -rawHeight : rawHeight;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > BMP_MAX_DIMENSION ||
    height > BMP_MAX_DIMENSION
  ) {
    return fail('badDimensions', 'error', { width, height });
  }

  if (!SUPPORTED_BITS.has(bitCount)) {
    return fail('unsupportedBitDepth', 'error', { bitCount });
  }
  if (compression !== BI_RGB) {
    const name = COMPRESSION_NAMES[compression];
    return fail('unsupportedCompression', 'error', {
      compression,
      ...(name !== undefined ? { compressionName: name } : {}),
    });
  }

  const indexed = bitCount <= 8;
  const entrySize = infoSize === 12 ? 3 : 4;
  const paletteStart = headerBytes;
  const maxColors = indexed ? 1 << bitCount : 0;
  // biClrUsed 0 means "full palette", but a core header has no biClrUsed
  // and some files stop the table at bfOffBits. Use the entries that fit.
  const fits = indexed ? Math.floor((pixelOffset - paletteStart) / entrySize) : 0;
  const paletteCount = indexed
    ? Math.min(clrUsed === 0 ? maxColors : clrUsed, maxColors, Math.max(fits, 0))
    : 0;

  if (pixelOffset < paletteStart || pixelOffset > bytes.length) {
    return fail('truncated', 'error', { width, height }, pixelOffset);
  }
  if (indexed && (fits < 1 || (clrUsed > 0 && fits < Math.min(clrUsed, maxColors)))) {
    return fail('badPalette', 'error', { paletteCount: clrUsed || maxColors }, paletteStart);
  }

  const stride = Math.floor((width * bitCount + 31) / 32) * 4;
  const pixelBytes = stride * height;
  if (bytes.length - pixelOffset < pixelBytes) {
    return fail('truncated', 'error', { width, height, expectedBytes: pixelBytes }, pixelOffset);
  }

  const palette = indexed ? readPalette(bytes, paletteStart, paletteCount, entrySize) : null;
  const rgba = new Uint8ClampedArray(width * height * 4);
  let outOfRange = 0;

  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    const src = pixelOffset + srcRow * stride;
    const dst = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = dst + x * 4;
      if (bitCount === 24) {
        rgba[i] = bytes[src + x * 3 + 2] ?? 0;
        rgba[i + 1] = bytes[src + x * 3 + 1] ?? 0;
        rgba[i + 2] = bytes[src + x * 3] ?? 0;
        rgba[i + 3] = 255;
      } else if (bitCount === 32) {
        rgba[i] = bytes[src + x * 4 + 2] ?? 0;
        rgba[i + 1] = bytes[src + x * 4 + 1] ?? 0;
        rgba[i + 2] = bytes[src + x * 4] ?? 0;
        rgba[i + 3] = bytes[src + x * 4 + 3] ?? 0;
      } else {
        const index = readIndex(bytes, src, bitCount, x);
        const safeIndex = palette !== null && index < paletteCount ? index : 0;
        if (index >= paletteCount) outOfRange += 1;
        const color = safeIndex * 3;
        rgba[i] = palette?.[color] ?? 0;
        rgba[i + 1] = palette?.[color + 1] ?? 0;
        rgba[i + 2] = palette?.[color + 2] ?? 0;
        rgba[i + 3] = 255;
        if (colorKey === 'paletteIndex0' && index === 0) {
          rgba[i] = 0;
          rgba[i + 1] = 0;
          rgba[i + 2] = 0;
          rgba[i + 3] = 0;
        }
      }
    }
  }

  if (bitCount === 32) forceOpaqueWhenAlphaUnused(rgba);
  const hasTransparency = applyColorKeyAndPremultiply(rgba, colorKey === 'paletteIndex0' ? 'none' : colorKey);

  if (outOfRange > 0) {
    diagnostics.push(
      bmpDiagnostic('paletteIndexOutOfRange', 'warning', file, { count: outOfRange }),
    );
  }
  if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
    diagnostics.push(bmpDiagnostic('nonPowerOfTwo', 'info', file, { width, height }));
  }

  return {
    data: {
      width,
      height,
      rgba,
      bitCount,
      compression,
      topDown,
      hasTransparency,
    },
    diagnostics,
  };
}

function emptyDecoded(): DecodedBmp {
  return {
    width: 0,
    height: 0,
    rgba: new Uint8ClampedArray(0),
    bitCount: 0,
    compression: 0,
    topDown: false,
    hasTransparency: false,
  };
}

function bmpDiagnostic(
  code: string,
  severity: Diagnostic['severity'],
  file: string | undefined,
  details?: Record<string, unknown>,
  offset?: number,
): Diagnostic {
  return diagnostic(code, 'bmp', severity, {
    ...(details !== undefined ? { details } : {}),
    location: {
      ...(file !== undefined ? { file } : {}),
      ...(offset !== undefined ? { offset } : {}),
    },
  });
}

function readPalette(
  bytes: Uint8Array,
  start: number,
  count: number,
  entrySize: number,
): Uint8Array {
  const rgb = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = start + i * entrySize;
    rgb[i * 3] = bytes[p + 2] ?? 0;
    rgb[i * 3 + 1] = bytes[p + 1] ?? 0;
    rgb[i * 3 + 2] = bytes[p] ?? 0;
  }
  return rgb;
}

function readIndex(bytes: Uint8Array, row: number, bitCount: number, x: number): number {
  if (bitCount === 8) return bytes[row + x] ?? 0;
  const byte = bytes[row + (x >> 1)] ?? 0;
  return (x & 1) === 0 ? (byte >> 4) & 0x0f : byte & 0x0f;
}

/**
 * 32-bit BI_RGB often stores 0 in the alpha byte because the writer did
 * not use it. A buffer whose alpha is entirely 0 is treated as opaque.
 */
function forceOpaqueWhenAlphaUnused(rgba: Uint8ClampedArray): void {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 0) return;
  }
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
}

function applyColorKeyAndPremultiply(rgba: Uint8ClampedArray, colorKey: BmpColorKey): boolean {
  let transparent = false;
  for (let i = 0; i < rgba.length; i += 4) {
    let r = rgba[i] ?? 0;
    let g = rgba[i + 1] ?? 0;
    let b = rgba[i + 2] ?? 0;
    let a = rgba[i + 3] ?? 0;
    if (
      (colorKey === 'magenta' && r === 255 && g === 0 && b === 255) ||
      (colorKey === 'black' && r === 0 && g === 0 && b === 0)
    ) {
      r = 0;
      g = 0;
      b = 0;
      a = 0;
    }
    if (a === 0) {
      r = 0;
      g = 0;
      b = 0;
      transparent = true;
    } else if (a !== 255) {
      r = Math.round((r * a) / 255);
      g = Math.round((g * a) / 255);
      b = Math.round((b * a) / 255);
      transparent = true;
    }
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  }
  return transparent;
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}
