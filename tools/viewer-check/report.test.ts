import { describe, expect, it } from 'vitest';
import { parseArgs } from './cli.ts';
import {
  buildReport,
  failureResult,
  formatPublicSummary,
  gradeRenderedShip,
  inspectPublicSummary,
  inspectReport,
  loadedResult,
  publicSummary,
  shipIdentity,
  skippedResult,
  totalsFor,
  withRenderError,
} from './report.ts';

describe('viewer check summary', () => {
  it('maps catalog failures onto resolve and geometry', () => {
    expect(failureResult('Klingon:TEST-CL-02', 'loader.missingModel')).toEqual({
      id: 'TEST-CL-02',
      empire: 'Klingon',
      pass: false,
      stage_failed: 'resolve',
      error: 'loader.missingModel',
    });
    expect(failureResult('Gorn:TEST-FF-04', 'shiplist.missingGeometry').stage_failed).toBe('resolve');
    expect(failureResult('Hydran:TEST-CA-06', 'mod.modelPathRejected').stage_failed).toBe('resolve');
    expect(failureResult('Romulan:TEST-DN-03', 'mod.badSignature')).toMatchObject({
      stage_failed: 'geometry',
      error: 'mod.badSignature',
    });
    expect(failureResult('ISC:TEST-CA-08', 'loader.noDrawableMesh').stage_failed).toBe('geometry');
    expect(failureResult('', 'importer.installNotRecognized')).toMatchObject({ id: 'install', empire: '', stage_failed: 'resolve' });
  });

  it('drops machine paths out of the ship id', () => {
    expect(shipIdentity('Hydran:C:/Games/Nope.mod')).toEqual({ id: 'row', empire: 'Hydran' });
    expect(shipIdentity('Federation:TEST-CA-01')).toEqual({ id: 'TEST-CA-01', empire: 'Federation' });
  });

  it('fails a loaded hull when a named map did not bind', () => {
    const clean = loadedResult({
      spawnKey: 'Federation:TEST-CA-01',
      placeholder: false,
      textured: true,
      selfIlluminated: true,
      unboundSelfIllum: false,
      diagnostics: [{ source: 'mod', code: 'lodCountMismatch', severity: 'warning' }],
    });
    expect(clean).toMatchObject({ pass: true, stage_failed: null, error: null });

    expect(
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: false,
        selfIlluminated: false,
        unboundSelfIllum: false,
        diagnostics: [{ source: 'bmp', code: 'missingTexture', severity: 'error' }],
      }).stage_failed,
    ).toBe('texture');

    expect(
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: true,
        selfIlluminated: false,
        unboundSelfIllum: false,
        diagnostics: [{ source: 'bmp', code: 'missingTexture', severity: 'error' }],
      }),
    ).toMatchObject({ stage_failed: 'selfIllum', error: 'bmp.missingTexture' });

    expect(
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: true,
        selfIlluminated: false,
        unboundSelfIllum: true,
        diagnostics: [],
      }).error,
    ).toBe('bmp.selfIllumUnbound');

    expect(
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: true,
        selfIlluminated: false,
        unboundSelfIllum: false,
        diagnostics: [{ source: 'mod', code: 'missingTextureName', severity: 'warning', which: 'luminance' }],
      }),
    ).toMatchObject({ pass: true, stage_failed: null, error: null });

    expect(
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: false,
        selfIlluminated: false,
        unboundSelfIllum: false,
        diagnostics: [{ source: 'mod', code: 'missingTextureName', severity: 'warning', which: 'diffuse' }],
      }).stage_failed,
    ).toBe('texture');

    expect(
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: false,
        selfIlluminated: false,
        unboundSelfIllum: false,
        diagnostics: [{ source: 'bmp', code: 'texturePlaceholder', severity: 'warning', which: 'diffuse' }],
      }),
    ).toEqual({
      id: 'TEST-CA-01',
      empire: 'Federation',
      pass: true,
      stage_failed: null,
      error: null,
      warnings: 1,
    });

    expect(
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: false,
        selfIlluminated: false,
        unboundSelfIllum: false,
        diagnostics: [{ source: 'mod', code: 'textureNameRejected', severity: 'warning' }],
      }).stage_failed,
    ).toBe('texture');
  });

  it('lets a placeholder with no maps pass the load stages', () => {
    const result = loadedResult({
      spawnKey: 'Neutral:TEST-CY-01',
      placeholder: true,
      textured: false,
      selfIlluminated: false,
      unboundSelfIllum: false,
      diagnostics: [{ source: 'loader', code: 'noHullModel', severity: 'warning' }],
    });
    expect(result.pass).toBe(true);
    expect(withRenderError(result, 'render.emptyFrame')).toMatchObject({
      pass: false,
      stage_failed: 'render',
      error: 'render.emptyFrame',
    });
  });

  it('rejects a summary that carries a path or disagrees with its totals', () => {
    const ships = [
      failureResult('Klingon:TEST-CL-02', 'loader.missingModel'),
      loadedResult({
        spawnKey: 'Federation:TEST-CA-01',
        placeholder: false,
        textured: true,
        selfIlluminated: true,
        unboundSelfIllum: false,
        diagnostics: [],
      }),
    ];
    const report = buildReport(ships, 12.4);
    expect(inspectReport(report).problem).toBeNull();
    expect(report.totals).toEqual({
      rows: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      warnings: 0,
      byStage: { resolve: 1, geometry: 0, texture: 0, selfIllum: 0, render: 0 },
      elapsedMs: 12,
    });
    expect(totalsFor(ships, 12.4).elapsedMs).toBe(12);

    const leaked = { ...report, ships: [{ ...report.ships[0], id: 'C:/Games/Nope' }, report.ships[1]] };
    expect(inspectReport(leaked).problem).toBe('leak');

    const extra = { ...report, note: 'Assets/Models/test/Good.mod' };
    expect(inspectReport(extra).problem).toBe('shape');

    const mismatch = {
      ...report,
      totals: { ...report.totals, byStage: { ...report.totals.byStage, resolve: 0 } },
    };
    expect(inspectReport(mismatch).problem).toBe('mismatch');
    expect(inspectReport(buildReport([], 0)).problem).toBe('empty');

    const summary = publicSummary(report);
    const text = JSON.stringify(summary);
    expect(text).not.toContain('TEST-CL-02');
    expect(text).not.toContain('Klingon');
    expect(text).not.toContain('Federation');
    expect(summary.errors).toEqual([{ class: 'loader.missingModel', count: 1 }]);
    expect(summary.result).toBe('fail');
    expect(formatPublicSummary(summary)).toContain('skipped=0');
    expect(formatPublicSummary(summary)).toContain('warnings=0');
    expect(formatPublicSummary(summary)).not.toContain('TEST-CL-02');
    expect(inspectPublicSummary(summary).problem).toBeNull();
    expect(inspectPublicSummary({ ...summary, ships: report.ships }).problem).toBe('leak');
  });

  it('counts skipped rows and placeholder warnings without failing the gate', () => {
    const warned = loadedResult({
      spawnKey: 'Lyran:TEST-MISS',
      placeholder: false,
      textured: false,
      selfIlluminated: false,
      unboundSelfIllum: false,
      diagnostics: [
        { source: 'bmp', code: 'texturePlaceholder', severity: 'warning', which: 'diffuse' },
        { source: 'bmp', code: 'texturePlaceholder', severity: 'warning', which: 'luminance' },
      ],
    });
    const skipped = skippedResult('Neutral:CY');
    const degenerate = gradeRenderedShip(
      loadedResult({
        spawnKey: 'Neutral:TEST-DUMMY',
        placeholder: false,
        textured: false,
        selfIlluminated: false,
        unboundSelfIllum: false,
        diagnostics: [],
      }),
      'degenerate',
    );
    const stillMissing = failureResult('Orion:TEST-STILL', 'loader.missingModel');
    const report = buildReport([skipped, warned, degenerate, stillMissing], 4);
    expect(report.totals).toMatchObject({
      rows: 4,
      passed: 1,
      failed: 1,
      skipped: 2,
      warnings: 2,
      byStage: { resolve: 1, geometry: 0, texture: 0, selfIllum: 0, render: 0 },
    });
    expect(inspectReport(report).problem).toBeNull();
    expect(publicSummary(report).result).toBe('fail');
    expect(publicSummary(report).errors).toEqual([{ class: 'loader.missingModel', count: 1 }]);
    const text = JSON.stringify(publicSummary(report));
    expect(text).not.toContain('TEST-DUMMY');
    expect(text).not.toContain('Neutral');

    const passed = buildReport([skipped, warned], 1);
    expect(publicSummary(passed).result).toBe('pass');
    expect(inspectReport({ ...report, ships: [{ ...skipped, warnings: 1 }] }).problem).toBe('shape');
  });

  it('parses the cli flags', () => {
    expect(parseArgs(['--synthetic', '--frames', '4'])).toMatchObject({ synthetic: true, frames: 4, allowFailures: false });
    expect(parseArgs(['--summary', 'verify-output/viewer-check.json', '--allow-failures'])).toMatchObject({
      summary: 'verify-output/viewer-check.json',
      allowFailures: true,
    });
    expect(() => parseArgs(['--frames', '1'])).toThrow(/--frames/);
    expect(() => parseArgs(['--install'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--nope'])).toThrow(/unknown argument/);
  });
});
