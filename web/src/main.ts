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
import { duelFromFiles, duelFromZip } from './install.ts';
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

document.getElementById('load')?.addEventListener('click', () => {
  void preferredDirectoryPicker().pick().then(async (picked) => {
    if (picked.status !== 'picked') return;
    const loaded = await duelFromFiles(picked.files);
    if ('error' in loaded) {
      const alert = document.getElementById('alert');
      if (alert) alert.textContent = loaded.error;
      return;
    }
    adopt(loaded.match, loaded.groups, loaded.roster, loaded.note);
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
    adopt(loaded.match, loaded.groups, loaded.roster, loaded.note);
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

requestAnimationFrame(frame);
