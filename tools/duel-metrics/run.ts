/**
 * Headless Phase 2 measurements. The world is the duel match's combat,
 * cruise, heading, and HET systems, stepped one tick at a time. Orders go
 * through LocalSession with input delay 0, the same stamp a player command
 * gets. No captain and no small craft, so nothing else queues orders.
 */
import { LocalSession } from '../../engine/net/session.ts';
import {
  EVENT_RULE,
  REASON_NAME,
  VERB_FIRE,
  VERB_SET_ENERGY,
  VERB_SPAWN,
  firePayload,
  setEnergyPayload,
  spawnPayload,
  createCombat,
} from '../../engine/sim/combat.ts';
import { CRUISE_TABLE, createCruise } from '../../engine/sim/cruise.ts';
import {
  HEADING_ORDER_TABLE,
  VERB_ORDER_HEADING,
  createHeadingSteer,
  headingHandler,
  headingPayload,
} from '../../engine/sim/heading.ts';
import { helmHandler } from '../../engine/sim/helm.ts';
import { createHetTurn, hetHandler } from '../../engine/sim/het.ts';
import { H, HULL, HULL_FIELDS, shipView, type ShipView } from '../../engine/sim/hull.ts';
import { ENERGY_SCALE, MODE_NORMAL, weaponDef, weaponId } from '../../engine/sim/rules-tables.ts';
import { createSim, type Sim, type SimEvent } from '../../engine/sim/sim.ts';
import { HET_TABLE, TURN_CURVE_TABLE } from '../../engine/sim/turn-curve.ts';
import type { ShipSetup } from '../../engine/sim/bind-shiplist.ts';
import {
  BEARINGS,
  FIREPOWER_SPEEDS,
  HEADING_TARGET,
  INPUT_DELAY,
  PHOTON_CODE,
  PROBE_SHIPS,
  RANGE_BANDS,
  RULES_TURN_TICKS,
  SEED,
  SHIELD_RANGE,
  SPEEDS,
  TICK_HZ,
  motionSetup,
  powerSetup,
  weaponSetup,
  type ProbeShip,
} from './ships.ts';

const SELF = 65536;
const TARGET = 65537;

interface Stepper {
  readonly sim: Sim;
  readonly session: LocalSession;
  step(): readonly SimEvent[];
}

function boot(setups: readonly ShipSetup[], places: readonly { x: number; y: number; heading: number }[]): Stepper {
  const combat = createCombat(setups, { rulesTurnTicks: RULES_TURN_TICKS });
  const sim = createSim({
    seed: SEED,
    tables: [...combat.tables, CRUISE_TABLE, HEADING_ORDER_TABLE, TURN_CURVE_TABLE, HET_TABLE],
    systems: [...combat.systems, createHetTurn(), createHeadingSteer(), createCruise(RULES_TURN_TICKS)],
    handlers: [...combat.handlers, helmHandler, headingHandler, hetHandler],
  });
  const session = new LocalSession({
    localSlot: 0,
    inputDelay: INPUT_DELAY,
    currentTick: () => sim.tick as number,
  });
  for (let i = 0; i < places.length; i++) {
    const place = places[i]!;
    session.issue(VERB_SPAWN, spawnPayload(i, place.x, place.y, place.heading));
  }
  const stepper: Stepper = {
    sim,
    session,
    step() {
      const next = (sim.tick as number) + 1;
      const result = sim.step(session.commandsFor(next));
      session.reportHash(result.tick, result.hash);
      return result.events;
    },
  };
  stepper.step();
  return stepper;
}

function viewAt(sim: Sim, index: number): ShipView {
  return shipView(sim.snapshot().world, index);
}

function hullAt(sim: Sim, index: number, field: number): number {
  const snap = sim.snapshot().world;
  for (const table of snap.tables) {
    if (table.id !== HULL) continue;
    return table.data[index * HULL_FIELDS + field] ?? 0;
  }
  throw new Error('hull table');
}

function rulePoints(hundredths: number): number {
  if (!Number.isInteger(hundredths) || hundredths % ENERGY_SCALE !== 0) throw new Error('energy hundredths');
  return hundredths / ENERGY_SCALE;
}

function tickOf(sim: Sim): number {
  return sim.tick as number;
}

function reasonName(code: number): string {
  return REASON_NAME[code] ?? String(code);
}

function ruleOn(events: readonly SimEvent[], entity: number): { reason: string; applied: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event.kind === EVENT_RULE && event.entity === entity) {
      return { reason: reasonName(event.a), applied: event.b };
    }
  }
  return null;
}

function energyOrder(
  entity: number,
  speed: number,
  life: boolean,
  fireControl: boolean,
  weapons: readonly { slot: number; request: number; mode: number }[],
): Uint8Array {
  return setEnergyPayload(entity, {
    lifeSupport: life,
    fireControl,
    speed,
    general: 0,
    specific: [0, 0, 0, 0, 0, 0],
    weapons,
  });
}

export interface TurnSample {
  readonly speed: number;
  readonly delayTicks: number;
  readonly turnRate16PerTick: number;
  readonly steadyRate16PerTick: number;
  readonly headingOrder: 'verb-12';
}

export interface SpeedSample {
  readonly speed: number;
  readonly ticksFromFirstApply: number;
  readonly trace: readonly number[];
}

export interface EnergySample {
  readonly speed: number;
  /** Movement spend on the setEnergy that landed on `speed`, in rule points. */
  readonly rulePointsPerRulesTurn: number;
  readonly perSpeedPointNumerator: number;
  readonly perSpeedPointDenominator: number;
  readonly perTickNumerator: number;
  readonly perTickDenominator: number;
}

export interface PhaserProbe {
  readonly band: string;
  readonly range: number;
  readonly damage: number | null;
  readonly reason: string;
}

export interface HeavySample {
  readonly weapon: string;
  readonly mode: 'normal';
  readonly catalogArmCost: number;
  readonly catalogArmTicks: number;
  readonly energyPaidRulePoints: number;
  readonly ticksUntilReady: number;
}

export interface ShieldSample {
  readonly bearing16: number;
  readonly facing: number;
  readonly damage: number;
  readonly reason: string;
}

export interface FirepowerSample {
  readonly speed: number;
  readonly weaponRulePoints: number;
  readonly lifeRulePoints: number;
  readonly fireControlRulePoints: number;
  readonly movementRulePoints: number;
}

export interface ShipReport {
  readonly id: ProbeShip['id'];
  readonly turnHull: ProbeShip['turnHull'];
  readonly turns: readonly TurnSample[];
  readonly timeToSpeed: readonly SpeedSample[];
  readonly energy: readonly EnergySample[];
  readonly phaser: readonly PhaserProbe[];
  readonly heavy: HeavySample;
  readonly shields: readonly ShieldSample[];
  readonly firepower: readonly FirepowerSample[];
}

export interface MetricsReport {
  readonly tool: 'duel-metrics';
  readonly tickHz: number;
  readonly rulesTurnTicks: number;
  readonly inputDelay: number;
  readonly seed: number;
  readonly acceleration: number;
  readonly warp: number;
  readonly moveCostRulePoints: number;
  readonly headingVerb: number;
  readonly energyVerb: number;
  readonly fireVerb: number;
  readonly ships: readonly ShipReport[];
}

function signedDelta(from: number, to: number): number {
  const d = (to - from) & 0xffff;
  return d > 32767 ? d - 65536 : d;
}

function measureMotion(turnHull: string, speed: number): { turn: TurnSample; ramp: SpeedSample; energy: EnergySample } {
  const stepper = boot([motionSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  let firstApply = -1;
  const trace: number[] = [];
  let landingApplied = 0;
  for (let n = 0; n < 16; n++) {
    const now = viewAt(stepper.sim, 0).speed;
    if (now === speed && firstApply >= 0) break;
    stepper.session.issue(VERB_SET_ENERGY, energyOrder(SELF, speed, false, false, []));
    stepper.step();
    if (firstApply < 0) firstApply = tickOf(stepper.sim);
    const landed = viewAt(stepper.sim, 0);
    trace.push(landed.speed);
    landingApplied = landed.lastApplied;
    if (landed.speed === speed) break;
  }
  if (viewAt(stepper.sim, 0).speed !== speed || firstApply < 0) throw new Error(`speed ${speed} on ${turnHull}`);
  const reach = tickOf(stepper.sim);
  const rulePointsPaid = rulePoints(landingApplied);
  const before = viewAt(stepper.sim, 0).heading;
  stepper.session.issue(VERB_ORDER_HEADING, headingPayload(SELF, HEADING_TARGET));
  stepper.step();
  const orderTick = tickOf(stepper.sim);
  let prev = before;
  let cursor = viewAt(stepper.sim, 0).heading;
  let firstTick = -1;
  let rate = 0;
  let steady = 0;
  const take = (at: number, delta: number): void => {
    const mag = delta < 0 ? -delta : delta;
    if (firstTick < 0) {
      firstTick = at;
      rate = mag;
      return;
    }
    if (steady === 0) steady = mag;
  };
  const opened = signedDelta(prev, cursor);
  if (opened !== 0) take(orderTick, opened);
  prev = cursor;
  for (let n = 0; n < 400 && steady === 0; n++) {
    stepper.step();
    cursor = viewAt(stepper.sim, 0).heading;
    const delta = signedDelta(prev, cursor);
    if (delta !== 0) take(tickOf(stepper.sim), delta);
    prev = cursor;
  }
  if (firstTick < 0 || rate <= 0 || steady <= 0) throw new Error(`turn ${turnHull} at ${speed}`);
  return {
    ramp: { speed, ticksFromFirstApply: reach - firstApply, trace },
    energy: {
      speed,
      rulePointsPerRulesTurn: rulePointsPaid,
      perSpeedPointNumerator: rulePointsPaid,
      perSpeedPointDenominator: speed,
      perTickNumerator: rulePointsPaid,
      perTickDenominator: RULES_TURN_TICKS,
    },
    turn: {
      speed,
      delayTicks: firstTick - orderTick,
      turnRate16PerTick: rate,
      steadyRate16PerTick: steady,
      headingOrder: 'verb-12',
    },
  };
}

function measurePhaser(turnHull: string, range: number): { damage: number | null; reason: string } {
  const stepper = boot(
    [weaponSetup(turnHull), weaponSetup(turnHull)],
    [
      { x: 0, y: 0, heading: 0 },
      { x: range, y: 0, heading: 0 },
    ],
  );
  stepper.session.issue(VERB_FIRE, firePayload(SELF, 0, TARGET));
  const events = stepper.step();
  const rule = ruleOn(events, SELF);
  if (!rule) throw new Error(`no fire result at range ${range}`);
  if (rule.reason !== 'ok') return { damage: null, reason: rule.reason };
  return { damage: rule.applied, reason: rule.reason };
}

function measureShield(turnHull: string, bearing16: number): ShieldSample {
  const heading = (32768 - bearing16) & 0xffff;
  const stepper = boot(
    [weaponSetup(turnHull), weaponSetup(turnHull)],
    [
      { x: 0, y: 0, heading: 0 },
      { x: SHIELD_RANGE, y: 0, heading },
    ],
  );
  stepper.session.issue(VERB_FIRE, firePayload(SELF, 0, TARGET));
  const events = stepper.step();
  const rule = ruleOn(events, SELF);
  const hit = viewAt(stepper.sim, 1).lastHit;
  if (!rule || rule.reason !== 'ok' || hit.facing < 0) {
    throw new Error(`shield bearing ${bearing16} (${rule?.reason ?? 'none'})`);
  }
  return { bearing16, facing: hit.facing, damage: hit.damage, reason: rule.reason };
}

function mountReady(view: ShipView, slot: number, cost100: number, armTicks: number): boolean {
  const row = view.mounts[slot];
  if (!row || row.weaponId === 0) return false;
  return row.charge100 >= cost100 && row.ticksCharging >= armTicks;
}

function measureHeavy(turnHull: string): HeavySample {
  const def = weaponDef(weaponId(PHOTON_CODE));
  if (!def) throw new Error('photon def');
  const stepper = boot([weaponSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  stepper.session.issue(
    VERB_SET_ENERGY,
    energyOrder(SELF, 0, false, false, [{ slot: 1, request: def.armCost, mode: MODE_NORMAL }]),
  );
  stepper.step();
  const applyTick = tickOf(stepper.sim);
  const paid = viewAt(stepper.sim, 0).lastApplied;
  let readyTick = -1;
  if (mountReady(viewAt(stepper.sim, 0), 1, def.armCost * ENERGY_SCALE, def.armTicks)) readyTick = applyTick;
  for (let n = 0; n < RULES_TURN_TICKS + 2 && readyTick < 0; n++) {
    stepper.step();
    if (mountReady(viewAt(stepper.sim, 0), 1, def.armCost * ENERGY_SCALE, def.armTicks)) readyTick = tickOf(stepper.sim);
  }
  if (readyTick < 0) throw new Error(`photon did not arm on ${turnHull}`);
  return {
    weapon: PHOTON_CODE,
    mode: 'normal',
    catalogArmCost: def.armCost,
    catalogArmTicks: def.armTicks,
    energyPaidRulePoints: rulePoints(paid),
    ticksUntilReady: readyTick - applyTick + 1,
  };
}

function measureFirepower(turnHull: string, speed: number): FirepowerSample {
  const stepper = boot([powerSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  for (let n = 0; n < 16; n++) {
    if (viewAt(stepper.sim, 0).speed === speed) break;
    stepper.session.issue(VERB_SET_ENERGY, energyOrder(SELF, speed, false, false, []));
    stepper.step();
  }
  if (viewAt(stepper.sim, 0).speed !== speed) throw new Error(`firepower speed ${speed}`);
  const weapons: { slot: number; request: number; mode: number }[] = [];
  for (let slot = 0; slot < viewAt(stepper.sim, 0).mounts.length; slot++) {
    const row = viewAt(stepper.sim, 0).mounts[slot]!;
    if (row.weaponId === 0) continue;
    weapons.push({ slot, request: 100, mode: MODE_NORMAL });
  }
  stepper.session.issue(VERB_SET_ENERGY, energyOrder(SELF, speed, true, true, weapons));
  const events = stepper.step();
  const rule = ruleOn(events, SELF);
  if (!rule || (rule.reason !== 'ok' && rule.reason !== 'overDraw' && rule.reason !== 'chargeCapped')) {
    throw new Error(`firepower ${turnHull} speed ${speed} (${rule?.reason ?? 'none'})`);
  }
  const view = viewAt(stepper.sim, 0);
  let weapon100 = 0;
  for (const row of view.mounts) weapon100 += row.budget100;
  const unpaid = hullAt(stepper.sim, 0, H.lsUnpaid);
  if (unpaid !== 0 && unpaid !== 1) throw new Error('life flag');
  const life = unpaid === 0 ? 1 : 0;
  const fireControl = view.fcPaid === 1 ? 1 : 0;
  const movement100 = view.moveCost100 * view.speed;
  const split = weapon100 + life * ENERGY_SCALE + fireControl * ENERGY_SCALE + movement100;
  if (split !== view.lastApplied) throw new Error(`energy split ${split} != ${view.lastApplied}`);
  return {
    speed,
    weaponRulePoints: rulePoints(weapon100),
    lifeRulePoints: life,
    fireControlRulePoints: fireControl,
    movementRulePoints: rulePoints(movement100),
  };
}

function measureShip(ship: ProbeShip): ShipReport {
  const turns: TurnSample[] = [];
  const timeToSpeed: SpeedSample[] = [];
  const energy: EnergySample[] = [];
  for (const speed of SPEEDS) {
    const sample = measureMotion(ship.turnHull, speed);
    turns.push(sample.turn);
    timeToSpeed.push(sample.ramp);
    energy.push(sample.energy);
  }
  const phaser: PhaserProbe[] = [];
  for (const band of RANGE_BANDS) {
    for (const range of band.probes) {
      const shot = measurePhaser(ship.turnHull, range);
      phaser.push({ band: band.band, range, damage: shot.damage, reason: shot.reason });
    }
  }
  const shields: ShieldSample[] = [];
  for (const bearing16 of BEARINGS) shields.push(measureShield(ship.turnHull, bearing16));
  const firepower: FirepowerSample[] = [];
  for (const speed of FIREPOWER_SPEEDS) firepower.push(measureFirepower(ship.turnHull, speed));
  return {
    id: ship.id,
    turnHull: ship.turnHull,
    turns,
    timeToSpeed,
    energy,
    phaser,
    heavy: measureHeavy(ship.turnHull),
    shields,
    firepower,
  };
}

export function collectMetrics(): MetricsReport {
  const ships: ShipReport[] = [];
  for (const ship of PROBE_SHIPS) ships.push(measureShip(ship));
  return {
    tool: 'duel-metrics',
    tickHz: TICK_HZ,
    rulesTurnTicks: RULES_TURN_TICKS,
    inputDelay: INPUT_DELAY,
    seed: SEED,
    acceleration: motionSetup('F-CA').acceleration,
    warp: motionSetup('F-CA').warp,
    moveCostRulePoints: motionSetup('F-CA').moveCost100 / ENERGY_SCALE,
    headingVerb: VERB_ORDER_HEADING,
    energyVerb: VERB_SET_ENERGY,
    fireVerb: VERB_FIRE,
    ships,
  };
}

