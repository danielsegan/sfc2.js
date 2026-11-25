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
import { filesFromDevInstall } from '../../web/src/dev-install-client.ts';
import { assessLoaded } from './assess.ts';
import {
  buildReport,
  failureResult,
  inspectReport,
  withRenderError,
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
    publish(buildReport([], performance.now() - started, 'full'));
  }
}

async function runCheck(started: number): Promise<ViewerCheckReport> {
  const params = new URLSearchParams(location.search);
  const frames = clampFrames(params.get('frames'));
  const files = params.get('synthetic') === '1' ? syntheticViewerFiles() : await filesFromDevInstall(null);
  if (files === null) {
    document.body.dataset.fail = 'no-install';
    return buildReport([], performance.now() - started, 'full');
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
      'full',
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
  const loaded = assessLoaded(ship, vfs);
  if (!loaded.pass) return loaded;
  if (!webgl || stage === null) return withRenderError(loaded, 'render.noWebGL');
  const rendered = renderFrames(stage, ship, frames);
  return rendered === null ? loaded : withRenderError(loaded, rendered);
}

function renderFrames(stage: ShipStage, ship: LoadedShip, frames: number): RenderError | null {
  try {
    stage.show(null);
    stage.setPose(0, 0);
    stage.render();
    const baseline = stage.readFrame();
    if (baseline.width < 16 || baseline.height < 16) return 'render.failed';
    if (baseline.glError !== 0) return 'render.glError';

    stage.show(ship);
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
    (window as CheckWindow).__viewerCheck = buildReport([], 0, 'full');
  } else {
    (window as CheckWindow).__viewerCheck = report;
  }
  document.body.dataset.done = '1';
}
