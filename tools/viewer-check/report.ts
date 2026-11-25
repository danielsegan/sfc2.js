/**
 * JSON summary for the headless ship viewer check.
 *
 * The report is ship ids, empires, pass/fail, the stage that failed, and
 * an error class. It does not carry paths, file bytes, or pixels.
 */

import { machinePathLeak } from '../formats/src/diagnostic.ts';
import { TEXTURE_MISS_CLASSES, type TextureMissClass } from '../../engine/render/src/texture-resolve.ts';

export { TEXTURE_MISS_CLASSES, type TextureMissClass };

export const STAGES = ['resolve', 'geometry', 'texture', 'selfIllum', 'render'] as const;
export type Stage = (typeof STAGES)[number];

export const RENDER_ERRORS = [
  'render.emptyFrame',
  'render.unchanged',
  'render.glError',
  'render.noWebGL',
  'render.failed',
] as const;
export type RenderError = (typeof RENDER_ERRORS)[number];

export const SKIP_REASONS = ['noHullModel', 'degenerate', 'unpaintable', 'symmetric'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export interface ShipResult {
  id: string;
  empire: string;
  pass: boolean;
  stage_failed: Stage | null;
  error: string | null;
  /** Expected non-ship, or a model with nothing to spin. Not a failure. */
  skip?: true;
  /** Why the row was skipped. Present only when `skip` is set. */
  skipReason?: SkipReason;
  /** Placeholder textures on a row that still passed. */
  warnings?: number;
  /** Class counts for those placeholder warnings. Sums to `warnings`. */
  textureMisses?: Partial<Record<TextureMissClass, number>>;
}

export interface ViewerCheckTotals {
  rows: number;
  passed: number;
  failed: number;
  skipped: number;
  warnings: number;
  /** Skip reasons. Sums to `skipped`. */
  skips: Record<SkipReason, number>;
  /** Placeholder-warning classes on rows that passed. Sums to `warnings`. */
  textureMisses: Record<TextureMissClass, number>;
  byStage: Record<Stage, number>;
  elapsedMs: number;
}

export interface ViewerCheckReport {
  ships: ShipResult[];
  totals: ViewerCheckTotals;
}

export interface DiagnosticSnap {
  source: string;
  code: string;
  severity: string;
  which?: 'diffuse' | 'luminance';
  miss?: TextureMissClass;
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
 * An empty luminance name is not a failure. A texture that is still
 * missing after the install search is `texturePlaceholder`, a warning.
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
  const misses = emptyMisses();
  for (const item of input.diagnostics) {
    const reason = `${item.source}.${item.code}`;
    if (reason === 'bmp.texturePlaceholder') {
      misses[item.miss ?? 'missingFile'] += 1;
      continue;
    }
    if (reason === 'mod.missingTextureName' && item.which === 'luminance') continue;
    if (item.severity === 'error') {
      return fail(identity, stageForLoadedError(reason, input), reason);
    }
    if (reason === 'mod.textureNameRejected') return fail(identity, 'texture', reason);
    if (reason === 'mod.missingTextureName') return fail(identity, 'texture', reason);
  }
  if (!input.placeholder && input.unboundSelfIllum) return fail(identity, 'selfIllum', 'bmp.selfIllumUnbound');
  return passedResult(identity, misses);
}

/** A known non-ship, or a model with no paintable surface. */
export function skippedResult(spawnKey: string, skipReason: SkipReason = 'noHullModel'): ShipResult {
  const identity = shipIdentity(spawnKey);
  return { ...identity, pass: true, stage_failed: null, error: null, skip: true, skipReason };
}

const RENDER_SKIPS = ['degenerate', 'unpaintable', 'symmetric'] as const;
export type RenderSkip = (typeof RENDER_SKIPS)[number];

export function gradeRenderedShip(loaded: ShipResult, outcome: RenderError | RenderSkip | null): ShipResult {
  if (!loaded.pass) return loaded;
  if (outcome === 'degenerate' || outcome === 'unpaintable' || outcome === 'symmetric') {
    return {
      id: loaded.id,
      empire: loaded.empire,
      pass: true,
      stage_failed: null,
      error: null,
      skip: true,
      skipReason: outcome,
    };
  }
  if (outcome === null) return loaded;
  return withRenderError(loaded, outcome);
}

export function withRenderError(result: ShipResult, error: RenderError): ShipResult {
  return { id: result.id, empire: result.empire, pass: false, stage_failed: 'render', error };
}

export function totalsFor(ships: readonly ShipResult[], elapsedMs: number): ViewerCheckTotals {
  const byStage = emptyStages();
  const skips = emptySkips();
  const textureMisses = emptyMisses();
  let passed = 0;
  let skipped = 0;
  let warnings = 0;
  for (const ship of ships) {
    if (ship.skip === true) {
      skipped += 1;
      if (ship.skipReason !== undefined) skips[ship.skipReason] += 1;
      continue;
    }
    if (ship.pass) {
      passed += 1;
      warnings += ship.warnings ?? 0;
      addMisses(textureMisses, ship.textureMisses);
    } else if (ship.stage_failed) byStage[ship.stage_failed] += 1;
  }
  return {
    rows: ships.length,
    passed,
    failed: ships.length - passed - skipped,
    skipped,
    warnings,
    skips,
    textureMisses,
    byStage,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
  };
}

export function buildReport(ships: readonly ShipResult[], elapsedMs: number): ViewerCheckReport {
  return { ships: ships.map((ship) => ({ ...ship })), totals: totalsFor(ships, elapsedMs) };
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

export interface ViewerPublicSummary {
  result: 'pass' | 'fail';
  totals: ViewerCheckTotals;
  errors: Array<{ class: string; count: number }>;
}

/** Totals and error classes. Ship ids and empires stay out of logs and artifacts. */
export function publicSummary(report: ViewerCheckReport): ViewerPublicSummary {
  const counts = new Map<string, number>();
  for (const ship of report.ships) {
    if (ship.pass || ship.error === null) continue;
    counts.set(ship.error, (counts.get(ship.error) ?? 0) + 1);
  }
  return {
    result: report.totals.failed === 0 && report.totals.rows > 0 ? 'pass' : 'fail',
    totals: report.totals,
    errors: [...counts.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([cls, count]) => ({ class: cls, count })),
  };
}

export function formatPublicSummary(summary: ViewerPublicSummary): string {
  const totals = summary.totals;
  const lines = [
    `viewer result=${summary.result} rows=${totals.rows} passed=${totals.passed} failed=${totals.failed} skipped=${totals.skipped} warnings=${totals.warnings}`,
  ];
  if (summary.errors.length === 0) lines.push('viewer errors=0');
  for (const item of summary.errors) lines.push(`viewer class=${item.class} count=${item.count}`);
  for (const reason of SKIP_REASONS) lines.push(`viewer skip=${reason} count=${totals.skips[reason]}`);
  for (const miss of TEXTURE_MISS_CLASSES) lines.push(`viewer textureMiss=${miss} count=${totals.textureMisses[miss]}`);
  return lines.join('\n');
}

export function inspectPublicSummary(value: unknown): { summary: ViewerPublicSummary | null; problem: string | null } {
  if (!isRecord(value)) return { summary: null, problem: 'shape' };
  if ('ships' in value || 'id' in value || 'empire' in value) return { summary: null, problem: 'leak' };
  if (!exactKeys(value, ['result', 'totals', 'errors'])) return { summary: null, problem: 'shape' };
  if (value.result !== 'pass' && value.result !== 'fail') return { summary: null, problem: 'shape' };
  if (machinePathLeak(value) !== null) return { summary: null, problem: 'leak' };
  if (!isRecord(value.totals)) return { summary: null, problem: 'shape' };
  const totals = asTotals(value.totals, countOf(value.totals, 'rows'));
  if (totals === null) return { summary: null, problem: 'shape' };
  if (!Array.isArray(value.errors)) return { summary: null, problem: 'shape' };
  for (const item of value.errors) {
    if (!isRecord(item) || !exactKeys(item, ['class', 'count'])) return { summary: null, problem: 'shape' };
    if (typeof item.class !== 'string' || !ERROR_CODE.test(item.class) || !isCount(item.count) || item.count < 1) {
      return { summary: null, problem: 'shape' };
    }
  }
  return { summary: { result: value.result, totals, errors: value.errors as ViewerPublicSummary['errors'] }, problem: null };
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

function emptySkips(): Record<SkipReason, number> {
  return { noHullModel: 0, degenerate: 0, unpaintable: 0, symmetric: 0 };
}

function emptyMisses(): Record<TextureMissClass, number> {
  return { missingFile: 0, unsupportedExtension: 0, differentEmpire: 0, unusualName: 0, decodeFailed: 0 };
}

function passedResult(
  identity: { id: string; empire: string },
  misses: Record<TextureMissClass, number>,
): ShipResult {
  const warnings = sumRecord(misses, TEXTURE_MISS_CLASSES);
  const textureMisses = sparseMisses(misses);
  return {
    ...identity,
    pass: true,
    stage_failed: null,
    error: null,
    ...(warnings > 0 && textureMisses !== undefined ? { warnings, textureMisses } : {}),
  };
}

function sparseMisses(misses: Record<TextureMissClass, number>): Partial<Record<TextureMissClass, number>> | undefined {
  const out: Partial<Record<TextureMissClass, number>> = {};
  let any = false;
  for (const key of TEXTURE_MISS_CLASSES) {
    const count = misses[key];
    if (count > 0) {
      out[key] = count;
      any = true;
    }
  }
  return any ? out : undefined;
}

function addMisses(into: Record<TextureMissClass, number>, from: Partial<Record<TextureMissClass, number>> | undefined): void {
  if (from === undefined) return;
  for (const key of TEXTURE_MISS_CLASSES) into[key] += from[key] ?? 0;
}

function sumMisses(misses: Partial<Record<TextureMissClass, number>>): number {
  return TEXTURE_MISS_CLASSES.reduce((sum, key) => sum + (misses[key] ?? 0), 0);
}

function sumRecord<Key extends string>(record: Record<Key, number>, keys: readonly Key[]): number {
  return keys.reduce((sum, key) => sum + record[key], 0);
}

function sameCounts<Key extends string>(
  left: Record<Key, number>,
  right: Record<Key, number>,
  keys: readonly Key[],
): boolean {
  return keys.every((key) => left[key] === right[key]);
}

function totalsMatch(report: ViewerCheckReport): boolean {
  const again = totalsFor(report.ships, report.totals.elapsedMs);
  if (
    again.rows !== report.totals.rows ||
    again.passed !== report.totals.passed ||
    again.failed !== report.totals.failed ||
    again.skipped !== report.totals.skipped ||
    again.warnings !== report.totals.warnings
  ) {
    return false;
  }
  if (again.elapsedMs !== report.totals.elapsedMs) return false;
  if (!sameCounts(again.skips, report.totals.skips, SKIP_REASONS)) return false;
  if (!sameCounts(again.textureMisses, report.totals.textureMisses, TEXTURE_MISS_CLASSES)) return false;
  return STAGES.every((stage) => again.byStage[stage] === report.totals.byStage[stage]);
}

function asReport(value: unknown): ViewerCheckReport | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, ['ships', 'totals'])) return null;
  if (!Array.isArray(value.ships)) return null;
  const ships: ShipResult[] = [];
  for (const item of value.ships) {
    const ship = asShip(item);
    if (ship === null) return null;
    ships.push(ship);
  }
  const totals = asTotals(value.totals, ships.length);
  if (totals === null) return null;
  return { ships, totals };
}

function asShip(value: unknown): ShipResult | null {
  if (!isRecord(value)) return null;
  const allowed = new Set(['id', 'empire', 'pass', 'stage_failed', 'error', 'skip', 'skipReason', 'warnings', 'textureMisses']);
  const keys = Object.keys(value);
  if (keys.length < 5 || keys.some((key) => !allowed.has(key))) return null;
  for (const key of ['id', 'empire', 'pass', 'stage_failed', 'error']) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return null;
  }
  if (typeof value.id !== 'string' || typeof value.empire !== 'string') return null;
  if (value.id.length === 0 || value.id.length > ID_MAX || value.empire.length > ID_MAX) return null;
  if (typeof value.pass !== 'boolean') return null;
  let skip = false;
  if ('skip' in value) {
    if (value.skip !== true) return null;
    skip = true;
  }
  let skipReason: SkipReason | undefined;
  if ('skipReason' in value) {
    if (!isSkipReason(value.skipReason)) return null;
    skipReason = value.skipReason;
  }
  if (skip !== (skipReason !== undefined)) return null;
  let warnings: number | undefined;
  if ('warnings' in value) {
    if (!isCount(value.warnings) || value.warnings < 1) return null;
    warnings = value.warnings;
  }
  let textureMisses: Partial<Record<TextureMissClass, number>> | undefined;
  if ('textureMisses' in value) {
    const parsed = asMissCounts(value.textureMisses);
    if (parsed === null) return null;
    textureMisses = parsed;
  }
  if ((warnings === undefined) !== (textureMisses === undefined)) return null;
  if (warnings !== undefined && textureMisses !== undefined && sumMisses(textureMisses) !== warnings) return null;
  if (skip && (warnings !== undefined || textureMisses !== undefined)) return null;
  if (value.pass) {
    if (value.stage_failed !== null || value.error !== null) return null;
    return {
      id: value.id,
      empire: value.empire,
      pass: true,
      stage_failed: null,
      error: null,
      ...(skip && skipReason !== undefined ? { skip: true as const, skipReason } : {}),
      ...(warnings !== undefined && textureMisses !== undefined ? { warnings, textureMisses } : {}),
    };
  }
  if (skip || warnings !== undefined || textureMisses !== undefined) return null;
  if (!isStage(value.stage_failed)) return null;
  if (typeof value.error !== 'string' || !ERROR_CODE.test(value.error) || value.error.length > ID_MAX) return null;
  return { id: value.id, empire: value.empire, pass: false, stage_failed: value.stage_failed, error: value.error };
}

function asTotals(value: unknown, rows: number): ViewerCheckTotals | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, ['rows', 'passed', 'failed', 'skipped', 'warnings', 'skips', 'textureMisses', 'byStage', 'elapsedMs'])) {
    return null;
  }
  if (
    !isCount(value.rows) ||
    !isCount(value.passed) ||
    !isCount(value.failed) ||
    !isCount(value.skipped) ||
    !isCount(value.warnings) ||
    !isCount(value.elapsedMs)
  ) {
    return null;
  }
  if (value.rows !== rows || value.passed + value.failed + value.skipped !== rows) return null;
  if (!isRecord(value.byStage) || !exactKeys(value.byStage, STAGES)) return null;
  const byStage = emptyStages();
  for (const stage of STAGES) {
    const count = value.byStage[stage];
    if (!isCount(count)) return null;
    byStage[stage] = count;
  }
  const skips = asCountRecord(value.skips, SKIP_REASONS);
  const textureMisses = asCountRecord(value.textureMisses, TEXTURE_MISS_CLASSES);
  if (skips === null || textureMisses === null) return null;
  if (sumRecord(skips, SKIP_REASONS) !== value.skipped) return null;
  if (sumRecord(textureMisses, TEXTURE_MISS_CLASSES) !== value.warnings) return null;
  return {
    rows: value.rows,
    passed: value.passed,
    failed: value.failed,
    skipped: value.skipped,
    warnings: value.warnings,
    skips,
    textureMisses,
    byStage,
    elapsedMs: value.elapsedMs,
  };
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

function isSkipReason(value: unknown): value is SkipReason {
  return typeof value === 'string' && (SKIP_REASONS as readonly string[]).includes(value);
}

function isMissClass(value: unknown): value is TextureMissClass {
  return typeof value === 'string' && (TEXTURE_MISS_CLASSES as readonly string[]).includes(value);
}

function asMissCounts(value: unknown): Partial<Record<TextureMissClass, number>> | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !isMissClass(key))) return null;
  const out: Partial<Record<TextureMissClass, number>> = {};
  for (const key of keys) {
    if (!isMissClass(key)) return null;
    const count = value[key];
    if (!isCount(count) || count < 1) return null;
    out[key] = count;
  }
  return out;
}

function asCountRecord<Key extends string>(value: unknown, keys: readonly Key[]): Record<Key, number> | null {
  if (!isRecord(value) || !exactKeys(value, keys)) return null;
  const out = {} as Record<Key, number>;
  for (const key of keys) {
    const count = value[key];
    if (!isCount(count)) return null;
    out[key] = count;
  }
  return out;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;
}

function countOf(value: Record<string, unknown>, key: string): number {
  const count = value[key];
  return isCount(count) ? count : -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  const got = Object.keys(value);
  return got.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
