/**
 * One-ship-against-one match. Orders go through the session, which
 * stamps tick, slot, and seq. Frame time goes through the driver only.
 * The view reads snapshots. It does not step the sim.
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
  DEFAULT_RULES_TURN_TICKS,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  MODE_KEEP,
  weaponDef,
} from '../sim/rules-tables.ts';
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

export interface DuelPlan {
  lifeSupport: boolean;
  fireControl: boolean;
  speed: number;
  general: number;
  /** Null asks each phaser or photon for its own cost. */
  weaponRequest: number | null;
}

export interface DuelMatchOptions {
  readonly seed?: number;
  readonly setups: readonly ShipSetup[];
  readonly spawns?: readonly SpawnPoint[];
  readonly rulesTurnTicks?: number;
  readonly timeScale?: number;
  readonly selfIndex?: number;
  readonly plan?: Partial<DuelPlan>;
  /** Keep paying the standing plan when a rules-turn ends. */
  readonly renew?: boolean;
  /** Send the plan on the tick after both hulls exist. */
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
  orderYaw(yaw16: number): void;
  orderFire(slotIndex: number): void;
  setTarget(id: number): void;
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
    const combat = createCombat(options.setups, { rulesTurnTicks: period });
    const sim = createSim({
      seed: options.seed ?? 1,
      tables: [...combat.tables, CRUISE_TABLE],
      systems: [...combat.systems, createCruise(period)],
      handlers: withHelm(combat.handlers),
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
    this.selfIndex = options.selfIndex ?? 0;
    this.renew = options.renew ?? true;
    this.wantOpening = options.opening ?? true;
    const base = { ...SYNTHETIC_PLAN };
    this.plan = {
      lifeSupport: options.plan?.lifeSupport ?? base.lifeSupport,
      fireControl: options.plan?.fireControl ?? base.fireControl,
      speed: clampSpeed(options.plan?.speed ?? base.speed),
      general: clampPoints(options.plan?.general ?? base.general),
      weaponRequest: options.plan?.weaponRequest === undefined ? base.weaponRequest : options.plan.weaponRequest,
    };
    for (const spawn of options.spawns ?? []) {
      this.session.issue(VERB_SPAWN, spawnPayload(spawn.setupIndex, spawn.x, spawn.y, spawn.heading));
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
    });
  }

  setSpeed(speed: number): void {
    this.plan.speed = clampSpeed(speed);
    this.userCommit();
  }

  bumpSpeed(delta: number): void {
    this.setSpeed(this.plan.speed + delta);
  }

  setLifeSupport(on: boolean): void {
    this.plan.lifeSupport = on;
    this.userCommit();
  }

  setFireControl(on: boolean): void {
    this.plan.fireControl = on;
    this.userCommit();
  }

  setGeneral(points: number): void {
    this.plan.general = clampPoints(points);
    this.userCommit();
  }

  setWeaponRequest(points: number | null): void {
    this.plan.weaponRequest = points === null ? null : clampPoints(points);
    this.userCommit();
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
    this.session.issue(VERB_FIRE, firePayload(this.selfEntity, slotIndex, this.targetEntity));
  }

  setTarget(id: number): void {
    this.targetEntity = id;
  }

  issue(kind: number, payload: Uint8Array): void {
    this.session.issue(kind, payload);
  }

  private noteSpawn(entity: number): void {
    const index = entity & 0xffff;
    if (index === this.selfIndex) this.selfEntity = entity;
    else if (this.targetEntity === null) this.targetEntity = entity;
  }

  private afterFrame(): void {
    if (this.wantOpening && !this.opened && this.selfEntity !== null && this.targetEntity !== null) {
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
      const cost = def.internal === INTERNAL_PHASER ? def.chargeCost : def.armCost;
      const request = this.plan.weaponRequest === null ? cost : this.plan.weaponRequest;
      if (request <= 0) continue;
      weapons.push({ slot, request, mode: MODE_KEEP });
    }
    return setEnergyPayload(this.selfEntity ?? 0, {
      lifeSupport: this.plan.lifeSupport,
      fireControl: this.plan.fireControl,
      speed: this.plan.speed,
      general: this.plan.general,
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

function withHelm(handlers: readonly CommandHandler[]): CommandHandler[] {
  for (const handler of handlers) {
    if (handler.kind === VERB_ORDER_HELM) return handlers.slice();
  }
  return [...handlers, helmHandler];
}

export function createDuelMatch(options: DuelMatchOptions): DuelMatch {
  return new Match(options);
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

