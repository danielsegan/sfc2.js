/**
 * The page clock lives here. It only calls match.frame(dt). The sim
 * never sees the wall clock. Orders go through the session.
 */
import { preferredDirectoryPicker } from '@sfc2js/platform';
import type { Group } from 'three';
import { SYNTHETIC_FIXTURE_PATH, SYNTHETIC_ROSTER, type RosterEntry } from '../../engine/duel/fixture.ts';
import { createSyntheticDuel, type DuelMatch } from '../../engine/duel/match.ts';
import { loadSyntheticHulls } from '../../engine/duel/meshes.ts';
import { updateHud } from './hud.ts';
import { assembleDuel, duelFromFiles, duelFromZip, type LoadedDuel } from './install.ts';
import { filesFromDevInstall } from './dev-install-client.ts';
import { DuelScene } from './scene.ts';

const space = document.getElementById('space');
if (!(space instanceof HTMLCanvasElement)) throw new Error('missing view');
const canvas: HTMLCanvasElement = space;

const scene = new DuelScene(canvas);
let match: DuelMatch = createSyntheticDuel({ timeScale: 4 });
let roster: readonly RosterEntry[] = SYNTHETIC_ROSTER;
let selectedSlot = 0;
let paused = false;
let scale = 4;
const held = new Set<string>();

const source = document.getElementById('source');
if (source) source.textContent = `Synthetic fixture · ${SYNTHETIC_FIXTURE_PATH}`;

void loadSyntheticHulls().then((groups) => scene.setHulls(groups));

const hud = {
  get selectedSlot() {
    return selectedSlot;
  },
  onSelect(slot: number) {
    selectedSlot = slot;
  },
};

document.getElementById('scale')?.addEventListener('change', (event) => {
  const value = Number((event.target as HTMLSelectElement).value);
  if (!Number.isFinite(value)) return;
  scale = value;
  if (!paused) match.setTimeScale(scale);
});

document.getElementById('pause')?.addEventListener('click', () => {
  paused = !paused;
  match.setTimeScale(paused ? 0 : scale);
  const button = document.getElementById('pause');
  if (button) button.textContent = paused ? 'Resume' : 'Pause';
});

document.getElementById('life')?.addEventListener('change', (event) => {
  match.setLifeSupport((event.target as HTMLInputElement).checked);
});
document.getElementById('fire-control')?.addEventListener('change', (event) => {
  match.setFireControl((event.target as HTMLInputElement).checked);
});
document.getElementById('general')?.addEventListener('change', (event) => {
  match.setGeneral(Number((event.target as HTMLInputElement).value));
});
document.getElementById('weapon-energy')?.addEventListener('change', (event) => {
  const raw = (event.target as HTMLInputElement).value.trim();
  match.setWeaponRequest(raw.length === 0 ? null : Number(raw));
});
document.getElementById('ordered-speed')?.addEventListener('change', (event) => {
  match.setSpeed(Number((event.target as HTMLInputElement).value));
});

let catalog: LoadedDuel | null = null;
let fillingShips = false;

document.getElementById('player-ship')?.addEventListener('change', () => {
  void rebuildFromPicker();
});
document.getElementById('opponent-ship')?.addEventListener('change', () => {
  void rebuildFromPicker();
});

document.getElementById('load')?.addEventListener('click', () => {
  void preferredDirectoryPicker().pick().then(async (picked) => {
    if (picked.status !== 'picked') return;
    const loaded = await duelFromFiles(picked.files);
    if ('error' in loaded) {
      const alert = document.getElementById('alert');
      if (alert) alert.textContent = loaded.error;
      return;
    }
    adoptLoaded(loaded);
  });
});

document.getElementById('zip')?.addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  void file.arrayBuffer().then(async (buffer) => {
    const loaded = await duelFromZip(new Uint8Array(buffer));
    if ('error' in loaded) {
      const alert = document.getElementById('alert');
      if (alert) alert.textContent = loaded.error;
      return;
    }
    adoptLoaded(loaded);
  });
});

window.addEventListener('keydown', (event) => {
  if (typing(event)) return;
  held.add(event.code);
  if (event.code === 'KeyW') match.bumpSpeed(1);
  if (event.code === 'KeyS') match.bumpSpeed(-1);
  if (event.code === 'KeyX') match.setSpeed(0);
  if (event.code === 'Space') {
    event.preventDefault();
    match.orderFire(selectedSlot);
  }
  if (event.code === 'Tab') {
    event.preventDefault();
    const target = match.targetId;
    if (target !== null) match.setTarget(target);
  }
  if (event.code === 'KeyV') scene.cycleCamera();
  if (event.code.startsWith('Digit')) {
    const slot = Number(event.code.slice(5)) - 1;
    if (slot >= 0 && slot < 6) selectedSlot = slot;
  }
  syncSpeedInput();
});

window.addEventListener('keyup', (event) => {
  held.delete(event.code);
});

function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function syncSpeedInput(): void {
  const input = document.getElementById('ordered-speed');
  if (input instanceof HTMLInputElement && document.activeElement !== input) {
    input.value = String(match.plan.speed);
  }
}

function fillShipPicker(loaded: LoadedDuel): void {
  const player = document.getElementById('player-ship');
  const opponent = document.getElementById('opponent-ship');
  if (!(player instanceof HTMLSelectElement) || !(opponent instanceof HTMLSelectElement)) return;
  fillingShips = true;
  player.replaceChildren();
  opponent.replaceChildren();
  for (let i = 0; i < loaded.candidates.length; i++) {
    const candidate = loaded.candidates[i];
    if (!candidate) continue;
    const label = `${candidate.race} ${candidate.className} (${candidate.hullType})`;
    const weapon = candidate.supported ? '' : ' — no phaser or photon';
    for (const select of [player, opponent]) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `${label}${weapon}`;
      select.append(option);
    }
  }
  player.value = String(loaded.player);
  opponent.value = String(loaded.opponent);
  fillingShips = false;
}

function appendNote(note: string): void {
  const list = document.getElementById('log');
  if (!list) return;
  const item = document.createElement('li');
  item.textContent = note;
  list.append(item);
}

function adoptLoaded(loaded: LoadedDuel): void {
  catalog = loaded;
  fillShipPicker(loaded);
  adopt(loaded.match, loaded.groups, loaded.roster, loaded.note);
  appendNote(loaded.note);
}

async function rebuildFromPicker(): Promise<void> {
  if (fillingShips || !catalog) return;
  const player = document.getElementById('player-ship');
  const opponent = document.getElementById('opponent-ship');
  if (!(player instanceof HTMLSelectElement) || !(opponent instanceof HTMLSelectElement)) return;
  const playerIndex = Number(player.value);
  const opponentIndex = Number(opponent.value);
  if (!Number.isInteger(playerIndex) || !Number.isInteger(opponentIndex) || playerIndex === opponentIndex) {
    player.value = String(catalog.player);
    opponent.value = String(catalog.opponent);
    return;
  }
  const left = catalog.candidates[playerIndex];
  const right = catalog.candidates[opponentIndex];
  if (!left || !right) return;
  const note = `Chosen ${left.spawnKey} (line ${String(left.line)}) vs ${right.spawnKey} (line ${String(right.line)}).`;
  const loaded = await assembleDuel(catalog.vfs, catalog.candidates, playerIndex, opponentIndex, note);
  if ('error' in loaded) {
    const alert = document.getElementById('alert');
    if (alert) alert.textContent = loaded.error;
    player.value = String(catalog.player);
    opponent.value = String(catalog.opponent);
    return;
  }
  adoptLoaded(loaded);
}

function adopt(next: DuelMatch, groups: readonly Group[], nextRoster: readonly RosterEntry[], note: string): void {
  match = next;
  roster = nextRoster;
  selectedSlot = 0;
  scene.setHulls(groups);
  match.setTimeScale(paused ? 0 : scale);
  if (source) source.textContent = note;
  document.body.dataset.ready = '0';
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  if (held.has('KeyA')) match.orderYaw(-8000);
  if (held.has('KeyD')) match.orderYaw(8000);
  match.frame(dt);
  const vm = match.view();
  if (vm.contacts.length >= 2) document.body.dataset.ready = '1';
  scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
  scene.render(vm, now);
  updateHud(vm, roster, hud, now);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
});

const pageInstall = new URLSearchParams(location.search).get('install');
void filesFromDevInstall(pageInstall).then(async (files) => {
  if (!files) return;
  const loaded = await duelFromFiles(files);
  if ('error' in loaded) {
    const alert = document.getElementById('alert');
    if (alert) alert.textContent = loaded.error;
    return;
  }
  adoptLoaded(loaded);
});

requestAnimationFrame(frame);
