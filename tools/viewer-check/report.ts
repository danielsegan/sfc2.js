/**
 * JSON summary for the headless ship viewer check.
 *
 * The report is ship ids, empires, pass/fail, the stage that failed, and
 * an error class, plus which stage set ran. It does not carry paths, file
 * bytes, or pixels.
 */

import { machinePathLeak } from '../formats/src/diagnostic.ts';

export const STAGES = ['resolve', 'geometry', 'texture', 'selfIllum', 'render'] as const;
export type Stage = (typeof STAGES)[number];

/** `load` stops before the GPU. `full` also renders in headless Chromium. */
export const STAGE_RUNS = ['load', 'full'] as const;
export type StagesRun = (typeof STAGE_RUNS)[number];

export function isStagesRun(value: string): value is StagesRun {
  return (STAGE_RUNS as readonly string[]).includes(value);
}

export const RENDER_ERRORS = [
  'render.emptyFrame',
  'render.unchanged',
  'render.glError',
  'render.noWebGL',
  'render.failed',
] as const;
export type RenderError = (typeof RENDER_ERRORS)[number];

export interface ShipResult {
  id: string;
  empire: string;
  pass: boolean;
  stage_failed: Stage | null;
  error: string | null;
}

export interface ViewerCheckTotals {
  rows: number;
  passed: number;
  failed: number;
  byStage: Record<Stage, number>;
  elapsedMs: number;
}

export interface ViewerCheckReport {
  stagesRun: StagesRun;
  ships: ShipResult[];
  totals: ViewerCheckTotals;
}

export interface DiagnosticSnap {
  source: string;
  code: string;
  severity: string;
  which?: 'diffuse' | 'luminance';
}

const ERROR_CODE = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;
const ID_MAX = 80;

const RESOLVE_REASONS = new Set([
  'shiplist.missingGeometry',
  'mod.modelPathRejected',
  'loader.missingModel',
  'importer.permissionDenied',
  'importer.missingShiplist',
  'importer.installNotRecognized',
  'loader.geometryColumnMissing',
  'loader.shipLoadFailed',
]);

export function shipIdentity(spawnKey: string): { id: string; empire: string } {
  const colon = spawnKey.indexOf(':');
  if (colon < 0) {
    const id = clipToken(spawnKey);
    return { id: id.length > 0 ? id : 'install', empire: '' };
  }
  const empire = clipToken(spawnKey.slice(0, colon));
  const id = clipToken(spawnKey.slice(colon + 1));
  return { id: id.length > 0 ? id : 'row', empire };
}

/** A shiplist row the catalog rejected before it had a mesh. */
export function failureResult(spawnKey: string, reason: string): ShipResult {
  const identity = shipIdentity(spawnKey);
  return {
    ...identity,
    pass: false,
    stage_failed: stageForCatalogFailure(reason),
    error: cleanError(reason),
  };
}

/**
 * Load stages for a hull that produced a mesh. A pass here still has to
 * render. Texture and self-illum fail when a named map did not bind.
 */
export function loadedResult(input: {
  spawnKey: string;
  placeholder: boolean;
  textured: boolean;
  selfIlluminated: boolean;
  unboundSelfIllum: boolean;
  diagnostics: readonly DiagnosticSnap[];
}): ShipResult {
  const identity = shipIdentity(input.spawnKey);
  for (const item of input.diagnostics) {
    const reason = `${item.source}.${item.code}`;
    if (item.severity === 'error') {
      return fail(identity, stageForLoadedError(reason, input), reason);
    }
    if (reason === 'mod.textureNameRejected') return fail(identity, 'texture', reason);
    if (reason === 'mod.missingTextureName') {
      return fail(identity, item.which === 'luminance' ? 'selfIllum' : 'texture', reason);
    }
  }
  if (!input.placeholder && input.unboundSelfIllum) return fail(identity, 'selfIllum', 'bmp.selfIllumUnbound');
  return { ...identity, pass: true, stage_failed: null, error: null };
}

export function withRenderError(result: ShipResult, error: RenderError): ShipResult {
  return { ...result, pass: false, stage_failed: 'render', error };
}

export function totalsFor(ships: readonly ShipResult[], elapsedMs: number): ViewerCheckTotals {
  const byStage = emptyStages();
  let passed = 0;
  for (const ship of ships) {
    if (ship.pass) passed += 1;
    else if (ship.stage_failed) byStage[ship.stage_failed] += 1;
  }
  return {
    rows: ships.length,
    passed,
    failed: ships.length - passed,
    byStage,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
  };
}

export function buildReport(ships: readonly ShipResult[], elapsedMs: number, stagesRun: StagesRun): ViewerCheckReport {
  return { stagesRun, ships: ships.map((ship) => ({ ...ship })), totals: totalsFor(ships, elapsedMs) };
}

/**
 * `shape`, `leak`, `mismatch`, or `empty` when the value must not be
 * uploaded. Null when the summary is safe to keep.
 */
export function inspectReport(value: unknown): { report: ViewerCheckReport | null; problem: string | null } {
  const report = asReport(value);
  if (report === null) return { report: null, problem: 'shape' };
  if (machinePathLeak(report) !== null) return { report: null, problem: 'leak' };
  if (!totalsMatch(report)) return { report: null, problem: 'mismatch' };
  if (report.totals.rows === 0) return { report, problem: 'empty' };
  return { report, problem: null };
}

function stageForCatalogFailure(reason: string): Stage {
  if (RESOLVE_REASONS.has(reason)) return 'resolve';
  if (reason.startsWith('bmp.')) return 'texture';
  if (reason.startsWith('mod.') || reason === 'loader.noDrawableMesh') return 'geometry';
  return 'resolve';
}

function stageForLoadedError(
  reason: string,
  input: { textured: boolean; selfIlluminated: boolean },
): Stage {
  if (reason === 'bmp.missingTexture' || reason === 'importer.permissionDenied' || reason.startsWith('bmp.')) {
    if (input.textured && !input.selfIlluminated) return 'selfIllum';
    return 'texture';
  }
  if (reason.startsWith('mod.') || reason === 'loader.noDrawableMesh') return 'geometry';
  return 'resolve';
}

function fail(identity: { id: string; empire: string }, stage: Stage, reason: string): ShipResult {
  return { ...identity, pass: false, stage_failed: stage, error: cleanError(reason) };
}

function cleanError(reason: string): string {
  return ERROR_CODE.test(reason) ? reason : 'loader.shipLoadFailed';
}

function clipToken(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    out += ch;
    if (out.length >= ID_MAX) break;
  }
  if (out.length === 0 || machinePathLeak(out) !== null) return '';
  return out;
}

function emptyStages(): Record<Stage, number> {
  return { resolve: 0, geometry: 0, texture: 0, selfIllum: 0, render: 0 };
}

function totalsMatch(report: ViewerCheckReport): boolean {
  const again = totalsFor(report.ships, report.totals.elapsedMs);
  if (again.rows !== report.totals.rows || again.passed !== report.totals.passed || again.failed !== report.totals.failed) {
    return false;
  }
  if (again.elapsedMs !== report.totals.elapsedMs) return false;
  return STAGES.every((stage) => again.byStage[stage] === report.totals.byStage[stage]);
}

function asReport(value: unknown): ViewerCheckReport | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, ['stagesRun', 'ships', 'totals'])) return null;
  if (typeof value.stagesRun !== 'string' || !isStagesRun(value.stagesRun)) return null;
  if (!Array.isArray(value.ships)) return null;
  const ships: ShipResult[] = [];
  for (const item of value.ships) {
    const ship = asShip(item);
    if (ship === null) return null;
    ships.push(ship);
  }
  const totals = asTotals(value.totals, ships.length);
  if (totals === null) return null;
  return { stagesRun: value.stagesRun, ships, totals };
}

function asShip(value: unknown): ShipResult | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, ['id', 'empire', 'pass', 'stage_failed', 'error'])) return null;
  if (typeof value.id !== 'string' || typeof value.empire !== 'string') return null;
  if (value.id.length === 0 || value.id.length > ID_MAX || value.empire.length > ID_MAX) return null;
  if (typeof value.pass !== 'boolean') return null;
  if (value.pass) {
    if (value.stage_failed !== null || value.error !== null) return null;
    return { id: value.id, empire: value.empire, pass: true, stage_failed: null, error: null };
  }
  if (!isStage(value.stage_failed)) return null;
  if (typeof value.error !== 'string' || !ERROR_CODE.test(value.error) || value.error.length > ID_MAX) return null;
  return { id: value.id, empire: value.empire, pass: false, stage_failed: value.stage_failed, error: value.error };
}

function asTotals(value: unknown, rows: number): ViewerCheckTotals | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, ['rows', 'passed', 'failed', 'byStage', 'elapsedMs'])) return null;
  if (!isCount(value.rows) || !isCount(value.passed) || !isCount(value.failed) || !isCount(value.elapsedMs)) return null;
  if (value.rows !== rows || value.passed + value.failed !== rows) return null;
  if (!isRecord(value.byStage) || !exactKeys(value.byStage, STAGES)) return null;
  const byStage = emptyStages();
  for (const stage of STAGES) {
    const count = value.byStage[stage];
    if (!isCount(count)) return null;
    byStage[stage] = count;
  }
  return { rows: value.rows, passed: value.passed, failed: value.failed, byStage, elapsedMs: value.elapsedMs };
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  const got = Object.keys(value);
  return got.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
