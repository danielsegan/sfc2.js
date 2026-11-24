import type { RosterEntry } from '../../engine/duel/fixture.ts';
import type { DuelPlan } from '../../engine/duel/match.ts';
import { MODE_OVERLOAD, MODE_PROXIMITY } from '../../engine/sim/rules-tables.ts';
import { toDisplayHeading } from '../../engine/view/units.ts';
import type { HudEvent, ViewModel, WeaponReadout } from '../../engine/view/view-model.ts';
import { mapOffset } from './map-geom.ts';

const FACING = ['Bow', 'Forward starboard', 'Aft starboard', 'Stern', 'Aft port', 'Forward port'];

export interface HudHandles {
  selectedSlot: number;
  group: number;
  groups: readonly (readonly number[])[];
  mapZoom: number;
  headingUp: boolean;
  mapFull: boolean;
  targetId: number | null;
  onSelect(slot: number): void;
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
  const target = vm.contacts.find((contact) => contact.kind === 'ship' && contact.id === hud.targetId && contact.detected)
    ?? vm.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'hostile' && contact.detected);
  text('tick', String(vm.tick));
  text('speed', self ? String(self.speed) : '0');
  text('speed-ordered', String(plan.speed));
  text('heading', self ? formatDeg(self.heading16) : '—');
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
  syncField('ordered-speed', String(plan.speed));
  syncField('general', String(plan.general));
  syncCheck('life', plan.lifeSupport);
  syncCheck('fire-control', plan.fireControl);
  syncField('weapon-energy', plan.weaponRequest === null ? '' : String(plan.weaponRequest));
  syncField('ew-ecm', String(plan.ecm));
  syncField('ew-eccm', String(plan.eccm));
  syncField('tractor-energy', String(plan.tractorEnergy));
  text('target-name', target ? roster[target.index]?.name ?? 'Contact' : 'No contact');
  text('target-class', target ? roster[target.index]?.empire ?? '' : 'Tab to target');
  text('target-range', target ? fmt(target.rangeFromSelf) : '—');
  text('target-bearing', target && self ? formatDeg(bearing(self.heading16, selfContact(vm), target)) : '—');
  text('target-shields', target ? target.shields.map((facing) => String(facing.current)).join(' · ') : '');
  renderTargetList(vm, roster, hud);
  const alert = latestAlert(vm.events);
  text('alert', alert);
  appendLog(vm);
  drawShields(vm, plan, now);
  drawMap(vm, hud);
  renderWeapons(vm, hud, plan);
  renderContacts(vm, roster);
  renderShieldTable(vm, plan);
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

function latestAlert(events: readonly HudEvent[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;
    if (event.kind === 'hit') return `Hit on facing ${String(event.facing)}, ${String(event.amount)} absorbed`;
    if (event.kind === 'alert' && event.id !== 'ok' && event.id !== 'helm') return event.id;
    if (event.kind === 'sim') return `sim ${String(event.code)}`;
  }
  return '';
}

const seen = new Set<string>();

function appendLog(vm: ViewModel): void {
  const list = document.getElementById('log');
  if (!list) return;
  for (const event of vm.events) {
    const line = logLine(vm.tick, event);
    if (!line) continue;
    const key = `${String(vm.tick)}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = document.createElement('li');
    item.textContent = line;
    list.append(item);
  }
  while (list.childElementCount > 200) list.firstElementChild?.remove();
}

function logLine(tick: number, event: HudEvent): string | null {
  const mark = `t${String(tick)}`;
  if (event.kind === 'hit') return `${mark}  Hit facing ${String(event.facing)}, absorbed ${String(event.amount)}`;
  if (event.kind === 'alert') {
    if (event.id === 'ok') return `${mark}  Order applied (${String(event.amount)})`;
    if (event.id === 'helm') return null;
    if (event.id === 'yawClamped') return `${mark}  Yaw clamped to ${String(event.amount)}`;
    if (event.id === 'turnModeUnverified') {
      return `${mark}  Turn mode unverified; using fallback yaw ${String(event.amount)}`;
    }
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
  button.addEventListener('click', () => hud.onSelect(weapon.slotIndex));
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
  button.classList.toggle('selected', weapon.slotIndex === hud.selectedSlot);
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

function renderContacts(vm: ViewModel, roster: readonly RosterEntry[]): void {
  const body = document.querySelector('#contacts tbody');
  if (!body) return;
  body.replaceChildren();
  for (const contact of vm.contacts) {
    if (contact.kind === 'shot' || !contact.detected) continue;
    const row = document.createElement('tr');
    const name = roster[contact.index]?.name ?? `Ship ${String(contact.index)}`;
    const who = contact.hostility === 'self' ? 'you' : contact.control === 'ai' ? 'AI' : contact.hostility;
    const side = contact.side < 0 ? '' : contact.side === 0 ? 'A ' : 'B ';
    row.append(cell(`${side}${name} (${who})`));
    row.append(cell(fmt(contact.rangeFromSelf)));
    row.append(cell(String(contact.speed)));
    body.append(row);
  }
}

function renderShieldTable(vm: ViewModel, plan: DuelPlan): void {
  const body = document.querySelector('#shield-table tbody');
  if (!body || !vm.self) return;
  body.replaceChildren();
  vm.self.shields.forEach((facing, index) => {
    const row = document.createElement('tr');
    row.append(cell(FACING[index] ?? String(index)));
    row.append(cell(`${String(facing.current)} / ${String(facing.max)}`));
    row.append(cell(String(plan.specific[index] ?? 0)));
    body.append(row);
  });
}

function cell(value: string): HTMLTableCellElement {
  const node = document.createElement('td');
  node.textContent = value;
  return node;
}

const flashes = new Map<number, number>();

function drawShields(vm: ViewModel, plan: DuelPlan, now: number): void {
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
  ctx.stroke();
  const shields = vm.self?.shields ?? [];
  for (let i = 0; i < 6; i++) {
    const facing = shields[i];
    const start = -Math.PI / 2 - Math.PI / 6 + i * (Math.PI / 3);
    const end = start + Math.PI / 3;
    const ratio = facing && facing.max > 0 ? facing.current / facing.max : 0;
    ctx.beginPath();
    const gap = 0.06;
    ctx.arc(cx, cy, radius, start + gap, end - gap);
    ctx.strokeStyle = ratio <= 0 ? '#e5484d' : ratio < 0.25 ? '#f2b33d' : '#5fd3a0';
    ctx.lineWidth = flashes.get(i) !== undefined && (flashes.get(i) ?? 0) > now ? 8 : 4;
    if (ratio > 0 && ratio < 0.25) ctx.setLineDash([3, 3]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
    const mid = (start + end) / 2;
    const labelAt = radius - 18;
    ctx.fillStyle = '#d8e2ec';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(facing?.current ?? 0), cx + Math.cos(mid) * labelAt, cy + Math.sin(mid) * labelAt);
    const extra = (plan.specific[i] ?? 0) > 0 || (facing?.reinforced ?? 0) > 0;
    if (extra) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 8, start + gap, end - gap);
      ctx.strokeStyle = '#f2b33d';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawMap(vm: ViewModel, hud: HudHandles): void {
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
  const size = hud.mapFull ? Math.min(width, height) - 32 : 220;
  const x = hud.mapFull ? Math.floor((width - size) / 2) : width - size - 16;
  const y = hud.mapFull ? 16 : 16;
  ctx.fillStyle = 'rgba(11, 17, 24, 0.85)';
  ctx.strokeStyle = '#3a4a5c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size, y + size - 6);
  ctx.lineTo(x + size - 6, y + size);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4f8fd6';
  ctx.fillRect(x, y, size, 2);
  ctx.fillStyle = '#8a9aab';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(hud.headingUp ? 'SENSOR  HDG' : 'SENSOR  NORTH', x + 10, y + 18);
  const cx = x + size / 2;
  const cy = y + size / 2 + 8;
  const scale = hud.mapZoom;
  const self = vm.contacts.find((contact) => contact.hostility === 'self');
  const selfPose = self ? { x: self.x, y: self.y, heading16: self.heading16 } : undefined;
  mapFrame = {
    left: x,
    top: y,
    size,
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
  ctx.strokeStyle = '#3a4a5c';
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'left';
  for (const ring of [5, 10]) {
    ctx.beginPath();
    ctx.arc(cx, cy, ring * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8a9aab';
    ctx.fillText(String(ring), cx + 4, cy - ring * scale);
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
    const point = (lx: number, ly: number) => {
      const sx = Math.cos(ang) * lx - Math.sin(ang) * ly;
      const sy = Math.sin(ang) * lx + Math.cos(ang) * ly;
      return [px + sx, py - sy] as const;
    };
    const targeted = contact.id === hud.targetId;
    ctx.fillStyle = contact.kind === 'shot' ? '#f2b33d' : contact.hostility === 'self' ? '#5fb7ff' : contact.hostility === 'friendly' ? '#5fd3a0' : '#ff6b5e';
    ctx.beginPath();
    if (contact.kind === 'shot') {
      ctx.moveTo(px, py - 3);
      ctx.lineTo(px + 3, py);
      ctx.lineTo(px, py + 3);
      ctx.lineTo(px - 3, py);
    } else if (contact.hostility === 'self') {
      const nose = point(7, 0);
      const left = point(-5, 4);
      const right = point(-5, -4);
      ctx.moveTo(nose[0], nose[1]);
      ctx.lineTo(left[0], left[1]);
      ctx.lineTo(right[0], right[1]);
    } else {
      ctx.rect(px - 4, py - 4, 8, 8);
    }
    ctx.fill();
    if (targeted) {
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(px - 7, py - 7, 14, 14);
    }
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

function wrapSpan(from16: number, to16: number): number {
  const span = to16 - from16;
  return span <= 0 ? span + 65536 : span;
}
