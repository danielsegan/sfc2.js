/**
 * Persistent target heading. The order stores one uint16. Each movement
 * tick the ship yaws toward it the short way, by at most its turn cap.
 * A later order replaces it. Nothing here follows another ship.
 * The payload is entity and heading. The session stamps tick, slot, and seq.
 *
 * A manual yaw replaces the order with a hold on the heading just reached.
 * Sims that do not register the table keep yaw-only helm.
 */
import { angle16, shortestArc } from '../core/angle.ts';
import { asEntityId, type EntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler, SimSystem, TickContext } from './sim.ts';
import type { TableSpec, World } from './world.ts';
import { H, readHull } from './hull.ts';
import { rulesDiv } from './rules-div.ts';
import { CLASS_FIGHTER, turnHasRate, turnImmobile, turnYawCap } from './rules-tables.ts';

/** Free verb. 1–11 and 20–27 are combat, allegiance, phase-3, and small craft. */
export const VERB_ORDER_HEADING = 12;

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
  const fields = readHull(world, id);
  const current = world.heading(id) as number;
  if (shortestArc(angle16(current), angle16(heading)) !== 0 && turnImmobile(fields[H.turnMode]!) === 1) {
    ctx.emit({ kind: EVENT_HEADING, entity: id as number, a: HEADING_IMMOBILE, b: 0 });
    return;
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
  const cap = turnYawCap(fields[H.turnMode]!);
  if (cap < 0) return;
  const aim = (order[HORD.heading] ?? 0) & 0xffff;
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
