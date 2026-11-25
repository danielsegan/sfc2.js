import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMod } from '@sfc2js/formats';
import { createVfs } from '@sfc2js/platform';
import { describe, expect, it } from 'vitest';
import { buildShipMesh } from '../../engine/render/src/ship-mesh.ts';
import { syntheticLoadFaultFiles, syntheticViewerFiles } from '../../engine/render/src/synthetic-viewer-install.ts';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  Uint16BufferAttribute,
  type Texture,
} from 'three';
import { assemblyFault, geometryFault, runLoadCheck } from './load.ts';
import type { BuiltShipMesh } from '../../engine/render/src/ship-mesh.ts';
import type { LoadedShip } from '../../engine/render/src/ship-catalog.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

describe('viewer check load stage', () => {
  it('resolves, builds, decodes, and assembles every synthetic row without a browser', async () => {
    const run = await runLoadCheck({ synthetic: true });
    expect(run.status).toBe('ok');
    expect(run.pageError).toBeNull();
    expect(run.report?.stagesRun).toBe('load');
    expect(run.report?.ships).toEqual([
      { id: 'TEST-CA-01', empire: 'Federation', pass: true, stage_failed: null, error: null },
      { id: 'TEST-CL-02', empire: 'Klingon', pass: false, stage_failed: 'resolve', error: 'loader.missingModel' },
      { id: 'TEST-DN-03', empire: 'Romulan', pass: false, stage_failed: 'geometry', error: 'mod.badSignature' },
      { id: 'TEST-FF-04', empire: 'Gorn', pass: false, stage_failed: 'resolve', error: 'shiplist.missingGeometry' },
      { id: 'TEST-BS-05', empire: 'Neutral', pass: true, stage_failed: null, error: null },
      { id: 'TEST-CA-06', empire: 'Hydran', pass: false, stage_failed: 'resolve', error: 'mod.modelPathRejected' },
      { id: 'TEST-CA-07', empire: 'Lyran', pass: true, stage_failed: null, error: null },
      { id: 'TEST-CA-08', empire: 'ISC', pass: false, stage_failed: 'geometry', error: 'loader.noDrawableMesh' },
    ]);
    expect(run.report?.totals).toMatchObject({
      rows: 8,
      passed: 3,
      failed: 5,
      byStage: { resolve: 3, geometry: 2, texture: 0, selfIllum: 0, render: 0 },
    });
    expect(run.report?.totals.elapsedMs).toBeGreaterThan(0);
    expect(JSON.stringify(run.report)).not.toMatch(/\.mod\b|\.bmp\b|Assets\/|C:|data:image|\/srv\/|\\/);
  });

  it('reads a synthetic directory the same way the private runner reads an install', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sfc2-viewer-load-'));
    try {
      for (const file of syntheticViewerFiles()) {
        const absolute = path.join(root, ...file.path.split('/'));
        await mkdir(path.dirname(absolute), { recursive: true });
        await writeFile(absolute, await file.read());
      }
      const run = await runLoadCheck({ install: root });
      expect(run.status).toBe('ok');
      expect(run.report?.stagesRun).toBe('load');
      expect(run.report?.totals).toMatchObject({ rows: 8, passed: 3, failed: 5 });
      expect(JSON.stringify(run.report)).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails a point, a line, and a non-finite position at geometry', async () => {
    const run = await runLoadCheck({ files: syntheticLoadFaultFiles() });
    expect(run.status).toBe('ok');
    expect(run.report?.stagesRun).toBe('load');
    expect(run.report?.ships).toEqual([
      { id: 'TEST-PT-01', empire: 'Federation', pass: false, stage_failed: 'geometry', error: 'loader.degenerateBounds' },
      { id: 'TEST-LN-02', empire: 'Klingon', pass: false, stage_failed: 'geometry', error: 'loader.degenerateBounds' },
      { id: 'TEST-NF-03', empire: 'Romulan', pass: false, stage_failed: 'geometry', error: 'loader.nonFinitePosition' },
    ]);
    expect(JSON.stringify(run.report)).not.toMatch(/\.mod\b|\.bmp\b|Assets\/|\\/);
  });

  it('requires vertex and index counts, finite positions, a real box, and a decoded material', async () => {
    const files = syntheticViewerFiles();
    const good = files.find((file) => file.path.endsWith('Good.mod'));
    expect(good).toBeDefined();
    const parsed = parseMod(await good!.read(), { file: 'Assets/Models/test/Good.mod' });
    const built = await buildShipMesh(parsed.data, {
      vfs: createVfs(files),
      modelPath: 'Assets/Models/test/Good.mod',
    });
    expect(geometryFault(built.data)).toBeNull();
    expect(assemblyFault(hull(built.data))).toBeNull();
    const mesh = built.data.lods[0]?.children[0];
    expect(mesh).toBeInstanceOf(Mesh);
    const geometry = (mesh as Mesh).geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    expect(position.count).toBeGreaterThan(0);
    expect(index?.count).toBeGreaterThan(0);
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true);
      expect(Number.isFinite(position.getY(i))).toBe(true);
      expect(Number.isFinite(position.getZ(i))).toBe(true);
    }
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box).not.toBeNull();
    const span = [box!.max.x - box!.min.x, box!.max.y - box!.min.y, box!.max.z - box!.min.z].filter((axis) => axis > 0);
    expect(span.length).toBeGreaterThanOrEqual(2);
    const material = built.data.materials[0] as MeshLambertMaterial;
    expect(material).toBeInstanceOf(MeshLambertMaterial);
    expect(textureReady(material.map)).toBe(true);
    expect(textureReady(material.emissiveMap)).toBe(true);

    const broken = hull(built.data);
    const map = material.map as Texture;
    map.image = { width: 0, height: 0, data: new Uint8Array() };
    expect(assemblyFault(broken)).toEqual({ stage: 'texture', error: 'bmp.undecoded' });
    material.map = null;
    const glow = material.emissiveMap as Texture;
    glow.image = { width: 2, height: 2, data: new Uint8Array(16) };
    expect(assemblyFault(broken)).toBeNull();
    glow.image = { width: 0, height: 0, data: new Uint8Array() };
    expect(assemblyFault(broken)).toEqual({ stage: 'selfIllum', error: 'bmp.undecoded' });
  });

  it('rejects an empty index, a NaN buffer, and a collapsed box', () => {
    const flat = new BufferGeometry();
    flat.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    flat.setIndex(new Uint16BufferAttribute([0, 1, 2], 1));
    expect(geometryFault(wrap(flat))).toBeNull();

    const emptyIndex = new BufferGeometry();
    emptyIndex.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    emptyIndex.setIndex(new Uint16BufferAttribute([], 1));
    expect(geometryFault(wrap(emptyIndex))).toBe('loader.emptyGeometry');

    const nan = new BufferGeometry();
    nan.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, Number.NaN, 0], 3));
    expect(geometryFault(wrap(nan))).toBe('loader.nonFinitePosition');

    const marked = new BufferGeometry();
    marked.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    marked.userData = { sfc2NonFinitePositions: 1 };
    expect(geometryFault(wrap(marked))).toBe('loader.nonFinitePosition');

    const point = new BufferGeometry();
    point.setAttribute('position', new Float32BufferAttribute([1, 2, 3, 1, 2, 3, 1, 2, 3], 3));
    expect(geometryFault(wrap(point))).toBe('loader.degenerateBounds');

    const line = new BufferGeometry();
    line.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 0, 0], 3));
    expect(geometryFault(wrap(line))).toBe('loader.degenerateBounds');

    expect(geometryFault({ root: new Group(), lods: [new Group()], attachments: [], materials: [] })).toBe('loader.emptyGeometry');
  });

  it('keeps Playwright and Chromium off the load path and the load workflow', async () => {
    const loadSource = await readFile(new URL('./load.ts', import.meta.url), 'utf8');
    const assessSource = await readFile(new URL('./assess.ts', import.meta.url), 'utf8');
    const cliSource = await readFile(new URL('./cli.ts', import.meta.url), 'utf8');
    expect(importLines(loadSource)).not.toMatch(/playwright|chromium|vite/i);
    expect(importLines(assessSource)).not.toMatch(/playwright|chromium|vite/i);
    expect(cliSource).toMatch(/stages === 'load'[\s\S]*import\('\.\/load\.ts'\)/);
    expect(cliSource).toMatch(/import\('\.\/run\.ts'\)/);
    const loadImport = cliSource.indexOf("import('./load.ts')");
    const fullImport = cliSource.indexOf("import('./run.ts')");
    expect(loadImport).toBeGreaterThan(0);
    expect(fullImport).toBeGreaterThan(loadImport);

    const workflow = await readFile(new URL('../../.github/workflows/private-viewer-check.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('default: load');
    expect(workflow).toMatch(/options:\n\s+- load\n\s+- full/);
    expect(workflow).toContain('--stages="$VIEWER_STAGES"');
    const installAt = workflow.indexOf('pnpm exec playwright install --with-deps chromium');
    expect(installAt).toBeGreaterThan(0);
    expect(workflow.indexOf('pnpm exec playwright install', installAt + 1)).toBe(-1);
    expect(workflow.slice(installAt - 180, installAt)).toContain("if: inputs.stages == 'full'");

    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'tools/viewer-check/cli.ts', '--stages=load', '--synthetic'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          NODE_DEBUG: 'module',
        },
      },
    );
    expect(result.status, result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as { stagesRun: string; totals: { rows: number } };
    expect(report.stagesRun).toBe('load');
    expect(report.totals.rows).toBe(8);
    expect(result.stderr).not.toMatch(/@playwright|playwright-core|playwright\/test|chromium/i);
  });
});

function importLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line) || /\bimport\(/.test(line))
    .join('\n');
}

function wrap(geometry: BufferGeometry): BuiltShipMesh {
  const material = new MeshLambertMaterial();
  const mesh = new Mesh(geometry, material);
  const lod = new Group();
  lod.add(mesh);
  const root = new Group();
  root.add(lod);
  return { root, lods: [lod], attachments: [], materials: [material] };
}

function hull(mesh: BuiltShipMesh): LoadedShip {
  return {
    spawnKey: 'Federation:TEST-CA-01',
    line: 3,
    hullType: 'CA',
    geometry: 'Assets/Models/test/Good.mod',
    mesh,
    textured: true,
    selfIlluminated: true,
    placeholder: false,
    diagnostics: [],
  };
}

function textureReady(texture: { image?: unknown } | null): boolean {
  const image = texture?.image as { width?: number; height?: number; data?: { length?: number } } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  return width > 0 && height > 0 && (image?.data?.length ?? 0) >= width * height * 4;
}
