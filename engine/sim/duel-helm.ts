/**
 * Phase 2 helm orders that sit beside yaw, heading, and the 90° HET.
 * Emergency deceleration, erratic maneuvers, the phaser-capacitor rate,
 * and the HET success roll. Numbers are the placeholders in
 * docs/rules/data/constants.json. The ones without a CE reading are listed
 * in docs/rules/needs-ce-reading.md.
 *
 * The table is opt-in. A sim that does not register it keeps today's
 * speed, capacitor, and HET behaviour, and it does not draw the combat stream.
 */
import constants from '../../docs/rules/data/constants.json' with { type: 'json' };
import { angle16 } from '../core/angle.ts';
import { asEntityId, type EntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler, SimSystem, TickContext } from './sim.ts';
import type { TableSpec, World, WorldSnap } from './world.ts';
import { H, readHull, writeHull } from './hull.ts';
import { rulesDiv } from './rules-div.ts';
import { hetActive } from './turn-curve.ts';

export const VERB_ORDER_EMER_DECEL = 14;
export const VERB_SET_ERRATIC = 15;
export const VERB_SET_CAPACITOR_RATE = 16;

export const DUEL_HELM = 'duelHelm';

export const DH = {
  capSet: 0,
  capRate: 1,
  recover: 2,
  bonus: 3,
  erratic: 4,
  breakdown: 5,
} as const;

export const DUEL_HELM_FIELDS = 6;

export const DUEL_HELM_TABLE: TableSpec = { id: DUEL_HELM, fieldCount: DUEL_HELM_FIELDS };

function tableInt(value: number, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(name);
  return value;
}

/** Ticks after an emergency stop during which ordered speed stays 0. Placeholder. */
export const EMER_RECOVER_TICKS = tableInt(constants.emerRecoverTicks, 'emerRecoverTicks', 0, 100000);
/** Shield points added to the bow per speed point at the moment of the stop. Placeholder. */
export const EMER_SHIELD_PER_SPEED = tableInt(constants.emerShieldPerSpeed, 'emerShieldPerSpeed', 0, 1000);
export const EMER_SHIELD_BONUS_CAP = tableInt(constants.emerShieldBonusCap, 'emerShieldBonusCap', 0, 1000);
/** Ordered-speed cap while erratic maneuvers are on. Placeholder. */
export const ERRATIC_SPEED_CAP = tableInt(constants.erraticSpeedCap, 'erraticSpeedCap', 0, 32);
/** Extra defensive ECM while erratic. Placeholder. */
export const ERRATIC_ECM_BONUS = tableInt(constants.erraticEcmBonus, 'erraticEcmBonus', 0, 100);
/** Points removed from the ship's own hit chance, out of 100. Placeholder. */
export const ERRATIC_HIT_PENALTY = tableInt(constants.erraticHitPenalty, 'erraticHitPenalty', 0, 100);
/** BAM of one erratic course step. Placeholder. */
export const ERRATIC_YAW_STEP = tableInt(constants.erraticYawStep, 'erraticYawStep', 0, 65535);
/** HET success percent removed while erratic. Placeholder. */
export const HET_ERRATIC_PENALTY = tableInt(constants.hetErraticPenalty, 'hetErraticPenalty', 0, 100);
/** Ticks of helm lock after a failed HET. Placeholder. */
export const HET_BREAKDOWN_TICKS = tableInt(constants.hetBreakdownTicks, 'hetBreakdownTicks', 0, 100000);
export const HET_SUCCESS_FLOOR = tableInt(constants.hetSuccessFloor, 'hetSuccessFloor', 0, 100);
/** 1000 is a full capacitor recharge rate. */
export const CAPACITOR_RATE_SCALE = tableInt(constants.capacitorRateScale, 'capacitorRateScale', 1, 100000);

export interface ErraticShot {
  readonly targetEcm: number;
  readonly shooterPenalty: number;
}

export interface HelmExtras {
  readonly hetSuccessChance: number;
  readonly hetBreakdown: boolean;
  readonly emerDecelActive: boolean;
  readonly emerDecelTicksLeft: number;
  readonly erraticActive: boolean;
}

const QUIET: HelmExtras = {
  hetSuccessChance: 100,
  hetBreakdown: false,
  emerDecelActive: false,
  emerDecelTicksLeft: 0,
  erraticActive: false,
};

function readI32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}

function rowOf(world: World, id: EntityId): number[] | null {
  if (!world.hasTable(DUEL_HELM) || !world.isLive(id)) return null;
  return world.getFields(id, DUEL_HELM);
}

function writeRow(world: World, id: EntityId, row: readonly number[]): void {
  world.setFields(id, DUEL_HELM, row);
}

export function erraticOn(world: World, id: EntityId): boolean {
  const row = rowOf(world, id);
  return row !== null && row[DH.erratic] === 1;
}

export function breakdownLeft(world: World, id: EntityId): number {
  const row = rowOf(world, id);
  if (!row) return 0;
  const left = row[DH.breakdown] ?? 0;
  return left > 0 ? left : 0;
}

/** 0–100. Damage does not reduce it until a hull maximum is published. */
export function hetChance(world: World, id: EntityId): number {
  let chance = 100;
  if (erraticOn(world, id)) chance -= HET_ERRATIC_PENALTY;
  if (chance < HET_SUCCESS_FLOOR) chance = HET_SUCCESS_FLOOR;
  if (chance > 100) chance = 100;
  return chance;
}

/**
 * A failed HET. One shield point comes off a combat-stream facing, and helm
 * orders lock for the placeholder window. The facing roll is the breakdown draw.
 */
export function markBreakdown(world: World, id: EntityId, ctx: TickContext): number {
  const row = rowOf(world, id);
  if (!row) return 0;
  row[DH.breakdown] = HET_BREAKDOWN_TICKS;
  writeRow(world, id, row);
  const facing = ctx.rng.stream('combat').int(6);
  const fields = readHull(world, id);
  const at = H.shield0 + facing;
  const cur = fields[at] ?? 0;
  if (cur > 0) fields[at] = cur - 1;
  writeHull(world, id, fields);
  return HET_BREAKDOWN_TICKS;
}

export function erraticShot(world: World, attacker: EntityId, target: EntityId): ErraticShot {
  if (!world.hasTable(DUEL_HELM)) return { targetEcm: 0, shooterPenalty: 0 };
  const shooterPenalty = erraticOn(world, attacker) ? ERRATIC_HIT_PENALTY : 0;
  const targetEcm = erraticOn(world, target) ? ERRATIC_ECM_BONUS : 0;
  return { targetEcm, shooterPenalty };
}

/** Full rate when the table is absent or the player has not set one. */
export function capacitorRate(world: World, id: EntityId): number {
  const row = rowOf(world, id);
  if (!row || row[DH.capSet] !== 1) return CAPACITOR_RATE_SCALE;
  const rate = row[DH.capRate] ?? 0;
  if (rate < 0) return 0;
  return rate > CAPACITOR_RATE_SCALE ? CAPACITOR_RATE_SCALE : rate;
}

export function scaleByCapacitorRate(amount: number, rate: number): number {
  if (rate >= CAPACITOR_RATE_SCALE) return amount;
  if (amount <= 0 || rate <= 0) return 0;
  return rulesDiv(amount * rate, CAPACITOR_RATE_SCALE);
}

export function limitOrderedSpeed(
  world: World,
  id: EntityId,
  speed: number,
  frac: number,
): { speed: number; frac: number; clamped: boolean } {
  const row = rowOf(world, id);
  if (!row) return { speed, frac, clamped: false };
  if ((row[DH.recover] ?? 0) > 0 && (speed > 0 || frac > 0)) {
    return { speed: 0, frac: 0, clamped: true };
  }
  if (row[DH.erratic] === 1 && speed > ERRATIC_SPEED_CAP) {
    return { speed: ERRATIC_SPEED_CAP, frac: 0, clamped: true };
  }
  return { speed, frac, clamped: false };
}

function speedPoints(fields: readonly number[]): number {
  const actual = fields[H.speedActual100] ?? -1;
  if (actual >= 0) return rulesDiv(actual, 100);
  return fields[H.speed] ?? 0;
}

function applyEmer(world: World, cmd: Command): void {
  if (cmd.payload.length < 4) throw new Error('emer payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const row = rowOf(world, id);
  if (!row) return;
  if ((row[DH.recover] ?? 0) > 0) return;
  const fields = readHull(world, id);
  if (fields[H.classCode] === 0 || fields[H.destroyed] === 1) return;
  let bonus = speedPoints(fields) * EMER_SHIELD_PER_SPEED;
  if (bonus > EMER_SHIELD_BONUS_CAP) bonus = EMER_SHIELD_BONUS_CAP;
  const room = (fields[H.shieldMax0] ?? 0) - (fields[H.shield0] ?? 0);
  if (bonus > room) bonus = room;
  if (bonus < 0) bonus = 0;
  fields[H.shield0] = (fields[H.shield0] ?? 0) + bonus;
  fields[H.speed] = 0;
  fields[H.speedFrac100] = 0;
  if ((fields[H.speedActual100] ?? -1) >= 0) {
    fields[H.speedActual100] = 0;
    fields[H.speedRampAcc] = 0;
  }
  fields[H.speedOverride] = -1;
  writeHull(world, id, fields);
  row[DH.recover] = EMER_RECOVER_TICKS;
  row[DH.bonus] = bonus;
  writeRow(world, id, row);
}

function applyErratic(world: World, cmd: Command): void {
  if (cmd.payload.length < 8) throw new Error('erratic payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const on = readI32(cmd.payload, 4);
  const row = rowOf(world, id);
  if (!row) return;
  if (on !== 0 && on !== 1) return;
  row[DH.erratic] = on;
  writeRow(world, id, row);
}

function applyRate(world: World, cmd: Command): void {
  if (cmd.payload.length < 8) throw new Error('capacitor payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const rate = readI32(cmd.payload, 4);
  const row = rowOf(world, id);
  if (!row) return;
  if (rate < 0 || rate > CAPACITOR_RATE_SCALE) return;
  row[DH.capSet] = 1;
  row[DH.capRate] = rate;
  writeRow(world, id, row);
}

export function emerPayload(entity: number): Uint8Array {
  const out = new Uint8Array(4);
  writeU32(out, 0, entity | 0);
  return out;
}

export function erraticPayload(entity: number, on: number): Uint8Array {
  const out = new Uint8Array(8);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, on | 0);
  return out;
}

export function capacitorRatePayload(entity: number, rate: number): Uint8Array {
  const out = new Uint8Array(8);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, rate | 0);
  return out;
}

function tickOne(world: World, id: EntityId, ctx: TickContext): void {
  const row = rowOf(world, id);
  if (!row) return;
  const recover = row[DH.recover] ?? 0;
  if (recover > 0) {
    const next = recover - 1;
    row[DH.recover] = next;
    if (next === 0 && (row[DH.bonus] ?? 0) > 0) {
      const fields = readHull(world, id);
      let shield = (fields[H.shield0] ?? 0) - (row[DH.bonus] ?? 0);
      if (shield < 0) shield = 0;
      fields[H.shield0] = shield;
      writeHull(world, id, fields);
      row[DH.bonus] = 0;
    }
    writeRow(world, id, row);
  }
  const breakdown = row[DH.breakdown] ?? 0;
  if (breakdown > 0) {
    row[DH.breakdown] = breakdown - 1;
    writeRow(world, id, row);
  }
  if (row[DH.erratic] !== 1) return;
  if (hetActive(world, id) === 1 || (row[DH.breakdown] ?? 0) > 0) return;
  const roll = ctx.rng.stream('combat').int(3) - 1;
  if (roll === 0) return;
  const heading = world.heading(id) as number;
  world.setHeading(id, angle16(heading + roll * ERRATIC_YAW_STEP));
}

export function createDuelHelm(): SimSystem {
  return {
    id: 'duel-helm',
    phase: 'movement',
    priority: 2,
    step(world, ctx) {
      if (!world.hasTable(DUEL_HELM)) return;
      for (const id of world.liveIds()) tickOne(world, id, ctx);
    },
  };
}

export const duelHelmHandlers: readonly CommandHandler[] = [
  {
    kind: VERB_ORDER_EMER_DECEL,
    apply(world, cmd) {
      applyEmer(world, cmd);
    },
  },
  {
    kind: VERB_SET_ERRATIC,
    apply(world, cmd) {
      applyErratic(world, cmd);
    },
  },
  {
    kind: VERB_SET_CAPACITOR_RATE,
    apply(world, cmd) {
      applyRate(world, cmd);
    },
  },
];

function snapRow(snap: WorldSnap, index: number): readonly number[] | null {
  if (index < 0 || snap.live[index] !== 1) return null;
  for (const table of snap.tables) {
    if (table.id !== DUEL_HELM) continue;
    const base = index * table.fieldCount;
    const out: number[] = [];
    for (let i = 0; i < DUEL_HELM_FIELDS; i++) out.push(table.data[base + i] ?? 0);
    return out;
  }
  return null;
}

export function helmExtras(snap: WorldSnap, index: number): HelmExtras {
  const row = snapRow(snap, index);
  if (!row) return QUIET;
  const erratic = row[DH.erratic] === 1;
  const recover = row[DH.recover] ?? 0;
  const breakdown = row[DH.breakdown] ?? 0;
  let chance = 100 - (erratic ? HET_ERRATIC_PENALTY : 0);
  if (chance < HET_SUCCESS_FLOOR) chance = HET_SUCCESS_FLOOR;
  return {
    hetSuccessChance: chance,
    hetBreakdown: breakdown > 0,
    emerDecelActive: recover > 0,
    emerDecelTicksLeft: recover > 0 ? recover : 0,
    erraticActive: erratic,
  };
}

/** Permille last ordered, or the full scale when the player has not set one. */
export function capacitorRateOf(snap: WorldSnap, index: number): number {
  const row = snapRow(snap, index);
  if (!row || row[DH.capSet] !== 1) return CAPACITOR_RATE_SCALE;
  const rate = row[DH.capRate] ?? 0;
  if (rate < 0) return 0;
  return rate > CAPACITOR_RATE_SCALE ? CAPACITOR_RATE_SCALE : rate;
}
