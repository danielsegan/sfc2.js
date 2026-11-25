import type { RosterEntry } from '../../engine/duel/fixture.ts';
import type { DuelPlan } from '../../engine/duel/match.ts';
import { MODE_OVERLOAD, MODE_PROXIMITY } from '../../engine/sim/rules-tables.ts';
import { toDisplayHeading } from '../../engine/view/units.ts';
import type { HelmView, HudEvent, ViewModel, WeaponReadout } from '../../engine/view/view-model.ts';
import { EMPIRE_MARKS, empireIdForRace, empireMarkFor } from './empire-marks.ts';
import { mapOffset } from './map-geom.ts';
import {
  arcPieSvgPath,
  drawPlaceholderHull,
  facingTowardPoint,
  hardpointPositions,
  scanGatedTargetStatus,
  type SchematicMode,
} from './schematic.ts';
import { FACING_NAMES, formatFacingList, normalizeFacings } from './shield-select.ts';
import {
  classifyLogChannel,
  mapEmpireColor,
  mapRingDistances,
  mapZoomIndex,
  MAP_ZOOM_LEVELS,
  type LogChannel,
} from './officer-mfd.ts';
import { formatSpeed } from './speed-bar.ts';
import { supportsProximity } from './weapon-select.ts';

/** Sim ticks are 30 Hz. HET delay is shown in seconds. */
export const TICKS_PER_SECOND = 30;

export function formatHetDelay(helm: Pick<HelmView, 'mode' | 'hetDelayTicks'> | null | undefined): string {
  if (!helm || helm.mode !== 'het') return '—';
  return `${(helm.hetDelayTicks / TICKS_PER_SECOND).toFixed(1)} s`;
}

export interface HudHandles {
  selectedSlot: number;
  selectedSlots: readonly number[];
  group: number;
  groups: readonly (readonly number[])[];
  mapZoom: number;
  headingUp: boolean;
  mapFull: boolean;
  targetId: number | null;
  selectedFacings: readonly number[];
  reinforceAmount: number;
  schematicMode: SchematicMode;
  officerPage?: string;
  logFilters?: Readonly<Partial<Record<LogChannel, boolean>>>;
  onSelect(slot: number, additive?: boolean): void;
  onSchematicSelect?(slot: number, additive?: boolean): void;
  onTarget?(id: number): void;
}

export interface MapFrame {
  left: number;
  top: number;
  size: number;
  scale: number;
  cx: number;
  cy: number;
  headingUp: boolean;
  self: { x: number; y: number; heading16: number } | null;
}

export let mapFrame: MapFrame | null = null;

export function updateHud(vm: ViewModel, roster: readonly RosterEntry[], hud: HudHandles, plan: DuelPlan, now: number): void {
  const self = vm.self;
  const target = (hud.targetId !== null
    ? vm.contacts.find((contact) => contact.kind === 'ship' && contact.id === hud.targetId)
    : undefined)
    ?? vm.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'hostile' && contact.detected);
  text('tick', String(vm.tick));
  text('speed', self ? formatSpeed(self.speed) : formatSpeed(0));
  text('speed-ordered', String(plan.speed));
  text('heading', self ? formatDeg(self.heading16) : '—');
  text('heading-ordered', self && self.orderedHeading16 !== null ? formatDeg(self.orderedHeading16) : '—');
  text('turn-ticks', self && self.turnTicksRemaining !== null ? String(self.turnTicksRemaining) : '—');
  text('het-delay', formatHetDelay(self?.helm));
  text('plan', self ? String(self.energy.planTicksLeft) : '0');
  text('gen-warp', fmt(self?.energy.warp ?? 0));
  text('gen-impulse', fmt(self?.energy.impulse ?? 0));
  text('gen-apr', fmt(self?.energy.apr ?? 0));
  text('gen-battery', `${fmt(self?.energy.battery ?? 0)} / ${fmt(self?.energy.batteryCapacity ?? 0)}`);
  text('energy-reason', self && self.energy.lastReason && self.energy.lastReason !== 'ok' ? self.energy.lastReason : '');
  const shift = self && self.netShift !== null ? String(self.netShift) : '—';
  text('ew-status', self ? `ECM ${String(self.ecm)} · ECCM ${String(self.eccm)} · shift ${shift}` : 'No ship');
  barWidth('ew-ecm-bar', self ? self.ecm : 0);
  barWidth('ew-eccm-bar', self ? self.eccm : 0);
  text('tractor-status', self ? `${tractorName(self.tractorMode)} · ${self.tractorLink ? 'holding' : 'idle'} · ${String(self.tractorPaid)}` : 'Idle');
  const cloakLabel = !self || !self.cloakFitted ? 'Not fitted' : cloakName(self.cloakState, self.cloakTicks);
  text('cloak-status', cloakLabel);
  const cloakButton = document.getElementById('cloak');
  if (cloakButton) {
    cloakButton.toggleAttribute('disabled', self ? !self.cloakFitted : true);
    cloakButton.textContent = self && self.cloakState !== 0 ? 'Decloak' : 'Cloak';
  }
  const energy = document.getElementById('energy');
  energy?.classList.toggle('overdraw', self?.energy.lastReason === 'overDraw');
  syncField('ordered-speed', formatSpeed(plan.speed));
  syncField('general', String(plan.general));
  syncCheck('life', plan.lifeSupport);
  syncCheck('fire-control', plan.fireControl);
  syncField('weapon-energy', plan.weaponRequest === null ? '' : String(plan.weaponRequest));
  syncField('ew-ecm', String(plan.ecm));
  syncField('ew-eccm', String(plan.eccm));
  syncField('tractor-energy', String(plan.tractorEnergy));
  const ready = self?.craft.fighterReady ?? 0;
  const pfs = self?.craft.pfReady ?? 0;
  const rearming = self?.craft.rearming ?? 0;
  const rearm = rearming > 0 ? ` · ${String(rearming)} rearming` : '';
  text('fighter-status', `${countWord(ready, 'fighter', 'fighters')} · ${countWord(pfs, 'PF', 'PFs')}${rearm}`);
  text('mine-status', `${countWord(self?.craft.mines ?? 0, 'mine', 'mines')} · ${countWord(self?.craft.boarding ?? 0, 'party', 'parties')}`);
  text('transporter-status', self ? `${countWord(self.craft.boarding, 'boarding party', 'boarding parties')} ready` : 'No ship');
  renderTargetSchematic(vm, self, target, roster, hud);
  const alert = latestAlert(vm.events, vm.self?.id);
  text('alert', alert);
  appendLog(vm, hud);
  drawShields(vm, plan, hud, now);
  drawShipSchematic(vm, self, target, plan, now);
  renderSchematicHardpoints(vm, hud, plan);
  drawMap(vm, roster, hud);
  renderFleetRoster(vm, roster);
  renderWeapons(vm, hud, plan);
  syncWeaponsMfdSummary(vm, hud, plan);
  syncProximityButton(vm, hud, plan);
  renderContacts(vm, roster);
  renderShieldTable(vm, plan, hud);
}

function barWidth(id: string, points: number): void {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLElement)) return;
  const pct = Math.max(0, Math.min(100, points * 8));
  node.style.width = `${String(pct)}%`;
}

function cloakName(state: number, ticks: number): string {
  if (state === 1) return `engaging ${String(ticks)}`;
  if (state === 2) return 'cloaked';
  if (state === 3) return `decloaking ${String(ticks)}`;
  return 'off';
}

function tractorName(mode: number): string {
  if (mode === 1) return 'hold';
  if (mode === 2) return 'repel';
  if (mode === 3) return 'reinforce';
  return 'off';
}

function countWord(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function selfContact(vm: ViewModel) {
  return vm.contacts.find((contact) => contact.hostility === 'self');
}

function bearing(heading: number, self: { x: number; y: number } | undefined, target: { x: number; y: number }): number {
  if (!self) return 0;
  const abs = (Math.atan2(target.y - self.y, target.x - self.x) / (Math.PI * 2)) * 65536;
  let rel = abs - heading;
  rel %= 65536;
  if (rel < 0) rel += 65536;
  return rel;
}

function syncField(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node instanceof HTMLInputElement && document.activeElement !== node && node.value !== value) node.value = value;
}

function syncCheck(id: string, on: boolean): void {
  const node = document.getElementById(id);
  if (node instanceof HTMLInputElement && document.activeElement !== node) node.checked = on;
}

function text(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}

function fmt(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatDeg(bam: number): string {
  return `${Math.round(toDisplayHeading(bam))}°`;
}

export function isOtherShipYawClamp(event: HudEvent, selfId: number | null | undefined): boolean {
  return event.kind === 'alert' && event.id === 'yawClamped' && (selfId == null || event.ship !== selfId);
}

export function latestAlert(events: readonly HudEvent[], selfId?: number | null): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;
    if (isOtherShipYawClamp(event, selfId)) continue;
    if (event.kind === 'hit') return `Hit on facing ${String(event.facing)}, ${String(event.amount)} absorbed`;
    if (event.kind === 'alert' && event.id !== 'ok' && event.id !== 'helm') return event.id;
    if (event.kind === 'sim') return `sim ${String(event.code)}`;
  }
  return '';
}

const seen = new Set<string>();

function appendLog(vm: ViewModel, hud: HudHandles): void {
  const list = document.getElementById('log');
  if (!list) return;
  const selfId = vm.self?.id;
  let added = false;
  for (const event of vm.events) {
    if (isOtherShipYawClamp(event, selfId)) {
      console.debug('yawClamped', event);
      continue;
    }
    const line = hudLogLine(vm.tick, event, selfId);
    if (!line) continue;
    const key = `${String(vm.tick)}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const channel = classifyLogChannel(event);
    const item = document.createElement('li');
    item.textContent = line;
    item.dataset.channel = channel;
    const visible = hud.logFilters?.[channel] !== false;
    item.dataset.filtered = visible ? '0' : '1';
    list.append(item);
    added = true;
  }
  while (list.childElementCount > 200) list.firstElementChild?.remove();
  if (added) list.lastElementChild?.scrollIntoView({ block: 'end' });
}

export function hudLogLine(tick: number, event: HudEvent, selfId?: number | null): string | null {
  if (isOtherShipYawClamp(event, selfId)) return null;
  const mark = `t${String(tick)}`;
  if (event.kind === 'hit') return `${mark}  Hit facing ${String(event.facing)}, absorbed ${String(event.amount)}`;
  if (event.kind === 'alert') {
    if (event.id === 'ok') return `${mark}  Order applied (${String(event.amount)})`;
    if (event.id === 'helm') return null;
    if (event.id === 'headingOrdered') return `${mark}  Heading ordered ${formatDeg(event.amount)}`;
    if (event.id === 'yawClamped') return `${mark}  Yaw clamped to ${String(event.amount)}`;
    if (event.id === 'turnModeUnverified') {
      return `${mark}  Turn mode unverified; using fallback yaw ${String(event.amount)}`;
    }
    if (event.id === 'hetActive') return `${mark}  hetActive`;
    if (event.id === 'hetInvalidDir') return `${mark}  hetInvalidDir`;
    return `${mark}  ${event.id}`;
  }
  if (event.kind === 'sim') return `${mark}  Event ${String(event.code)}`;
  return null;
}

let weaponKey = '';

function renderWeapons(vm: ViewModel, hud: HudHandles, plan: DuelPlan): void {
  const host = document.getElementById('weapons');
  if (!host) return;
  const weapons = vm.self?.weapons ?? [];
  const key = weapons.map((weapon) => `${String(weapon.slotIndex)}:${weapon.code}:${weapon.status}:${String(weapon.mode)}:${String(plan.modes[weapon.slotIndex] ?? -1)}`).join('|');
  if (key !== weaponKey) {
    weaponKey = key;
    host.replaceChildren();
    if (weapons.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No mounts.';
      host.append(empty);
    }
    for (const weapon of weapons) host.append(weaponButton(weapon, hud, plan));
  } else {
    for (const weapon of weapons) updateWeapon(weapon, hud, plan);
  }
}

function weaponButton(weapon: WeaponReadout, hud: HudHandles, plan: DuelPlan): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `weapon${weapon.ready ? ' ready' : ''}${weapon.slotIndex === hud.selectedSlot ? ' selected' : ''}`;
  button.dataset.slot = String(weapon.slotIndex);
  const icon = document.createElement('img');
  icon.alt = '';
  icon.width = 24;
  icon.height = 24;
  icon.src = weapon.family === 'photon' ? './art/icon-warhead.svg' : './art/icon-phaser.svg';
  const copy = document.createElement('span');
  copy.className = 'copy';
  const title = document.createElement('span');
  title.textContent = `${weapon.code}  ${weapon.arc}`;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.dataset.role = 'meta';
  const bar = document.createElement('span');
  bar.className = 'bar';
  const fill = document.createElement('span');
  fill.dataset.role = 'fill';
  bar.append(fill);
  copy.append(title, meta, bar);
  const state = document.createElement('span');
  state.className = 'meta';
  state.dataset.role = 'state';
  button.append(icon, copy, state);
  button.addEventListener('click', (event) => hud.onSelect(weapon.slotIndex, event.shiftKey));
  paintWeapon(button, weapon, hud, plan);
  return button;
}

function updateWeapon(weapon: WeaponReadout, hud: HudHandles, plan: DuelPlan): void {
  const button = document.querySelector<HTMLButtonElement>(`button[data-slot="${String(weapon.slotIndex)}"]`);
  if (!button) return;
  paintWeapon(button, weapon, hud, plan);
}

function paintWeapon(button: HTMLButtonElement, weapon: WeaponReadout, hud: HudHandles, plan: DuelPlan): void {
  const grouped = hud.groups[hud.group]?.includes(weapon.slotIndex) === true;
  const picked = hud.selectedSlots.includes(weapon.slotIndex) || weapon.slotIndex === hud.selectedSlot;
  button.classList.toggle('selected', picked);
  button.classList.toggle('ready', weapon.ready);
  const meta = button.querySelector('[data-role="meta"]');
  const state = button.querySelector('[data-role="state"]');
  const fill = button.querySelector<HTMLElement>('[data-role="fill"]');
  const mode = plan.modes[weapon.slotIndex] ?? weapon.mode;
  const badge = mode === MODE_OVERLOAD ? 'OVL' : mode === MODE_PROXIMITY ? 'PROX' : '';
  const label = `${fmt(weapon.charge)} / ${String(weapon.cost)}${badge ? ` ${badge}` : ''}${grouped ? ` g${String(hud.group + 1)}` : ''}`;
  if (meta) meta.textContent = label;
  if (state) state.textContent = weapon.status;
  if (fill) {
    const pct = weapon.cost > 0 ? Math.max(0, Math.min(1, weapon.charge / weapon.cost)) : weapon.ready ? 1 : 0;
    fill.style.width = `${String(Math.round(pct * 100))}%`;
  }
}

function selectionSlots(hud: HudHandles): number[] {
  return hud.selectedSlots.length > 0 ? [...hud.selectedSlots] : [hud.selectedSlot];
}

/** Show the Proximity toggle only when a selected mount is a photon. */
function syncProximityButton(vm: ViewModel, hud: HudHandles, plan: DuelPlan): void {
  const button = document.getElementById('weapons-proximity');
  if (!(button instanceof HTMLButtonElement)) return;
  const weapons = vm.self?.weapons ?? [];
  const slots = selectionSlots(hud);
  const supported = slots.some((slot) => supportsProximity(weapons.find((item) => item.slotIndex === slot)));
  button.hidden = !supported;
  button.disabled = !supported;
  const armed = slots.some((slot) => {
    const weapon = weapons.find((item) => item.slotIndex === slot);
    const mode = plan.modes[slot] ?? weapon?.mode;
    return supportsProximity(weapon) && mode === MODE_PROXIMITY;
  });
  button.setAttribute('aria-pressed', armed ? 'true' : 'false');
}

function renderContacts(vm: ViewModel, roster: readonly RosterEntry[]): void {

  const body = document.querySelector('#contacts tbody');
  if (!body) return;
  body.replaceChildren();
  for (const contact of vm.contacts) {
    if (contact.kind === 'shot' || !contact.detected) continue;
    const row = document.createElement('tr');
    const named = roster[contact.index]?.name ?? `Ship ${String(contact.index)}`;
    const name = contact.kind === 'fighter' ? 'Fighter' : contact.kind === 'mine' ? 'Mine' : named;
    const who = contact.hostility === 'self' ? 'you' : contact.control === 'ai' ? 'AI' : contact.hostility;
    const side = contact.side < 0 ? '' : contact.side === 0 ? 'A ' : 'B ';
    row.append(cell(`${side}${name} (${who})`));
    row.append(cell(fmt(contact.rangeFromSelf)));
    row.append(cell(String(contact.speed)));
    body.append(row);
  }
}

function renderShieldTable(vm: ViewModel, plan: DuelPlan, hud: HudHandles): void {
  const body = document.querySelector('#shield-table tbody');
  if (!body || !vm.self) return;
  const selected = new Set(normalizeFacings(hud.selectedFacings));
  body.replaceChildren();
  vm.self.shields.forEach((facing, index) => {
    const row = document.createElement('tr');
    if (selected.has(index)) row.className = 'selected';
    row.append(cell(FACING_NAMES[index] ?? String(index)));
    row.append(cell(`${String(facing.current)} / ${String(facing.max)}`));
    row.append(cell(String(plan.specific[index] ?? 0)));
    const pending = selected.has(index) ? cell(String(hud.reinforceAmount)) : cell('—');
    if (selected.has(index) && hud.reinforceAmount !== (plan.specific[index] ?? 0)) pending.classList.add('pending');
    row.append(pending);
    body.append(row);
  });
  text('shield-selection', formatFacingList(hud.selectedFacings));
  text('shield-committed', formatCommitted(plan));
}

function formatCommitted(plan: DuelPlan): string {
  const parts: string[] = [];
  if (plan.general > 0) parts.push(`General ${String(plan.general)}`);
  plan.specific.forEach((points, index) => {
    if ((points ?? 0) > 0) parts.push(`${FACING_NAMES[index] ?? String(index)} ${String(points)}`);
  });
  return parts.length > 0 ? parts.join(' · ') : 'None';
}

function cell(value: string): HTMLTableCellElement {
  const node = document.createElement('td');
  node.textContent = value;
  return node;
}

const flashes = new Map<number, number>();

function drawShields(vm: ViewModel, plan: DuelPlan, hud: HudHandles, now: number): void {
  const canvas = document.getElementById('shields');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  for (const event of vm.events) {
    if (event.kind === 'hit' && vm.self && event.ship === vm.self.id) flashes.set(event.facing, now + 150);
  }
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const radius = 68;
  ctx.strokeStyle = '#8a9aab';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 28);
  ctx.lineTo(cx + 16, cy + 18);
  ctx.lineTo(cx, cy + 8);
  ctx.lineTo(cx - 16, cy + 18);
  ctx.closePath();
  const selected = new Set(normalizeFacings(hud.selectedFacings));
  const allSelected = selected.size === 6;
  if (allSelected) {
    ctx.fillStyle = 'rgba(79, 143, 214, 0.28)';
    ctx.fill();
  }
  ctx.strokeStyle = allSelected ? '#ffffff' : '#8a9aab';
  ctx.lineWidth = allSelected ? 2 : 1;
  ctx.stroke();
  const shields = vm.self?.shields ?? [];
  for (let i = 0; i < 6; i++) {
    const facing = shields[i];
    const start = -Math.PI / 2 - Math.PI / 6 + i * (Math.PI / 3);
    const end = start + Math.PI / 3;
    const ratio = facing && facing.max > 0 ? facing.current / facing.max : 0;
    const gap = 0.06;
    const mid = (start + end) / 2;
    if (selected.has(i)) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start + gap, end - gap);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 14;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start + gap, end - gap);
    ctx.strokeStyle = ratio <= 0 ? '#e5484d' : ratio < 0.25 ? '#f2b33d' : '#5fd3a0';
    ctx.lineWidth = flashes.get(i) !== undefined && (flashes.get(i) ?? 0) > now ? 8 : selected.has(i) ? 6 : 4;
    if (ratio > 0 && ratio < 0.25) ctx.setLineDash([3, 3]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (selected.has(i)) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start + gap, end - gap);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const labelAt = radius - 18;
    ctx.fillStyle = selected.has(i) ? '#ffffff' : '#d8e2ec';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(facing?.current ?? 0), cx + Math.cos(mid) * labelAt, cy + Math.sin(mid) * labelAt);
    const committed = plan.specific[i] ?? 0;
    const extra = committed > 0 || (facing?.reinforced ?? 0) > 0;
    if (extra) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 8, start + gap, end - gap);
      ctx.strokeStyle = '#f2b33d';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (selected.has(i) && hud.reinforceAmount > 0 && hud.reinforceAmount !== committed) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 12, start + gap, end - gap);
      ctx.strokeStyle = '#4f8fd6';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function clearOverlay(): void {
  const canvas = document.getElementById('overlay');
  const stage = document.getElementById('stage');
  if (!(canvas instanceof HTMLCanvasElement) || !stage) return;
  const rect = stage.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${String(width)}px`;
    canvas.style.height = `${String(height)}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
}

function syncMapChrome(hud: HudHandles): void {
  const index = mapZoomIndex(hud.mapZoom);
  text('map-zoom-label', `Zoom ${String(index + 1)} / ${String(MAP_ZOOM_LEVELS.length)} · ×${String(hud.mapZoom)}`);
  const heading = document.getElementById('map-heading');
  if (heading) heading.textContent = hud.headingUp ? 'HDG' : 'N';
  const zoomOut = document.querySelector<HTMLButtonElement>('[data-action="view.mapZoomOut"]');
  const zoomIn = document.querySelector<HTMLButtonElement>('[data-action="view.mapZoomIn"]');
  zoomOut?.toggleAttribute('disabled', index <= 0);
  zoomIn?.toggleAttribute('disabled', index >= MAP_ZOOM_LEVELS.length - 1);
}

function drawMap(vm: ViewModel, roster: readonly RosterEntry[], hud: HudHandles): void {
  clearOverlay();
  syncMapChrome(hud);
  const canvas = document.getElementById('officer-map');
  if (!(canvas instanceof HTMLCanvasElement)) {
    mapFrame = null;
    return;
  }
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(32, Math.floor(canvas.clientWidth || 180));
  const height = Math.max(32, Math.floor(canvas.clientHeight || 140));
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${String(width)}px`;
    canvas.style.height = `${String(height)}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    mapFrame = null;
    return;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const scale = hud.mapZoom;
  const radius = Math.max(8, Math.min(cx, cy) - 4);
  const self = vm.contacts.find((contact) => contact.hostility === 'self');
  const selfPose = self ? { x: self.x, y: self.y, heading16: self.heading16 } : undefined;
  mapFrame = {
    left: 0,
    top: 0,
    size: Math.min(width, height),
    scale,
    cx,
    cy,
    headingUp: hud.headingUp,
    self: selfPose ?? null,
  };
  const toScreen = (wx: number, wy: number): [number, number] => {
    const offset = mapOffset({ x: wx, y: wy }, selfPose, hud.headingUp);
    return [cx + offset.x * scale, cy - offset.y * scale];
  };
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#627488';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'left';
  for (const ring of mapRingDistances(scale, radius)) {
    const ringPx = ring * scale;
    if (ringPx <= 0) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, ringPx, 0, Math.PI * 2);
    ctx.strokeStyle = '#627488';
    ctx.stroke();
    ctx.fillStyle = '#8a9aab';
    ctx.fillText(String(ring), cx + 3, cy - ring * scale);
  }
  const weapon = vm.self?.weapons.find((item) => item.slotIndex === hud.selectedSlot) ?? vm.self?.weapons[0];
  if (self && weapon) {
    ctx.strokeStyle = 'rgba(79, 163, 224, 0.9)';
    ctx.beginPath();
    const origin = toScreen(self.x, self.y);
    ctx.moveTo(origin[0], origin[1]);
    const sweep = weapon.arcFull ? 65536 : wrapSpan(weapon.arcFrom16, weapon.arcTo16);
    const steps = weapon.arcFull ? 24 : 8;
    for (let i = 0; i <= steps; i++) {
      const bam = self.heading16 + weapon.arcFrom16 + (sweep * i) / steps;
      const ang = (bam / 65536) * Math.PI * 2;
      const at = toScreen(self.x + Math.cos(ang) * 10, self.y + Math.sin(ang) * 10);
      ctx.lineTo(at[0], at[1]);
    }
    ctx.stroke();
  }
  for (const contact of vm.contacts) {
    if (!contact.detected) continue;
    const at = toScreen(contact.x, contact.y);
    const px = at[0];
    const py = at[1];
    let ang = (contact.heading16 / 65536) * Math.PI * 2;
    if (hud.headingUp && self) ang += Math.PI / 2 - (self.heading16 / 65536) * Math.PI * 2;
    const targeted = contact.id === hud.targetId;
    if (contact.kind === 'shot' || contact.kind === 'mine' || contact.kind === 'fighter') {
      ctx.fillStyle = contact.kind === 'shot' ? '#f2b33d' : contact.kind === 'mine' ? '#8a9aab' : '#d9a441';
      ctx.beginPath();
      if (contact.kind === 'shot') {
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 3, py);
        ctx.lineTo(px, py + 3);
        ctx.lineTo(px - 3, py);
      } else {
        ctx.arc(px, py, contact.kind === 'fighter' ? 3 : 2.5, 0, Math.PI * 2);
      }
      ctx.fill();
    } else {
      const empire = roster[contact.index]?.empire ?? '';
      const mark = empireMarkFor(empire);
      const color = mapEmpireColor(mark.id);
      const size = contact.hostility === 'self' ? 14 : 12;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(size / 16, size / 16);
      ctx.translate(-8, -8);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(empireMarkPath(mark.id));
      ctx.restore();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(ang) * 8, py - Math.sin(ang) * 8);
      ctx.stroke();
    }
    if (targeted) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 8, py - 8, 16, 16);
    }
  }
}

const empireMarkPaths = new Map<string, Path2D>();

function empireMarkPath(id: string): Path2D {
  let path = empireMarkPaths.get(id);
  if (!path) {
    const mark = EMPIRE_MARKS[id as keyof typeof EMPIRE_MARKS] ?? EMPIRE_MARKS.neutral;
    path = new Path2D(mark.path);
    empireMarkPaths.set(id, path);
  }
  return path;
}

function renderFleetRoster(vm: ViewModel, roster: readonly RosterEntry[]): void {
  const host = document.getElementById('fleet-roster');
  if (!host) return;
  host.replaceChildren();
  const ships = vm.contacts.filter((contact) => contact.kind === 'ship' && contact.detected);
  if (ships.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No ships on sensors.';
    host.append(empty);
    return;
  }
  for (const contact of ships) {
    const row = document.createElement('div');
    const name = roster[contact.index]?.name ?? `Ship ${String(contact.index)}`;
    const empire = roster[contact.index]?.empire ?? '';
    const who = contact.hostility === 'self' ? 'you' : contact.control === 'ai' ? 'AI' : contact.hostility;
    const side = contact.side < 0 ? '' : contact.side === 0 ? 'A · ' : 'B · ';
    row.textContent = `${side}${name} · ${empire} · ${who}`;
    host.append(row);
  }
}

let targetKey = '';

function renderTargetList(vm: ViewModel, roster: readonly RosterEntry[], hud: HudHandles): void {
  const host = document.getElementById('target-list');
  if (!host) return;
  const ships = vm.contacts.filter((contact) => contact.kind === 'ship');
  const key = ships.map((contact) => `${String(contact.id)}:${contact.hostility}:${contact.id === hud.targetId ? '1' : '0'}`).join('|');
  if (key === targetKey) return;
  targetKey = key;
  host.replaceChildren();
  for (const contact of ships) {
    const button = document.createElement('button');
    button.type = 'button';
    const name = roster[contact.index]?.name ?? `Ship ${String(contact.index)}`;
    const side = contact.side < 0 ? '' : contact.side === 0 ? 'A · ' : 'B · ';
    const who = contact.hostility === 'self' ? 'you' : contact.control === 'ai' ? 'AI' : contact.hostility;
    const selected = contact.id === hud.targetId;
    button.textContent = `${side}${name} · ${who}`;
    button.className = `${contact.hostility}${selected ? ' selected' : ''}`;
    button.addEventListener('click', () => hud.onTarget?.(contact.id));
    host.append(button);
  }
}

function renderTargetSchematic(
  vm: ViewModel,
  self: ViewModel['self'],
  target: ViewModel['contacts'][number] | undefined,
  roster: readonly RosterEntry[],
  hud: HudHandles,
): void {
  const scan = scanGatedTargetStatus(target);
  text('target-scan-state', scan.scanLabel);
  text('target-weapon-status', scan.weaponStatusLabel);
  text('target-name', target ? roster[target.index]?.name ?? 'Contact' : 'No contact');
  text('target-class', target ? roster[target.index]?.empire ?? '' : 'Tab to target');
  const visible = Boolean(target && target.detected);
  text('target-range', visible && target ? fmt(target.rangeFromSelf) : '—');
  text('target-speed', visible && target ? fmt(target.speed) : '—');
  text('target-bearing', visible && target && self ? formatDeg(bearing(self.heading16, selfContact(vm), target)) : '—');
  text(
    'target-hull',
    target && scan.shieldVisible ? `${String(target.hull.forward)} · ${String(target.hull.center)} · ${String(target.hull.aft)}` : '—',
  );
  text(
    'target-shields',
    target && scan.shieldVisible ? target.shields.map((facing) => String(facing.current)).join(' · ') : '',
  );
  drawTargetShields(vm, target, roster, scan.shieldVisible);
  renderTargetList(vm, roster, hud);
}

function drawTargetShields(
  vm: ViewModel,
  target: ViewModel['contacts'][number] | undefined,
  roster: readonly RosterEntry[],
  shieldVisible: boolean,
): void {
  const canvas = document.getElementById('target-shields-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.38;
  const targetEmpire = target ? empireIdForRace(roster[target.index]?.empire ?? '') : 'neutral';
  drawPlaceholderHull(ctx, cx, cy, radius, targetEmpire, shieldVisible ? '#8a9aab' : '#55606b');
  const selfPos = selfContact(vm);
  const facingUs = target && selfPos && shieldVisible ? facingTowardPoint(target.heading16, target, selfPos) : null;
  const shields = target?.shields ?? [];
  for (let i = 0; i < 6; i++) {
    const start = -Math.PI / 2 - Math.PI / 6 + i * (Math.PI / 3);
    const end = start + Math.PI / 3;
    const gap = 0.08;
    const facing = shields[i];
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start + gap, end - gap);
    if (!shieldVisible || !target) {
      ctx.strokeStyle = '#55606b';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const ratio = facing && facing.max > 0 ? facing.current / facing.max : 0;
    ctx.strokeStyle = ratio <= 0 ? '#e5484d' : ratio < 0.25 ? '#f2b33d' : '#5fd3a0';
    ctx.lineWidth = facingUs === i ? 5 : 3;
    if (ratio > 0 && ratio < 0.25) ctx.setLineDash([3, 3]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (facingUs === i) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, start + gap, end - gap);
      ctx.strokeStyle = '#ff6b5e';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const mid = (start + end) / 2;
    const labelAt = radius - 13;
    ctx.fillStyle = facingUs === i ? '#ffffff' : '#d8e2ec';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(facing?.current ?? 0), cx + Math.cos(mid) * labelAt, cy + Math.sin(mid) * labelAt);
  }
}

function drawShipSchematic(
  vm: ViewModel,
  self: ViewModel['self'],
  target: ViewModel['contacts'][number] | undefined,
  plan: DuelPlan,
  now: number,
): void {
  const canvas = document.getElementById('ship-schematic-shields');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.42;
  const empire = document.body.dataset.empire ?? 'fed';
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f8fd6';
  drawPlaceholderHull(ctx, cx, cy, radius, empire, accent, 'rgba(79, 143, 214, 0.08)');
  const selfPos = selfContact(vm);
  const facingTarget = self && selfPos && target && target.detected && !target.cloaked
    ? facingTowardPoint(self.heading16, selfPos, target)
    : null;
  const shields = self?.shields ?? [];
  for (let i = 0; i < 6; i++) {
    const facing = shields[i];
    const start = -Math.PI / 2 - Math.PI / 6 + i * (Math.PI / 3);
    const end = start + Math.PI / 3;
    const gap = 0.07;
    const ratio = facing && facing.max > 0 ? facing.current / facing.max : 0;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start + gap, end - gap);
    ctx.strokeStyle = ratio <= 0 ? '#e5484d' : ratio < 0.25 ? '#f2b33d' : '#5fd3a0';
    ctx.lineWidth = flashes.get(i) !== undefined && (flashes.get(i) ?? 0) > now ? 6 : 3;
    if (ratio > 0 && ratio < 0.25) ctx.setLineDash([3, 3]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
    if ((plan.specific[i] ?? 0) > 0 || (facing?.reinforced ?? 0) > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 5, start + gap, end - gap);
      ctx.strokeStyle = '#f2b33d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (facingTarget === i) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 5, start + gap, end - gap);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

let hardpointKey = '';

function renderSchematicHardpoints(vm: ViewModel, hud: HudHandles, plan: DuelPlan): void {
  const host = document.getElementById('schematic-hardpoints');
  if (!host) return;
  const weapons = vm.self?.weapons ?? [];
  const readyCount = weapons.filter((w) => w.ready).length;
  text('ship-schematic-summary', `${String(readyCount)}/${String(weapons.length)} ready`);
  const positions = hardpointPositions(weapons);
  const key = `${hud.schematicMode}:${weapons.map((w) => `${String(w.slotIndex)}:${w.family}:${String(w.arcFrom16)}:${String(w.arcTo16)}`).join('|')}`;
  if (key !== hardpointKey) {
    hardpointKey = key;
    host.replaceChildren();
    for (const weapon of weapons) {
      const pos = positions.find((item) => item.slotIndex === weapon.slotIndex);
      if (!pos) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hardpoint';
      button.dataset.hardpointSlot = String(weapon.slotIndex);
      button.style.left = `${String(pos.xPct)}%`;
      button.style.top = `${String(pos.yPct)}%`;
      button.title = `${weapon.code} (${weapon.arc})`;
      if (hud.schematicMode === 'arcs') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 20 20');
        svg.setAttribute('aria-hidden', 'true');
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', '10');
        ring.setAttribute('cy', '10');
        ring.setAttribute('r', '7');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', '#627488');
        ring.setAttribute('stroke-width', '1');
        const wedge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        wedge.setAttribute('d', arcPieSvgPath(weapon.arcFrom16, weapon.arcTo16, weapon.arcFull));
        wedge.setAttribute('fill', '#4fa3e0');
        wedge.setAttribute('fill-opacity', '0.5');
        wedge.setAttribute('stroke', '#4fa3e0');
        wedge.setAttribute('stroke-width', '1');
        svg.append(ring, wedge);
        button.append(svg);
      } else {
        const icon = document.createElement('img');
        icon.alt = '';
        icon.width = 14;
        icon.height = 14;
        icon.src = weapon.family === 'photon' ? './art/icon-warhead.svg' : './art/icon-phaser.svg';
        button.append(icon);
      }
      const bar = document.createElement('span');
      bar.className = 'hp-bar';
      const fill = document.createElement('span');
      fill.dataset.role = 'fill';
      bar.append(fill);
      const grp = document.createElement('span');
      grp.className = 'hp-grp';
      grp.dataset.role = 'grp';
      button.append(bar, grp);
      button.addEventListener('click', (event) => {
        if (hud.onSchematicSelect) hud.onSchematicSelect(weapon.slotIndex, event.shiftKey);
        else hud.onSelect(weapon.slotIndex, event.shiftKey);
      });
      host.append(button);
    }
  }
  for (const weapon of weapons) {
    const button = host.querySelector<HTMLButtonElement>(`button[data-hardpoint-slot="${String(weapon.slotIndex)}"]`);
    if (!button) continue;
    const picked = hud.selectedSlots.includes(weapon.slotIndex) || weapon.slotIndex === hud.selectedSlot;
    const mode = plan.modes[weapon.slotIndex] ?? weapon.mode;
    const destroyed = weapon.boxesMax > 0 && weapon.boxes <= 0;
    button.classList.toggle('selected', picked);
    button.classList.toggle('ready', weapon.ready);
    button.classList.toggle('overload', mode === MODE_OVERLOAD);
    button.classList.toggle('destroyed', destroyed);
    const fill = button.querySelector<HTMLElement>('[data-role="fill"]');
    if (fill) {
      const pct = weapon.cost > 0 ? Math.max(0, Math.min(1, weapon.charge / weapon.cost)) : weapon.ready ? 1 : 0;
      fill.style.width = `${String(Math.round(pct * 100))}%`;
    }
    const grp = button.querySelector<HTMLElement>('[data-role="grp"]');
    if (grp) {
      const groupIdx = hud.groups.findIndex((members) => members.includes(weapon.slotIndex));
      grp.textContent = groupIdx >= 0 ? String(groupIdx + 1) : '';
      grp.hidden = groupIdx < 0;
    }
  }
}

function syncWeaponsMfdSummary(vm: ViewModel, hud: HudHandles, plan: DuelPlan): void {
  const weapons = vm.self?.weapons ?? [];
  const slots = selectionSlots(hud);
  const picked = weapons.filter((w) => slots.includes(w.slotIndex));
  const active = picked[0] ?? weapons[0];
  const families = new Set(picked.map((w) => w.family));
  const phaserClass = picked.length > 0 && families.size === 1 && active?.family === 'phaser';
  const title =
    picked.length === 0
      ? 'No mounts'
      : families.size > 1
        ? 'MULTIPLE'
        : active?.family === 'phaser'
          ? 'PHASERS'
          : active?.family === 'photon'
            ? 'PHOTONS'
            : (active?.code ?? 'Weapons');
  text('mfd-weapon-title', title);
  const normalBtn = document.getElementById('weapons-normal');
  if (normalBtn instanceof HTMLButtonElement) normalBtn.textContent = phaserClass ? 'Online' : 'Normal';
  const overloadBtn = document.getElementById('weapons-overload');
  if (overloadBtn instanceof HTMLButtonElement) {
    overloadBtn.hidden = phaserClass;
    overloadBtn.disabled = phaserClass;
  }
  const bar = document.getElementById('mfd-weapon-bar');
  const barWrap = bar?.parentElement;
  if (bar instanceof HTMLElement) {
    const pct = active && active.cost > 0 ? Math.max(0, Math.min(1, active.charge / active.cost)) : active?.ready ? 1 : 0;
    bar.style.width = `${String(Math.round(pct * 100))}%`;
  }
  barWrap?.classList.toggle('ready', Boolean(active?.ready));
  const arcPath = document.getElementById('mfd-weapon-arc-path');
  if (arcPath) {
    arcPath.setAttribute('d', active ? arcPieSvgPath(active.arcFrom16, active.arcTo16, active.arcFull) : '');
  }
  const anyOverload = picked.some((w) => (plan.modes[w.slotIndex] ?? w.mode) === MODE_OVERLOAD);
  const anyProx = picked.some((w) => (plan.modes[w.slotIndex] ?? w.mode) === MODE_PROXIMITY);
  document.getElementById('weapons-overload')?.setAttribute('aria-pressed', anyOverload ? 'true' : 'false');
  document.getElementById('weapons-normal')?.setAttribute('aria-pressed', !anyOverload && !anyProx ? 'true' : 'false');
  for (const oval of document.querySelectorAll<HTMLElement>('[data-group-oval]')) {
    const idx = Number(oval.dataset.groupOval);
    const activeGroup = idx === hud.group;
    oval.classList.toggle('active', activeGroup);
    oval.setAttribute('aria-pressed', activeGroup ? 'true' : 'false');
  }
}

function wrapSpan(from16: number, to16: number): number {
  const span = to16 - from16;
  return span <= 0 ? span + 65536 : span;
}
