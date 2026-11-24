/**
 * Ship viewer page. One route, separate from the tactical presentation.
 * Keys are KeyboardEvent.code values from SHIP_VIEWER_KEYS.
 */

import {
  importInstall,
  importZipArchive,
  pickAndImport,
  preferredDirectoryPicker,
  type ImportResult,
} from '../../engine/platform/src/index.ts';
import {
  SHIP_VIEWER_KEYS,
  advanceSpin,
  applyViewerCode,
  createShipStage,
  createTurntable,
  disposeShipCatalog,
  dragTurntable,
  loadShipCatalog,
  showShipLod,
  syntheticViewerFiles,
  type LoadedShip,
  type RenderTier,
  type ShipCatalog,
  type ShipStage,
  type TurntableState,
} from '../../engine/render/src/index.ts';

const folderButton = mustQuery<HTMLButtonElement>('#open-folder');
const zipInput = mustQuery<HTMLInputElement>('#zip-file');
const canvas = mustQuery<HTMLCanvasElement>('#view');
const shipSelect = mustQuery<HTMLSelectElement>('#ships');
const status = mustQuery<HTMLParagraphElement>('#status');
const failureSummary = mustQuery<HTMLParagraphElement>('#failure-summary');
const failureList = mustQuery<HTMLUListElement>('#failures');
const keyHelp = mustQuery<HTMLParagraphElement>('#keys');
const banner = mustQuery<HTMLParagraphElement>('#banner');
const webglNote = mustQuery<HTMLParagraphElement>('#webgl-note');

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motion.matches;
let tier: RenderTier = 'period';
let imported: ImportResult | null = null;
let catalog: ShipCatalog | null = null;
let turntable: TurntableState = createTurntable(reduced);
let busy = false;
const lodByShip = new Map<string, number>();

let stage: ShipStage | null = null;
try {
  stage = createShipStage(canvas, tier);
  stage.resize();
} catch {
  webglNote.hidden = false;
  webglNote.textContent = 'WebGL is unavailable. Ships that fail are still listed.';
}

void labelKeys();
motion.addEventListener('change', () => {
  reduced = motion.matches;
  if (reduced) turntable = { ...turntable, spinning: false };
  paintStatus();
});

folderButton.addEventListener('click', () => {
  void openFolder();
});

zipInput.addEventListener('change', () => {
  const file = zipInput.files?.[0];
  if (file) void openZip(file);
});

shipSelect.addEventListener('change', () => {
  const index = Number(shipSelect.value);
  if (!Number.isInteger(index)) return;
  turntable = { ...turntable, index };
  showCurrent();
});

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const count = catalog?.ships.length ?? 0;
  const result = applyViewerCode(turntable, event.code, count, reduced);
  if (!result.handled) return;
  event.preventDefault();
  turntable = result.state;
  if (result.tier !== undefined && result.tier !== tier && imported !== null) {
    tier = result.tier;
    stage?.setTier(tier);
    void showImport(imported, false);
    return;
  }
  if (result.lodStep !== undefined) cycleLod(result.lodStep);
  if (result.indexChanged) showCurrent();
  else paintStatus();
});

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  canvas.dataset.dragging = '1';
  canvas.dataset.x = String(event.clientX);
  canvas.dataset.y = String(event.clientY);
});

canvas.addEventListener('pointermove', (event) => {
  if (canvas.dataset.dragging !== '1') return;
  const x = Number(canvas.dataset.x ?? event.clientX);
  const y = Number(canvas.dataset.y ?? event.clientY);
  turntable = dragTurntable(turntable, event.clientX - x, event.clientY - y);
  canvas.dataset.x = String(event.clientX);
  canvas.dataset.y = String(event.clientY);
});

function endDrag(event: PointerEvent): void {
  if (canvas.dataset.dragging !== '1') return;
  canvas.dataset.dragging = '0';
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

window.addEventListener('resize', () => stage?.resize());

let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  turntable = advanceSpin(turntable, dt, reduced);
  stage?.setPose(turntable.yaw, turntable.pitch);
  stage?.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).get('demo') === '1') {
  banner.hidden = false;
  void (async () => {
    imported = await importInstall(syntheticViewerFiles());
    await showImport(imported, true);
  })();
}

async function openFolder(): Promise<void> {
  const picked = await pickAndImport(preferredDirectoryPicker());
  if (picked.status === 'cancelled') {
    status.textContent = 'Folder selection was cancelled.';
    return;
  }
  if (picked.status === 'unavailable') {
    status.textContent = 'This browser cannot open a folder. Choose a zip instead.';
    return;
  }
  imported = picked.result;
  await showImport(imported, true);
}

async function openZip(file: File): Promise<void> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    imported = await importZipArchive(bytes);
    await showImport(imported, true);
  } catch {
    status.textContent = 'The zip could not be read.';
  }
}

async function showImport(result: ImportResult, resetView: boolean): Promise<void> {
  if (busy) return;
  busy = true;
  const kept = resetView ? createTurntable(reduced) : turntable;
  status.textContent = 'Loading ships…';
  try {
    const next = await loadShipCatalog(result, {
      tier,
      onProgress(done, total) {
        status.textContent = total === 0 ? 'Loading ships…' : `Loading ships… ${done} / ${total}`;
      },
    });
    if (catalog) disposeShipCatalog(catalog);
    catalog = next;
    const count = next.ships.length;
    const index = count === 0 ? 0 : Math.min(kept.index, count - 1);
    turntable = { ...kept, index, spinning: reduced ? false : kept.spinning };
    renderShips();
    renderFailures();
    showCurrent();
  } catch {
    status.textContent = 'The install could not be read.';
  } finally {
    busy = false;
  }
}

function renderShips(): void {
  shipSelect.replaceChildren();
  for (const [index, ship] of (catalog?.ships ?? []).entries()) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = ship.spawnKey;
    shipSelect.append(option);
  }
}

function renderFailures(): void {
  failureList.replaceChildren();
  const failures = catalog?.failures ?? [];
  const missingColumn = catalog?.diagnostics.some((item) => item.code === 'geometryColumnMissing') ?? false;
  if (catalog === null) {
    failureSummary.textContent = 'No install opened.';
  } else if (failures.length === 0) {
    failureSummary.textContent = 'Every shiplist row loaded.';
  } else {
    const column = missingColumn ? ' No geometry column was found in the table.' : '';
    failureSummary.textContent = `${failures.length} could not load.${column} The viewer kept going.`;
  }
  for (const failure of failures) {
    const item = document.createElement('li');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = failure.spawnKey === '' ? 'Install' : failure.spawnKey;
    const why = document.createElement('span');
    why.className = 'reason';
    why.textContent = failure.reason;
    item.append(who);
    if (failure.line !== null) {
      const line = document.createElement('span');
      line.textContent = `Line ${failure.line}`;
      item.append(line);
    }
    item.append(why);
    failureList.append(item);
  }
}

function showCurrent(): void {
  const ship = catalog?.ships[turntable.index];
  stage?.show(ship ?? null);
  if (ship) {
    const lod = lodByShip.get(shipId(ship)) ?? 0;
    if (ship.mesh.lods.length > 0) showShipLod(ship.mesh, Math.min(lod, ship.mesh.lods.length - 1));
  }
  if (shipSelect.value !== String(turntable.index)) shipSelect.value = String(turntable.index);
  paintStatus();
  stage?.resize();
}

function paintStatus(): void {
  const ship = catalog?.ships[turntable.index];
  if (catalog === null) return;
  if (ship === undefined) {
    status.textContent = catalog.failures.length > 0 ? 'No ship could be shown. See the list.' : 'The shiplist has no rows.';
    return;
  }
  const maps = [ship.textured ? 'texture' : 'no texture', ship.selfIlluminated ? 'self-illum' : 'no self-illum'];
  const spin = reduced ? 'spin off (reduced motion)' : turntable.spinning ? 'spinning' : 'spin paused';
  status.textContent = `${ship.spawnKey} · ${maps.join(' · ')} · ${spin}`;
}

function cycleLod(step: number): void {
  const ship = catalog?.ships[turntable.index];
  if (ship === undefined || ship.mesh.lods.length === 0) return;
  const id = shipId(ship);
  const current = lodByShip.get(id) ?? 0;
  const next = (current + step) % ship.mesh.lods.length;
  lodByShip.set(id, next);
  showShipLod(ship.mesh, next);
}

function shipId(ship: LoadedShip): string {
  return `${ship.line}:${ship.spawnKey}`;
}

async function labelKeys(): Promise<void> {
  const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } }).keyboard;
  let map: ReadonlyMap<string, string> | null = null;
  try {
    map = (await keyboard?.getLayoutMap?.()) ?? null;
  } catch {
    map = null;
  }
  keyHelp.textContent = SHIP_VIEWER_KEYS.map((binding) => {
    const shown = map?.get(binding.code) || binding.code;
    return `${shown}: ${binding.label}`;
  }).join(' · ');
  keyHelp.textContent += ' Drag the view to rotate.';
}

function mustQuery<T extends Element>(selector: string): T {
  const found = document.querySelector(selector);
  if (!(found instanceof Element)) throw new Error(`missing ${selector}`);
  return found as T;
}
