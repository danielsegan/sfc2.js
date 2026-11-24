/**
 * One tick of yaw for the duel. Combat verbs 1–5 stay in combat.ts.
 * This handler is registered beside them. The payload is entity and yaw
 * only. The session stamps tick, slot, and seq.
 *
 * Caps come from the synthetic turn-mode table. An unverified letter
 * uses the documented fallback cap and still turns. The hull's last-verb
 * fields are left to the combat verbs.
 */
import { angle16 } from '../core/angle.ts';
import { asEntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler, TickContext } from '../sim/sim.ts';
import type { World } from '../sim/world.ts';
import { H, readHull } from '../sim/hull.ts';
import {
  CLASS_FIGHTER,
  turnHasRate,
  turnImmobile,
  turnYawCap,
} from '../sim/rules-tables.ts';

export { turnYawCap };

/** Duel yaw order. Combat's verbs stay 1–5; this match registers 6 beside them. */
export const VERB_ORDER_HELM = 6;

export const EVENT_HELM = 16;

export const HELM_OK = 0;
export const HELM_YAW_CLAMPED = 1;
export const HELM_IMMOBILE = 2;
export const HELM_UNVERIFIED = 3;
export const HELM_DISABLED = 4;
export const HELM_NO_SHIP = 5;
export const HELM_NOT_SHIP = 6;
export const HELM_DESTROYED = 7;

export function helmPayload(entity: number, yaw16: number): Uint8Array {
  const out = new Uint8Array(8);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, yaw16 | 0);
  return out;
}

function readI32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}

function reject(ctx: TickContext, entity: number, code: number): void {
  ctx.emit({ kind: EVENT_HELM, entity, a: code, b: 0 });
}

function apply(world: World, cmd: Command, ctx: TickContext): void {
  if (cmd.payload.length < 8) throw new Error('helm payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const yaw = readI32(cmd.payload, 4);
  if (!world.isLive(id)) {
    reject(ctx, id as number, HELM_NO_SHIP);
    return;
  }
  const fields = readHull(world, id);
  if (fields[H.classCode] === CLASS_FIGHTER) {
    reject(ctx, id as number, HELM_NOT_SHIP);
    return;
  }
  if (fields[H.classCode] === 0) {
    reject(ctx, id as number, HELM_NO_SHIP);
    return;
  }
  if (fields[H.destroyed] === 1) {
    reject(ctx, id as number, HELM_DESTROYED);
    return;
  }
  if (fields[H.disabled] === 1 || fields[H.crew]! < fields[H.minCrew]!) {
    reject(ctx, id as number, HELM_DISABLED);
    return;
  }
  if (turnHasRate(fields[H.turnMode]!) === 0) {
    reject(ctx, id as number, HELM_UNVERIFIED);
    return;
  }
  if (yaw !== 0 && turnImmobile(fields[H.turnMode]!) === 1) {
    ctx.emit({ kind: EVENT_HELM, entity: id as number, a: HELM_IMMOBILE, b: 0 });
    return;
  }
  const cap = turnYawCap(fields[H.turnMode]!);
  if (cap < 0) {
    reject(ctx, id as number, HELM_UNVERIFIED);
    return;
  }
  const sign = yaw < 0 ? -1 : 1;
  const mag = yaw < 0 ? -yaw : yaw;
  let applied = yaw;
  let code: number = HELM_OK;
  if (mag > cap) {
    applied = sign * cap;
    code = HELM_YAW_CLAMPED;
  }
  if (applied !== 0) {
    const heading = (world.heading(id) as number) + applied;
    world.setHeading(id, angle16(heading));
  }
  ctx.emit({ kind: EVENT_HELM, entity: id as number, a: code, b: applied });
}

export const helmHandler: CommandHandler = {
  kind: VERB_ORDER_HELM,
  apply(world, cmd, ctx) {
    apply(world, cmd, ctx);
  },
};
