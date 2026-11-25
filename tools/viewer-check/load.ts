/**
 * Every shiplist row, through material assembly, in plain Node.
 * No Playwright import and no Chromium. The GPU render stays in run.ts.
 *
 * Stages, in order: model resolve, .mod parse, BufferGeometry (vertex and
 * index counts, finite positions, bounding box), texture resolve, BMP
 * decode, self-illum resolve and pairing, material assembly.
 */

import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { importInstall, type PickedFile } from '@sfc2js/platform';
import type { Vfs } from '../../engine/platform/src/vfs.ts';
import { loadShipCatalog, type LoadedShip } from '../../engine/render/src/ship-catalog.ts';
import type { BuiltShipMesh } from '../../engine/render/src/ship-mesh.ts';
import { syntheticViewerFiles } from '../../engine/render/src/synthetic-viewer-install.ts';
import { Box3, BufferGeometry, Mesh, Vector3, type Material, type Texture } from 'three';
import { assessLoaded } from './assess.ts';
import {
  buildReport,
  failureResult,
  inspectReport,
  shipIdentity,
  type ShipResult,
  type ViewerCheckReport,
} from './report.ts';

const BOUNDS = new Box3();
const SIZE = new Vector3();

export type GeometryFault = 'loader.emptyGeometry' | 'loader.nonFinitePosition' | 'loader.degenerateBounds';

export interface AssemblyFault {
  stage: 'texture' | 'selfIllum';
  error: 'loader.materialMissing' | 'bmp.undecoded';
}

export interface RunLoadCheckOptions {
  synthetic?: boolean;
  /** Absolute install root. Used only on this machine. It is not put in the report. */
  install?: string;
  /** In-memory files. Tests pass a synthetic install here. */
  files?: readonly PickedFile[];
}

export interface LoadCheckRun {
  report: ViewerCheckReport | null;
  /** `ok` when a safe summary was built. Other values are harness failures. */
  status: 'ok' | 'no-install' | 'withheld';
  pageError: null;
}

export async function runLoadCheck(options: RunLoadCheckOptions): Promise<LoadCheckRun> {
  const started = performance.now();
  const synthetic = options.synthetic === true;
  let files: readonly PickedFile[];
  if (options.files !== undefined) {
    files = options.files;
  } else if (synthetic) {
    files = syntheticViewerFiles();
  } else {
    if (options.install === undefined || options.install.length === 0) {
      throw new Error('set SFC2_REFERENCE or pass --install');
    }
    await assertDirectory(options.install);
    files = await listInstall(options.install);
  }
  if (files.length === 0) {
    return finish(buildReport([], performance.now() - started, 'load'));
  }

  const imported = await importInstall(files);
  const ordered: { line: number; result: ShipResult }[] = [];
  const vfs = imported.vfs;
  const catalog = await loadShipCatalog(imported, {
    onProgress(done, total) {
      if (done === total || done % 25 === 0) process.stderr.write(`progress ${done} ${total}\n`);
    },
    onShip(ship) {
      ordered.push({ line: ship.line, result: verdict(ship, vfs) });
    },
  });
  for (const failure of catalog.failures) {
    ordered.push({ line: failure.line ?? 0, result: failureResult(failure.spawnKey, failure.reason) });
  }
  ordered.sort((a, b) => a.line - b.line);
  return finish(
    buildReport(
      ordered.map((item) => item.result),
      performance.now() - started,
      'load',
    ),
  );
}

/**
 * Drawable mesh, or the first geometry fault.
 * A missing index uses the vertex count: three.js draws that range directly.
 * An index that is present must be non-empty and in range.
 */
export function geometryFault(built: BuiltShipMesh): GeometryFault | null {
  let meshes = 0;
  for (const lod of built.lods) {
    for (const child of lod.children) {
      if (!(child instanceof Mesh) || !(child.geometry instanceof BufferGeometry)) continue;
      meshes += 1;
      const fault = bufferFault(child.geometry);
      if (fault !== null) return fault;
    }
  }
  return meshes > 0 ? null : 'loader.emptyGeometry';
}

/** A passing load still needs a material, and any bound map must carry decoded pixels. */
export function assemblyFault(ship: LoadedShip): AssemblyFault | null {
  if (ship.placeholder) return null;
  if (ship.mesh.materials.length === 0) return { stage: 'texture', error: 'loader.materialMissing' };
  for (const material of ship.mesh.materials) {
    const mapped = material as Material & { map?: Texture | null; emissiveMap?: Texture | null };
    if (mapped.map && !textureReady(mapped.map)) return { stage: 'texture', error: 'bmp.undecoded' };
    if (mapped.emissiveMap && !textureReady(mapped.emissiveMap)) return { stage: 'selfIllum', error: 'bmp.undecoded' };
  }
  return null;
}

function verdict(ship: LoadedShip, vfs: Vfs | null): ShipResult {
  const fault = geometryFault(ship.mesh);
  if (fault !== null) {
    const identity = shipIdentity(ship.spawnKey);
    return { ...identity, pass: false, stage_failed: 'geometry', error: fault };
  }
  const loaded = assessLoaded(ship, vfs);
  if (!loaded.pass) return loaded;
  const assembled = assemblyFault(ship);
  if (assembled !== null) {
    const identity = shipIdentity(ship.spawnKey);
    return { ...identity, pass: false, stage_failed: assembled.stage, error: assembled.error };
  }
  return loaded;
}

function bufferFault(geometry: BufferGeometry): GeometryFault | null {
  const position = geometry.getAttribute('position');
  if (position === undefined || position.itemSize < 3) return 'loader.emptyGeometry';
  const vertexCount = position.count;
  const index = geometry.getIndex();
  const indexCount = index === null ? vertexCount : index.count;
  if (vertexCount <= 0 || indexCount <= 0) return 'loader.emptyGeometry';
  if (index !== null) {
    for (let i = 0; i < index.count; i++) {
      const at = index.getX(i);
      if (!Number.isInteger(at) || at < 0 || at >= vertexCount) return 'loader.emptyGeometry';
    }
  }
  const marked = geometry.userData.sfc2NonFinitePositions;
  if (typeof marked === 'number' && marked > 0) return 'loader.nonFinitePosition';
  for (let i = 0; i < vertexCount; i++) {
    if (!Number.isFinite(position.getX(i)) || !Number.isFinite(position.getY(i)) || !Number.isFinite(position.getZ(i))) {
      return 'loader.nonFinitePosition';
    }
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box === null) return 'loader.degenerateBounds';
  BOUNDS.copy(box);
  BOUNDS.getSize(SIZE);
  if (![BOUNDS.min.x, BOUNDS.min.y, BOUNDS.min.z, BOUNDS.max.x, BOUNDS.max.y, BOUNDS.max.z, SIZE.x, SIZE.y, SIZE.z].every((value) => Number.isFinite(value))) {
    return 'loader.degenerateBounds';
  }
  const span = (SIZE.x > 0 ? 1 : 0) + (SIZE.y > 0 ? 1 : 0) + (SIZE.z > 0 ? 1 : 0);
  if (span < 2) return 'loader.degenerateBounds';
  return null;
}

function textureReady(texture: Texture): boolean {
  const image = texture.image as { width?: number; height?: number; data?: { length?: number } } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  const length = image?.data?.length ?? 0;
  return width > 0 && height > 0 && length >= width * height * 4;
}

function finish(report: ViewerCheckReport): LoadCheckRun {
  const inspected = inspectReport(report);
  if (inspected.report === null || inspected.problem === 'leak' || inspected.problem === 'shape' || inspected.problem === 'mismatch') {
    return { report: null, status: 'withheld', pageError: null };
  }
  if (inspected.problem === 'empty') return { report: inspected.report, status: 'no-install', pageError: null };
  return { report: inspected.report, status: 'ok', pageError: null };
}

async function assertDirectory(install: string): Promise<void> {
  try {
    const info = await stat(install);
    if (!info.isDirectory()) throw new Error('not-dir');
  } catch {
    throw new Error('install directory was not found');
  }
}

async function listInstall(root: string): Promise<PickedFile[]> {
  const rootReal = await realpath(root);
  const files: PickedFile[] = [];
  await walk(rootReal, rootReal, files);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}

async function walk(root: string, dir: string, out: PickedFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue;
    let real: string;
    try {
      real = await realpath(path.resolve(dir, entry.name));
    } catch {
      continue;
    }
    const fromRoot = path.relative(root, real);
    if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) continue;
    let info;
    try {
      info = await stat(real);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      await walk(root, real, out);
    } else if (info.isFile()) {
      const rel = fromRoot.split(path.sep).join('/');
      if (rel.length === 0 || rel.split('/').includes('..')) continue;
      out.push({ path: rel, size: info.size, read: () => readFile(real) });
    }
  }
}
