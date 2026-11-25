/**
 * High-Energy Turn, verb 13 (VERB_ORDER_HET in heading.ts). The payload is
 * entity and dir: -1 turns to port, +1 to starboard. Sweep, rate, and delay
 * come from docs/rules/data/het.json by hull row and current speed; the
 * command cannot override them. There is no speed cutoff.
 *
 * The turn runs in two phases in the movement step: the delay counts down
 * one tick at a time, then the heading steps by the locked rate until the
 * sweep is used up. The last step takes only what is left. When it ends the
 * ship holds the heading it reached.
 *
 * While a HET is pending or running, heading orders, manual yaw, and a second
 * HET are refused with hetActive (provisional, see docs/rules/het.md).
 * Sims that do not register HET_TABLE never see this verb.
 */
import { angle16 } from '../core/angle.ts';
import { asEntityId, type EntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler, SimSystem, TickContext } from './sim.ts';
import type { World } from './world.ts';
import { H, readHull } from './hull.ts';
import { CLASS_FIGHTER, turnImmobile } from './rules-tables.ts';
import { HEADING_OFF, HEADING_ORDER, VERB_ORDER_HET, holdHeading } from './heading.ts';
import {
  HET_CURVE,
  HET_FIELDS,
  HET_STATE,
  HS,
  curvePoint,
  hetIdFor,
  setCurveDelay,
  speedKey,
} from './turn-curve.ts';
import { breakdownLeft, hetChance, markBreakdown } from './duel-helm.ts';

export const EVENT_HET = 20;

export const HET_ORDERED = 0;
export const HET_IMMOBILE = 2;
export const HET_DISABLED = 4;
export const HET_NO_SHIP = 5;
export const HET_NOT_SHIP = 6;
export const HET_DESTROYED = 7;
export const HET_INVALID_DIR = 8;
export const HET_ACTIVE = 9;
/** Not a refusal: the sweep finished this tick. `b` is the heading reached. */
export const HET_DONE = 10;
/** The success roll failed, or helm is still locked from an earlier failure. */
export const HET_BREAKDOWN = 11;

export function hetPayload(entity: number, dir: number): Uint8Array {
  const out = new Uint8Array(8);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, dir | 0);
  return out;
}

/** Free-angle HET. `delta16` is a signed BAM sweep, from −32768 through 32768. 0 holds the bow through the delay. */
export function hetAnglePayload(entity: number, delta16: number): Uint8Array {
  const out = new Uint8Array(12);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, 0);
  writeU32(out, 8, delta16 | 0);
  return out;
}

function readI32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}

function emit(ctx: TickContext, entity: number, code: number, b: number): void {
  ctx.emit({ kind: EVENT_HET, entity, a: code, b });
}

function idle(): number[] {
  const out: number[] = [];
  for (let i = 0; i < HET_FIELDS; i++) out.push(0);
  return out;
}

function shipProblem(world: World, id: EntityId): number {
  if (!world.isLive(id)) return HET_NO_SHIP;
  const fields = readHull(world, id);
  if (fields[H.classCode] === CLASS_FIGHTER) return HET_NOT_SHIP;
  if (fields[H.classCode] === 0) return HET_NO_SHIP;
  if (fields[H.destroyed] === 1) return HET_DESTROYED;
  if (fields[H.disabled] === 1 || fields[H.crew]! < fields[H.minCrew]!) return HET_DISABLED;
  return HET_ORDERED;
}

function applyHet(world: World, cmd: Command, ctx: TickContext): void {
  if (cmd.payload.length < 8) throw new Error('het payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const dir = readI32(cmd.payload, 4);
  const problem = shipProblem(world, id);
  if (problem !== HET_ORDERED) {
    emit(ctx, id as number, problem, 0);
    return;
  }
  const free = cmd.payload.length >= 12;
  const delta = free ? readI32(cmd.payload, 8) : 0;
  const deltaMag = delta < 0 ? -delta : delta;
  const badSweep = free ? deltaMag > 32768 : dir !== -1 && dir !== 1;
  if (badSweep) {
    emit(ctx, id as number, HET_INVALID_DIR, free ? delta : dir);
    return;
  }
  const fields = readHull(world, id);
  if (turnImmobile(fields[H.turnMode]!) === 1) {
    emit(ctx, id as number, HET_IMMOBILE, 0);
    return;
  }
  const state = world.getFields(id, HET_STATE);
  if (state[HS.active] === 1) {
    emit(ctx, id as number, HET_ACTIVE, state[HS.remaining]!);
    return;
  }
  const locked = breakdownLeft(world, id);
  if (locked > 0) {
    emit(ctx, id as number, HET_BREAKDOWN, locked);
    return;
  }
  const chance = hetChance(world, id);
  if (chance < 100 && !ctx.rng.stream('combat').chance(chance, 100)) {
    emit(ctx, id as number, HET_BREAKDOWN, markBreakdown(world, id, ctx));
    return;
  }
  const point = curvePoint(HET_CURVE, hetIdFor(world, id), speedKey(fields));
  const sweep = free ? delta : dir * point.angle;
  world.setFields(id, HET_STATE, [1, sweep, point.delay, point.rate]);
  // The HET supersedes any heading order. A pending normal-turn delay is dropped.
  if (world.hasTable(HEADING_ORDER)) world.setFields(id, HEADING_ORDER, [HEADING_OFF, 0, 0, 0]);
  setCurveDelay(world, id, 0);
  emit(ctx, id as number, HET_ORDERED, sweep);
}

export const hetHandler: CommandHandler = {
  kind: VERB_ORDER_HET,
  apply(world, cmd, ctx) {
    applyHet(world, cmd, ctx);
  },
};

/** Movement phase, before the heading steer (-1) and cruise (0). */
export function createHetTurn(): SimSystem {
  return {
    id: 'het-turn',
    phase: 'movement',
    priority: -2,
    step(world, ctx) {
      if (!world.hasTable(HET_STATE)) return;
      for (const id of world.liveIds()) stepOne(world, id, ctx);
    },
  };
}

function stepOne(world: World, id: EntityId, ctx: TickContext): void {
  const state = world.getFields(id, HET_STATE);
  if (state[HS.active] !== 1) return;
  const fields = readHull(world, id);
  if (fields[H.classCode] === 0 || fields[H.destroyed] === 1) {
    world.setFields(id, HET_STATE, idle());
    return;
  }
  const delay = state[HS.delayLeft]!;
  if (delay > 0) {
    world.setFields(id, HET_STATE, [1, state[HS.remaining]!, delay - 1, state[HS.rate]!]);
    return;
  }
  const remaining = state[HS.remaining]!;
  const rate = state[HS.rate]!;
  const mag = remaining < 0 ? -remaining : remaining;
  const step = mag > rate ? (remaining < 0 ? -rate : rate) : remaining;
  if (step !== 0) world.setHeading(id, angle16((world.heading(id) as number) + step));
  const left = remaining - step;
  if (left !== 0) {
    world.setFields(id, HET_STATE, [1, left, 0, rate]);
    return;
  }
  world.setFields(id, HET_STATE, idle());
  const heading = world.heading(id) as number;
  holdHeading(world, id, heading);
  emit(ctx, id as number, HET_DONE, heading);
}
