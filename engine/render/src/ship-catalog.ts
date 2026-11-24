/**
 * Load every shiplist row into a mesh, and keep going when one fails.
 *
 * Uses the install index, parseShiplist, parseMod and buildShipMesh.
 * The Assets/Specs table is the skirmish copy. MetaAssets is used only
 * when that copy is absent. Geometry headers match the shiplist aliases.
 */

import {
  diagnostic,
  parseMod,
  parseShiplist,
  type Diagnostic,
  type ShiplistRow,
} from '@sfc2js/formats';
import { normalizeInstallPath, type ImportResult, type Vfs } from '@sfc2js/platform';
import { Mesh, type Material, type Texture } from 'three';
import { buildShipMesh, type BuiltShipMesh } from './ship-mesh.ts';
import type { RenderTier } from './ship-texture.ts';

export interface LoadedShip {
  spawnKey: string;
  line: number;
  hullType: string;
  geometry: string;
  mesh: BuiltShipMesh;
  textured: boolean;
  selfIlluminated: boolean;
  diagnostics: Diagnostic[];
}

export interface ShipFailure {
  spawnKey: string;
  line: number | null;
  /** Locale key `source.code`. */
  reason: string;
  diagnostics: Diagnostic[];
}

export interface ShipCatalog {
  tier: RenderTier;
  shiplistPath: string | null;
  ships: LoadedShip[];
  failures: ShipFailure[];
  diagnostics: Diagnostic[];
}

export interface LoadShipCatalogOptions {
  tier?: RenderTier;
  /** Called after each row so the page can paint. Absent in unit tests. */
  onProgress?: (done: number, total: number) => void;
}

const HULL_HEADERS = new Set(['hull type', 'hulltype', 'hull']);

export async function loadShipCatalog(
  imported: ImportResult,
  options?: LoadShipCatalogOptions,
): Promise<ShipCatalog> {
  const tier = options?.tier ?? 'period';
  const diagnostics: Diagnostic[] = [...imported.diagnostics];
  const vfs = imported.vfs;
  const shiplistPath = imported.shiplist.assets ?? imported.shiplist.metaassets;
  if (vfs === null || shiplistPath === null) {
    const existing =
      imported.diagnostics.find((item) => item.code === 'missingShiplist' || item.code === 'installNotRecognized') ??
      diagnostic('missingShiplist', 'importer', 'error', {
        details: { expected: 'Assets/Specs/shiplist.txt' },
        location: { file: 'Assets/Specs/shiplist.txt' },
      });
    return {
      tier,
      shiplistPath,
      ships: [],
      failures: [failureFrom('', null, existing)],
      diagnostics,
    };
  }

  let bytes: Uint8Array | null;
  try {
    bytes = await vfs.read(shiplistPath);
  } catch {
    const item = diagnostic('permissionDenied', 'importer', 'error', { location: { file: shiplistPath } });
    diagnostics.push(item);
    return { tier, shiplistPath, ships: [], failures: [failureFrom('', null, item)], diagnostics };
  }
  if (bytes === null) {
    const item = diagnostic('missingShiplist', 'importer', 'error', {
      details: { expected: shiplistPath },
      location: { file: shiplistPath },
    });
    diagnostics.push(item);
    return { tier, shiplistPath, ships: [], failures: [failureFrom('', null, item)], diagnostics };
  }

  const parsed = parseShiplist(bytes, { file: shiplistPath, checkVocabulary: false });
  diagnostics.push(...parsed.diagnostics);
  if (parsed.data.columns.length > 0 && !parsed.data.columns.some((column) => normHeader(column) === 'geometry')) {
    diagnostics.push(
      diagnostic('geometryColumnMissing', 'loader', 'error', {
        details: { columns: parsed.data.columns.length },
        location: { file: shiplistPath },
      }),
    );
  }

  const ships: LoadedShip[] = [];
  const failures: ShipFailure[] = [];
  if (parsed.data.rows.length === 0) {
    const error = parsed.diagnostics.find((item) => item.severity === 'error');
    if (error) failures.push(failureFrom('', null, error));
  }

  for (let index = 0; index < parsed.data.rows.length; index++) {
    const row = parsed.data.rows[index];
    if (row === undefined) continue;
    try {
      const outcome = await loadRow(vfs, row, parsed.data.columns, parsed.diagnostics, shiplistPath, tier);
      diagnostics.push(...outcome.diagnostics);
      if (outcome.ship) ships.push(outcome.ship);
      if (outcome.failure) failures.push(outcome.failure);
    } catch {
      const item = diagnostic('shipLoadFailed', 'loader', 'error', {
        details: { spawnKey: row.spawnKey },
        location: { file: shiplistPath, line: row.line },
      });
      diagnostics.push(item);
      failures.push(failureFrom(row.spawnKey, row.line, item));
    }
    options?.onProgress?.(index + 1, parsed.data.rows.length);
    if (options?.onProgress) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return { tier, shiplistPath, ships, failures, diagnostics };
}

export function disposeShipCatalog(catalog: ShipCatalog): void {
  for (const ship of catalog.ships) disposeBuilt(ship.mesh);
}

interface RowOutcome {
  ship?: LoadedShip;
  failure?: ShipFailure;
  diagnostics: Diagnostic[];
}

async function loadRow(
  vfs: Vfs,
  row: ShiplistRow,
  columns: readonly string[],
  parsedDiagnostics: readonly Diagnostic[],
  shiplistPath: string,
  tier: RenderTier,
): Promise<RowOutcome> {
  const hullType = stringField(row, columns, HULL_HEADERS, 1);
  const geometryField = fieldName(columns, 'geometry', 151);
  const geometry = stringField(row, columns, new Set(['geometry']), 151);
  if (geometry === '') {
    const existing = parsedDiagnostics.find((item) => item.code === 'missingGeometry' && item.location?.line === row.line);
    const item =
      existing ??
      diagnostic('missingGeometry', 'shiplist', 'warning', {
        details: { spawnKey: row.spawnKey, hullType, className: classFrom(row) },
        location: { file: shiplistPath, line: row.line, field: geometryField || 'geometry' },
      });
    return {
      failure: { spawnKey: row.spawnKey, line: row.line, reason: 'shiplist.missingGeometry', diagnostics: [item] },
      diagnostics: existing ? [] : [item],
    };
  }

  const normalized = normalizeInstallPath(geometry);
  if (!normalized.ok) {
    const item = diagnostic('modelPathRejected', 'mod', 'warning', {
      details: { spawnKey: row.spawnKey },
      location: { file: shiplistPath, line: row.line, ...(geometryField ? { field: geometryField } : {}) },
    });
    return { failure: failureFrom(row.spawnKey, row.line, item), diagnostics: [item] };
  }

  const resolved = vfs.resolve(normalized.path);
  if (resolved === null) {
    const item = diagnostic('missingModel', 'loader', 'error', {
      details: { spawnKey: row.spawnKey },
      location: { file: normalized.path },
    });
    return { failure: failureFrom(row.spawnKey, row.line, item), diagnostics: [item] };
  }

  let bytes: Uint8Array | null;
  try {
    bytes = await vfs.read(resolved);
  } catch {
    const item = diagnostic('permissionDenied', 'importer', 'error', { location: { file: resolved } });
    return { failure: failureFrom(row.spawnKey, row.line, item), diagnostics: [item] };
  }
  if (bytes === null) {
    const item = diagnostic('missingModel', 'loader', 'error', {
      details: { spawnKey: row.spawnKey },
      location: { file: resolved },
    });
    return { failure: failureFrom(row.spawnKey, row.line, item), diagnostics: [item] };
  }

  const parsedMod = parseMod(bytes, { file: resolved });
  const error = parsedMod.diagnostics.find((item) => item.severity === 'error');
  if (error) {
    return {
      failure: {
        spawnKey: row.spawnKey,
        line: row.line,
        reason: `${error.source}.${error.code}`,
        diagnostics: parsedMod.diagnostics,
      },
      diagnostics: parsedMod.diagnostics,
    };
  }

  const built = await buildShipMesh(parsedMod.data, { vfs, modelPath: resolved, tier });
  const rowDiagnostics = [...parsedMod.diagnostics, ...built.diagnostics];
  if (!hasTriangles(built.data)) {
    const item = diagnostic('noDrawableMesh', 'loader', 'warning', {
      details: { spawnKey: row.spawnKey },
      location: { file: resolved },
    });
    rowDiagnostics.push(item);
    return {
      failure: { spawnKey: row.spawnKey, line: row.line, reason: 'loader.noDrawableMesh', diagnostics: rowDiagnostics },
      diagnostics: rowDiagnostics,
    };
  }

  const flags = materialFlags(built.data);
  return {
    ship: {
      spawnKey: row.spawnKey,
      line: row.line,
      hullType,
      geometry: resolved,
      mesh: built.data,
      textured: flags.textured,
      selfIlluminated: flags.selfIlluminated,
      diagnostics: rowDiagnostics,
    },
    diagnostics: rowDiagnostics,
  };
}

function failureFrom(spawnKey: string, line: number | null, item: Diagnostic): ShipFailure {
  return { spawnKey, line, reason: `${item.source}.${item.code}`, diagnostics: [item] };
}

function hasTriangles(built: BuiltShipMesh): boolean {
  for (const lod of built.lods) {
    for (const child of lod.children) {
      if (!(child instanceof Mesh)) continue;
      const position = child.geometry.getAttribute('position');
      if (position !== undefined && position.count > 0) return true;
    }
  }
  return false;
}

function materialFlags(built: BuiltShipMesh): { textured: boolean; selfIlluminated: boolean } {
  let textured = false;
  let selfIlluminated = false;
  for (const material of built.materials) {
    const mapped = material as Material & { map?: Texture | null; emissiveMap?: Texture | null };
    if (mapped.map) textured = true;
    if (mapped.emissiveMap) selfIlluminated = true;
  }
  return { textured, selfIlluminated };
}

function disposeBuilt(built: BuiltShipMesh): void {
  built.root.removeFromParent();
  const seen = new Set<Material>();
  for (const material of built.materials) {
    if (seen.has(material)) continue;
    seen.add(material);
    const mapped = material as Material & { map?: Texture | null; emissiveMap?: Texture | null };
    mapped.map?.dispose();
    mapped.emissiveMap?.dispose();
    material.dispose();
  }
  built.root.traverse((obj) => {
    if (obj instanceof Mesh) obj.geometry.dispose();
  });
}

function stringField(row: ShiplistRow, columns: readonly string[], aliases: ReadonlySet<string>, indexFallback: number): string {
  if (columns.length === 0) {
    const value = row.fields[`col${indexFallback}`];
    return typeof value === 'string' ? value.trim() : '';
  }
  for (const column of columns) {
    if (!aliases.has(normHeader(column))) continue;
    const value = row.fields[column];
    if (typeof value === 'string') return value.trim();
  }
  return '';
}

function fieldName(columns: readonly string[], alias: string, indexFallback: number): string {
  if (columns.length === 0) return `col${indexFallback}`;
  for (const column of columns) {
    if (normHeader(column) === alias) return column;
  }
  return '';
}

function classFrom(row: ShiplistRow): string {
  const split = row.spawnKey.indexOf(':');
  return split < 0 ? '' : row.spawnKey.slice(split + 1);
}

function normHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/_+$/g, '');
}
