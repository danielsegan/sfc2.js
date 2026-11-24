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
  C,
  CRAFT,
  CRAFT_FIELDS,
  CRAFT_REASON,
  EVENT_CRAFT,
  EVENT_CRAFT_NOTE,
  NOTE_NAME,
  ROLE_MINE,
  craftReadout,
  entitySide,
  type CraftReadout,
} from '../sim/smallcraft.ts';
import { CLASS_FIGHTER } from '../sim/rules-tables.ts';
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
  readHelmView,
  type HelmView,
} from '../sim/helm.ts';

export type { HelmView };
import {
  EVENT_HEADING,
  HEADING_DESTROYED,
  HEADING_DISABLED,
  HEADING_FIELDS,
  HEADING_HOLD,
  HEADING_IMMOBILE,
  HEADING_NOT_SHIP,
  HEADING_NO_SHIP,
  HEADING_ORDER,
  HEADING_ORDERED,
  HEADING_STEER,
  HEADING_UNVERIFIED,
  HORD,
} from '../sim/heading.ts';
import {
  INTERNAL_DRONE,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  MODE_OVERLOAD,
  arcDef,
  turnYawCap,
  weaponDef,
  type WeaponDef,
} from '../sim/rules-tables.ts';
import { blendScalar, toDisplayEnergy, toDisplayRange, FULL_CIRCLE } from './units.ts';
import { readAllegiance } from '../sim/allegiance.ts';
import { CLOAK_OFF, EVENT_MISS, cloakVisible, ewShift } from '../sim/phase3.ts';

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
  /** Display range units copied from the weapon table. 0 when the table has none. */
  readonly rangeMax: number;
  readonly rangeBands: readonly number[];
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

/** Remaining hull boxes. The sim does not store a separate maximum. */
export interface HullReadout {
  readonly forward: number;
  readonly center: number;
  readonly aft: number;
}

export const EMPTY_HULL: HullReadout = { forward: 0, center: 0, aft: 0 };

export function hullOf(ship: { systems: { hullForward: number; hullCenter: number; hullAft: number } }): HullReadout {
  return {
    forward: ship.systems.hullForward,
    center: ship.systems.hullCenter,
    aft: ship.systems.hullAft,
  };
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
  readonly hull: HullReadout;
  readonly weapons: readonly WeaponReadout[];
  readonly speed: number;
  readonly heading16: number;
  /** Null when the ship has no heading order. Otherwise the ordered heading. */
  readonly orderedHeading16: number | null;
  /** Same value as `orderedHeading16`, for the field heading tick. Absent when there is no order. */
  readonly headingOrdered16?: number;
  /** Ticks of yaw still needed to reach the ordered heading. Null when there is no order. */
  readonly turnTicksRemaining: number | null;
  readonly turnRateLimit16PerTick: number;
  /** Remaining-angle band. 0 under 22.5°, then 45°, 90°, and at least 90°. Null when there is no order. */
  readonly turnBand: 0 | 1 | 2 | 3 | null;
  /** Current tick's helm readout. `mode` is never `het` until a high-energy turn exists. */
  readonly helm: HelmView;
  readonly destroyed: boolean;
  readonly disabled: boolean;
  readonly ecm: number;
  readonly eccm: number;
  readonly stealth: number;
  readonly cloakState: number;
  readonly cloakTicks: number;
  readonly cloakFitted: boolean;
  readonly tractorMode: number;
  readonly tractorPaid: number;
  readonly tractorLink: boolean;
  readonly netShift: number | null;
  readonly craft: CraftReadout;
}

export interface ContactView {
  readonly id: number;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly heading16: number;
  readonly speed: number;
  readonly destroyed: boolean;
  readonly hostility: 'self' | 'friendly' | 'hostile';
  /** -1 when the ship was spawned without a side. Otherwise 0 or 1. */
  readonly side: number;
  readonly control: 'manual' | 'ai' | 'none';
  readonly targeted: boolean;
  readonly kind: 'ship' | 'shot' | 'fighter' | 'mine';
  readonly shields: readonly ShieldReadout[];
  readonly hull: HullReadout;
  readonly rangeFromSelf: number;
  readonly cloaked: boolean;
  readonly detected: boolean;
}

export interface ViewModel {
  readonly tick: number;
  readonly alpha: number;
  readonly self: SelfView | null;
  readonly targetId: number | null;
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
  readonly targetId?: number | null;
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

function rangeBandsOf(def: WeaponDef | undefined): number[] {
  if (!def) return [];
  const bands: number[] = [];
  for (const band of def.bands) {
    const reach = band[0] ?? 0;
    if (reach > 0) bands.push(reach);
  }
  return bands;
}

function rangeMaxOf(def: WeaponDef | undefined): number {
  if (!def) return 0;
  if (def.maxRange > 0) return def.maxRange;
  const bands = rangeBandsOf(def);
  return bands.length > 0 ? bands[bands.length - 1]! : 0;
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
  else if (mount.mode === MODE_OVERLOAD) status = ready ? 'overload' : 'overload arming';
  else if (ready) status = 'ready';
  return {
    slotIndex: slot,
    code: def?.code ?? 'slot',
    family: familyOf(def),
    arc: arc?.code ?? '—',
    arcFrom16: arc?.from16 ?? 0,
    arcTo16: arc?.to16 ?? 0,
    arcFull: arc?.full === 1,
    rangeMax: rangeMaxOf(def),
    rangeBands: rangeBandsOf(def),
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

function helmReadout(snap: WorldSnap, index: number, turnMode: number): {
  orderedHeading16: number | null;
  turnTicksRemaining: number | null;
  turnRateLimit16PerTick: number;
  turnBand: 0 | 1 | 2 | 3 | null;
} {
  const cap = turnYawCap(turnMode);
  const blank = { orderedHeading16: null, turnTicksRemaining: null, turnRateLimit16PerTick: cap, turnBand: null as 0 | 1 | 2 | 3 | null };
  const data = table(snap, HEADING_ORDER);
  if (!data || snap.live[index] !== 1) return blank;
  const base = index * HEADING_FIELDS;
  const mode = data[base + HORD.mode] ?? 0;
  if (mode !== HEADING_STEER && mode !== HEADING_HOLD) return blank;
  const band = data[base + HORD.band] ?? 0;
  const turnBand: 0 | 1 | 2 | 3 = band === 1 || band === 2 || band === 3 ? band : 0;
  return {
    orderedHeading16: (data[base + HORD.heading] ?? 0) & 0xffff,
    turnTicksRemaining: data[base + HORD.ticks] ?? 0,
    turnRateLimit16PerTick: cap,
    turnBand,
  };
}

function headingId(code: number): string {
  if (code === HEADING_ORDERED) return 'headingOrdered';
  if (code === HEADING_IMMOBILE) return 'immobile';
  if (code === HEADING_UNVERIFIED) return 'turnModeUnverified';
  if (code === HEADING_DISABLED) return 'crewDisabled';
  if (code === HEADING_NO_SHIP) return 'noSuchShip';
  if (code === HEADING_NOT_SHIP) return 'notAShip';
  if (code === HEADING_DESTROYED) return 'shipDestroyed';
  return 'headingOrdered';
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
  if (event.kind === EVENT_MISS) {
    return { kind: 'alert', tick: event.tick as number, id: 'ewMiss', severity: 'warn', ship: event.entity, amount: event.b };
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
  if (event.kind === EVENT_HEADING) {
    const id = headingId(event.a);
    const severity = event.a === HEADING_ORDERED ? 'info' : 'warn';
    return { kind: 'alert', tick: event.tick as number, id, severity, ship: event.entity, amount: event.b };
  }
  if (event.kind === EVENT_CRAFT) {
    const id = CRAFT_REASON[event.a] ?? 'craft';
    const severity = event.a === 0 ? 'info' : 'warn';
    return { kind: 'alert', tick: event.tick as number, id, severity, ship: event.entity, amount: event.b };
  }
  if (event.kind === EVENT_CRAFT_NOTE) {
    const id = NOTE_NAME[event.a] ?? 'craft';
    return { kind: 'alert', tick: event.tick as number, id, severity: 'info', ship: event.entity, amount: event.b };
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
      side: -1,
      control: 'none',
      targeted: false,
      kind: 'shot',
      shields: [],
      hull: EMPTY_HULL,
      rangeFromSelf: selfPose ? hypot(dx, dy) : 0,
      cloaked: false,
      detected: true,
    });
  }
  return out;
}

function shiftAgainst(
  curr: WorldSnap,
  self: ReturnType<typeof shipView>,
  contacts: readonly ContactView[],
): number | null {
  for (const contact of contacts) {
    if (contact.kind !== 'ship' || contact.hostility !== 'hostile' || !contact.detected) continue;
    const foe = shipView(curr, contact.index);
    return ewShift(self.eccmPaid, foe.ecmPaid, foe.stealth);
  }
  return null;
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
  const targetId = input.targetId ?? null;
  const allegianceSelf = input.selfIndex >= 0 ? readAllegiance(curr, input.selfIndex).side : -1;
  const selfSide = allegianceSelf >= 0 ? allegianceSelf : entitySide(curr, input.selfIndex);
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
    const allegiance = readAllegiance(curr, index);
    const id = entityId(curr, index);
    const craftSide = entitySide(curr, index);
    const side = allegiance.side >= 0 ? allegiance.side : craftSide;
    const allied = index === input.selfIndex || (selfSide >= 0 && side >= 0 && side === selfSide);
    const selfShip = input.selfIndex >= 0 && input.selfIndex < count && curr.live[input.selfIndex] === 1
      ? shipView(curr, input.selfIndex)
      : null;
    const selfRaw = rawPos(curr, input.selfIndex);
    const otherRaw = rawPos(curr, index);
    const seen = allied || !selfShip || !selfRaw || !otherRaw
      ? true
      : cloakVisible(
          ship.cloakState,
          ship.spottedBy,
          input.selfIndex,
          selfShip.scanners,
          (otherRaw.x - selfRaw.x) | 0,
          (otherRaw.y - selfRaw.y) | 0,
        );
    contacts.push({
      id,
      index,
      x,
      y,
      heading16,
      speed: ship.speed,
      destroyed: ship.destroyed === 1,
      hostility: hostilityOf(index, input.selfIndex, selfSide, side),
      side,
      control: allegiance.control === 1 ? 'ai' : side >= 0 ? 'manual' : 'none',
      targeted: targetId !== null && id === targetId,
      kind: ship.classCode === CLASS_FIGHTER ? 'fighter' : 'ship',
      shields: shieldsOf(ship),
      hull: hullOf(ship),
      rangeFromSelf: 0,
      cloaked: ship.cloakState !== CLOAK_OFF,
      detected: seen,
    });
  }
  const craftTable = table(curr, CRAFT);
  const kindTable = table(curr, 'kind');
  if (craftTable && kindTable) {
    for (let index = 0; index < count; index++) {
      if (curr.live[index] !== 1 || kindTable[index] !== ENTITY_KIND.mapObject) continue;
      const role = craftTable[index * CRAFT_FIELDS + C.role] ?? 0;
      if (role !== ROLE_MINE) continue;
      const currPos = rawPos(curr, index);
      const prevPos = prev.live[index] === 1 ? rawPos(prev, index) : null;
      const x = toDisplayRange(prevPos ? blendScalar(prevPos.x, currPos?.x ?? prevPos.x, alpha) : (currPos?.x ?? 0));
      const y = toDisplayRange(prevPos ? blendScalar(prevPos.y, currPos?.y ?? prevPos.y, alpha) : (currPos?.y ?? 0));
      const selfSide = entitySide(curr, input.selfIndex);
      const theirSide = entitySide(curr, index);
      contacts.push({
        id: entityId(curr, index),
        index,
        x,
        y,
        heading16: 0,
        speed: 0,
        destroyed: false,
        hostility: selfSide >= 0 && theirSide >= 0 && theirSide === selfSide ? 'friendly' : 'hostile',
        side: theirSide,
        control: 'none',
        targeted: false,
        kind: 'mine',
        shields: [],
        hull: EMPTY_HULL,
        rangeFromSelf: 0,
        cloaked: false,
        detected: true,
      });
    }
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
      const helm = helmReadout(input.curr.world, input.selfIndex, ship.turnMode);
      const helmView = readHelmView(input.curr.world, input.selfIndex);
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
        hull: hullOf(ship),
        weapons,
        speed: ship.speed,
        heading16: ship.heading,
        ...helm,
        headingOrdered16: helm.orderedHeading16 ?? undefined,
        helm: helmView,
        destroyed: ship.destroyed === 1,
        disabled: ship.disabled === 1,
        ecm: ship.ecmPaid,
        eccm: ship.eccmPaid,
        stealth: ship.stealth,
        cloakState: ship.cloakState,
        cloakTicks: ship.cloakTicks,
        cloakFitted: ship.cloakCost > 0,
        tractorMode: ship.tractorMode,
        tractorPaid: ship.tractorPaid,
        tractorLink: ship.tractorLink === 1,
        netShift: shiftAgainst(curr, ship, contacts),
        craft: craftReadout(curr, input.selfIndex),
      };
    }
  }

  return {
    tick: input.curr.tick,
    alpha,
    self,
    targetId,
    contacts: posed,
    mission: { objectives: [], timers: [] },
    events,
  };
}

function hostilityOf(index: number, selfIndex: number, selfSide: number, side: number): ContactView['hostility'] {
  if (index === selfIndex) return 'self';
  if (selfSide >= 0 && side >= 0 && side === selfSide) return 'friendly';
  return 'hostile';
}
