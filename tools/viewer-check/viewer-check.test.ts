import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { syntheticViewerFiles } from '../../engine/render/src/synthetic-viewer-install.ts';
import { viewerFailureFiles } from '../../engine/render/src/viewer-failure-fixtures.ts';
import { runViewerCheck } from './run.ts';

describe('viewer check against the synthetic install', () => {
  it(
    'resolves, textures, binds self-illum, and renders every fixture row',
    async () => {
      const run = await runViewerCheck({ synthetic: true, frames: 3, timeoutMs: 90_000 });
      const summary = {
        status: run.status,
        pageError: run.pageError,
        ships: run.report?.ships ?? null,
        totals: run.report?.totals ?? null,
      };
      expect(summary.status, JSON.stringify(summary)).toBe('ok');
      expect(summary.pageError).toBeNull();
      expect(summary.ships).toEqual([
        { id: 'TEST-CA-01', empire: 'Federation', pass: true, stage_failed: null, error: null },
        { id: 'TEST-CL-02', empire: 'Klingon', pass: false, stage_failed: 'resolve', error: 'loader.missingModel' },
        { id: 'TEST-DN-03', empire: 'Romulan', pass: false, stage_failed: 'geometry', error: 'mod.badSignature' },
        { id: 'TEST-FF-04', empire: 'Gorn', pass: false, stage_failed: 'resolve', error: 'shiplist.missingGeometry' },
        { id: 'TEST-BS-05', empire: 'Neutral', pass: true, stage_failed: null, error: null },
        { id: 'TEST-CA-06', empire: 'Hydran', pass: false, stage_failed: 'resolve', error: 'mod.modelPathRejected' },
        { id: 'TEST-CA-07', empire: 'Lyran', pass: true, stage_failed: null, error: null },
        { id: 'TEST-CA-08', empire: 'ISC', pass: false, stage_failed: 'geometry', error: 'loader.noDrawableMesh' },
      ]);
      expect(summary.totals).toMatchObject({
        rows: 8,
        passed: 3,
        failed: 5,
        skipped: 0,
        warnings: 0,
        byStage: { resolve: 3, geometry: 2, texture: 0, selfIllum: 0, render: 0 },
      });
      expect(summary.totals?.elapsedMs).toBeGreaterThan(0);
      const text = JSON.stringify(run.report);
      expect(text).not.toMatch(/\.mod\b|\.bmp\b|Assets\/|C:|data:image|\/srv\/|\\/);
    },
    120_000,
  );

  it(
    'reads a synthetic directory the same way the private runner reads an install',
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'sfc2-viewer-'));
      try {
        for (const file of syntheticViewerFiles()) {
          const absolute = path.join(root, ...file.path.split('/'));
          await mkdir(path.dirname(absolute), { recursive: true });
          await writeFile(absolute, await file.read());
        }
        const run = await runViewerCheck({ install: root, frames: 3, timeoutMs: 90_000 });
        expect(run.status, JSON.stringify({ status: run.status, pageError: run.pageError })).toBe('ok');
        expect(run.report?.totals).toMatchObject({ rows: 8, passed: 3, failed: 5, skipped: 0, warnings: 0 });
        expect(JSON.stringify(run.report)).not.toContain(root);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    120_000,
  );

  it(
    'skips empty rows, frames a tiny hull, and warns on a texture that is really absent',
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'sfc2-viewer-fail-'));
      try {
        for (const file of viewerFailureFiles()) {
          const absolute = path.join(root, ...file.path.split('/'));
          await mkdir(path.dirname(absolute), { recursive: true });
          await writeFile(absolute, await file.read());
        }
        const run = await runViewerCheck({ install: root, frames: 3, timeoutMs: 90_000 });
        expect(run.status, JSON.stringify({ status: run.status, pageError: run.pageError, ships: run.report?.ships })).toBe('ok');
        expect(run.report?.ships).toEqual([
          { id: 'CY', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'noHullModel' },
          { id: 'CR', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'noHullModel' },
          { id: 'cw', empire: 'neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'noHullModel' },
          { id: 'TEST-CASE', empire: 'Federation', pass: true, stage_failed: null, error: null },
          { id: 'TEST-PATH', empire: 'Klingon', pass: true, stage_failed: null, error: null },
          {
            id: 'TEST-MISS',
            empire: 'Lyran',
            pass: true,
            stage_failed: null,
            error: null,
            warnings: 1,
            textureMisses: { missingFile: 1 },
          },
          { id: 'TEST-GLOW', empire: 'Hydran', pass: true, stage_failed: null, error: null },
          { id: 'TEST-TINY', empire: 'Neutral', pass: true, stage_failed: null, error: null },
          { id: 'TEST-DUMMY', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'degenerate' },
          { id: 'TEST-AXES', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'degenerate' },
          { id: 'TEST-QUAD', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'degenerate' },
          { id: 'TEST-SPECK', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'degenerate' },
          { id: 'TEST-INVIS', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'unpaintable' },
          { id: 'TEST-ALPHA', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'unpaintable' },
          { id: 'TEST-DARK', empire: 'Neutral', pass: true, stage_failed: null, error: null, skip: true, skipReason: 'unpaintable' },
          { id: 'TEST-BLEND', empire: 'Neutral', pass: true, stage_failed: null, error: null },
          {
            id: 'TEST-ODD',
            empire: 'Neutral',
            pass: true,
            stage_failed: null,
            error: null,
            warnings: 1,
            textureMisses: { unusualName: 1 },
          },
          {
            id: 'TEST-EXT',
            empire: 'Lyran',
            pass: true,
            stage_failed: null,
            error: null,
            warnings: 1,
            textureMisses: { unsupportedExtension: 1 },
          },
          {
            id: 'TEST-EMP',
            empire: 'Federation',
            pass: true,
            stage_failed: null,
            error: null,
            warnings: 1,
            textureMisses: { differentEmpire: 1 },
          },
          {
            id: 'TEST-BAD',
            empire: 'Neutral',
            pass: true,
            stage_failed: null,
            error: null,
            warnings: 1,
            textureMisses: { decodeFailed: 1 },
          },
          { id: 'TEST-BALL', empire: 'Neutral', pass: true, stage_failed: null, error: null },
          { id: 'TEST-STILL', empire: 'Orion', pass: false, stage_failed: 'resolve', error: 'loader.missingModel' },
        ]);
        const publicText = JSON.stringify({
          totals: run.report?.totals,
          errors: run.report?.ships.filter((ship) => !ship.pass).map((ship) => ship.error),
        });
        expect(publicText).not.toMatch(/glow#1|mark\.pcx|panel\.bmp|bad\.bmp|not-there|Assets\//);
        expect(run.report?.totals).toMatchObject({
          rows: 22,
          passed: 11,
          failed: 1,
          skipped: 10,
          warnings: 5,
          skips: { noHullModel: 3, degenerate: 4, unpaintable: 3, symmetric: 0 },
          textureMisses: {
            missingFile: 1,
            unsupportedExtension: 1,
            differentEmpire: 1,
            unusualName: 1,
            decodeFailed: 1,
          },
          byStage: { resolve: 1, geometry: 0, texture: 0, selfIllum: 0, render: 0 },
        });
        expect(JSON.stringify(run.report)).not.toContain(root);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
