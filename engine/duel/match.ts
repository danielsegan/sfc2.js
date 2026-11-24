/**
 * A duel or a skirmish of up to six ships. Orders go through the session,
 * which stamps tick, slot, and seq. AI captains queue the same verbs from
 * inside the sim. Frame time goes through the driver only. The view reads
 * snapshots. It does not step the sim.
 */
import type { Sim, SimEvent } from '../sim/sim.ts';
import { createSim, type CommandHandler } from '../sim/sim.ts';
import { LocalSession } from '../net/session.ts';
import { createDriver, type FixedStepDriver, type FrameResult } from '../driver/fixed-step.ts';
import {
  EVENT_SPAWN,
  VERB_FIRE,
  VERB_SET_ENERGY,
  VERB_SPAWN,
  firePayload,
  setEnergyPayload,
  spawnPayload,
  createCombat,
} from '../sim/combat.ts';
import { H, HULL, HULL_FIELDS, shipView } from '../sim/hull.ts';
import {
  ALLEGIANCE_TABLE,
  CONTROL_AI,
  VERB_SET_ALLEGIANCE,
  allegianceHandler,
  allegiancePayload,
  readAllegiance,
} from '../sim/allegiance.ts';
import { createCaptain } from '../sim/captain.ts';
import {
  DEFAULT_RULES_TURN_TICKS,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  MODE_KEEP,
  MODE_NORMAL,
  MODE_OVERLOAD,
  MODE_PROXIMITY,
  weaponDef,
} from '../sim/rules-tables.ts';
import {
  VERB_SET_CLOAK,
  VERB_SET_EW,
  VERB_SET_TRACTOR,
  VERB_SET_WEAPON_MODE,
  mountEnergyCost,
  setCloakPayload,
  setEwPayload,
  setTractorPayload,
  setWeaponModePayload,
} from '../sim/phase3.ts';
import type { ShipSetup } from '../sim/bind-shiplist.ts';
import { CRUISE_TABLE, createCruise } from './cruise.ts';
import { VERB_ORDER_HELM, helmHandler, helmPayload } from './helm.ts';
import { buildViewModel, type ViewModel } from '../view/view-model.ts';
import {
  SYNTHETIC_PLAN,
  SYNTHETIC_SPAWNS,
  syntheticSetups,
  type SpawnPoint,
} from './fixture.ts';

const SPEED_CAP = 32;
const EVENT_CAP = 256;
export const FLEET_MAX = 6;

export interface DuelPlan {
  lifeSupport: boolean;
  fireControl: boolean;
  speed: number;
  general: number;
  /** Null asks each phaser or photon for its own cost. */
  weaponRequest: number | null;
  /** Per-facing reinforcement, bow first. Length 6. */
  specific: number[];
  /** Per-slot weapon mode. Missing slots stay on MODE_KEEP. */
  modes: number[];
  ecm: number;
  eccm: number;
  tractorEnergy: number;
}

export interface FleetSlot {
  readonly setupIndex: number;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  /** 0 and 1. Ships on the same side do not fire on each other from the helm. */
  readonly side: 0 | 1;
  /** `ai` queues captain orders. `manual` waits for the session. */
  readonly control: 'manual' | 'ai';
}

export interface DuelMatchOptions {
  readonly seed?: number;
  readonly setups: readonly ShipSetup[];
  readonly spawns?: readonly SpawnPoint[];
  /** When set, replaces `spawns` and assigns sides. Length 1..6. */
  readonly fleet?: readonly FleetSlot[];
  readonly rulesTurnTicks?: number;
  readonly timeScale?: number;
  readonly selfIndex?: number;
  readonly plan?: Partial<DuelPlan>;
  /** Keep paying the standing plan when a rules-turn ends. */
  readonly renew?: boolean;
  /** Send the plan on the tick after the player hull exists. */
  readonly opening?: boolean;
}

export interface DuelMatch {
  readonly session: LocalSession;
  readonly selfIndex: number;
  frame(frameDtMs: number): FrameResult;
  view(): ViewModel;
  stateHash(): number;
  readonly tick: number;
  readonly selfId: number | null;
  readonly targetId: number | null;
  readonly plan: DuelPlan;
  setTimeScale(speed: number): void;
  setSpeed(speed: number): void;
  bumpSpeed(delta: number): void;
  setLifeSupport(on: boolean): void;
  setFireControl(on: boolean): void;
  setGeneral(points: number): void;
  setWeaponRequest(points: number | null): void;
  setFacing(facing: number, points: number): void;
  setWeaponMode(slot: number, mode: number): void;
  setAllocation(next: Partial<DuelPlan>): void;
  setEw(ecm: number, eccm: number): void;
  toggleOverload(slotIndex: number): void;
  setTractor(mode: number, energy: number): void;
  setCloak(on: boolean): void;
  orderYaw(yaw16: number): void;
  orderFire(slotIndex: number): void;
  setTarget(id: number): void;
  /** Step through hostile contacts. Negative steps go backwards. */
  cycleTarget(step: number): void;
  /** Raw verb. The payload must not carry a tick. */
  issue(kind: number, payload: Uint8Array): void;
}

function watchSim(sim: Sim, sink: SimEvent[]): Sim {
  return {
    get tick() {
      return sim.tick;
    },
    step(commands) {
      const result = sim.step(commands);
      for (const event of result.events) sink.push(event);
      return result;
    },
    snapshot: () => sim.snapshot(),
    restore: (snapshot) => sim.restore(snapshot),
    stateHash: () => sim.stateHash(),
    canonicalBytes: () => sim.canonicalBytes(),
    resolvedSystemIds: () => sim.resolvedSystemIds(),
  };
}

function clampSpeed(speed: number): number {
  if (!Number.isInteger(speed) || speed < 0) return 0;
  return speed > SPEED_CAP ? SPEED_CAP : speed;
}

function clampPoints(points: number): number {
  if (!Number.isInteger(points) || points < 0) return 0;
  return points > 100 ? 100 : points;
}

function clampMode(mode: number): number {
  if (mode === MODE_KEEP || mode === MODE_NORMAL || mode === MODE_OVERLOAD || mode === MODE_PROXIMITY) return mode;
  return MODE_KEEP;
}

function normalizeSpecific(values: readonly number[] | undefined): number[] {
  const out = [0, 0, 0, 0, 0, 0];
  if (!values) return out;
  for (let i = 0; i < 6; i++) out[i] = clampPoints(values[i] ?? 0);
  return out;
}

class Match implements DuelMatch {
  readonly session: LocalSession;
  readonly selfIndex: number;
  readonly plan: DuelPlan;
  private readonly sim: Sim;
  private readonly driver: FixedStepDriver;
  private readonly sink: SimEvent[] = [];
  private readonly buffer: SimEvent[] = [];
  private readonly renew: boolean;
  private readonly wantOpening: boolean;
  private opened = false;
  private renewStamp = -1;
  private helmStamp = -1;
  private selfEntity: number | null = null;
  private targetEntity: number | null = null;
  private lastAlpha = 0;

  constructor(options: DuelMatchOptions) {
    const period = options.rulesTurnTicks ?? DEFAULT_RULES_TURN_TICKS;
    const fleet = options.fleet;
    if (fleet && (fleet.length < 1 || fleet.length > FLEET_MAX)) throw new Error('fleet size');
    const combat = createCombat(options.setups, { rulesTurnTicks: period });
    const tables = [...combat.tables, CRUISE_TABLE];
    const systems = [...combat.systems, createCruise(period)];
    const handlers = withHelm(combat.handlers);
    if (fleet) {
      tables.push(ALLEGIANCE_TABLE);
      systems.push(createCaptain());
      handlers.push(allegianceHandler);
    }
    const sim = createSim({
      seed: options.seed ?? 1,
      tables,
      systems,
      handlers,
    });
    this.sim = sim;
    this.session = new LocalSession({ localSlot: 0, inputDelay: 0, currentTick: () => sim.tick as number });
    const watched = watchSim(sim, this.sink);
    this.driver = createDriver({
      sim: watched,
      session: this.session,
      speed: options.timeScale ?? 1,
    });
    this.driver.ring.push(sim.snapshot());
    this.selfIndex = resolveSelf(options.selfIndex, fleet);
    this.renew = options.renew ?? true;
    this.wantOpening = options.opening ?? true;
    const base = { ...SYNTHETIC_PLAN };
    this.plan = {
      lifeSupport: options.plan?.lifeSupport ?? base.lifeSupport,
      fireControl: options.plan?.fireControl ?? base.fireControl,
      speed: clampSpeed(options.plan?.speed ?? base.speed),
      general: clampPoints(options.plan?.general ?? base.general),
      weaponRequest: options.plan?.weaponRequest === undefined ? base.weaponRequest : options.plan.weaponRequest,
      specific: normalizeSpecific(options.plan?.specific),
      modes: (options.plan?.modes ?? base.modes).map((mode) => clampMode(mode)),
      ecm: clampPoints(options.plan?.ecm ?? base.ecm),
      eccm: clampPoints(options.plan?.eccm ?? base.eccm),
      tractorEnergy: clampPoints(options.plan?.tractorEnergy ?? base.tractorEnergy),
    };
    const spawns = fleet
      ? fleet.map((slot) => ({
          setupIndex: slot.setupIndex,
          x: slot.x,
          y: slot.y,
          heading: slot.heading,
        }))
      : (options.spawns ?? []);
    for (const spawn of spawns) {
      if (spawn.setupIndex < 0 || spawn.setupIndex >= options.setups.length) throw new Error('setup index');
      this.session.issue(VERB_SPAWN, spawnPayload(spawn.setupIndex, spawn.x, spawn.y, spawn.heading));
    }
    if (fleet) {
      for (let i = 0; i < fleet.length; i++) {
        const slot = fleet[i]!;
        if (slot.side !== 0 && slot.side !== 1) throw new Error('side');
        const id = (i & 0xffff) | (1 << 16);
        const control = slot.control === 'ai' ? CONTROL_AI : 0;
        this.session.issue(VERB_SET_ALLEGIANCE, allegiancePayload(id, slot.side, control));
      }
    }
  }

  get tick(): number {
    return this.sim.tick as number;
  }

  get selfId(): number | null {
    return this.selfEntity;
  }

  get targetId(): number | null {
    return this.targetEntity;
  }

  stateHash(): number {
    return this.sim.stateHash();
  }

  setTimeScale(speed: number): void {
    this.driver.setSpeed(speed);
  }

  frame(frameDtMs: number): FrameResult {
    const result = this.driver.frame(frameDtMs);
    this.lastAlpha = result.alpha;
    const fresh = this.sink.splice(0, this.sink.length);
    for (const event of fresh) {
      this.buffer.push(event);
      if (event.kind === EVENT_SPAWN) this.noteSpawn(event.entity);
    }
    if (this.buffer.length > EVENT_CAP) this.buffer.splice(0, this.buffer.length - EVENT_CAP);
    this.afterFrame();
    return result;
  }

  view(): ViewModel {
    const events = this.buffer.splice(0, this.buffer.length);
    const curr = this.driver.ring.at(0) ?? this.sim.snapshot();
    const prev = this.driver.ring.at(1) ?? curr;
    return buildViewModel({
      prev,
      curr,
      alpha: this.lastAlpha,
      events,
      selfIndex: this.selfIndex,
      targetId: this.targetEntity,
    });
  }

  setSpeed(speed: number): void {
    this.setAllocation({ speed });
  }

  bumpSpeed(delta: number): void {
    this.setSpeed(this.plan.speed + delta);
  }

  setLifeSupport(on: boolean): void {
    this.setAllocation({ lifeSupport: on });
  }

  setFireControl(on: boolean): void {
    this.setAllocation({ fireControl: on });
  }

  setGeneral(points: number): void {
    this.setAllocation({ general: points });
  }

  setWeaponRequest(points: number | null): void {
    this.setAllocation({ weaponRequest: points });
  }

  setFacing(facing: number, points: number): void {
    if (!Number.isInteger(facing) || facing < 0 || facing > 5) return;
    const specific = this.plan.specific.slice();
    specific[facing] = clampPoints(points);
    this.setAllocation({ specific });
  }

  setWeaponMode(slot: number, mode: number): void {
    if (!Number.isInteger(slot) || slot < 0 || !Number.isInteger(mode)) return;
    const modes = this.plan.modes.slice();
    while (modes.length <= slot) modes.push(MODE_KEEP);
    modes[slot] = clampMode(mode);
    this.plan.modes = modes;
    if (this.selfEntity !== null) {
      this.session.issue(VERB_SET_WEAPON_MODE, setWeaponModePayload(this.selfEntity, slot, modes[slot]!));
    }
    this.userCommit();
  }

  setAllocation(next: Partial<DuelPlan>): void {
    if (next.lifeSupport !== undefined) this.plan.lifeSupport = next.lifeSupport;
    if (next.fireControl !== undefined) this.plan.fireControl = next.fireControl;
    if (next.speed !== undefined) this.plan.speed = clampSpeed(next.speed);
    if (next.general !== undefined) this.plan.general = clampPoints(next.general);
    if (next.weaponRequest !== undefined) {
      this.plan.weaponRequest = next.weaponRequest === null ? null : clampPoints(next.weaponRequest);
    }
    if (next.specific !== undefined) this.plan.specific = normalizeSpecific(next.specific);
    if (next.modes !== undefined) this.plan.modes = next.modes.map((mode) => clampMode(mode));
    this.userCommit();
  }

  setEw(ecm: number, eccm: number): void {
    if (this.selfEntity === null) return;
    this.plan.ecm = clampPoints(ecm);
    this.plan.eccm = clampPoints(eccm);
    this.session.issue(VERB_SET_EW, setEwPayload(this.selfEntity, this.plan.ecm, this.plan.eccm));
  }

  toggleOverload(slotIndex: number): void {
    if (this.selfEntity === null) return;
    const ship = shipView(this.sim.snapshot().world, this.selfIndex);
    const mount = ship.mounts[slotIndex];
    const next = mount && mount.mode === MODE_OVERLOAD ? MODE_NORMAL : MODE_OVERLOAD;
    this.setWeaponMode(slotIndex, next);
  }

  setTractor(mode: number, energy: number): void {
    if (this.selfEntity === null || !Number.isInteger(mode)) return;
    if (mode !== 0 && this.targetEntity === null) return;
    this.plan.tractorEnergy = clampPoints(energy);
    this.session.issue(
      VERB_SET_TRACTOR,
      setTractorPayload(this.selfEntity, this.targetEntity ?? 0, mode, mode === 0 ? 0 : this.plan.tractorEnergy),
    );
  }

  setCloak(on: boolean): void {
    if (this.selfEntity === null) return;
    this.session.issue(VERB_SET_CLOAK, setCloakPayload(this.selfEntity, on ? 1 : 0));
  }

  orderYaw(yaw16: number): void {
    if (this.selfEntity === null || !Number.isInteger(yaw16)) return;
    const target = this.tick + 1;
    if (this.helmStamp === target) return;
    this.helmStamp = target;
    this.session.issue(VERB_ORDER_HELM, helmPayload(this.selfEntity, yaw16));
  }

  orderFire(slotIndex: number): void {
    if (this.selfEntity === null || this.targetEntity === null) return;
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return;
    if (this.sameSide(this.targetEntity)) return;
    this.session.issue(VERB_FIRE, firePayload(this.selfEntity, slotIndex, this.targetEntity));
  }

  setTarget(id: number): void {
    this.targetEntity = id;
  }

  cycleTarget(step: number): void {
    const ids = this.hostileIds();
    if (ids.length === 0) {
      this.targetEntity = null;
      return;
    }
    const dir = step < 0 ? -1 : 1;
    let at = -1;
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === this.targetEntity) at = i;
    }
    let next = at < 0 ? (dir < 0 ? ids.length - 1 : 0) : at + dir;
    if (next < 0) next = ids.length - 1;
    if (next >= ids.length) next = 0;
    this.targetEntity = ids[next] ?? null;
  }

  issue(kind: number, payload: Uint8Array): void {
    this.session.issue(kind, payload);
  }

  private refreshTarget(): void {
    const ids = this.hostileIds();
    if (this.targetEntity !== null) {
      for (const id of ids) {
        if (id === this.targetEntity) return;
      }
    }
    this.targetEntity = ids[0] ?? null;
  }

  private hostileIds(): number[] {
    const world = this.sim.snapshot().world;
    const selfSide = this.selfIndex >= 0 ? readAllegiance(world, this.selfIndex).side : -1;
    const out: number[] = [];
    for (let index = 0; index < world.live.length; index++) {
      if (world.live[index] !== 1 || index === this.selfIndex) continue;
      const ship = shipView(world, index);
      if (!ship.live || ship.classCode === 0 || ship.destroyed === 1) continue;
      const side = readAllegiance(world, index).side;
      if (selfSide >= 0 && side >= 0 && side === selfSide) continue;
      const gen = world.generations[index] ?? 0;
      out.push((index & 0xffff) | ((gen & 0xffff) << 16));
    }
    return out;
  }

  private sameSide(entity: number): boolean {
    const world = this.sim.snapshot().world;
    const selfSide = this.selfIndex >= 0 ? readAllegiance(world, this.selfIndex).side : -1;
    const side = readAllegiance(world, entity & 0xffff).side;
    return selfSide >= 0 && side >= 0 && side === selfSide;
  }

  private noteSpawn(entity: number): void {
    const index = entity & 0xffff;
    if (index === this.selfIndex) this.selfEntity = entity;
  }

  private afterFrame(): void {
    this.refreshTarget();
    if (this.wantOpening && !this.opened && this.selfEntity !== null) {
      this.opened = true;
      this.userCommit();
    }
    if (!this.renew || !this.opened || this.selfEntity === null) return;
    const ship = shipView(this.sim.snapshot().world, this.selfIndex);
    if (!ship.live || hullField(this.sim.snapshot().world, this.selfIndex, H.planTicksLeft) !== 0) return;
    this.autoRenew();
  }

  private userCommit(): void {
    if (this.selfEntity === null) return;
    this.renewStamp = this.tick + 1;
    this.session.issue(VERB_SET_ENERGY, this.energyPayload());
  }

  private autoRenew(): void {
    const target = this.tick + 1;
    if (this.renewStamp === target) return;
    this.renewStamp = target;
    this.session.issue(VERB_SET_ENERGY, this.energyPayload());
  }

  private energyPayload(): Uint8Array {
    const ship = shipView(this.sim.snapshot().world, this.selfIndex);
    const weapons: { slot: number; request: number; mode: number }[] = [];
    for (let slot = 0; slot < ship.mounts.length; slot++) {
      const mount = ship.mounts[slot];
      if (!mount || mount.weaponId === 0) continue;
      const def = weaponDef(mount.weaponId);
      if (!def || (def.internal !== INTERNAL_PHASER && def.internal !== INTERNAL_PHOTON)) continue;
      const stored = clampMode(this.plan.modes[slot] ?? MODE_KEEP);
      let mode = stored;
      if (def.internal === INTERNAL_PHASER && mode !== MODE_KEEP && mode !== MODE_NORMAL) mode = MODE_NORMAL;
      const priced = mode === MODE_KEEP ? mount.mode : mode;
      const cost = mountEnergyCost(def, priced);
      const request = this.plan.weaponRequest === null ? cost : this.plan.weaponRequest;
      if (request <= 0 && mode === MODE_KEEP) continue;
      weapons.push({ slot, request: request > 0 ? request : 0, mode });
    }
    return setEnergyPayload(this.selfEntity ?? 0, {
      lifeSupport: this.plan.lifeSupport,
      fireControl: this.plan.fireControl,
      speed: this.plan.speed,
      general: this.plan.general,
      specific: this.plan.specific,
      weapons,
    });
  }
}

function hullField(snap: { tables: readonly { id: string; data: readonly number[] }[]; live: readonly number[] }, index: number, field: number): number {
  if (snap.live[index] !== 1) return 0;
  for (const entry of snap.tables) {
    if (entry.id !== HULL) continue;
    return entry.data[index * HULL_FIELDS + field] ?? 0;
  }
  return 0;
}

function resolveSelf(requested: number | undefined, fleet: readonly FleetSlot[] | undefined): number {
  if (!fleet) return requested ?? 0;
  if (requested !== undefined) {
    if (!Number.isInteger(requested) || requested < 0 || requested >= fleet.length) throw new Error('self index');
    return requested;
  }
  for (let i = 0; i < fleet.length; i++) {
    if (fleet[i]!.control === 'manual') return i;
  }
  return 0;
}

function withHelm(handlers: readonly CommandHandler[]): CommandHandler[] {
  for (const handler of handlers) {
    if (handler.kind === VERB_ORDER_HELM) return handlers.slice();
  }
  return [...handlers, helmHandler];
}

export function createDuelMatch(options: DuelMatchOptions): DuelMatch {
  return new Match(options);
}

export function createFleetMatch(options: DuelMatchOptions & { readonly fleet: readonly FleetSlot[] }): DuelMatch {
  return createDuelMatch(options);
}

export function createSyntheticDuel(options?: Omit<DuelMatchOptions, 'setups' | 'spawns'>): DuelMatch {
  return createDuelMatch({
    seed: 0x0d0e1,
    setups: syntheticSetups(),
    spawns: SYNTHETIC_SPAWNS,
    plan: { ...SYNTHETIC_PLAN },
    ...options,
  });
}

