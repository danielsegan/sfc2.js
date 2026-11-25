/**
 * Browser half of the every-ship check. Runs inside headless Chromium.
 * Pixel samples stay in this page. The object published on `window` is the
 * metadata summary from report.ts.
 */

import type { Vfs } from '../../engine/platform/src/vfs.ts';
import { importInstall } from '../../engine/platform/src/import-install.ts';
import {
  advanceSpin,
  createShipStage,
  createTurntable,
  loadShipCatalog,
  syntheticViewerFiles,
  type LoadedShip,
  type ShipStage,
} from '../../engine/render/src/index.ts';
import { pairSelfIllumination } from '../formats/src/self-illum.ts';
import { filesFromDevInstall } from '../../web/src/dev-install-client.ts';
import {
  buildReport,
  failureResult,
  gradeRenderedShip,
  inspectReport,
  loadedResult,
  skippedResult,
  type DiagnosticSnap,
  type RenderError,
  type ShipResult,
  type ViewerCheckReport,
} from './report.ts';

const FRAME_COUNT_DEFAULT = 3;
const SPIN_TICKS = 8;
const MIN_CHANGED_PIXELS = 8;

interface CheckWindow extends Window {
  __viewerCheck?: ViewerCheckReport;
}

void main();

async function main(): Promise<void> {
  const started = performance.now();
  try {
    const report = await runCheck(started);
    publish(report);
  } catch {
    document.body.dataset.fail = 'check-failed';
    publish(buildReport([], performance.now() - started));
  }
}

async function runCheck(started: number): Promise<ViewerCheckReport> {
  const params = new URLSearchParams(location.search);
  const frames = clampFrames(params.get('frames'));
  const files = params.get('synthetic') === '1' ? syntheticViewerFiles() : await filesFromDevInstall(null);
  if (files === null) {
    document.body.dataset.fail = 'no-install';
    return buildReport([], performance.now() - started);
  }

  const canvas = document.querySelector('#view');
  let stage: ShipStage | null = null;
  try {
    let webgl = false;
    if (canvas instanceof HTMLCanvasElement) {
      try {
        stage = createShipStage(canvas, 'period', { preserveDrawingBuffer: true });
        stage.resize();
        stage.render();
        const probe = stage.readFrame();
        webgl = probe.width >= 16 && probe.height >= 16 && probe.glError === 0;
      } catch {
        webgl = false;
      }
    }
    if (!webgl) document.body.dataset.fail = 'no-webgl';

    const imported = await importInstall(files);
    const ordered: { line: number; result: ShipResult }[] = [];
    const vfs = imported.vfs;
    const catalog = await loadShipCatalog(imported, {
      onProgress(done, total) {
        if (done === total || done % 25 === 0) console.log(`progress ${done} ${total}`);
      },
      async onShip(ship) {
        ordered.push({ line: ship.line, result: assessShip(ship, vfs, stage, webgl, frames) });
      },
    });
    for (const failure of catalog.failures) {
      ordered.push({ line: failure.line ?? 0, result: failureResult(failure.spawnKey, failure.reason) });
    }
    ordered.sort((a, b) => a.line - b.line);
    return buildReport(
      ordered.map((item) => item.result),
      performance.now() - started,
    );
  } finally {
    stage?.dispose();
  }
}

function assessShip(
  ship: LoadedShip,
  vfs: Vfs | null,
  stage: ShipStage | null,
  webgl: boolean,
  frames: number,
): ShipResult {
  if (ship.expectedNoModel) return skippedResult(ship.spawnKey);
  const loaded = loadedResult({
    spawnKey: ship.spawnKey,
    placeholder: ship.placeholder,
    textured: ship.textured,
    selfIlluminated: ship.selfIlluminated,
    unboundSelfIllum: vfs !== null && unboundSelfIllum(ship, vfs),
    diagnostics: ship.diagnostics.map(snapDiagnostic),
  });
  if (!loaded.pass) return loaded;
  if (!webgl || stage === null) return gradeRenderedShip(loaded, 'render.noWebGL');
  return gradeRenderedShip(loaded, renderFrames(stage, ship, frames));
}

function renderFrames(stage: ShipStage, ship: LoadedShip, frames: number): RenderError | 'degenerate' | null {
  try {
    stage.show(null);
    stage.setPose(0, 0);
    stage.render();
    const baseline = stage.readFrame();
    if (baseline.width < 16 || baseline.height < 16) return 'render.failed';
    if (baseline.glError !== 0) return 'render.glError';

    const framing = stage.show(ship);
    if (framing.degenerate) return 'degenerate';
    let turn = createTurntable(false);
    let previous: Uint8Array | null = null;
    let sawShip = false;
    let sawSpin = false;
    for (let frame = 0; frame < frames; frame++) {
      for (let tick = 0; tick < SPIN_TICKS; tick++) turn = advanceSpin(turn, 0.1, false);
      stage.setPose(turn.yaw, turn.pitch);
      stage.render();
      const sample = stage.readFrame();
      if (sample.glError !== 0) return 'render.glError';
      if (framesDiffer(baseline.pixels, sample.pixels)) sawShip = true;
      if (previous !== null && framesDiffer(previous, sample.pixels)) sawSpin = true;
      previous = sample.pixels;
    }
    if (!sawShip) return 'render.emptyFrame';
    if (!sawSpin) return 'render.unchanged';
    return null;
  } catch {
    return 'render.failed';
  } finally {
    try {
      stage.show(null);
    } catch {
      // The catalog disposes the mesh after this returns.
    }
  }
}

function unboundSelfIllum(ship: LoadedShip, vfs: Vfs): boolean {
  if (ship.placeholder || ship.geometry.length === 0) return false;
  for (const material of ship.mesh.materials) {
    const mapped = material as {
      map?: { userData?: { installPath?: unknown } } | null;
      emissiveMap?: { image?: { width?: number } } | null;
      userData?: { texturePlaceholder?: unknown };
    };
    if (mapped.userData?.texturePlaceholder === true) continue;
    const emissive = mapped.emissiveMap;
    if (emissive && !(typeof emissive.image?.width === 'number' && emissive.image.width > 0)) return true;
    const basePath = mapped.map?.userData?.installPath;
    if (typeof basePath !== 'string') continue;
    const pair = glowBesideBase(vfs, basePath);
    if (pair !== undefined && !emissive) return true;
  }
  return false;
}

function glowBesideBase(vfs: Vfs, basePath: string): string | undefined {
  const slash = basePath.lastIndexOf('/');
  const dir = slash >= 0 ? basePath.slice(0, slash) : '';
  const prefix = dir.length > 0 ? `${dir}/` : '';
  const local = vfs
    .list()
    .map((entry) => entry.path)
    .filter((path) => {
      if (!path.toLowerCase().endsWith('.bmp')) return false;
      if (dir.length === 0) return !path.includes('/');
      if (!path.toLowerCase().startsWith(prefix.toLowerCase())) return false;
      return !path.slice(prefix.length).includes('/');
    });
  return pairSelfIllumination(local).pairs.find((item) => item.basePath.toLowerCase() === basePath.toLowerCase())?.selfIllumPath;
}

function snapDiagnostic(item: { source: string; code: string; severity: string; details?: Record<string, unknown> }): DiagnosticSnap {
  const which = item.details?.which;
  return {
    source: item.source,
    code: item.code,
    severity: item.severity,
    ...(which === 'diffuse' || which === 'luminance' ? { which } : {}),
  };
}

function framesDiffer(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return true;
  let changed = 0;
  for (let i = 0; i < left.length; i += 4) {
    const dr = Math.abs((left[i] ?? 0) - (right[i] ?? 0));
    const dg = Math.abs((left[i + 1] ?? 0) - (right[i + 1] ?? 0));
    const db = Math.abs((left[i + 2] ?? 0) - (right[i + 2] ?? 0));
    if (dr > 2 || dg > 2 || db > 2) {
      changed += 1;
      if (changed >= MIN_CHANGED_PIXELS) return true;
    }
  }
  return false;
}

function clampFrames(raw: string | null): number {
  const parsed = raw === null ? FRAME_COUNT_DEFAULT : Number(raw);
  if (!Number.isInteger(parsed)) return FRAME_COUNT_DEFAULT;
  return Math.min(8, Math.max(2, parsed));
}

function publish(report: ViewerCheckReport): void {
  if (inspectReport(report).problem === 'leak') {
    document.body.dataset.fail = 'unsafe';
    (window as CheckWindow).__viewerCheck = buildReport([], 0);
  } else {
    (window as CheckWindow).__viewerCheck = report;
  }
  document.body.dataset.done = '1';
}
