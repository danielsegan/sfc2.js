/**
 * The page clock lives here. It only calls match.frame(dt). The sim
 * never sees the wall clock. Orders go through the session.
 */
import { preferredDirectoryPicker, type Vfs } from '@sfc2js/platform';
import { Group } from 'three';
import { classById, empireById, linePosition, syntheticRoster, syntheticSetup } from '../../engine/duel/catalog.ts';
import { SYNTHETIC_FIXTURE_PATH, type RosterEntry } from '../../engine/duel/fixture.ts';
import { createFleetMatch, type DuelMatch, type FleetSlot } from '../../engine/duel/match.ts';
import { groupFromMod, loadFleetHulls } from '../../engine/duel/meshes.ts';
import { FIXTURE_MODEL_DIR, placeholderHullMod, type PlaceholderShape } from '../../engine/duel/placeholder-mod.ts';
import { cuesForFrame, emptyAudioMemory, type AudioMemory } from '../../engine/audio/cues.ts';
import { readSoundIndex } from '../../engine/audio/load-index.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import { updateHud } from './hud.ts';
import { assembleDuel, duelFromFiles, duelFromZip, type LoadedDuel } from './install.ts';
import { filesFromDevInstall } from './dev-install-client.ts';
import { devInstallUrl } from '../dev-install-shared.ts';
import { DuelScene } from './scene.ts';
import { hudScaleFromLocation, paintFieldHud } from './field-hud.ts';
import { speedScale } from './tactical/frame.ts';
import { barFractionFromClientX, formatSpeed, speedBarGesture, speedFromBarFraction } from './speed-bar.ts';
import type { SchematicMode, SystemMfdPage } from './schematic.ts';
import {
  DEFAULT_OFFICER_PAGE,
  isOfficerPage,
  LOG_CHANNELS,
  nearestMapZoom,
  type LogChannel,
  type OfficerPageId,
} from './officer-mfd.ts';
import { clampReinforceAmount, REINFORCE_STEP, selectFacing, toggleAllFacings } from './shield-select.ts';
import { selectWeaponClassSlots, toggleSlot } from './weapon-select.ts';
import { fieldRelease, orbitOnPress } from './tactical/pointer.ts';
import { pickContact } from './tactical/tags.ts';
import { createKeyTracker } from './input/keymap.ts';
import { runAction, type CommandHost } from './commands.ts';
import { mountKeymapDialog } from './keymap-dialog.ts';
import { createGameAudio } from './audio-out.ts';
import { headingToward } from './helm-aim.ts';
import { applyEmpireSkin } from './skins/apply.ts';
import { fitUiScale, formatUiScale } from './skins/scale.ts';
import { shieldHitAt } from './shield-hit.ts';
import { applyChromeBudget, fieldChromeBudget } from './tactical/chrome.ts';
import {
  fillShiplist,
  fillSynthetic,
  isDefaultDuelSetup,
  mountSkirmish,
  readSkirmish,
  skirmishMode,
  snapshotSlots,
  type SlotChoice,
} from './skirmish-ui.ts';

const space = document.getElementById('space');
if (!(space instanceof HTMLCanvasElement)) throw new Error('missing view');
const canvas: HTMLCanvasElement = space;

const pageSearch = location.search;
const hudScale = hudScaleFromLocation(pageSearch);
const scene = new DuelScene(canvas, { preserveDrawingBuffer: new URLSearchParams(pageSearch).get('smoke') === '1' });
let scale = 4;
const opening = syntheticFleet(readDefaultDuel());
let match: DuelMatch = opening.match;
let roster: readonly RosterEntry[] = opening.roster;
let selectedSlot = 0;
let selectedSlots: number[] = [0];
let selectedGroup = 0;
let selectedFacings: number[] = [];
let reinforceAmount = 1;
let systemMfd: SystemMfdPage = 'weapons';
let schematicMode: SchematicMode = 'mounts';
let mapZoom = nearestMapZoom(8);
let headingUp = false;
let mapFull = false;
let officerPage: OfficerPageId = DEFAULT_OFFICER_PAGE;
const logFilters: Record<LogChannel, boolean> = {
  engineering: true,
  mission: true,
  science: true,
  fleet: true,
};
let interfaceCollapsed = false;
let paused = false;
let latest: ViewModel | null = null;
let installVfs: Vfs | null = null;
let pendingHeading: number | null = null;
let audioMemory: AudioMemory = emptyAudioMemory();
const groups: number[][] = [[0], [1], [2], [3], [4], [5]];
const keys = createKeyTracker();
const audio = createGameAudio();

const source = document.getElementById('source');
if (source) source.textContent = `Synthetic skirmish · ${SYNTHETIC_FIXTURE_PATH}`;

void opening.groups.then((groups) => scene.setHulls(groups));

let setupCustomized = false;
let matchLive = false;

const slotsHost = document.getElementById('skirmish-slots');
if (slotsHost) {
  mountSkirmish(slotsHost, () => {
    setupCustomized = !isDefaultDuelSetup(skirmishMode(), snapshotSlots());
    void startSkirmish({ preview: true });
  });
}

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
  get selectedSlots() {
    return selectedSlots;
  },
  get selectedFacings() {
    return selectedFacings;
  },
  get reinforceAmount() {
    return reinforceAmount;
  },
  get schematicMode() {
    return schematicMode;
  },
  get officerPage() {
    return officerPage;
  },
  logFilters,
  onSelect(slot: number, additive = false) {
    selectedSlots = additive ? toggleSlot(selectedSlots, slot) : [slot];
    selectedSlot = slot;
  },
  onSchematicSelect(slot: number, additive = false) {
    selectedSlots = additive
      ? toggleSlot(selectedSlots, slot)
      : selectWeaponClassSlots(latest?.self?.weapons ?? [], slot);
    selectedSlot = slot;
    setSystemMfd('weapons');
  },
  onTarget(id: number) {
    match.setTarget(id);
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
    selectedSlots = [slot];
  },
  getSlots: () => selectedSlots,
  setSlots(slots) {
    selectedSlots = [...new Set(slots)];
    if (selectedSlots.length > 0 && !selectedSlots.includes(selectedSlot)) {
      selectedSlot = selectedSlots[0]!;
    }
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
    mapZoom = nearestMapZoom(zoom);
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
  get officerPage() {
    return officerPage;
  },
  setOfficerPage(page) {
    setOfficerPage(page);
  },
  get interfaceCollapsed() {
    return interfaceCollapsed;
  },
  setInterfaceCollapsed(on) {
    interfaceCollapsed = on;
    applyLayout();
  },
  getShieldSelection: () => selectedFacings,
  setShieldSelection(facings) {
    selectedFacings = [...facings];
  },
  getReinforceAmount: () => reinforceAmount,
  setReinforceAmount(points) {
    setPendingReinforce(points);
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

document.getElementById('ew-ecm')?.addEventListener('change', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  match.setEw(Number.isInteger(value) && value > 0 ? value : 0, match.plan.eccm);
});
document.getElementById('ew-eccm')?.addEventListener('change', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  match.setEw(match.plan.ecm, Number.isInteger(value) && value > 0 ? value : 0);
});
document.getElementById('tractor-energy')?.addEventListener('change', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  match.plan.tractorEnergy = Number.isInteger(value) && value > 0 ? value : 0;
});

let catalog: LoadedDuel | null = null;
let fillingShips = false;

document.getElementById('skirmish-start')?.addEventListener('click', () => {
  void startSkirmish();
});
document.getElementById('skirmish-3v3')?.addEventListener('click', () => {
  fillSynthetic('3v3');
  setupCustomized = true;
  void startSkirmish();
});

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
  if (keys.held('view.orbitLeft') || keys.held('view.orbitRight')) event.preventDefault();
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
  syncSpeedInput();
});

document.getElementById('shields')?.addEventListener('click', (event) => {
  const canvas = event.currentTarget;
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const hit = shieldHitAt(x, y, canvas.width, canvas.height);
  if (!hit) return;
  if (hit.kind === 'centre') selectedFacings = toggleAllFacings(selectedFacings);
  else selectedFacings = selectFacing(selectedFacings, hit.facing, event.shiftKey);
});

function setPendingReinforce(value: number): void {
  reinforceAmount = clampReinforceAmount(value);
  const amount = document.getElementById('reinforce-amount');
  const slider = document.getElementById('reinforce-slider');
  if (amount instanceof HTMLInputElement && document.activeElement !== amount) {
    amount.value = String(reinforceAmount);
  }
  if (slider instanceof HTMLInputElement) slider.value = String(reinforceAmount);
}

function onReinforceInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (event.type === 'input' && target.id === 'reinforce-amount' && target.value === '') return;
  setPendingReinforce(Number(target.value));
}

document.getElementById('reinforce-amount')?.addEventListener('input', onReinforceInput);
document.getElementById('reinforce-amount')?.addEventListener('change', onReinforceInput);
document.getElementById('reinforce-slider')?.addEventListener('input', onReinforceInput);
document.getElementById('reinforce-slider')?.addEventListener('change', onReinforceInput);

document.getElementById('reinforce-dec')?.addEventListener('click', () => {
  setPendingReinforce(reinforceAmount - REINFORCE_STEP);
});
document.getElementById('reinforce-inc')?.addEventListener('click', () => {
  setPendingReinforce(reinforceAmount + REINFORCE_STEP);
});

function setSystemMfd(page: SystemMfdPage): void {
  systemMfd = page;
  for (const node of document.querySelectorAll<HTMLElement>('[data-mfd-page]')) {
    node.hidden = node.dataset.mfdPage !== page;
  }
  for (const button of document.querySelectorAll<HTMLElement>('[data-mfd]')) {
    const on = button.dataset.mfd === page;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function setSchematicMode(mode: SchematicMode): void {
  schematicMode = mode;
  for (const button of document.querySelectorAll<HTMLElement>('[data-schematic-mode]')) {
    const on = button.dataset.schematicMode === mode;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function setOfficerPage(page: OfficerPageId): void {
  if (!isOfficerPage(page)) return;
  officerPage = page;
  for (const node of document.querySelectorAll<HTMLElement>('[data-officer-page]')) {
    node.classList.toggle('active', node.dataset.officerPage === page);
  }
  for (const button of document.querySelectorAll<HTMLElement>('[data-officer]')) {
    const on = button.dataset.officer === page;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function applyLogFilters(): void {
  for (const item of document.querySelectorAll<HTMLElement>('#log li')) {
    const channel = item.dataset.channel;
    const visible = channel === undefined || (isLogChannel(channel) && logFilters[channel]);
    item.dataset.filtered = visible ? '0' : '1';
  }
}

function isLogChannel(value: string): value is LogChannel {
  return (LOG_CHANNELS as readonly string[]).includes(value);
}

for (const button of document.querySelectorAll<HTMLElement>('[data-log-filter]')) {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const channel = button.dataset.logFilter;
    if (!channel || !isLogChannel(channel)) return;
    logFilters[channel] = !logFilters[channel];
    button.classList.toggle('active', logFilters[channel]);
    button.setAttribute('aria-pressed', logFilters[channel] ? 'true' : 'false');
    applyLogFilters();
  });
}

for (const button of document.querySelectorAll<HTMLElement>('[data-mfd]')) {
  button.addEventListener('click', () => {
    const page = button.dataset.mfd as SystemMfdPage | undefined;
    if (!page) return;
    audio.unlock();
    audio.play(['ui.click'], performance.now());
    setSystemMfd(page);
  });
}

for (const button of document.querySelectorAll<HTMLElement>('[data-schematic-mode]')) {
  button.addEventListener('click', () => {
    const mode = button.dataset.schematicMode as SchematicMode | undefined;
    if (!mode) return;
    audio.unlock();
    audio.play(['ui.click'], performance.now());
    setSchematicMode(mode);
  });
}

for (const oval of document.querySelectorAll<HTMLElement>('[data-group-oval]')) {
  oval.addEventListener('click', (event) => {
    const num = Number(oval.dataset.groupOval) + 1;
    if (num < 1 || num > 4) return;
    audio.unlock();
    audio.play(['ui.click'], performance.now());
    runAction(host, `${event.shiftKey ? 'weapons.assign' : 'weapons.group'}${String(num)}`);
  });
}

setSystemMfd(systemMfd);
setSchematicMode(schematicMode);

const stage = document.getElementById('stage');
let orbiting = false;
let dragX = 0;
let dragY = 0;
let downX = 0;
let downY = 0;
stage?.addEventListener('pointerdown', (event) => {
  downX = event.clientX;
  downY = event.clientY;
  dragX = event.clientX;
  dragY = event.clientY;
  // Plain left-press is helm. Only Alt+left and middle-drag orbit.
  if (orbitOnPress(event.button, event.altKey)) {
    orbiting = true;
    if (event.button === 1) event.preventDefault();
    audio.unlock();
    return;
  }
  if (event.button === 2) audio.unlock();
});
stage?.addEventListener('pointermove', (event) => {
  if (!orbiting) return;
  scene.orbitBy(event.clientX - dragX, event.clientY - dragY);
  dragX = event.clientX;
  dragY = event.clientY;
});
stage?.addEventListener('pointerup', (event) => {
  const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
  const gesture = fieldRelease(event.button, event.altKey, moved, hudScale);
  if (event.button === 0 || event.button === 1) orbiting = false;
  // Alt+left and middle-drag never steer, even when the press moved under 4 px.
  if (chromePointer(event.target)) return;
  if (gesture === 'target') targetAt(event.clientX, event.clientY);
  else if (gesture === 'steer') steerAt(event.clientX, event.clientY);
});
stage?.addEventListener('pointerleave', () => {
  orbiting = false;
});
stage?.addEventListener('contextmenu', (event) => event.preventDefault());
document.getElementById('offscreen-tags')?.addEventListener('click', (event) => {
  const node = event.target;
  if (!(node instanceof Element)) return;
  const button = node.closest<HTMLElement>('button[data-id]');
  if (!button?.dataset.id) return;
  match.setTarget(Number(button.dataset.id));
});
const speedBar = document.getElementById('field-speed-bar');
speedBar?.addEventListener('pointerdown', (event) => {
  if (speedBarGesture(event.type, event.button, false) !== 'start' || !(speedBar instanceof HTMLElement)) return;
  speedBar.setPointerCapture(event.pointerId);
  setSpeedFromBar(event.clientX);
});
speedBar?.addEventListener('pointermove', (event) => {
  if (!(speedBar instanceof HTMLElement)) return;
  if (speedBarGesture(event.type, event.button, speedBar.hasPointerCapture(event.pointerId)) !== 'move') return;
  setSpeedFromBar(event.clientX);
});
speedBar?.addEventListener('pointerup', (event) => releaseSpeedBar(speedBar, event));
speedBar?.addEventListener('pointercancel', (event) => releaseSpeedBar(speedBar, event));
speedBar?.addEventListener('wheel', (event) => {
  event.preventDefault();
}, { passive: false });
document.getElementById('field-cap')?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  const bar = event.currentTarget;
  if (!(bar instanceof HTMLElement)) return;
  const rect = bar.getBoundingClientRect();
  const fraction = rect.width <= 0 ? 0 : (event.clientX - rect.left) / rect.width;
  const request = Math.round(Math.max(0, Math.min(1, fraction)) * 20);
  match.setWeaponRequest(request);
  bar.setAttribute('aria-valuenow', String(request));
});
stage?.addEventListener('wheel', (event) => {
  if (chromePointer(event.target)) return;
  scene.dolly(event.deltaY > 0 ? 1.2 : -1.2);
  event.preventDefault();
}, { passive: false });

function chromePointer(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.plate, button, a, input, select, label') !== null;
}

function releaseSpeedBar(bar: Element, event: PointerEvent): void {
  if (!(bar instanceof HTMLElement) || !bar.hasPointerCapture(event.pointerId)) return;
  if (speedBarGesture(event.type, event.button, true) === 'end') setSpeedFromBar(event.clientX);
  bar.releasePointerCapture(event.pointerId);
}

function setSpeedFromBar(clientX: number): void {
  const bar = document.getElementById('field-speed-bar');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const fraction = barFractionFromClientX(clientX, rect.left, rect.width);
  const max = speedScale(latest?.self ?? null).max;
  const next = speedFromBarFraction(fraction, max);
  if (next === match.plan.speed) return;
  match.setSpeed(next);
  syncSpeedInput();
}

function targetAt(clientX: number, clientY: number): void {
  if (!latest || !stage) return;
  const rect = stage.getBoundingClientRect();
  const points = [];
  for (const contact of latest.contacts) {
    if (contact.kind === 'shot' || contact.hostility === 'self' || !contact.detected) continue;
    const ndc = scene.projectNdc(contact.x, contact.y);
    if (!ndc.inFront || ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) continue;
    points.push({
      id: contact.id,
      x: (ndc.x * 0.5 + 0.5) * rect.width,
      y: (1 - (ndc.y * 0.5 + 0.5)) * rect.height,
      kind: contact.kind,
    });
  }
  const id = pickContact(points, clientX - rect.left, clientY - rect.top, 28);
  if (id !== null) match.setTarget(id);
}

function ownShip(): { x: number; y: number } | null {
  return latest?.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'self') ?? null;
}

function bearingPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  if (latest && stage) {
    const rect = stage.getBoundingClientRect();
    const points = [];
    for (const contact of latest.contacts) {
      if (contact.kind === 'shot' || contact.hostility === 'self' || !contact.detected) continue;
      const ndc = scene.projectNdc(contact.x, contact.y);
      if (!ndc.inFront || ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) continue;
      points.push({
        id: contact.id,
        x: (ndc.x * 0.5 + 0.5) * rect.width,
        y: (1 - (ndc.y * 0.5 + 0.5)) * rect.height,
        kind: contact.kind,
      });
    }
    const id = pickContact(points, clientX - rect.left, clientY - rect.top, 28);
    const contact = id === null ? null : latest.contacts.find((item) => item.id === id);
    if (contact) return { x: contact.x, y: contact.y };
  }
  return scene.groundPoint(clientX, clientY);
}

function steerAt(clientX: number, clientY: number): void {
  const self = ownShip();
  if (!self) return;
  const point = bearingPoint(clientX, clientY);
  if (!point) return;
  const heading = headingToward(self.x, self.y, point.x, point.y);
  if (heading === null) return;
  pendingHeading = heading;
}

function uniqueSlots(slots: readonly number[]): number[] {
  const list: number[] = [];
  for (const slot of slots) {
    if (!list.includes(slot)) list.push(slot);
  }
  return list;
}

function officerMfdObstacle(stageRect: DOMRect | undefined): { left: number; top: number; right: number; bottom: number }[] {
  const mfd = document.getElementById('officer-mfd');
  if (!mfd || !stageRect) return [];
  const rect = mfd.getBoundingClientRect();
  return [{
    left: rect.left - stageRect.left,
    top: rect.top - stageRect.top,
    right: rect.right - stageRect.left,
    bottom: rect.bottom - stageRect.top,
  }];
}

function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function syncSpeedInput(): void {
  const input = document.getElementById('ordered-speed');
  if (input instanceof HTMLInputElement && document.activeElement !== input) {
    input.value = formatSpeed(match.plan.speed);
  }
}

function candidateLabel(candidate: LoadedDuel['candidates'][number]): string {
  const hull = candidate.hullType.length > 0 ? ` (${candidate.hullType})` : '';
  return `${candidate.race} ${candidate.className}${hull}`.trim();
}

function rosterLabel(entry: RosterEntry): string {
  const name = entry.name.trim();
  const empire = entry.empire.trim();
  if (empire.length === 0) return name;
  if (name.toLowerCase().startsWith(empire.toLowerCase())) return name;
  return `${empire} ${name}`;
}

function fillShipPicker(loaded: LoadedDuel, selectDefaults = true): void {
  const player = document.getElementById('player-ship');
  const opponent = document.getElementById('opponent-ship');
  if (!(player instanceof HTMLSelectElement) || !(opponent instanceof HTMLSelectElement)) return;
  const previousPlayer = player.value;
  const previousOpponent = opponent.value;
  fillingShips = true;
  player.replaceChildren();
  opponent.replaceChildren();
  for (let i = 0; i < loaded.candidates.length; i++) {
    const candidate = loaded.candidates[i];
    if (!candidate) continue;
    const weapon = candidate.supported ? '' : ' — no phaser or photon';
    for (const select of [player, opponent]) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `${candidateLabel(candidate)}${weapon}`;
      select.append(option);
    }
  }
  if (selectDefaults) {
    player.value = String(loaded.player);
    opponent.value = String(loaded.opponent);
  } else {
    if ([...player.options].some((option) => option.value === previousPlayer)) player.value = previousPlayer;
    if ([...opponent.options].some((option) => option.value === previousOpponent)) opponent.value = previousOpponent;
  }
  fillingShips = false;
}

function candidateIndexFor(entry: RosterEntry, loaded: LoadedDuel): number | null {
  const name = entry.name.trim().toLowerCase();
  const empire = entry.empire.trim().toLowerCase();
  const exact = loaded.candidates.findIndex((candidate) => {
    const className = candidate.className.trim().toLowerCase();
    const race = candidate.race.trim().toLowerCase();
    const label = candidateLabel(candidate).trim().toLowerCase();
    return (
      (className.length > 0 && (name === className || name.endsWith(` ${className}`))) &&
      (race.length === 0 || empire === race || name.startsWith(race))
    ) || label === name || label === `${empire} ${name}`.trim();
  });
  return exact >= 0 ? exact : null;
}

function ensurePickerOption(select: HTMLSelectElement, value: string, label: string): void {
  if (![...select.options].some((option) => option.value === value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  select.value = value;
}

/** Point "Your ship" / Opponent at the live roster, not the catalog default. */
function syncShipHeader(): void {
  const player = document.getElementById('player-ship');
  const opponent = document.getElementById('opponent-ship');
  if (!(player instanceof HTMLSelectElement) || !(opponent instanceof HTMLSelectElement)) return;
  const selfIndex = latest?.self?.index ?? match.selfIndex;
  const self = roster[selfIndex];
  const other = roster.find((_, index) => index !== selfIndex);
  fillingShips = true;
  if (self) {
    const value = catalog ? String(candidateIndexFor(self, catalog) ?? `roster:${String(selfIndex)}`) : `roster:${String(selfIndex)}`;
    ensurePickerOption(player, value, rosterLabel(self));
  }
  if (other) {
    const otherIndex = roster.indexOf(other);
    const value = catalog ? String(candidateIndexFor(other, catalog) ?? `roster:${String(otherIndex)}`) : `roster:${String(otherIndex)}`;
    ensurePickerOption(opponent, value, rosterLabel(other));
  }
  fillingShips = false;
}

function appendNote(note: string): void {
  const list = document.getElementById('log');
  if (!list) return;
  const item = document.createElement('li');
  item.textContent = note;
  list.append(item);
}

function shiplistOptions(loaded: LoadedDuel) {
  return loaded.candidates.map((candidate, index) => ({
    index,
    empire: candidate.race.length > 0 ? candidate.race : 'Empire',
    label: `${candidate.className} (${candidate.hullType})`,
  }));
}

function adoptLoaded(loaded: LoadedDuel, opts?: { replaceMatch?: boolean; resetSlots?: boolean }): void {
  const replaceMatch = opts?.replaceMatch ?? (!matchLive && !setupCustomized);
  const resetSlots = opts?.resetSlots ?? replaceMatch;
  catalog = loaded;
  installVfs = loaded.vfs;
  fillShipPicker(loaded, replaceMatch);
  fillShiplist(shiplistOptions(loaded), loaded.player, loaded.opponent, { reset: resetSlots });
  if (replaceMatch) {
    adopt(loaded.match, loaded.groups, loaded.roster, loaded.note);
    appendNote(loaded.note);
  } else {
    syncShipHeader();
    appendNote(`Install catalog ready. Skirmish setup unchanged.`);
  }
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
  adoptLoaded(loaded, { replaceMatch: true, resetSlots: false });
}

function adopt(next: DuelMatch, groups: readonly Group[], nextRoster: readonly RosterEntry[], note: string): void {
  match = next;
  roster = nextRoster;
  selectedSlot = 0;
  selectedSlots = [0];
  audioMemory = emptyAudioMemory();
  scene.setHulls(groups);
  match.setTimeScale(paused ? 0 : scale);
  if (source) source.textContent = note;
  document.body.dataset.ready = '0';
  syncShipHeader();
  void paintSkin();
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  if (pendingHeading !== null) {
    match.orderHeading(pendingHeading);
    pendingHeading = null;
  } else {
    if (keys.held('helm.turnLeft')) match.orderYaw(-8000);
    if (keys.held('helm.turnRight')) match.orderYaw(8000);
  }
  if (keys.held('view.orbitLeft')) scene.orbitBy(-16, 0);
  if (keys.held('view.orbitRight')) scene.orbitBy(16, 0);
  match.frame(dt);
  const vm = match.view();
  latest = vm;
  if (vm.contacts.some((contact) => contact.kind === 'ship')) {
    const wasReady = document.body.dataset.ready === '1';
    document.body.dataset.ready = '1';
    if (!wasReady) syncShipHeader();
  }
  document.body.dataset.camera = scene.cameraMode;
  scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
  const groupSlots = groups[selectedGroup] ?? [];
  const selection = uniqueSlots([
    ...selectedSlots,
    ...(groupSlots.includes(selectedSlot) ? groupSlots : [selectedSlot, ...groupSlots]),
  ]);
  scene.render(vm, now, selection);
  updateHud(vm, roster, hud, match.plan, now);
  const stageRect = stage?.getBoundingClientRect();
  const obstacles = officerMfdObstacle(stageRect);
  paintFieldHud({
    vm,
    roster,
    planSpeed: match.plan.speed,
    now,
    scale: hudScale,
    width: stageRect?.width ?? canvas.clientWidth,
    height: stageRect?.height ?? canvas.clientHeight,
    obstacles,
    project: (x, y) => scene.projectNdc(x, y),
  });
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
  applyLayout();
  scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
});

const pageInstall = new URLSearchParams(location.search).get('install');
mountKeymapDialog(keys, (text) => host.note(text));
bindVolume();
applyLayout();
bindUiScale();
void paintSkin();
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

function paintSkin(): Promise<string> {
  const empire = roster[match.selfIndex]?.empire ?? 'Federation';
  return applyEmpireSkin(empire, installVfs).then((text) => {
    host.note(text);
    return text;
  });
}

function applyLayout(): void {
  const consoleEl = document.getElementById('console');
  if (consoleEl) consoleEl.hidden = interfaceCollapsed;
  applyChromeBudget(fieldChromeBudget(window.innerHeight, hudScale, { consoleCollapsed: interfaceCollapsed }));
  scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
}

function bindUiScale(): void {
  const select = document.getElementById('ui-scale');
  if (!(select instanceof HTMLSelectElement)) return;
  const stored = localStorage.getItem('sfc2js.uiScale.v1');
  const fitted = formatUiScale(fitUiScale(window.innerWidth, window.innerHeight));
  const known = [...select.options].some((option) => option.value === stored);
  select.value = stored && known ? stored : fitted;
  const apply = () => {
    document.documentElement.style.setProperty('--ui-scale', select.value);
    localStorage.setItem('sfc2js.uiScale.v1', select.value);
    applyLayout();
  };
  select.addEventListener('change', apply);
  apply();
}

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

function readDefaultDuel(): SlotChoice[] {
  return [
    { control: 'you', side: 0, kind: 'synthetic', empireId: 'federation', classId: 'cruiser' },
    { control: 'ai', side: 1, kind: 'synthetic', empireId: 'klingon', classId: 'cruiser' },
  ];
}

function syntheticFleet(choices: readonly SlotChoice[]): {
  match: DuelMatch;
  roster: RosterEntry[];
  groups: Promise<Group[]>;
} {
  const built = layoutSynthetic(choices);
  return {
    match: createFleetMatch({
      seed: 0x5f33,
      setups: built.setups,
      fleet: built.fleet,
      timeScale: scale,
    }),
    roster: built.roster,
    groups: loadFleetHulls(built.hulls),
  };
}

function layoutSynthetic(choices: readonly SlotChoice[]): {
  setups: ReturnType<typeof syntheticSetup>[];
  fleet: FleetSlot[];
  roster: RosterEntry[];
  hulls: { tint: { r: number; g: number; b: number }; shape: PlaceholderShape }[];
} {
  const active = choices.filter((choice): choice is Extract<SlotChoice, { kind: 'synthetic' }> => {
    return choice.control !== 'empty' && choice.kind === 'synthetic';
  });
  const counts = [0, 0];
  for (const choice of active) counts[choice.side] = (counts[choice.side] ?? 0) + 1;
  const seen = [0, 0];
  const setups = [];
  const fleet: FleetSlot[] = [];
  const nextRoster: RosterEntry[] = [];
  const hulls: { tint: { r: number; g: number; b: number }; shape: PlaceholderShape }[] = [];
  for (const choice of active) {
    const at = linePosition(seen[choice.side] ?? 0, counts[choice.side] ?? 1, choice.side);
    seen[choice.side] = (seen[choice.side] ?? 0) + 1;
    setups.push(syntheticSetup(choice.classId));
    nextRoster.push(syntheticRoster(choice.empireId, choice.classId));
    const empire = empireById(choice.empireId);
    const hull = classById(choice.classId);
    hulls.push({
      tint: empire?.tint ?? { r: 79, g: 143, b: 214 },
      shape: hull?.shape ?? 'ca',
    });
    fleet.push({
      setupIndex: setups.length - 1,
      x: at.x,
      y: at.y,
      heading: at.heading,
      side: choice.side,
      control: choice.control === 'you' ? 'manual' : 'ai',
    });
  }
  return { setups, fleet, roster: nextRoster, hulls };
}

let previewGen = 0;

async function startSkirmish(opts?: { preview?: boolean }): Promise<void> {
  const preview = opts?.preview === true;
  if (preview && matchLive) return;
  const choices = readSkirmish();
  const occupied = choices.filter((choice) => choice.control !== 'empty');
  const alert = document.getElementById('alert');
  if (occupied.length < 1) {
    if (!preview && alert) alert.textContent = 'Pick at least one ship.';
    return;
  }
  if (!occupied.some((choice) => choice.control === 'you')) {
    if (!preview && alert) alert.textContent = 'Mark one slot as you.';
    return;
  }
  const gen = ++previewGen;
  if (occupied.some((choice) => choice.kind === 'shiplist')) {
    await startShiplist(choices, { preview, gen });
    return;
  }
  const built = syntheticFleet(choices);
  const groups = await built.groups;
  if (preview && (matchLive || gen !== previewGen)) return;
  if (!preview) matchLive = true;
  adopt(built.match, groups, built.roster, `Synthetic skirmish · ${String(occupied.length)} ships`);
  if (alert && !preview) alert.textContent = '';
}

async function startShiplist(
  choices: readonly SlotChoice[],
  opts?: { preview?: boolean; gen?: number },
): Promise<void> {
  const preview = opts?.preview === true;
  if (preview && matchLive) return;
  if (!catalog) return;
  const alert = document.getElementById('alert');
  const active = choices.filter((choice): choice is Extract<SlotChoice, { kind: 'shiplist' }> => {
    return choice.control !== 'empty' && choice.kind === 'shiplist';
  });
  const counts = [0, 0];
  for (const choice of active) counts[choice.side] = (counts[choice.side] ?? 0) + 1;
  const seen = [0, 0];
  const setups = [];
  const fleet: FleetSlot[] = [];
  const nextRoster: RosterEntry[] = [];
  const groups: Group[] = [];
  for (const choice of active) {
    const candidate = catalog.candidates[choice.candidateIndex];
    if (!candidate) {
      if (!preview && alert) alert.textContent = 'That ship is not in the list.';
      return;
    }
    const at = linePosition(seen[choice.side] ?? 0, counts[choice.side] ?? 1, choice.side);
    seen[choice.side] = (seen[choice.side] ?? 0) + 1;
    setups.push(candidate.setup);
    nextRoster.push({
      name: candidate.className.length > 0 ? candidate.className : candidate.spawnKey,
      empire: candidate.race.length > 0 ? candidate.race : 'Empire',
      accent: '#4F8FD6',
      modelFile: candidate.geometry,
    });
    const shape: PlaceholderShape = groups.length % 2 === 0 ? 'ca' : 'd7';
    const path = candidate.geometry.replaceAll('\\', '/');
    const resolved = path.length > 0 ? catalog.vfs.resolve(path) : null;
    const modelBytes = resolved ? await catalog.vfs.read(resolved) : null;
    const modelPath = resolved ?? `${FIXTURE_MODEL_DIR}/test-${shape}.mod`;
    const tint = shape === 'd7' ? { r: 178, g: 58, b: 58 } : { r: 79, g: 143, b: 214 };
    const group = await groupFromMod(modelBytes ?? placeholderHullMod(tint, shape), modelPath, catalog.vfs);
    groups.push(group ?? new Group());
    fleet.push({
      setupIndex: setups.length - 1,
      x: at.x,
      y: at.y,
      heading: at.heading,
      side: choice.side,
      control: choice.control === 'you' ? 'manual' : 'ai',
    });
  }
  const next = createFleetMatch({
    seed: 0x5f33,
    setups,
    fleet,
    timeScale: scale,
  });
  if (preview && (matchLive || (opts?.gen != null && opts.gen !== previewGen))) return;
  if (!preview) matchLive = true;
  adopt(next, groups, nextRoster, `Skirmish · ${String(active.length)} ships from the install.`);
  if (alert && !preview) alert.textContent = '';
}
