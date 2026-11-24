import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { encodeBmp } from './src/encode-bmp.ts';
import { machinePathLeak } from './src/diagnostic.ts';
import { verifyInstall } from './verify-install.ts';

test('synthetic install reports pairs, bit depth, colour key and a short file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sfc2-verify-'));
  try {
    const palette = new Uint8Array(256 * 3);
    palette[0] = 255;
    palette[1] = 0;
    palette[2] = 255;
    palette[3] = 10;
    palette[4] = 10;
    palette[5] = 10;
    const base = encodeBmp({
      width: 2,
      height: 2,
      bitCount: 8,
      pixels: Uint8Array.of(1, 1, 1, 1),
      palette,
      clrUsed: 0,
    });
    const glow = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 4,
      pixels: Uint8Array.of(1),
      palette: Uint8Array.of(0, 0, 0, 255, 0, 0),
      clrUsed: 2,
    });
    const gray = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(40, 40, 40),
    });
    const magenta = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(255, 0, 255),
    });
    const orphan = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 8,
      pixels: Uint8Array.of(0),
      palette: Uint8Array.of(0, 0, 0),
      clrUsed: 1,
    });
    const named = encodeBmp({
      width: 1,
      height: 1,
      bitCount: 24,
      pixels: Uint8Array.of(1, 2, 3),
    });
    await writeTree(root, {
      'Starfleet2CE.exe': Uint8Array.of(0x4d, 0x5a),
      'Assets/Specs/shiplist.txt': text('Race\tClass\nTest\tTEST-01\n'),
      'MetaAssets/shiplist.txt': text('Race\tClass\nTest\tTEST-01\n'),
      'Assets/Models/t/Hull_1.bmp': base,
      'Assets/Models/t/Hull_1i.bmp': glow,
      'Assets/Models/t/Hull_2.bmp': gray,
      'Assets/Models/t/Hull_2i.bmp': gray,
      'Assets/Models/t/Panel_3.bmp': magenta,
      'Assets/Models/t/Hull_9i.bmp': orphan,
      'Assets/Models/t/badge-i.bmp': named,
      'Assets/Models/t/short.bmp': base.subarray(0, base.length - 2),
    });

    const report = await verifyInstall(root);
    assert.equal(machinePathLeak(report), null);
    assert.equal(report.build, 'Starfleet2CE.exe');
    assert.equal(report.ok, true);
    assert.equal(report.shiplist.assets, 'Assets/Specs/shiplist.txt');
    assert.equal(report.bmp.fourBit.count, 1);
    assert.equal(report.bmp.pairsWithGlow, 2);
    assert.equal(report.bmp.orphans, 1);
    assert.equal(report.bmp.sizeMismatches, 1);
    assert.equal(report.bmp.dashIllumNames, 1);
    assert.equal(report.bmp.glowColored, 1);
    assert.ok(report.bmp.glowGrayscale >= 1);
    assert.equal(report.bmp.magentaFiles, 1);
    assert.ok(report.bmp.magentaPixels >= 1);
    assert.ok(report.bmp.paletteZero.magenta >= 1);
    assert.equal(report.bmp.shortByTwoBytes.count, 1);
    assert.equal(report.bmp.shortByTwoBytes.parsed, 0);
    assert.equal(report.gpuUpload, 'not checked headless');
    assert.equal(report.bmp.bitCounts['4'], 1);
    assert.ok((report.bmp.bitCounts['8'] ?? 0) >= 1);
    assert.ok((report.bmp.bitCounts['24'] ?? 0) >= 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeTree(root: string, files: Record<string, Uint8Array>): Promise<void> {
  for (const [relative, bytes] of Object.entries(files)) {
    const absolute = path.join(root, ...relative.split('/'));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
  }
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
