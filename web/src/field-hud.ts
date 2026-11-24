/**
 * Thin upper and lower displays, plus off-screen tags.
 * Reads the view model. Does not touch the sim.
 */
import type { RosterEntry } from '../../engine/duel/fixture.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import { empireMarkFor, renderEmpireMark } from './empire-marks.ts';
import {
  alertLamp,
  barSize,
  capacitorFraction,
  hullFraction,
  hudFrame,
  missionClock,
  powerBars,
  soonestCountdown,
  speedScale,
  turnFraction,
} from './tactical/frame.ts';
import { avoidObstacles, formatRangeTag, offscreenPoint, stackTags, type Rect, type StackedTag } from './tactical/tags.ts';
import { TAG_HIT_UNITS, TAG_STACK_UNITS } from './tactical/tokens.ts';

interface Projected {
  readonly x: number;
  readonly y: number;
  readonly inFront: boolean;
}

export interface FieldHudInput {
  readonly vm: ViewModel;
  readonly roster: readonly RosterEntry[];
  readonly planSpeed: number;
  readonly now: number;
  readonly scale: number;
  readonly width: number;
  readonly height: number;
  readonly obstacles: readonly Rect[];
  project(x: number, y: number): Projected;
}

const eventLines: { text: string; until: number }[] = [];

/** D3: 1.0–4.0 in 0.25 steps. Values outside that range clamp, then snap. */
export function hudScaleFromLocation(search: string): number {
  const raw = new URLSearchParams(search).get('hudScale');
  if (raw === null || raw.trim() === '') return 1;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  const clamped = Math.min(4, Math.max(1, value));
  const snapped = Math.round(clamped / 0.25) * 0.25;
  const rounded = Math.round(snapped * 100) / 100;
  if (rounded < 1) return 1;
  if (rounded > 4) return 4;
  return rounded;
}

export function applyHudFrame(width: number, height: number, scale: number): void {
  const frame = hudFrame(width, height);
  const root = document.documentElement;
  root.style.setProperty('--hud-scale', String(scale));
  root.style.setProperty('--hud-frame-left', `${String(frame.left)}px`);
  root.style.setProperty('--hud-frame-width', `${String(frame.width)}px`);
  root.style.setProperty('--hud-safe-left', `${String(frame.safeLeft)}px`);
  root.dataset.hudMode = frame.mode;
  root.dataset.hudScale = String(scale);
  document.getElementById('top-bar')?.classList.toggle('wide', frame.mode === 'wide');
  document.getElementById('bottom-bar')?.classList.toggle('wide', frame.mode === 'wide');
}

export function paintFieldHud(input: FieldHudInput): void {
  // The stage can be a short strip under the skirmish row. The 4:3 frame
  // is the window, not that strip, or a wide short stage looks ultrawide.
  applyHudFrame(window.innerWidth, window.innerHeight, input.scale);
  const self = input.vm.self;
  const target = input.vm.contacts.find((contact) => contact.kind !== 'shot' && contact.id === input.vm.targetId)
    ?? input.vm.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'hostile');
  setBar('field-hull-fill', self ? hullFraction(self.id, self.hull) : 0);
  setBar('field-target-fill', target ? hullFraction(target.id, target.hull) : 0);
  setBar('field-cap-fill', capacitorFraction(self?.weapons ?? []));
  text('field-clock', missionClock(input.vm.tick));
  text('field-countdown', soonestCountdown(input.vm.mission.timers));
  const name = target ? input.roster[target.index]?.name ?? 'Contact' : 'No target';
  text('field-target-name', name);
  text('field-speed', self ? String(self.speed) : '0');
  const speedBar = document.getElementById('field-speed-bar');
  if (speedBar) {
    speedBar.setAttribute('aria-valuenow', String(input.planSpeed));
    speedBar.setAttribute('aria-valuetext', `Desired speed ${String(input.planSpeed)}`);
  }
  const speeds = speedScale(self);
  setBar('field-speed-fill', self ? Math.max(0, Math.min(1, self.speed / speeds.max)) : 0);
  const marker = document.getElementById('field-speed-marker');
  if (marker) marker.style.left = `${String(Math.round(Math.max(0, Math.min(speeds.max, input.planSpeed)) / speeds.max * 100))}%`;
  const powerTick = document.getElementById('field-speed-power');
  if (powerTick) {
    if (speeds.powerTick === null) {
      powerTick.hidden = true;
    } else {
      powerTick.hidden = false;
      const fraction = Math.max(0, Math.min(1, speeds.powerTick / speeds.max));
      powerTick.style.left = `${String(Math.round(fraction * 100))}%`;
    }
  }
  const turn = turnFraction(self);
  setBar('field-turn-fill', turn ?? 0);
  const power = powerBars(self?.energy ?? { warp: 0, impulse: 0, apr: 0, lastReason: '' }, self?.weapons ?? []);
  const scale = Math.max(power.power, power.systems, 1);
  setBar('field-power-fill', power.power / scale);
  setBar('field-systems-fill', power.systems / scale);
  document.getElementById('field-power')?.classList.toggle('overdraw', power.overdraw);
  const lamp = alertLamp(input.vm.events);
  for (const id of ['green', 'yellow', 'red'] as const) {
    const node = document.getElementById(`lamp-${id}`);
    const on = lamp === id;
    node?.classList.toggle('on', on);
    if (node) node.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  text('field-alert-state', lamp === 'red' ? 'Red' : lamp === 'yellow' ? 'Yellow' : 'Green');
  noteEvents(input.vm, input.now);
  paintEvents(input.now);
  paintTags(input);
}

function noteEvents(vm: ViewModel, now: number): void {
  for (const event of vm.events) {
    if (event.kind !== 'hit') continue;
    eventLines.push({ text: `Hit ${String(event.amount)}`, until: now + 2400 });
  }
  while (eventLines.length > 6) eventLines.shift();
}

function paintEvents(now: number): void {
  const host = document.getElementById('field-events');
  if (!host) return;
  for (let i = eventLines.length - 1; i >= 0; i--) {
    const line = eventLines[i];
    if (!line || line.until > now) continue;
    eventLines.splice(i, 1);
  }
  host.replaceChildren();
  for (const line of eventLines) {
    const item = document.createElement('p');
    item.textContent = line.text;
    host.append(item);
  }
}

function paintTags(input: FieldHudInput): void {
  const host = document.getElementById('offscreen-tags');
  if (!host) return;
  const margin = barSize(TAG_HIT_UNITS, input.scale) * 0.5 + 4;
  const view = { left: margin, top: margin, right: Math.max(margin + 1, input.width - margin), bottom: Math.max(margin + 1, input.height - margin) };
  const pending: StackedTag[] = [];
  for (const contact of input.vm.contacts) {
    if (contact.kind === 'shot' || contact.destroyed) continue;
    if (contact.hostility === 'self') continue;
    const targeted = contact.id === input.vm.targetId || contact.targeted;
    if (!targeted && !contact.detected) continue;
    const ndc = input.project(contact.x, contact.y);
    const placed = offscreenPoint(ndc.x, ndc.y, ndc.inFront, view, 0);
    if (!placed) continue;
    const clear = avoidObstacles(placed, view, input.obstacles, 4);
    pending.push({ id: contact.id, x: clear.x, y: clear.y, edge: clear.edge });
  }
  const stacked = stackTags(pending, barSize(TAG_STACK_UNITS, input.scale) + barSize(TAG_HIT_UNITS, input.scale), view, 0);
  host.replaceChildren();
  for (const tag of stacked) {
    const contact = input.vm.contacts.find((item) => item.id === tag.id);
    if (!contact) continue;
    const name = input.roster[contact.index]?.name ?? 'Contact';
    const badge = empireMarkFor(input.roster[contact.index]?.empire ?? '');
    const range = formatRangeTag(contact.rangeFromSelf);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `offscreen-tag ${contact.hostility}`;
    if (contact.id === input.vm.targetId || contact.targeted) button.classList.add('bracket');
    button.dataset.id = String(contact.id);
    button.dataset.empire = badge.id;
    button.title = `${badge.code}  ${name}  ${range}`;
    button.style.left = `${String(tag.x)}px`;
    button.style.top = `${String(tag.y)}px`;
    button.append(renderEmpireMark(badge, 'tag-mark'), empireCode(badge.code));
    const shape = document.createElement('span');
    shape.className = `tag-shape ${contact.hostility === 'hostile' ? 'chevron' : contact.hostility === 'friendly' ? 'chevron solid' : 'diamond'}`;
    shape.setAttribute('aria-hidden', 'true');
    const arrow = document.createElement('span');
    arrow.className = `tag-arrow ${tag.edge}`;
    arrow.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'tag-class';
    label.textContent = name;
    const readout = document.createElement('span');
    readout.className = 'tag-range num';
    readout.textContent = range;
    button.append(shape, arrow, label, readout);
    host.append(button);
  }
}

function empireCode(code: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = 'tag-code';
  node.textContent = code;
  return node;
}

function setBar(id: string, fraction: number): void {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLElement)) return;
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  node.style.width = `${String(pct)}%`;
}

function text(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}
