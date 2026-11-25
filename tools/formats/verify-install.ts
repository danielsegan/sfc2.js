/**
 * Metadata-only check of a local SFC2 install.
 *
 * Stdout is counts, pass/fail, and diagnostic classes. The full report,
 * including install-relative paths, is written only when --output is set.
 * It does not print file bytes, table rows, or pixel samples.
 *
 *   SFC2_REFERENCE=/path/to/install node --experimental-strip-types tools/formats/verify-install.ts
 *
 * The private CI job is `.github/workflows/private-bmp-verify.yml`.
 * It runs only when someone dispatches it on the sfc2-ci runner.
 */

import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importInstall } from '../../engine/platform/src/import-install.ts';
import type { PickedFile } from '../../engine/platform/src/picker.ts';
import { machinePathLeak, SELF_ILLUM_STEM, parseBmp } from './index.ts';

const PATH_CAP = 40;

export interface InstallVerifyReport {
  fileCount: number;
  build: 'Starfleet2CE.exe' | 'Starfleet2.exe' | 'unknown';
  ok: boolean;
  shiplist: { assets: string | null; metaassets: string | null };
  importDiagnostics: Array<{ code: string; source: string; severity: string; file?: string }>;
  bmp: {
    count: number;
    decoded: number;
    errorFiles: number;
    bitCounts: Record<string, number>;
    compressions: Record<string, number>;
    headerSizes: Record<string, number>;
    codes: Record<string, number>;
    nonPowerOfTwo: number;
    shortByTwoBytes: { count: number; parsed: number; paths: string[] };
    fourBit: { count: number; paths: string[] };
    pairs: number;
    pairsWithGlow: number;
    orphans: number;
    orphanPaths: string[];
    sizeMismatches: number;
    dashIllumNames: number;
    glowGrayscale: number;
    glowColored: number;
    paletteZero: { black: number; magenta: number; other: number; absent: number };
    magentaPixels: number;
    magentaFiles: number;
    opaqueBlackPixels: number;
  };
  gpuUpload: 'not checked headless';
}

export interface InstallPublicSummary {
  result: 'pass' | 'fail';
  fileCount: number;
  build: InstallVerifyReport['build'];
  shiplist: { assets: boolean; metaassets: boolean };
  errors: Array<{ class: string; severity: string; count: number }>;
  bmp: {
    count: number;
    decoded: number;
    errorFiles: number;
    bitCounts: Record<string, number>;
    compressions: Record<string, number>;
    headerSizes: Record<string, number>;
    codes: Record<string, number>;
    nonPowerOfTwo: number;
    shortByTwoBytes: number;
    shortParsed: number;
    fourBit: number;
    pairs: number;
    pairsWithGlow: number;
    orphans: number;
    sizeMismatches: number;
    dashIllumNames: number;
    glowGrayscale: number;
    glowColored: number;
    paletteZero: InstallVerifyReport['bmp']['paletteZero'];
    magentaPixels: number;
    magentaFiles: number;
    opaqueBlackPixels: number;
  };
}

/** Counts and error classes. Paths and per-file samples are omitted. */
export function publicInstallSummary(report: InstallVerifyReport): InstallPublicSummary {
  const errors = diagnosticClasses(report.importDiagnostics);
  return {
    result: report.ok ? 'pass' : 'fail',
    fileCount: report.fileCount,
    build: report.build,
    shiplist: {
      assets: report.shiplist.assets !== null,
      metaassets: report.shiplist.metaassets !== null,
    },
    errors,
    bmp: {
      count: report.bmp.count,
      decoded: report.bmp.decoded,
      errorFiles: report.bmp.errorFiles,
      bitCounts: report.bmp.bitCounts,
      compressions: report.bmp.compressions,
      headerSizes: report.bmp.headerSizes,
      codes: report.bmp.codes,
      nonPowerOfTwo: report.bmp.nonPowerOfTwo,
      shortByTwoBytes: report.bmp.shortByTwoBytes.count,
      shortParsed: report.bmp.shortByTwoBytes.parsed,
      fourBit: report.bmp.fourBit.count,
      pairs: report.bmp.pairs,
      pairsWithGlow: report.bmp.pairsWithGlow,
      orphans: report.bmp.orphans,
      sizeMismatches: report.bmp.sizeMismatches,
      dashIllumNames: report.bmp.dashIllumNames,
      glowGrayscale: report.bmp.glowGrayscale,
      glowColored: report.bmp.glowColored,
      paletteZero: report.bmp.paletteZero,
      magentaPixels: report.bmp.magentaPixels,
      magentaFiles: report.bmp.magentaFiles,
      opaqueBlackPixels: report.bmp.opaqueBlackPixels,
    },
  };
}

function diagnosticClasses(
  diagnostics: InstallVerifyReport['importDiagnostics'],
): InstallPublicSummary['errors'] {
  const counts = new Map<string, { class: string; severity: string; count: number }>();
  for (const item of diagnostics) {
    const key = `${item.code}:${item.severity}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { class: item.code, severity: item.severity, count: 1 });
  }
  return [...counts.values()].sort((left, right) => (left.class < right.class ? -1 : left.class > right.class ? 1 : 0));
}

export function formatInstallSummary(summary: InstallPublicSummary): string {
  const lines = [
    `bmp result=${summary.result} files=${summary.fileCount} bmp=${summary.bmp.count} decoded=${summary.bmp.decoded} errorFiles=${summary.bmp.errorFiles}`,
  ];
  if (summary.errors.length === 0 && Object.keys(summary.bmp.codes).length === 0) {
    lines.push('bmp errors=0');
  }
  for (const item of summary.errors) {
    lines.push(`bmp class=${item.class} severity=${item.severity} count=${item.count}`);
  }
  for (const [code, count] of Object.entries(summary.bmp.codes).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
    lines.push(`bmp class=${code} count=${count}`);
  }
  return lines.join('\n');
}

export async function verifyInstall(root: string): Promise<InstallVerifyReport> {
  const files = await listInstall(root);
  const imported = await importInstall(files);
  const glowPaths = new Set(
    imported.texturePairs
      .map((pair) => pair.selfIllumPath?.toLowerCase())
      .filter((item): item is string => item !== undefined),
  );

  const bmp = emptyBmp();
  const decodedSize = new Map<string, { width: number; height: number }>();
  bmp.count = files.filter((file) => file.path.toLowerCase().endsWith('.bmp')).length;
  bmp.pairs = imported.texturePairs.length;
  bmp.pairsWithGlow = glowPaths.size;
  for (const diagnostic of imported.diagnostics) {
    if (diagnostic.code !== 'orphanSelfIllum') continue;
    bmp.orphans += 1;
    const illumPath = diagnostic.details?.illumPath;
    if (typeof illumPath === 'string') pushCap(bmp.orphanPaths, illumPath);
  }

  for (const file of files) {
    if (!file.path.toLowerCase().endsWith('.bmp')) continue;
    const stem = path.posix.basename(file.path, path.posix.extname(file.path));
    if (/(?:^|[-_])i$/i.test(stem) && !SELF_ILLUM_STEM.test(stem) && /[-]i$/i.test(stem)) {
      bmp.dashIllumNames += 1;
    }
    const bytes = await file.read();
    const header = readHeader(bytes);
    if (header !== null) {
      bump(bmp.bitCounts, String(header.bitCount));
      bump(bmp.compressions, String(header.compression));
      bump(bmp.headerSizes, String(header.infoSize));
      if (header.bitCount === 4) {
        bmp.fourBit.count += 1;
        pushCap(bmp.fourBit.paths, file.path);
      }
      if (header.indexed) {
        if (header.palette0 === null) bmp.paletteZero.absent += 1;
        else if (isBlack(header.palette0)) bmp.paletteZero.black += 1;
        else if (isMagenta(header.palette0)) bmp.paletteZero.magenta += 1;
        else bmp.paletteZero.other += 1;
      }
      if (bytes.length + 2 === header.expectedEnd) {
        bmp.shortByTwoBytes.count += 1;
        pushCap(bmp.shortByTwoBytes.paths, file.path);
      }
    }

    const parsed = parseBmp(bytes, { file: file.path, colorKey: 'none' });
    for (const diagnostic of parsed.diagnostics) bump(bmp.codes, diagnostic.code);
    const failed = parsed.data.width === 0 || parsed.diagnostics.some((item) => item.severity === 'error');
    if (failed) {
      bmp.errorFiles += 1;
      continue;
    }
    bmp.decoded += 1;
    decodedSize.set(file.path.toLowerCase(), { width: parsed.data.width, height: parsed.data.height });
    if (header !== null && bytes.length + 2 === header.expectedEnd) bmp.shortByTwoBytes.parsed += 1;
    if (parsed.diagnostics.some((item) => item.code === 'nonPowerOfTwo')) bmp.nonPowerOfTwo += 1;
    const colors = countKeyColors(parsed.data.rgba);
    bmp.magentaPixels += colors.magenta;
    bmp.opaqueBlackPixels += colors.black;
    if (colors.magenta > 0) bmp.magentaFiles += 1;
    if (glowPaths.has(file.path.toLowerCase())) {
      if (isGrayscale(parsed.data.rgba)) bmp.glowGrayscale += 1;
      else bmp.glowColored += 1;
    }
  }

  for (const pair of imported.texturePairs) {
    if (pair.selfIllumPath === undefined) continue;
    const base = decodedSize.get(pair.basePath.toLowerCase());
    const glow = decodedSize.get(pair.selfIllumPath.toLowerCase());
    if (base !== undefined && glow !== undefined && (base.width !== glow.width || base.height !== glow.height)) {
      bmp.sizeMismatches += 1;
    }
  }

  const report: InstallVerifyReport = {
    fileCount: files.length,
    build: imported.build.exe,
    ok: imported.ok,
    shiplist: imported.shiplist,
    importDiagnostics: imported.diagnostics.map((item) => ({
      code: item.code,
      source: item.source,
      severity: item.severity,
      ...(item.location?.file !== undefined ? { file: item.location.file } : {}),
    })),
    bmp,
    gpuUpload: 'not checked headless',
  };
  const leak = machinePathLeak(report);
  if (leak !== null) {
    throw new Error('verify report included a machine-local path');
  }
  return report;
}

async function listInstall(root: string): Promise<PickedFile[]> {
  const rootReal = await realpath(root);
  const entries = await readdir(rootReal, { recursive: true, withFileTypes: true });
  const files: PickedFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const real = await realpath(absolute);
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) continue;
    const relative = path.relative(rootReal, real).split(path.sep).join('/');
    if (relative === '' || relative.split('/').includes('..')) continue;
    const info = await stat(real);
    files.push({
      path: relative,
      size: info.size,
      read: () => readFile(real),
    });
  }
  return files;
}

function emptyBmp(): InstallVerifyReport['bmp'] {
  return {
    count: 0,
    decoded: 0,
    errorFiles: 0,
    bitCounts: {},
    compressions: {},
    headerSizes: {},
    codes: {},
    nonPowerOfTwo: 0,
    shortByTwoBytes: { count: 0, parsed: 0, paths: [] },
    fourBit: { count: 0, paths: [] },
    pairs: 0,
    pairsWithGlow: 0,
    orphans: 0,
    orphanPaths: [],
    sizeMismatches: 0,
    dashIllumNames: 0,
    glowGrayscale: 0,
    glowColored: 0,
    paletteZero: { black: 0, magenta: 0, other: 0, absent: 0 },
    magentaPixels: 0,
    magentaFiles: 0,
    opaqueBlackPixels: 0,
  };
}

interface HeaderFacts {
  bitCount: number;
  compression: number;
  infoSize: number;
  indexed: boolean;
  palette0: { r: number; g: number; b: number } | null;
  expectedEnd: number;
}

function readHeader(bytes: Uint8Array): HeaderFacts | null {
  if (bytes.length < 26 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pixelOffset = view.getUint32(10, true);
  const infoSize = view.getUint32(14, true);
  if (infoSize !== 12 && (infoSize < 40 || infoSize > 124)) return null;
  if (bytes.length < 14 + Math.min(infoSize, 40) && infoSize !== 12) return null;
  let width: number;
  let height: number;
  let bitCount: number;
  let compression = 0;
  let clrUsed = 0;
  if (infoSize === 12) {
    if (bytes.length < 26) return null;
    width = view.getUint16(18, true);
    height = view.getUint16(20, true);
    bitCount = view.getUint16(24, true);
  } else {
    if (bytes.length < 54) return null;
    width = view.getInt32(18, true);
    height = Math.abs(view.getInt32(22, true));
    bitCount = view.getUint16(28, true);
    compression = view.getUint32(30, true);
    clrUsed = view.getUint32(46, true);
  }
  if (width <= 0 || height <= 0 || height > 8192 || width > 8192) return null;
  const indexed = bitCount === 4 || bitCount === 8;
  const entrySize = infoSize === 12 ? 3 : 4;
  const paletteStart = 14 + infoSize;
  let palette0: HeaderFacts['palette0'] = null;
  if (indexed && paletteStart + entrySize <= bytes.length && paletteStart + entrySize <= pixelOffset) {
    palette0 = {
      b: bytes[paletteStart] ?? 0,
      g: bytes[paletteStart + 1] ?? 0,
      r: bytes[paletteStart + 2] ?? 0,
    };
  }
  const stride = Math.floor((width * bitCount + 31) / 32) * 4;
  const paletteCount = indexed ? (clrUsed === 0 ? 1 << bitCount : Math.min(clrUsed, 1 << bitCount)) : 0;
  const expectedEnd = Math.max(pixelOffset, paletteStart + paletteCount * entrySize) + stride * height;
  return { bitCount, compression, infoSize, indexed, palette0, expectedEnd };
}

function countKeyColors(rgba: Uint8ClampedArray): { magenta: number; black: number } {
  let magenta = 0;
  let black = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const a = rgba[i + 3] ?? 0;
    if (a !== 255) continue;
    if (r === 255 && g === 0 && b === 255) magenta += 1;
    else if (r === 0 && g === 0 && b === 0) black += 1;
  }
  return { magenta, black };
}

function isGrayscale(rgba: Uint8ClampedArray): boolean {
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) === 0) continue;
    if ((rgba[i] ?? 0) !== (rgba[i + 1] ?? 0) || (rgba[i + 1] ?? 0) !== (rgba[i + 2] ?? 0)) return false;
  }
  return true;
}

function isBlack(color: { r: number; g: number; b: number }): boolean {
  return color.r === 0 && color.g === 0 && color.b === 0;
}

function isMagenta(color: { r: number; g: number; b: number }): boolean {
  return color.r === 255 && color.g === 0 && color.b === 255;
}

function bump(bag: Record<string, number>, key: string): void {
  bag[key] = (bag[key] ?? 0) + 1;
}

function pushCap(list: string[], value: string): void {
  if (list.length < PATH_CAP) list.push(value);
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) return undefined;
  return value;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const root = process.env.SFC2_REFERENCE;
  if (root === undefined || root.length === 0) {
    process.stderr.write('bmp result=fail class=reference-unset count=1\n');
    process.exitCode = 2;
    return;
  }
  const report = await verifyInstall(root);
  const summary = publicInstallSummary(report);
  const output = flag('--output');
  const summaryOut = flag('--summary-out');
  if (output !== undefined) await writeJson(output, report);
  if (summaryOut !== undefined) await writeJson(summaryOut, summary);
  process.stdout.write(`${formatInstallSummary(summary)}\n`);
}

const invoked = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch(() => {
    process.stderr.write('bmp result=fail class=exception count=1\n');
    process.exitCode = 1;
  });
}
