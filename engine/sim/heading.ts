/**
 * Persistent target heading. The order stores one uint16. Each movement
 * tick the ship yaws toward it the short way, by at most its turn cap.
 * A later order replaces it. Nothing here follows another ship.
 * The payload is entity and heading. The session stamps tick, slot, and seq.
 *
 * A manual yaw replaces the order with a hold on the heading just reached.
 * Sims that do not register the table keep yaw-only helm.
 *
 * With the turnCurve table (turn-curve.ts) a hull that names a turn hull
 * steers at its measured normal-turn rate. A measured letter cap, or a
 * TEST-* / H row, can still bound that rate. The shared fallback does not.
 * A fresh order waits out the curve's start delay before the first step.
 * Without that table the letter cap is used unchanged.
 */
import { angle16, shortestArc } from '../core/angle.ts';
import { asEntityId, type EntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler, SimSystem, TickContext } from './sim.ts';
import type { TableSpec, World } from './world.ts';
import { H, readHull } from './hull.ts';
import { rulesDiv } from './rules-div.ts';
import { CLASS_FIGHTER, turnHasRate, turnImmobile } from './rules-tables.ts';
import { TC, curveRow, hetActive, normalDelayFor, setCurveDelay, turnRateFor, usesCurve } from './turn-curve.ts';
import { breakdownLeft, erraticOn } from './duel-helm.ts';

/** Free verbs. 1–11 and 20–27 are combat, allegiance, phase-3, and small craft. */
export const VERB_ORDER_HEADING = 12;

/** High-Energy Turn. The handler is engine/sim/het.ts. */
export const VERB_ORDER_HET = 13;

export const EVENT_HEADING = 19;

export const HEADING_ORDER = 'headingOrder';

export const HORD = {
  mode: 0,
  heading: 1,
  ticks: 2,
  band: 3,
} as const;

export const HEADING_FIELDS = 4;

export const HEADING_ORDER_TABLE: TableSpec = { id: HEADING_ORDER, fieldCount: HEADING_FIELDS };

export const HEADING_OFF = 0;
export const HEADING_STEER = 1;
export const HEADING_HOLD = 2;

export const HEADING_ORDERED = 0;
export const HEADING_IMMOBILE = 2;
export const HEADING_UNVERIFIED = 3;
export const HEADING_DISABLED = 4;
export const HEADING_NO_SHIP = 5;
export const HEADING_NOT_SHIP = 6;
export const HEADING_DESTROYED = 7;
/** A High-Energy Turn is pending or running (hetActive). */
export const HEADING_HET_ACTIVE = 8;
/** Helm is locked after a failed High-Energy Turn. */
export const HEADING_BREAKDOWN = 9;

export function headingPayload(entity: number, heading16: number): Uint8Array {
  const out = new Uint8Array(8);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, (heading16 | 0) & 0xffff);
  return out;
}

function readI32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}

function reject(ctx: TickContext, entity: number, code: number): void {
  ctx.emit({ kind: EVENT_HEADING, entity, a: code, b: 0 });
}

function orderRow(mode: number, heading: number, ticks: number, band: number): number[] {
  return [mode, heading & 0xffff, ticks | 0, band | 0];
}

/** Point a manual yaw at the heading it just applied. No-op without the table. */
export function holdHeading(world: World, id: EntityId, heading16: number): void {
  if (!world.hasTable(HEADING_ORDER)) return;
  world.setFields(id, HEADING_ORDER, orderRow(HEADING_HOLD, heading16, 0, 0));
}

function shipProblem(world: World, id: EntityId): number {
  if (!world.isLive(id)) return HEADING_NO_SHIP;
  const fields = readHull(world, id);
  if (fields[H.classCode] === CLASS_FIGHTER) return HEADING_NOT_SHIP;
  if (fields[H.classCode] === 0) return HEADING_NO_SHIP;
  if (fields[H.destroyed] === 1) return HEADING_DESTROYED;
  if (fields[H.disabled] === 1 || fields[H.crew]! < fields[H.minCrew]!) return HEADING_DISABLED;
  if (turnHasRate(fields[H.turnMode]!) === 0) return HEADING_UNVERIFIED;
  return HEADING_ORDERED;
}

function applyHeading(world: World, cmd: Command, ctx: TickContext): void {
  if (cmd.payload.length < 8) throw new Error('heading payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const heading = readI32(cmd.payload, 4) & 0xffff;
  const problem = shipProblem(world, id);
  if (problem !== HEADING_ORDERED) {
    reject(ctx, id as number, problem);
    return;
  }
  if (hetActive(world, id) === 1) {
    reject(ctx, id as number, HEADING_HET_ACTIVE);
    return;
  }
  if (breakdownLeft(world, id) > 0) {
    reject(ctx, id as number, HEADING_BREAKDOWN);
    return;
  }
  const fields = readHull(world, id);
  const current = world.heading(id) as number;
  const arc = shortestArc(angle16(current), angle16(heading));
  if (arc !== 0 && turnImmobile(fields[H.turnMode]!) === 1) {
    ctx.emit({ kind: EVENT_HEADING, entity: id as number, a: HEADING_IMMOBILE, b: 0 });
    return;
  }
  // A curve hull that is not already turning waits out the start delay. One that is keeps its count.
  if (usesCurve(world, id) === 1 && world.getFields(id, HEADING_ORDER)[HORD.mode] !== HEADING_STEER) {
    setCurveDelay(world, id, arc !== 0 ? normalDelayFor(world, id, fields) : 0);
  }
  world.setFields(id, HEADING_ORDER, orderRow(HEADING_STEER, heading, 0, 0));
  ctx.emit({ kind: EVENT_HEADING, entity: id as number, a: HEADING_ORDERED, b: heading });
}

export const headingHandler: CommandHandler = {
  kind: VERB_ORDER_HEADING,
  apply(world, cmd, ctx) {
    applyHeading(world, cmd, ctx);
  },
};

/**
 * Movement phase, before cruise. Same priority as the tractor pull;
 * the id sorts first, so the ship turns and then moves on the new heading.
 */
export function createHeadingSteer(): SimSystem {
  return {
    id: 'heading-steer',
    phase: 'movement',
    priority: -1,
    step(world) {
      if (!world.hasTable(HEADING_ORDER)) return;
      for (const id of world.liveIds()) steerOne(world, id);
    },
  };
}

function steerOne(world: World, id: EntityId): void {
  const order = world.getFields(id, HEADING_ORDER);
  const mode = order[HORD.mode] ?? 0;
  if (mode !== HEADING_STEER) return;
  const fields = readHull(world, id);
  if (fields[H.classCode] === 0 || fields[H.classCode] === CLASS_FIGHTER || fields[H.destroyed] === 1) {
    world.setFields(id, HEADING_ORDER, orderRow(HEADING_OFF, 0, 0, 0));
    return;
  }
  if (fields[H.disabled] === 1 || fields[H.crew]! < fields[H.minCrew]!) {
    world.setFields(id, HEADING_ORDER, orderRow(HEADING_OFF, 0, 0, 0));
    return;
  }
  if (turnHasRate(fields[H.turnMode]!) === 0) return;
  if (hetActive(world, id) === 1) return;
  if (breakdownLeft(world, id) > 0 || erraticOn(world, id)) return;
  const cap = turnRateFor(world, id, fields);
  if (cap < 0) return;
  const aim = (order[HORD.heading] ?? 0) & 0xffff;
  const curve = curveRow(world, id);
  const wait = curve ? (curve[TC.delayLeft] ?? 0) : 0;
  if (wait > 0) {
    setCurveDelay(world, id, wait - 1);
    const pending = remain(world.heading(id) as number, aim, cap);
    world.setFields(id, HEADING_ORDER, orderRow(mode, aim, pending.ticks + wait - 1, pending.band));
    return;
  }
  if (turnImmobile(fields[H.turnMode]!) === 1) {
    const stuck = remain(world.heading(id) as number, aim, cap);
    world.setFields(id, HEADING_ORDER, orderRow(mode, aim, stuck.ticks, stuck.band));
    return;
  }
  const arc = shortestArc(world.heading(id), angle16(aim));
  if (arc !== 0) {
    const mag = arc < 0 ? -arc : arc;
    const applied = mag > cap ? (arc < 0 ? -cap : cap) : arc;
    world.setHeading(id, angle16((world.heading(id) as number) + applied));
  }
  const left = remain(world.heading(id) as number, aim, cap);
  const done = left.ticks === 0;
  world.setFields(id, HEADING_ORDER, orderRow(done ? HEADING_HOLD : HEADING_STEER, aim, left.ticks, left.band));
}

/** Bands are remaining angle, not remaining time. 0 under 22.5°, then 45°, 90°, and at least 90°. */
function remain(heading: number, aim: number, cap: number): { ticks: number; band: number } {
  const arc = shortestArc(angle16(heading), angle16(aim));
  const mag = arc < 0 ? -arc : arc;
  let band = 0;
  if (mag >= 16384) band = 3;
  else if (mag >= 8192) band = 2;
  else if (mag >= 4096) band = 1;
  const ticks = cap > 0 ? rulesDiv(mag + cap - 1, cap) : 0;
  return { ticks, band };
}
