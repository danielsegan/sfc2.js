import type { RosterEntry } from '../../engine/duel/fixture.ts';
import { toDisplayHeading } from '../../engine/view/units.ts';
import type { HudEvent, ViewModel, WeaponReadout } from '../../engine/view/view-model.ts';

const FACING = ['Bow', 'Forward starboard', 'Aft starboard', 'Stern', 'Aft port', 'Forward port'];

export interface HudHandles {
  selectedSlot: number;
  onSelect(slot: number): void;
}

export function updateHud(vm: ViewModel, roster: readonly RosterEntry[], hud: HudHandles, now: number): void {
  const self = vm.self;
  const target = vm.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'hostile');
  text('tick', String(vm.tick));
  text('speed', self ? String(self.speed) : '0');
  text('heading', self ? formatDeg(self.heading16) : '—');
  text('plan', self ? String(self.energy.planTicksLeft) : '0');
  text('gen-warp', fmt(self?.energy.warp ?? 0));
  text('gen-impulse', fmt(self?.energy.impulse ?? 0));
  text('gen-battery', `${fmt(self?.energy.battery ?? 0)} / ${fmt(self?.energy.batteryCapacity ?? 0)}`);
  text('energy-reason', self && self.energy.lastReason && self.energy.lastReason !== 'ok' ? self.energy.lastReason : '');
  text('target-name', target ? roster[target.index]?.name ?? 'Contact' : 'No contact');
  text('target-range', target ? fmt(target.rangeFromSelf) : '—');
  text('target-bearing', target && self ? formatDeg(bearing(self.heading16, selfContact(vm), target)) : '—');
  text('target-shields', target ? target.shields.map((facing) => String(facing.current)).join(' · ') : '');
  const alert = latestAlert(vm.events);
  text('alert', alert);
  appendLog(vm);
  drawShields(vm, now);
  drawMap(vm, hud.selectedSlot);
  renderWeapons(vm, hud);
  renderContacts(vm, roster);
  renderShieldTable(vm);
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
    return `${mark}  ${event.id}`;
  }
  if (event.kind === 'sim') return `${mark}  Event ${String(event.code)}`;
  return null;
}

let weaponKey = '';

function renderWeapons(vm: ViewModel, hud: HudHandles): void {
  const host = document.getElementById('weapons');
  if (!host) return;
  const weapons = vm.self?.weapons ?? [];
  const key = weapons.map((weapon) => `${String(weapon.slotIndex)}:${weapon.code}:${weapon.status}`).join('|');
  if (key !== weaponKey) {
    weaponKey = key;
    host.replaceChildren();
    if (weapons.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No mounts. Fire still sends the order.';
      host.append(empty);
    }
    for (const weapon of weapons) host.append(weaponButton(weapon, hud));
  } else {
    for (const weapon of weapons) updateWeapon(weapon, hud.selectedSlot);
  }
}

function weaponButton(weapon: WeaponReadout, hud: HudHandles): HTMLButtonElement {
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
  paintWeapon(button, weapon, hud.selectedSlot);
  return button;
}

function updateWeapon(weapon: WeaponReadout, selected: number): void {
  const button = document.querySelector<HTMLButtonElement>(`button[data-slot="${String(weapon.slotIndex)}"]`);
  if (!button) return;
  paintWeapon(button, weapon, selected);
}

function paintWeapon(button: HTMLButtonElement, weapon: WeaponReadout, selected: number): void {
  button.classList.toggle('selected', weapon.slotIndex === selected);
  button.classList.toggle('ready', weapon.ready);
  const meta = button.querySelector('[data-role="meta"]');
  const state = button.querySelector('[data-role="state"]');
  const fill = button.querySelector<HTMLElement>('[data-role="fill"]');
  const label = `${fmt(weapon.charge)} / ${String(weapon.cost)}`;
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
    if (contact.kind === 'shot') continue;
    const row = document.createElement('tr');
    const name = roster[contact.index]?.name ?? `Ship ${String(contact.index)}`;
    row.append(cell(contact.hostility === 'self' ? `${name} (you)` : name));
    row.append(cell(fmt(contact.rangeFromSelf)));
    row.append(cell(String(contact.speed)));
    body.append(row);
  }
}

function renderShieldTable(vm: ViewModel): void {
  const body = document.querySelector('#shield-table tbody');
  if (!body || !vm.self) return;
  body.replaceChildren();
  vm.self.shields.forEach((facing, index) => {
    const row = document.createElement('tr');
    row.append(cell(FACING[index] ?? String(index)));
    row.append(cell(`${String(facing.current)} / ${String(facing.max)}`));
    body.append(row);
  });
}

function cell(value: string): HTMLTableCellElement {
  const node = document.createElement('td');
  node.textContent = value;
  return node;
}

const flashes = new Map<number, number>();

function drawShields(vm: ViewModel, now: number): void {
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
  }
}

function drawMap(vm: ViewModel, selected: number): void {
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
  const size = 200;
  const x = width - size - 16;
  const y = 16;
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
  ctx.fillText('SENSOR', x + 10, y + 18);
  const cx = x + size / 2;
  const cy = y + size / 2 + 8;
  const scale = 6;
  ctx.strokeStyle = '#3a4a5c';
  for (const ring of [5, 10]) {
    ctx.beginPath();
    ctx.arc(cx, cy, ring * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  const self = vm.contacts.find((contact) => contact.hostility === 'self');
  const weapon = vm.self?.weapons.find((item) => item.slotIndex === selected) ?? vm.self?.weapons[0];
  if (self && weapon) {
    ctx.strokeStyle = 'rgba(79, 163, 224, 0.9)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const sweep = weapon.arcFull ? 65536 : wrapSpan(weapon.arcFrom16, weapon.arcTo16);
    const steps = weapon.arcFull ? 24 : 8;
    for (let i = 0; i <= steps; i++) {
      const bam = self.heading16 + weapon.arcFrom16 + (sweep * i) / steps;
      const ang = (bam / 65536) * Math.PI * 2;
      ctx.lineTo(cx + Math.cos(ang) * 10 * scale, cy - Math.sin(ang) * 10 * scale);
    }
    ctx.stroke();
  }
  for (const contact of vm.contacts) {
    const px = cx + (self ? contact.x - self.x : contact.x) * scale;
    const py = cy - (self ? contact.y - self.y : contact.y) * scale;
    const ang = (contact.heading16 / 65536) * Math.PI * 2;
    const point = (lx: number, ly: number) => {
      const sx = Math.cos(ang) * lx - Math.sin(ang) * ly;
      const sy = Math.sin(ang) * lx + Math.cos(ang) * ly;
      return [px + sx, py - sy] as const;
    };
    ctx.fillStyle = contact.kind === 'shot' ? '#f2b33d' : contact.hostility === 'self' ? '#5fb7ff' : '#ff6b5e';
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
  }
}

function wrapSpan(from16: number, to16: number): number {
  const span = to16 - from16;
  return span <= 0 ? span + 65536 : span;
}
