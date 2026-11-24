/**
 * One tick of yaw for the duel. Combat verbs 1–5 and 7–10 stay in combat.ts.
 * This handler is registered beside them. The payload is entity and yaw
 * only. The session stamps tick, slot, and seq.
 *
 * Caps come from the synthetic turn-mode table. An unverified letter
 * uses the documented fallback cap and still turns. With the turnCurve
 * table a hull that names a turn hull is capped by its measured normal-turn
 * rate instead (still bounded by the letter cap). The hull's last-verb
 * fields are left to the combat verbs.
 */
import { angle16, shortestArc } from '../core/angle.ts';
import { asEntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler, TickContext } from './sim.ts';
import type { World, WorldSnap } from './world.ts';
import { H, readHull } from './hull.ts';
import {
  CLASS_FIGHTER,
  turnHasRate,
  turnImmobile,
} from './rules-tables.ts';
import { HS, HET_FIELDS, HET_STATE, hetActive, setCurveDelay, turnRateFor } from './turn-curve.ts';
import {
  HEADING_FIELDS,
  HEADING_HOLD,
  HEADING_ORDER,
  HEADING_STEER,
  HORD,
  holdHeading,
} from './heading.ts';

/** Duel yaw order. Combat's verbs stay 1–5 and 7–10; this match registers 6 beside them. */
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
/** A High-Energy Turn is pending or running (hetActive). */
export const HELM_HET_ACTIVE = 8;

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
  if (hetActive(world, id) === 1) {
    reject(ctx, id as number, HELM_HET_ACTIVE);
    return;
  }
  if (yaw !== 0 && turnImmobile(fields[H.turnMode]!) === 1) {
    ctx.emit({ kind: EVENT_HELM, entity: id as number, a: HELM_IMMOBILE, b: 0 });
    return;
  }
  const cap = turnRateFor(world, id, fields);
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
  holdHeading(world, id, world.heading(id) as number);
  setCurveDelay(world, id, 0);
  ctx.emit({ kind: EVENT_HELM, entity: id as number, a: code, b: applied });
}

export const helmHandler: CommandHandler = {
  kind: VERB_ORDER_HELM,
  apply(world, cmd, ctx) {
    apply(world, cmd, ctx);
  },
};

/** `het` while a High-Energy Turn (het.ts) is in its delay or turn phase. */
export const HELM_MODES = ['none', 'heading', 'het'] as const;

export type HelmMode = (typeof HELM_MODES)[number];

/**
 * Read-only helm picture for one ship, taken from the snapshot the sim
 * just wrote. It is not stored, so it does not enter the state hash.
 * There is no tracked target.
 */
export interface HelmView {
  readonly mode: HelmMode;
  /**
   * Signed short-way arc still to turn, in the same BAM units as heading.ts.
   * 65536 is a full turn. The half-turn tie is −32768, matching shortestArc.
   */
  readonly remainingTurn16: number;
  /** Ticks left before a pending High-Energy Turn starts rotating. 0 outside `het` and once rotation starts. */
  readonly hetDelayTicks: number;
}

function tableOf(snap: WorldSnap, id: string): { readonly data: readonly number[]; readonly fieldCount: number } | undefined {
  for (const table of snap.tables) {
    if (table.id === id) return table;
  }
  return undefined;
}

/** Current tick only. Positions are not blended here. */
export function readHelmView(snap: WorldSnap, index: number): HelmView {
  const idle: HelmView = { mode: 'none', remainingTurn16: 0, hetDelayTicks: 0 };
  if (index < 0 || snap.live[index] !== 1) return idle;
  const het = tableOf(snap, HET_STATE);
  if (het && het.fieldCount >= HET_FIELDS) {
    const at = index * het.fieldCount;
    if (het.data[at + HS.active] === 1) {
      return {
        mode: 'het',
        remainingTurn16: (het.data[at + HS.remaining] ?? 0) | 0,
        hetDelayTicks: (het.data[at + HS.delayLeft] ?? 0) | 0,
      };
    }
  }
  const order = tableOf(snap, HEADING_ORDER);
  if (!order || order.fieldCount < HEADING_FIELDS) return idle;
  const base = index * order.fieldCount;
  const mode = order.data[base + HORD.mode] ?? 0;
  if (mode !== HEADING_STEER && mode !== HEADING_HOLD) return idle;
  const aim = (order.data[base + HORD.heading] ?? 0) & 0xffff;
  const heading = tableOf(snap, 'heading');
  const width = heading && heading.fieldCount > 0 ? heading.fieldCount : 1;
  const current = heading ? (heading.data[index * width] ?? 0) : 0;
  return {
    mode: 'heading',
    remainingTurn16: shortestArc(angle16(current), angle16(aim)) | 0,
    hetDelayTicks: 0,
  };
}
