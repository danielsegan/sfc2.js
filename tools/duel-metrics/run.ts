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
  VERB_ORDER_HET,
  createHeadingSteer,
  headingHandler,
  headingPayload,
} from '../../engine/sim/heading.ts';
import { helmHandler } from '../../engine/sim/helm.ts';
import { EVENT_HET, HET_DONE, createHetTurn, hetHandler, hetPayload } from '../../engine/sim/het.ts';
import { H, shipView, type ShipView } from '../../engine/sim/hull.ts';
import {
  DEFAULT_FC_HUNDREDTHS,
  DEFAULT_LIFE_HUNDREDTHS,
  ENERGY_SCALE,
  MODE_NORMAL,
  MODE_OVERLOAD,
  weaponDef,
  weaponId,
} from '../../engine/sim/rules-tables.ts';
import { createSim, type Sim, type SimEvent } from '../../engine/sim/sim.ts';
import { HET_TABLE, TURN_CURVE_TABLE } from '../../engine/sim/turn-curve.ts';
import type { ShipSetup } from '../../engine/sim/bind-shiplist.ts';
import {
  BEARINGS,
  FCA_HIGH_SPEED_HUNDREDTHS,
  HEADING_TARGET,
  INPUT_DELAY,
  DISRUPTOR_CODE,
  DISRUPTOR_OVERLOAD_RANGES,
  DISRUPTOR_RANGES,
  PHASER_RANGES,
  PHOTON_CODE,
  PHOTON_RANGES,
  PROBE_SHIPS,
  RULES_TURN_TICKS,
  SEED,
  SHIELD_RANGE,
  SPEEDS,
  TICK_HZ,
  armedPhotonSetup,
  motionSetup,
  powerSetup,
  armedDisruptorSetup,
  weaponSetup,
  type ProbeShip,
} from './ships.ts';

const SELF = 65536;
const TARGET = 65537;
const RAMP_LIMIT = 8000;

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
  speedHundredths: number,
  life: boolean,
  fireControl: boolean,
  weapons: readonly { slot: number; request: number; mode: number }[],
): Uint8Array {
  return setEnergyPayload(entity, {
    lifeSupport: life,
    fireControl,
    speedHundredths,
    general: 0,
    specific: [0, 0, 0, 0, 0, 0],
    weapons,
  });
}

export interface TurnSample {
  readonly speedHundredths: number;
  readonly delayTicks: number;
  readonly turnRate16PerTick: number;
}

export interface HetSample {
  readonly speedHundredths: number;
  readonly delayTicks: number;
  readonly turnRate16PerTick: number;
  readonly sweep16: number;
}

export interface SpeedSample {
  readonly speedHundredths: number;
  readonly ticksFromRest: number;
}

export interface EnergySample {
  readonly speedHundredths: number;
  readonly movementHundredths: number;
}

export interface PhaserProbe {
  readonly range: number;
  readonly damage: number | null;
  readonly reason: string;
}

export interface HeavySample {
  readonly weapon: string;
  readonly armPerTurn: number;
  readonly holdCost: number;
  readonly catalogArmCost: number;
  readonly energyPaidHundredths: number;
  readonly ticksUntilReady: number;
}

export interface ShieldSample {
  readonly bearing16: number;
  readonly facing: number;
}

export interface FirepowerSample {
  readonly speedHundredths: number;
  readonly weaponHundredths: number;
  readonly lifeHundredths: number;
  readonly fireControlHundredths: number;
  readonly movementHundredths: number;
}

export interface DecelSample {
  readonly hundredthsLost: number;
  readonly ticks: number;
}

export interface ShipReport {
  readonly id: ProbeShip['id'];
  readonly turnHull: ProbeShip['turnHull'];
  readonly warp: number;
  readonly turns: readonly TurnSample[];
  readonly hets: readonly HetSample[];
  readonly timeToSpeed: readonly SpeedSample[];
  readonly energy: readonly EnergySample[];
  readonly decel: DecelSample;
  readonly phaser: readonly PhaserProbe[];
  readonly photonDamage: readonly PhaserProbe[];
  readonly disruptorDamage: readonly PhaserProbe[];
  readonly disruptorOverload: readonly PhaserProbe[];
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
  readonly ships: readonly ShipReport[];
}

function signedDelta(from: number, to: number): number {
  const d = (to - from) & 0xffff;
  return d > 32767 ? d - 65536 : d;
}

function actualOf(sim: Sim): number {
  return viewAt(sim, 0).speedActual100;
}

/** Order a speed and step until actual speed reaches it. Returns the ramp length and the energy paid. */
function reachSpeed(stepper: Stepper, speedHundredths: number): { ticks: number; paidHundredths: number } {
  stepper.session.issue(VERB_SET_ENERGY, energyOrder(SELF, speedHundredths, false, false, []));
  let steps = 0;
  let paid = 0;
  while (steps < RAMP_LIMIT) {
    stepper.step();
    steps += 1;
    if (steps === 1) paid = viewAt(stepper.sim, 0).lastApplied;
    if (actualOf(stepper.sim) >= speedHundredths) break;
  }
  if (actualOf(stepper.sim) < speedHundredths) throw new Error(`speed ${speedHundredths}`);
  return { ticks: steps, paidHundredths: paid };
}

function measureTurn(turnHull: string, speedHundredths: number): TurnSample {
  const stepper = boot([motionSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  reachSpeed(stepper, speedHundredths);
  const before = viewAt(stepper.sim, 0).heading;
  stepper.session.issue(VERB_ORDER_HEADING, headingPayload(SELF, HEADING_TARGET));
  stepper.step();
  const orderTick = tickOf(stepper.sim);
  let prev = before;
  let cursor = viewAt(stepper.sim, 0).heading;
  let firstTick = -1;
  let rate = 0;
  const take = (at: number, delta: number): void => {
    const mag = delta < 0 ? -delta : delta;
    if (firstTick < 0) {
      firstTick = at;
      rate = mag;
    }
  };
  const opened = signedDelta(prev, cursor);
  if (opened !== 0) take(orderTick, opened);
  prev = cursor;
  for (let n = 0; n < 400 && firstTick < 0; n++) {
    stepper.step();
    cursor = viewAt(stepper.sim, 0).heading;
    const delta = signedDelta(prev, cursor);
    if (delta !== 0) take(tickOf(stepper.sim), delta);
    prev = cursor;
  }
  if (firstTick < 0 || rate <= 0) throw new Error(`turn ${turnHull} at ${speedHundredths}`);
  return { speedHundredths, delayTicks: firstTick - orderTick, turnRate16PerTick: rate };
}

function measureHet(turnHull: string, speedHundredths: number): HetSample {
  const stepper = boot([motionSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  reachSpeed(stepper, speedHundredths);
  const before = viewAt(stepper.sim, 0).heading;
  stepper.session.issue(VERB_ORDER_HET, hetPayload(SELF, 1));
  let events = stepper.step();
  const orderTick = tickOf(stepper.sim);
  let prev = before;
  let firstTick = -1;
  let rate = 0;
  let sweep = 0;
  let done = false;
  const take = (eventsNow: readonly SimEvent[]): void => {
    const cursor = viewAt(stepper.sim, 0).heading;
    const delta = signedDelta(prev, cursor);
    prev = cursor;
    if (delta !== 0) {
      const mag = delta < 0 ? -delta : delta;
      if (firstTick < 0) {
        firstTick = tickOf(stepper.sim);
        rate = mag;
      }
      sweep += mag;
    }
    for (const event of eventsNow) {
      if (event.kind === EVENT_HET && event.a === HET_DONE) done = true;
    }
  };
  take(events);
  for (let n = 0; n < 800 && !done; n++) {
    events = stepper.step();
    take(events);
  }
  if (firstTick < 0 || rate <= 0 || sweep <= 0) throw new Error(`het ${turnHull} at ${speedHundredths}`);
  return { speedHundredths, delayTicks: firstTick - orderTick, turnRate16PerTick: rate, sweep16: sweep };
}

function measureDecel(turnHull: string): DecelSample {
  const stepper = boot([motionSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  reachSpeed(stepper, 2000);
  const before = actualOf(stepper.sim);
  stepper.session.issue(VERB_SET_ENERGY, energyOrder(SELF, 0, false, false, []));
  const ticks = 300;
  for (let n = 0; n < ticks; n++) stepper.step();
  const after = actualOf(stepper.sim);
  return { hundredthsLost: before - after, ticks };
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

function measureDisruptor(rangeK: number, mode: number): { damage: number | null; reason: string } {
  const stepper = boot(
    [armedDisruptorSetup(mode), weaponSetup('K-D7')],
    [
      { x: 0, y: 0, heading: 0 },
      { x: rangeK * 1000, y: 0, heading: 0 },
    ],
  );
  stepper.session.issue(VERB_FIRE, firePayload(SELF, 0, TARGET));
  const events = stepper.step();
  const rule = ruleOn(events, SELF);
  if (!rule) throw new Error(`no disruptor at range ${rangeK}k`);
  if (rule.reason !== 'ok') return { damage: null, reason: rule.reason };
  return { damage: rule.applied, reason: rule.reason };
}

function measurePhoton(range: number): { damage: number | null; reason: string } {
  const stepper = boot(
    [armedPhotonSetup('F-CA'), armedPhotonSetup('F-CA')],
    [
      { x: 0, y: 0, heading: 0 },
      { x: range, y: 0, heading: 0 },
    ],
  );
  stepper.session.issue(VERB_FIRE, firePayload(SELF, 0, TARGET));
  const events = stepper.step();
  const rule = ruleOn(events, SELF);
  if (!rule) throw new Error(`no photon at range ${range}`);
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
  return { bearing16, facing: hit.facing };
}

function mountReady(view: ShipView, slot: number, cost100: number, armTicks: number): boolean {
  const row = view.mounts[slot];
  if (!row || row.weaponId === 0) return false;
  return row.charge100 >= cost100 && row.ticksCharging >= armTicks;
}

function measureHeavy(turnHull: string, code: string): HeavySample {
  const def = weaponDef(weaponId(code));
  if (!def) throw new Error(`${code} def`);
  const perTurn = def.armPerTurn > 0 ? def.armPerTurn : def.armCost;
  const stepper = boot([weaponSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  let paid = 0;
  let started = -1;
  let readyTick = -1;
  for (let plan = 0; plan < 4 && readyTick < 0; plan++) {
    stepper.session.issue(
      VERB_SET_ENERGY,
      energyOrder(SELF, 0, false, false, [{ slot: 1, request: perTurn, mode: MODE_NORMAL }]),
    );
    stepper.step();
    if (started < 0) started = tickOf(stepper.sim);
    paid += viewAt(stepper.sim, 0).lastApplied;
    if (mountReady(viewAt(stepper.sim, 0), 1, def.armCost * ENERGY_SCALE, def.armTicks)) {
      readyTick = tickOf(stepper.sim);
      break;
    }
    for (let n = 1; n < RULES_TURN_TICKS && readyTick < 0; n++) {
      stepper.step();
      if (mountReady(viewAt(stepper.sim, 0), 1, def.armCost * ENERGY_SCALE, def.armTicks)) {
        readyTick = tickOf(stepper.sim);
      }
    }
  }
  if (readyTick < 0 || started < 0) throw new Error(`${code} did not arm on ${turnHull}`);
  return {
    weapon: code,
    armPerTurn: perTurn,
    holdCost: def.holdCost,
    catalogArmCost: def.armCost,
    energyPaidHundredths: paid,
    ticksUntilReady: readyTick - started + 1,
  };
}

function measureFirepower(turnHull: string, speedHundredths: number): FirepowerSample {
  const stepper = boot([powerSetup(turnHull)], [{ x: 0, y: 0, heading: 0 }]);
  const weapons: { slot: number; request: number; mode: number }[] = [];
  for (let slot = 0; slot < viewAt(stepper.sim, 0).mounts.length; slot++) {
    const row = viewAt(stepper.sim, 0).mounts[slot]!;
    if (row.weaponId === 0) continue;
    weapons.push({ slot, request: 100, mode: MODE_NORMAL });
  }
  stepper.session.issue(VERB_SET_ENERGY, energyOrder(SELF, speedHundredths, true, true, weapons));
  const events = stepper.step();
  const rule = ruleOn(events, SELF);
  if (!rule || (rule.reason !== 'ok' && rule.reason !== 'overDraw' && rule.reason !== 'chargeCapped')) {
    throw new Error(`firepower ${turnHull} speed ${speedHundredths} (${rule?.reason ?? 'none'})`);
  }
  const view = viewAt(stepper.sim, 0);
  let weapon100 = 0;
  for (const row of view.mounts) weapon100 += row.budget100;
  const snap = stepper.sim.snapshot().world;
  let unpaid = -1;
  for (const table of snap.tables) {
    if (table.id !== 'hull') continue;
    unpaid = table.data[H.lsUnpaid] ?? 0;
  }
  if (unpaid !== 0 && unpaid !== 1) throw new Error('life flag');
  const lifeHundredths = unpaid === 0 ? DEFAULT_LIFE_HUNDREDTHS : 0;
  const fireControlHundredths = view.fcPaid === 1 ? DEFAULT_FC_HUNDREDTHS : 0;
  const movementHundredths =
    view.moveCost100 * view.speed + Math.floor((view.moveCost100 * view.speedFrac100) / ENERGY_SCALE);
  const split = weapon100 + lifeHundredths + fireControlHundredths + movementHundredths;
  if (split !== view.lastApplied) throw new Error(`energy split ${split} != ${view.lastApplied}`);
  return {
    speedHundredths,
    weaponHundredths: weapon100,
    lifeHundredths,
    fireControlHundredths,
    movementHundredths,
  };
}

function turnSpeeds(ship: ProbeShip): number[] {
  const out: number[] = [];
  for (const speed of SPEEDS) out.push(speed * 100);
  if (ship.turnHull === 'F-CA') out.push(FCA_HIGH_SPEED_HUNDREDTHS);
  return out;
}

function timeSpeeds(ship: ProbeShip): number[] {
  const out = [5, 10, 15, 20, 25, 30];
  if (ship.turnHull === 'K-D7') out.push(31);
  const hundredths: number[] = [];
  for (const speed of out) hundredths.push(speed * 100);
  return hundredths;
}

function firepowerSpeeds(ship: ProbeShip): number[] {
  if (ship.turnHull === 'F-CA') return [0, 1000, 2000, FCA_HIGH_SPEED_HUNDREDTHS];
  return [0, 1000, 2000, 3100];
}

function measureShip(ship: ProbeShip): ShipReport {
  const turns: TurnSample[] = [];
  const hets: HetSample[] = [];
  const timeToSpeed: SpeedSample[] = [];
  const energy: EnergySample[] = [];
  for (const speedHundredths of turnSpeeds(ship)) {
    turns.push(measureTurn(ship.turnHull, speedHundredths));
    hets.push(measureHet(ship.turnHull, speedHundredths));
  }
  for (const speedHundredths of timeSpeeds(ship)) {
    const ramp = reachSpeed(boot([motionSetup(ship.turnHull)], [{ x: 0, y: 0, heading: 0 }]), speedHundredths);
    timeToSpeed.push({ speedHundredths, ticksFromRest: ramp.ticks });
  }
  for (const speed of SPEEDS) {
    const paid = reachSpeed(boot([motionSetup(ship.turnHull)], [{ x: 0, y: 0, heading: 0 }]), speed * 100);
    energy.push({ speedHundredths: speed * 100, movementHundredths: paid.paidHundredths });
  }
  const phaser: PhaserProbe[] = [];
  for (const range of PHASER_RANGES) {
    const shot = measurePhaser(ship.turnHull, range);
    phaser.push({ range, damage: shot.damage, reason: shot.reason });
  }
  const photonDamage: PhaserProbe[] = [];
  const disruptorDamage: PhaserProbe[] = [];
  const disruptorOverload: PhaserProbe[] = [];
  if (ship.heavy === PHOTON_CODE) {
    for (const range of PHOTON_RANGES) {
      const shot = measurePhoton(range);
      photonDamage.push({ range, damage: shot.damage, reason: shot.reason });
    }
  }
  if (ship.heavy === DISRUPTOR_CODE) {
    for (const range of DISRUPTOR_RANGES) {
      const shot = measureDisruptor(range, MODE_NORMAL);
      disruptorDamage.push({ range, damage: shot.damage, reason: shot.reason });
    }
    for (const range of DISRUPTOR_OVERLOAD_RANGES) {
      const shot = measureDisruptor(range, MODE_OVERLOAD);
      disruptorOverload.push({ range, damage: shot.damage, reason: shot.reason });
    }
  }
  const shields: ShieldSample[] = [];
  for (const bearing16 of BEARINGS) shields.push(measureShield(ship.turnHull, bearing16));
  const firepower: FirepowerSample[] = [];
  for (const speedHundredths of firepowerSpeeds(ship)) {
    firepower.push(measureFirepower(ship.turnHull, speedHundredths));
  }
  return {
    id: ship.id,
    turnHull: ship.turnHull,
    warp: ship.warp,
    turns,
    hets,
    timeToSpeed,
    energy,
    decel: measureDecel(ship.turnHull),
    phaser,
    photonDamage,
    disruptorDamage,
    disruptorOverload,
    heavy: measureHeavy(ship.turnHull, ship.heavy),
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
    ships,
  };
}
