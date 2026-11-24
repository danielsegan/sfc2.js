/**
 * One read-only picture of a duel frame. Positions and headings blend.
 * Gauges stay on the current tick. Building this does not write the sim.
 */
import { shortestArc, angle16 } from '../core/angle.ts';
import type { SimEvent, Snapshot } from '../sim/sim.ts';
import { ENTITY_KIND, type WorldSnap } from '../sim/world.ts';
import { H, HULL_FIELDS, S, SHOT_FIELDS, shipView } from '../sim/hull.ts';
import {
  EVENT_HIT,
  EVENT_RULE,
  EVENT_SPAWN,
  R,
  REASON_NAME,
} from '../sim/combat.ts';
import {
  EVENT_HELM,
  HELM_DESTROYED,
  HELM_DISABLED,
  HELM_IMMOBILE,
  HELM_NOT_SHIP,
  HELM_NO_SHIP,
  HELM_OK,
  HELM_UNVERIFIED,
  HELM_YAW_CLAMPED,
} from '../duel/helm.ts';
import {
  INTERNAL_DRONE,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  MODE_OVERLOAD,
  arcDef,
  weaponDef,
  type WeaponDef,
} from '../sim/rules-tables.ts';
import { blendScalar, toDisplayEnergy, toDisplayRange, FULL_CIRCLE } from './units.ts';

export type Facing = 0 | 1 | 2 | 3 | 4 | 5;

export type HudEvent =
  | { kind: 'hit'; tick: number; ship: number; facing: Facing; amount: number }
  | { kind: 'alert'; tick: number; id: string; severity: 'info' | 'warn' | 'crit'; ship: number; amount: number }
  | { kind: 'sim'; tick: number; code: number; ship: number; a: number; b: number };

export interface WeaponReadout {
  readonly slotIndex: number;
  readonly code: string;
  readonly family: string;
  readonly arc: string;
  readonly arcFrom16: number;
  readonly arcTo16: number;
  readonly arcFull: boolean;
  readonly charge: number;
  readonly cost: number;
  readonly ready: boolean;
  readonly status: string;
  readonly mode: number;
  readonly boxes: number;
  readonly boxesMax: number;
}

export interface ShieldReadout {
  readonly current: number;
  readonly max: number;
  readonly reinforced: number;
}

export interface EnergyReadout {
  readonly warp: number;
  readonly impulse: number;
  readonly apr: number;
  readonly battery: number;
  readonly batteryCapacity: number;
  readonly speed: number;
  readonly fireControl: boolean;
  readonly planTicksLeft: number;
  readonly lastReason: string;
  readonly lastVerb: number;
}

export interface SelfView {
  readonly id: number;
  readonly index: number;
  readonly energy: EnergyReadout;
  readonly shields: readonly ShieldReadout[];
  readonly weapons: readonly WeaponReadout[];
  readonly speed: number;
  readonly heading16: number;
  readonly destroyed: boolean;
  readonly disabled: boolean;
}

export interface ContactView {
  readonly id: number;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly heading16: number;
  readonly speed: number;
  readonly destroyed: boolean;
  readonly hostility: 'self' | 'hostile';
  readonly kind: 'ship' | 'shot';
  readonly shields: readonly ShieldReadout[];
  readonly rangeFromSelf: number;
}

export interface ViewModel {
  readonly tick: number;
  readonly alpha: number;
  readonly self: SelfView | null;
  readonly contacts: readonly ContactView[];
  readonly mission: { readonly objectives: readonly never[]; readonly timers: readonly never[] };
  readonly events: readonly HudEvent[];
}

export interface ViewBuildInput {
  readonly prev: Snapshot;
  readonly curr: Snapshot;
  readonly alpha: number;
  readonly events: readonly SimEvent[];
  readonly selfIndex: number;
}

function fieldAt(snap: WorldSnap, index: number, field: number): number {
  const data = table(snap, 'hull');
  if (!data || snap.live[index] !== 1) return 0;
  return data[index * HULL_FIELDS + field] ?? 0;
}

function table(snap: WorldSnap, id: string): readonly number[] | undefined {
  for (const entry of snap.tables) {
    if (entry.id === id) return entry.data;
  }
  return undefined;
}

function entityId(snap: WorldSnap, index: number): number {
  const gen = snap.generations[index] ?? 0;
  return (index & 0xffff) | ((gen & 0xffff) << 16);
}

function rawPos(snap: WorldSnap, index: number): { x: number; y: number } | null {
  const data = table(snap, 'position');
  if (data === undefined) return null;
  const base = index * 2;
  if (base + 1 >= data.length) return null;
  return { x: data[base] ?? 0, y: data[base + 1] ?? 0 };
}

function blendHeading(prev: number, curr: number, alpha: number): number {
  const arc = shortestArc(angle16(prev), angle16(curr));
  let next = prev + arc * alpha;
  next = next % FULL_CIRCLE;
  if (next < 0) next += FULL_CIRCLE;
  return next;
}

function armCost(def: WeaponDef, mode: number): number {
  if (def.internal === INTERNAL_PHASER) return def.chargeCost;
  if (def.internal === INTERNAL_PHOTON) return mode === MODE_OVERLOAD ? def.overloadArmCost : def.armCost;
  return 0;
}

function familyOf(def: WeaponDef | undefined): string {
  if (!def) return 'unknown';
  if (def.internal === INTERNAL_PHASER) return 'phaser';
  if (def.internal === INTERNAL_PHOTON) return 'photon';
  if (def.internal === INTERNAL_DRONE) return 'drone';
  return 'other';
}

function weaponReadout(slot: number, mount: { weaponId: number; arcId: number; charge100: number; boxes: number; boxesMax: number; mode: number; ticksCharging: number }): WeaponReadout {
  const def = weaponDef(mount.weaponId);
  const arc = arcDef(mount.arcId);
  const cost = def ? armCost(def, mount.mode) : 0;
  const inSlice = def !== undefined && (def.internal === INTERNAL_PHASER || def.internal === INTERNAL_PHOTON);
  let ready = false;
  if (def && inSlice && cost > 0 && mount.boxes > 0 && mount.charge100 >= cost * 100) {
    ready = def.internal === INTERNAL_PHASER || mount.ticksCharging >= (mount.mode === MODE_OVERLOAD ? def.overloadArmTicks : def.armTicks);
  }
  let status = 'charging';
  if (mount.boxes <= 0) status = 'destroyed';
  else if (!def) status = 'unknown';
  else if (!inSlice) status = 'outside this duel';
  else if (cost <= 0) status = 'no cost yet';
  else if (ready) status = 'ready';
  return {
    slotIndex: slot,
    code: def?.code ?? 'slot',
    family: familyOf(def),
    arc: arc?.code ?? '—',
    arcFrom16: arc?.from16 ?? 0,
    arcTo16: arc?.to16 ?? 0,
    arcFull: arc?.full === 1,
    charge: toDisplayEnergy(mount.charge100),
    cost,
    ready,
    status,
    mode: mount.mode,
    boxes: mount.boxes,
    boxesMax: mount.boxesMax,
  };
}

function shieldsOf(ship: ReturnType<typeof shipView>): ShieldReadout[] {
  const out: ShieldReadout[] = [];
  for (let i = 0; i < 6; i++) {
    out.push({
      current: ship.shields[i] ?? 0,
      max: ship.shieldsMax[i] ?? 0,
      reinforced: ship.facingBudget[i] ?? 0,
    });
  }
  return out;
}

function helmId(code: number): string {
  if (code === HELM_OK) return 'helm';
  if (code === HELM_YAW_CLAMPED) return 'yawClamped';
  if (code === HELM_IMMOBILE) return 'immobile';
  if (code === HELM_UNVERIFIED) return 'turnModeUnverified';
  if (code === HELM_DISABLED) return 'crewDisabled';
  if (code === HELM_NO_SHIP) return 'noSuchShip';
  if (code === HELM_NOT_SHIP) return 'notAShip';
  if (code === HELM_DESTROYED) return 'shipDestroyed';
  return 'helm';
}

function toHud(event: SimEvent): HudEvent | null {
  if (event.kind === EVENT_SPAWN) return null;
  if (event.kind === EVENT_HIT) {
    const facing = event.a >= 0 && event.a <= 5 ? (event.a as Facing) : 0;
    return { kind: 'hit', tick: event.tick as number, ship: event.entity, facing, amount: event.b };
  }
  if (event.kind === EVENT_RULE) {
    const id = REASON_NAME[event.a] ?? 'rule';
    const severity = event.a === R.ok ? 'info' : 'warn';
    return { kind: 'alert', tick: event.tick as number, id, severity, ship: event.entity, amount: event.b };
  }
  if (event.kind === EVENT_HELM) {
    const id = helmId(event.a);
    const severity = event.a === HELM_OK || event.a === HELM_YAW_CLAMPED ? 'info' : 'warn';
    return { kind: 'alert', tick: event.tick as number, id, severity, ship: event.entity, amount: event.b };
  }
  return { kind: 'sim', tick: event.tick as number, code: event.kind, ship: event.entity, a: event.a, b: event.b };
}

function hypot(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

function shotContacts(
  prev: WorldSnap,
  curr: WorldSnap,
  alpha: number,
  selfPose: { x: number; y: number } | null,
): ContactView[] {
  const currKind = table(curr, 'kind');
  const prevKind = table(prev, 'kind');
  const shots = table(curr, 'shot');
  if (!currKind || !shots) return [];
  const out: ContactView[] = [];
  for (let index = 0; index < curr.live.length; index++) {
    if (curr.live[index] !== 1 || currKind[index] !== ENTITY_KIND.seeker) continue;
    if ((shots[index * SHOT_FIELDS + S.live] ?? 0) !== 1) continue;
    const currPos = rawPos(curr, index);
    const prevLive = prev.live[index] === 1 && prevKind?.[index] === ENTITY_KIND.seeker;
    const prevPos = prevLive ? rawPos(prev, index) : null;
    const x = toDisplayRange(prevPos ? blendScalar(prevPos.x, currPos?.x ?? prevPos.x, alpha) : (currPos?.x ?? 0));
    const y = toDisplayRange(prevPos ? blendScalar(prevPos.y, currPos?.y ?? prevPos.y, alpha) : (currPos?.y ?? 0));
    const dx = selfPose ? x - selfPose.x : 0;
    const dy = selfPose ? y - selfPose.y : 0;
    out.push({
      id: entityId(curr, index),
      index,
      x,
      y,
      heading16: 0,
      speed: 0,
      destroyed: false,
      hostility: 'hostile',
      kind: 'shot',
      shields: [],
      rangeFromSelf: selfPose ? hypot(dx, dy) : 0,
    });
  }
  return out;
}

export function buildViewModel(input: ViewBuildInput): ViewModel {
  const alpha = input.alpha < 0 ? 0 : input.alpha > 1 ? 1 : input.alpha;
  const curr = input.curr.world;
  const prev = input.prev.world;
  const events: HudEvent[] = [];
  for (const event of input.events) {
    const hud = toHud(event);
    if (hud) events.push(hud);
  }

  const contacts: ContactView[] = [];
  const count = curr.live.length;
  let selfPose: { x: number; y: number } | null = null;
  for (let index = 0; index < count; index++) {
    if (curr.live[index] !== 1) continue;
    const ship = shipView(curr, index);
    if (ship.classCode === 0) continue;
    const currPos = rawPos(curr, index);
    const prevPos = prev.live[index] === 1 ? rawPos(prev, index) : null;
    const x = toDisplayRange(
      prevPos ? blendScalar(prevPos.x, currPos?.x ?? prevPos.x, alpha) : (currPos?.x ?? 0),
    );
    const y = toDisplayRange(
      prevPos ? blendScalar(prevPos.y, currPos?.y ?? prevPos.y, alpha) : (currPos?.y ?? 0),
    );
    const heading16 = prev.live[index] === 1
      ? blendHeading(shipView(prev, index).heading, ship.heading, alpha)
      : ship.heading;
    if (index === input.selfIndex) selfPose = { x, y };
    contacts.push({
      id: entityId(curr, index),
      index,
      x,
      y,
      heading16,
      speed: ship.speed,
      destroyed: ship.destroyed === 1,
      hostility: index === input.selfIndex ? 'self' : 'hostile',
      kind: 'ship',
      shields: shieldsOf(ship),
      rangeFromSelf: 0,
    });
  }
  contacts.sort((a, b) => a.id - b.id);
  const posed: ContactView[] = [];
  for (const contact of contacts) {
    const dx = selfPose ? contact.x - selfPose.x : 0;
    const dy = selfPose ? contact.y - selfPose.y : 0;
    posed.push({ ...contact, rangeFromSelf: selfPose && contact.index !== input.selfIndex ? hypot(dx, dy) : 0 });
  }
  for (const shot of shotContacts(input.prev.world, input.curr.world, alpha, selfPose)) posed.push(shot);

  let self: SelfView | null = null;
  if (input.selfIndex >= 0 && input.selfIndex < count && curr.live[input.selfIndex] === 1) {
    const ship = shipView(curr, input.selfIndex);
    if (ship.classCode !== 0) {
      const weapons: WeaponReadout[] = [];
      for (let slot = 0; slot < ship.mounts.length; slot++) {
        const mount = ship.mounts[slot];
        if (!mount || mount.weaponId === 0) continue;
        weapons.push(weaponReadout(slot, mount));
      }
      const reason = ship.lastVerb === 0 ? '' : (REASON_NAME[ship.lastReason] ?? '');
      self = {
        id: entityId(curr, input.selfIndex),
        index: input.selfIndex,
        energy: {
          warp: toDisplayEnergy(ship.warp100),
          impulse: toDisplayEnergy(ship.impulse100),
          apr: toDisplayEnergy(ship.apr100),
          battery: toDisplayEnergy(ship.battery100),
          batteryCapacity: toDisplayEnergy(ship.batteryCapacity100),
          speed: ship.speed,
          fireControl: ship.fcPaid === 1,
          planTicksLeft: fieldAt(input.curr.world, input.selfIndex, H.planTicksLeft),
          lastReason: reason,
          lastVerb: ship.lastVerb,
        },
        shields: shieldsOf(ship),
        weapons,
        speed: ship.speed,
        heading16: ship.heading,
        destroyed: ship.destroyed === 1,
        disabled: ship.disabled === 1,
      };
    }
  }

  return {
    tick: input.curr.tick,
    alpha,
    self,
    contacts: posed,
    mission: { objectives: [], timers: [] },
    events,
  };
}
