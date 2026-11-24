/**
 * The page clock lives here. It only calls match.frame(dt). The sim
 * never sees the wall clock. Orders go through the session.
 */
import { preferredDirectoryPicker } from '@sfc2js/platform';
import type { Group } from 'three';
import { SYNTHETIC_FIXTURE_PATH, SYNTHETIC_ROSTER, type RosterEntry } from '../../engine/duel/fixture.ts';
import { createSyntheticDuel, type DuelMatch } from '../../engine/duel/match.ts';
import { loadSyntheticHulls } from '../../engine/duel/meshes.ts';
import { updateHud, mapFrame } from './hud.ts';
import { assembleDuel, duelFromFiles, duelFromZip, type LoadedDuel } from './install.ts';
import { filesFromDevInstall } from './dev-install-client.ts';
import { devInstallUrl } from '../dev-install-shared.ts';
import { DuelScene } from './scene.ts';
import { createKeyTracker } from './input/keymap.ts';
import { runAction, type CommandHost } from './commands.ts';
import { mountKeymapDialog } from './keymap-dialog.ts';
import { createGameAudio } from './audio-out.ts';
import { cuesForFrame, emptyAudioMemory, type AudioMemory } from '../../engine/audio/cues.ts';
import { readSoundIndex } from '../../engine/audio/load-index.ts';
import { nearestContact } from './map-geom.ts';
import { shieldFacingAt } from './shield-hit.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import type { Vfs } from '@sfc2js/platform';

const space = document.getElementById('space');
if (!(space instanceof HTMLCanvasElement)) throw new Error('missing view');
const canvas: HTMLCanvasElement = space;

const scene = new DuelScene(canvas);
let match: DuelMatch = createSyntheticDuel({ timeScale: 4 });
let roster: readonly RosterEntry[] = SYNTHETIC_ROSTER;
let selectedSlot = 0;
let selectedGroup = 0;
let mapZoom = 8;
let headingUp = false;
let mapFull = false;
let paused = false;
let scale = 4;
let latest: ViewModel | null = null;
let audioMemory: AudioMemory = emptyAudioMemory();
const groups: number[][] = [[0], [1], [2], [3], [4], [5]];
const keys = createKeyTracker();
const audio = createGameAudio();

const source = document.getElementById('source');
if (source) source.textContent = `Synthetic fixture · ${SYNTHETIC_FIXTURE_PATH}`;

void loadSyntheticHulls().then((groups) => scene.setHulls(groups));

const hud = {
  get selectedSlot() {
    return selectedSlot;
  },
  get group() {
    return selectedGroup;
  },
  groups,
  get mapZoom() {
    return mapZoom;
  },
  get headingUp() {
    return headingUp;
  },
  get mapFull() {
    return mapFull;
  },
  get targetId() {
    return match.targetId;
  },
  onSelect(slot: number) {
    selectedSlot = slot;
  },
};

const host: CommandHost = {
  get match() {
    return match;
  },
  scene,
  note(text) {
    const notice = document.getElementById('notice');
    if (notice) notice.textContent = text;
    appendNote(text);
  },
  togglePause() {
    paused = !paused;
    match.setTimeScale(paused ? 0 : scale);
    const button = document.getElementById('pause');
    if (button) button.textContent = paused ? 'Resume' : 'Pause';
  },
  getSlot: () => selectedSlot,
  setSlot(slot) {
    selectedSlot = slot;
  },
  groups,
  get group() {
    return selectedGroup;
  },
  setGroup(group) {
    selectedGroup = group;
  },
  get mapZoom() {
    return mapZoom;
  },
  setMapZoom(zoom) {
    mapZoom = zoom;
  },
  get headingUp() {
    return headingUp;
  },
  setHeadingUp(on) {
    headingUp = on;
  },
  get mapFull() {
    return mapFull;
  },
  setMapFull(on) {
    mapFull = on;
  },
  view: () => latest,
};

document.getElementById('scale')?.addEventListener('change', (event) => {
  const value = Number((event.target as HTMLSelectElement).value);
  if (!Number.isFinite(value)) return;
  scale = value;
  if (!paused) match.setTimeScale(scale);
});

document.getElementById('pause')?.addEventListener('click', () => {
  host.togglePause();
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
  const dialog = document.getElementById('keymap');
  if (dialog instanceof HTMLDialogElement && dialog.open) return;
  if (event.code === 'Tab') event.preventDefault();
  const action = keys.press(event);
  if (!action) return;
  event.preventDefault();
  audio.unlock();
  runAction(host, action);
  syncSpeedInput();
});

window.addEventListener('keyup', (event) => {
  keys.release(event);
});
window.addEventListener('blur', () => keys.blur());

document.body.addEventListener('click', (event) => {
  const node = event.target;
  if (!(node instanceof Element)) return;
  const action = node.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (!action || node.closest('button')?.hasAttribute('disabled')) return;
  audio.unlock();
  audio.play(['ui.click'], performance.now());
  runAction(host, action);
});

document.getElementById('shields')?.addEventListener('click', (event) => {
  const canvas = event.currentTarget;
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const facing = shieldFacingAt(x, y, canvas.width, canvas.height);
  if (facing === null) return;
  if (event.shiftKey) match.setFacing(facing, 0);
  else match.setFacing(facing, (match.plan.specific[facing] ?? 0) + 1);
});

const stage = document.getElementById('stage');
let dragging = false;
let dragX = 0;
let dragY = 0;
stage?.addEventListener('pointerdown', (event) => {
  if (event.button !== 2) return;
  dragging = true;
  dragX = event.clientX;
  dragY = event.clientY;
  audio.unlock();
});
stage?.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  scene.orbitBy(event.clientX - dragX, event.clientY - dragY);
  dragX = event.clientX;
  dragY = event.clientY;
});
stage?.addEventListener('pointerup', () => {
  dragging = false;
});
stage?.addEventListener('pointerleave', () => {
  dragging = false;
});
stage?.addEventListener('contextmenu', (event) => event.preventDefault());
stage?.addEventListener('wheel', (event) => {
  const frame = mapFrame;
  const overlay = document.getElementById('overlay');
  if (frame && overlay) {
    const rect = overlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x >= frame.left && y >= frame.top && x <= frame.left + frame.size && y <= frame.top + frame.size) {
      mapZoom = clampZoom(mapZoom + (event.deltaY > 0 ? -1 : 1));
      event.preventDefault();
      return;
    }
  }
  scene.dolly(event.deltaY > 0 ? 1.2 : -1.2);
  event.preventDefault();
}, { passive: false });
stage?.addEventListener('click', (event) => {
  const frame = mapFrame;
  const overlay = document.getElementById('overlay');
  if (!frame || !overlay || !latest || !frame.self) return;
  const rect = overlay.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < frame.left || y < frame.top || x > frame.left + frame.size || y > frame.top + frame.size) return;
  const id = nearestContact(latest.contacts, frame.self, frame.headingUp, frame.scale, x - frame.cx, y - frame.cy);
  if (id !== null) match.setTarget(id);
});

function clampZoom(value: number): number {
  if (value < 3) return 3;
  if (value > 18) return 18;
  return value;
}

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
  void attachSounds(vfsRead(loaded.vfs));
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
  audioMemory = emptyAudioMemory();
  scene.setHulls(groups);
  match.setTimeScale(paused ? 0 : scale);
  if (source) source.textContent = note;
  document.body.dataset.ready = '0';
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  if (keys.held('helm.turnLeft')) match.orderYaw(-8000);
  if (keys.held('helm.turnRight')) match.orderYaw(8000);
  match.frame(dt);
  const vm = match.view();
  latest = vm;
  if (vm.contacts.length >= 2) document.body.dataset.ready = '1';
  scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
  scene.render(vm, now);
  updateHud(vm, roster, hud, match.plan, now);
  const heard = cuesForFrame(
    {
      events: vm.events,
      weapons: vm.self?.weapons ?? [],
      shields: vm.self?.shields ?? [],
      shotIds: vm.contacts.filter((contact) => contact.kind === 'shot').map((contact) => contact.id),
      selfId: vm.self?.id,
    },
    audioMemory,
  );
  audioMemory = heard.memory;
  audio.play(heard.cues, now);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
});

const pageInstall = new URLSearchParams(location.search).get('install');
mountKeymapDialog(keys, (text) => host.note(text));
bindVolume();
void attachSounds((path) => readDevFile(pageInstall, path));
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

function bindVolume(): void {
  const levels = audio.levels();
  wire('vol-master', levels.master, (value) => audio.setVolume({ master: value }));
  wire('vol-effects', levels.effects, (value) => audio.setVolume({ effects: value }));
  wire('vol-alerts', levels.alerts, (value) => audio.setVolume({ alerts: value }));
}

function wire(id: string, value: number, apply: (value: number) => void): void {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) return;
  input.value = String(Math.round(value * 100));
  input.addEventListener('input', () => {
    audio.unlock();
    apply(Number(input.value) / 100);
  });
}

async function readDevFile(root: string | null, path: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(devInstallUrl('file', root, path));
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function attachSounds(read: (path: string) => Promise<Uint8Array | null>): Promise<void> {
  const found = await readSoundIndex(read);
  if (!found) return;
  const count = await audio.loadIndex(found.index, read);
  host.note(`Sound index ${found.file}, ${String(count)} cues.`);
}

function vfsRead(vfs: Vfs): (path: string) => Promise<Uint8Array | null> {
  return async (path) => {
    const resolved = vfs.resolve(path);
    if (!resolved) return null;
    return vfs.read(resolved);
  };
}

requestAnimationFrame(frame);
