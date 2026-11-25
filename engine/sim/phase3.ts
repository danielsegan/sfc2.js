/**
 * Electronic warfare, heavy-weapon arming, tractors, and cloaks.
 *
 * Numbers come from docs/rules/data/constants.json. The rules are written
 * in docs/rules/phase3-systems.md. A shift of zero or better does not draw
 * from the combat stream, so a duel that never allocates ECM still hits
 * the way the Phase 2 slice did.
 *
 * Payload words do not carry a tick. The session stamps tick, slot, and seq.
 */
import { asEntityId, type EntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import { add, delta, distSq, fxRaw, FX_ONE, isqrt64 } from '../core/fx.ts';
import { divFloorI64byI32, mulI32ToI64, type I64 } from '../core/i64.ts';
import type { CommandHandler, SimSystem, TickContext } from './sim.ts';
import { ENTITY_KIND, type World } from './world.ts';
import { withinRange } from './arcs.ts';
import { rulesDiv } from './rules-div.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import { H, readHull, readMounts, writeHull, writeMounts } from './hull.ts';
import {
  CLASS_FIGHTER,
  CLOAK_BASE_DETECT,
  CLOAK_SCAN_PER_BOX,
  CLOAK_TICKS,
  ENERGY_SCALE,
  EW_HIT_DENOM,
  EW_HIT_FLOOR,
  EW_PENALTY_PER_POINT,
  INTERNAL_DISRUPTOR,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  MODE_NORMAL,
  MODE_OVERLOAD,
  MODE_PROXIMITY,
  SPECIAL_SENSOR_CHANCE_PER_BOX,
  TRACTOR_PULL_PER_POINT,
  TRACTOR_RANGE,
  TRACTOR_SELF_SLOW,
  weaponDef,
  type WeaponDef,
} from './rules-tables.ts';

/** 7 is setAllegiance. EW starts at 11 so the two tables do not share a verb. */
export const VERB_SET_EW = 11;
export const VERB_SET_WEAPON_MODE = 8;
export const VERB_SET_TRACTOR = 9;
export const VERB_SET_CLOAK = 10;

/** A shot resolved and missed. Not a second ruleResult for a photon in flight. */
export const EVENT_MISS = 4;

/** Same kind combat.ts emits for ruleResult. */
const EVENT_RULE = 2;

export const CLOAK_OFF = 0;
export const CLOAK_ENGAGING = 1;
export const CLOAK_ON = 2;
export const CLOAK_DISENGAGING = 3;

export const TRACTOR_OFF = 0;
export const TRACTOR_HOLD = 1;
export const TRACTOR_REPEL = 2;
export const TRACTOR_REINFORCE = 3;

const STATUS_APPLIED = 1;
const STATUS_CLAMPED = 2;
const STATUS_REJECTED = 3;

const OK = 0;
const NO_SUCH_SHIP = 1;
const SHIP_DESTROYED = 2;
const NOT_A_SHIP = 3;
const NEGATIVE = 4;
const UNKNOWN_SLOT = 7;
const NOT_SLICE = 8;
const OUT_OF_RANGE = 12;
const OVER_DRAW = 16;

export const P3 = {
  ewMiss: 23,
  noEw: 24,
  ewCapped: 25,
  noOverload: 26,
  noTractor: 27,
  badTarget: 28,
  tractorBroken: 29,
  noCloak: 30,
  cloaked: 31,
  notDetected: 32,
  cloakCollapsed: 33,
  tractorCapped: 34,
} as const;

const SPOT_BITS = 32;
const PULL_CAP = 4096;

function words(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) writeU32(out, i * 4, values[i]! | 0);
  return out;
}

function readI32(buf: Uint8Array, offset: number): number {
  return (buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16) | (buf[offset + 3]! << 24)) | 0;
}

function need(buf: Uint8Array, count: number): boolean {
  return buf.length >= count * 4;
}

function emitRule(ctx: TickContext, entity: number, reason: number, applied: number): void {
  ctx.emit({ kind: EVENT_RULE, entity, a: reason, b: applied });
}

function statusFor(reason: number): number {
  if (reason === OK) return STATUS_APPLIED;
  if (
    reason === OVER_DRAW ||
    reason === P3.ewMiss ||
    reason === P3.ewCapped ||
    reason === P3.tractorBroken ||
    reason === P3.cloakCollapsed ||
    reason === P3.tractorCapped
  ) {
    return STATUS_CLAMPED;
  }
  return STATUS_REJECTED;
}

function remember(fields: number[], verb: number, reason: number, applied: number): void {
  fields[H.lastVerb] = verb;
  fields[H.lastReason] = reason;
  fields[H.lastStatus] = statusFor(reason);
  fields[H.lastApplied] = applied | 0;
}

function finish(
  world: World,
  id: EntityId,
  fields: number[],
  ctx: TickContext,
  verb: number,
  reason: number,
  applied: number,
): void {
  remember(fields, verb, reason, applied);
  writeHull(world, id, fields);
  emitRule(ctx, id as number, reason, applied);
}

function liveShip(world: World, id: EntityId): number[] | null {
  if (!world.isLive(id)) return null;
  const fields = readHull(world, id);
  if (fields[H.classCode] === 0) return null;
  return fields;
}

function gate(fields: number[] | null): number | null {
  if (!fields) return NO_SUCH_SHIP;
  if (fields[H.classCode] === CLASS_FIGHTER) return NOT_A_SHIP;
  if (fields[H.destroyed] === 1) return SHIP_DESTROYED;
  return null;
}

function sensorCapacity(fields: readonly number[]): number {
  const sum = fields[H.sensors]! + fields[H.scanners]! + fields[H.specialSensors]!;
  return sum > 0 ? sum : 0;
}

/** Defensive ECM after free stealth. Negative stealth cannot drop the total below zero. */
export function defensiveEcm(paid: number, stealth: number): number {
  const sum = paid + stealth;
  return sum > 0 ? sum : 0;
}

/** Attacker ECCM minus defender ECM. Positive means the shooter has the advantage. */
export function ewShift(eccm: number, ecmPaid: number, stealth: number): number {
  return eccm - defensiveEcm(ecmPaid, stealth);
}

/**
 * Hit chance out of `den`. A non-negative shift is certainty and must not draw.
 * Each point of defender advantage removes `ewPenaltyPerPoint`, down to the floor.
 */
export function hitChance(shift: number): { num: number; den: number } {
  const den = EW_HIT_DENOM;
  if (shift >= 0) return { num: den, den };
  let penalty = (-shift) * EW_PENALTY_PER_POINT;
  const cap = den - EW_HIT_FLOOR;
  if (penalty > cap) penalty = cap;
  if (penalty < 0) penalty = 0;
  return { num: den - penalty, den };
}

/** True when the combat stream says the shot missed. Certainty does not draw. */
export function shotMisses(ctx: TickContext, attacker: readonly number[], target: readonly number[]): boolean {
  const shift = ewShift(attacker[H.eccmPaid]!, target[H.ecmPaid]!, target[H.stealth]!);
  const chance = hitChance(shift);
  if (chance.num >= chance.den) return false;
  if (chance.num <= 0) return true;
  return !ctx.rng.stream('combat').chance(chance.num, chance.den);
}

function spotBit(index: number): number {
  if (index < 0 || index >= SPOT_BITS) return 0;
  return (1 << index) >>> 0;
}

export function cloakVisible(
  cloakState: number,
  spottedBy: number,
  searcherIndex: number,
  searcherScanners: number,
  dx: number,
  dy: number,
): boolean {
  if (cloakState !== CLOAK_ON) return true;
  if (withinRange(dx, dy, CLOAK_BASE_DETECT)) return true;
  if (searcherScanners > 0) {
    let reach = searcherScanners * CLOAK_SCAN_PER_BOX;
    if (reach > 32767) reach = 32767;
    if (withinRange(dx, dy, reach)) return true;
  }
  const bit = spotBit(searcherIndex);
  if (bit !== 0 && ((spottedBy >>> 0) & bit) !== 0) return true;
  return false;
}

export function fireBlocked(fields: readonly number[]): number | null {
  if (fields[H.cloakState] !== CLOAK_OFF) return P3.cloaked;
  return null;
}

export function targetHidden(world: World, searcherId: EntityId, targetId: EntityId, searcher: readonly number[], target: readonly number[]): boolean {
  const from = world.position(searcherId);
  const to = world.position(targetId);
  const index = (searcherId as number) & 0xffff;
  return !cloakVisible(
    target[H.cloakState]!,
    target[H.spottedBy]!,
    index,
    searcher[H.scanners]!,
    delta(to.x, from.x),
    delta(to.y, from.y),
  );
}

/** Energy a mount asks for in its current arming mode. Phasers ignore mode. */
export function mountEnergyCost(def: WeaponDef, mode: number): number {
  if (def.internal === INTERNAL_PHASER) return def.chargeCost;
  if (def.internal === INTERNAL_PHOTON) return mode === MODE_OVERLOAD ? def.overloadArmCost : def.armCost;
  if (def.internal === INTERNAL_DISRUPTOR) return mode === MODE_OVERLOAD ? def.overloadArmCost : def.armCost;
  return 0;
}

export function stampPhase3(fields: number[], setup: ShipSetup): void {
  fields[H.stealth] = setup.stealth ?? 0;
  fields[H.scanners] = setup.scanners ?? 0;
  fields[H.specialSensors] = setup.specialSensors ?? 0;
  fields[H.cloakCost] = setup.cloakCost ?? 0;
  fields[H.tractors] = setup.tractors ?? 0;
  fields[H.speedOverride] = -1;
  fields[H.speedActual100] = -1;
}

export function setEwPayload(entity: number, ecm: number, eccm: number): Uint8Array {
  return words([entity, ecm, eccm]);
}

export function setWeaponModePayload(entity: number, slot: number, mode: number): Uint8Array {
  return words([entity, slot, mode]);
}

export function setTractorPayload(entity: number, target: number, mode: number, energy: number): Uint8Array {
  return words([entity, target, mode, energy]);
}

export function setCloakPayload(entity: number, on: number): Uint8Array {
  return words([entity, on]);
}

function cutPair(ecm: number, eccm: number, keep: number): { ecm: number; eccm: number } {
  let nextEcm = ecm;
  let nextEccm = eccm;
  let over = nextEcm + nextEccm - keep;
  if (over < 0) over = 0;
  const cutEccm = nextEccm < over ? nextEccm : over;
  nextEccm -= cutEccm;
  over -= cutEccm;
  const cutEcm = nextEcm < over ? nextEcm : over;
  nextEcm -= cutEcm;
  return { ecm: nextEcm, eccm: nextEccm };
}

function applySetEw(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 3)) throw new Error('ew payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const askEcm = readI32(cmd.payload, 4);
  const askEccm = readI32(cmd.payload, 8);
  const fields = liveShip(world, id);
  const blocked = gate(fields);
  if (!fields || blocked !== null) {
    emitRule(ctx, id as number, blocked ?? NO_SUCH_SHIP, -1);
    return;
  }
  if (askEcm < 0 || askEccm < 0) {
    finish(world, id, fields, ctx, VERB_SET_EW, NEGATIVE, -1);
    return;
  }
  const cap = sensorCapacity(fields);
  if (cap <= 0 && askEcm + askEccm > 0) {
    finish(world, id, fields, ctx, VERB_SET_EW, P3.noEw, -1);
    return;
  }
  let ecm = askEcm;
  let eccm = askEccm;
  let capped = false;
  if (ecm + eccm > cap) {
    const cut = cutPair(ecm, eccm, cap);
    ecm = cut.ecm;
    eccm = cut.eccm;
    capped = true;
  }
  const old = fields[H.ecmPaid]! + fields[H.eccmPaid]!;
  let next = ecm + eccm;
  const wanted = next - old;
  let short = false;
  if (wanted > 0) {
    const afford = rulesDiv(fields[H.battery100]!, ENERGY_SCALE);
    if (afford < wanted) {
      const cut = cutPair(ecm, eccm, old + afford);
      ecm = cut.ecm;
      eccm = cut.eccm;
      next = ecm + eccm;
      short = true;
    }
    const spend = (next - old) * ENERGY_SCALE;
    fields[H.battery100] = fields[H.battery100]! - spend;
  } else if (wanted < 0) {
    const refund = (old - next) * ENERGY_SCALE;
    const room = fields[H.batteryCapacity100]! - fields[H.battery100]!;
    const give = refund < room ? refund : room > 0 ? room : 0;
    fields[H.battery100] = fields[H.battery100]! + give;
  }
  fields[H.ecmPaid] = ecm;
  fields[H.eccmPaid] = eccm;
  let reason: number = OK;
  if (short) reason = OVER_DRAW;
  else if (capped) reason = P3.ewCapped;
  finish(world, id, fields, ctx, VERB_SET_EW, reason, next);
}

function applySetWeaponMode(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 3)) throw new Error('weapon mode payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const slot = readI32(cmd.payload, 4);
  const mode = readI32(cmd.payload, 8);
  const fields = liveShip(world, id);
  const blocked = gate(fields);
  if (!fields || blocked !== null) {
    emitRule(ctx, id as number, blocked ?? NO_SUCH_SHIP, -1);
    return;
  }
  const mounts = readMounts(world, id);
  if (slot < 0 || slot >= mounts.length || mounts[slot]!.weaponId === 0) {
    finish(world, id, fields, ctx, VERB_SET_WEAPON_MODE, UNKNOWN_SLOT, -1);
    return;
  }
  if (mode !== MODE_NORMAL && mode !== MODE_OVERLOAD && mode !== MODE_PROXIMITY) {
    finish(world, id, fields, ctx, VERB_SET_WEAPON_MODE, NOT_SLICE, -1);
    return;
  }
  const mount = mounts[slot]!;
  const def = weaponDef(mount.weaponId);
  if (!def || (def.internal !== INTERNAL_PHASER && def.internal !== INTERNAL_PHOTON && def.internal !== INTERNAL_DISRUPTOR)) {
    finish(world, id, fields, ctx, VERB_SET_WEAPON_MODE, NOT_SLICE, -1);
    return;
  }
  if (def.internal === INTERNAL_PHASER && mode !== MODE_NORMAL) {
    finish(world, id, fields, ctx, VERB_SET_WEAPON_MODE, NOT_SLICE, -1);
    return;
  }
  if (def.internal === INTERNAL_DISRUPTOR && mode === MODE_PROXIMITY) {
    finish(world, id, fields, ctx, VERB_SET_WEAPON_MODE, NOT_SLICE, -1);
    return;
  }
  if (mode === MODE_OVERLOAD && def.overloadArmCost <= 0) {
    finish(world, id, fields, ctx, VERB_SET_WEAPON_MODE, P3.noOverload, -1);
    return;
  }
  if (mode !== mount.mode) {
    mount.charge100 = 0;
    mount.ticksCharging = 0;
    mount.mode = mode;
  }
  writeMounts(world, id, mounts);
  finish(world, id, fields, ctx, VERB_SET_WEAPON_MODE, OK, mode);
}

function refundBattery(fields: number[], points: number): void {
  if (points <= 0) return;
  const refund = points * ENERGY_SCALE;
  const room = fields[H.batteryCapacity100]! - fields[H.battery100]!;
  const give = room > 0 ? (refund < room ? refund : room) : 0;
  fields[H.battery100] = fields[H.battery100]! + give;
}

function applySetTractor(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 4)) throw new Error('tractor payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const targetId = asEntityId(readU32(cmd.payload, 4));
  const mode = readI32(cmd.payload, 8);
  const energy = readI32(cmd.payload, 12);
  const fields = liveShip(world, id);
  const blocked = gate(fields);
  if (!fields || blocked !== null) {
    emitRule(ctx, id as number, blocked ?? NO_SUCH_SHIP, -1);
    return;
  }
  if (mode !== TRACTOR_OFF && mode !== TRACTOR_HOLD && mode !== TRACTOR_REPEL && mode !== TRACTOR_REINFORCE) {
    finish(world, id, fields, ctx, VERB_SET_TRACTOR, NOT_SLICE, -1);
    return;
  }
  if (energy < 0) {
    finish(world, id, fields, ctx, VERB_SET_TRACTOR, NEGATIVE, -1);
    return;
  }
  if (mode === TRACTOR_OFF) {
    refundBattery(fields, fields[H.tractorPaid]!);
    fields[H.tractorMode] = TRACTOR_OFF;
    fields[H.tractorTarget] = 0;
    fields[H.tractorPaid] = 0;
    fields[H.tractorLink] = 0;
    fields[H.tractorRest] = 0;
    finish(world, id, fields, ctx, VERB_SET_TRACTOR, OK, 0);
    return;
  }
  const boxes = fields[H.tractors]!;
  if (boxes <= 0) {
    finish(world, id, fields, ctx, VERB_SET_TRACTOR, P3.noTractor, -1);
    return;
  }
  let targetFields: number[] | null = null;
  if (mode === TRACTOR_HOLD || mode === TRACTOR_REPEL) {
    if ((targetId as number) === (id as number)) {
      finish(world, id, fields, ctx, VERB_SET_TRACTOR, P3.badTarget, -1);
      return;
    }
    targetFields = liveShip(world, targetId);
    const targetBlock = gate(targetFields);
    if (!targetFields || targetBlock !== null) {
      finish(world, id, fields, ctx, VERB_SET_TRACTOR, targetBlock ?? NO_SUCH_SHIP, -1);
      return;
    }
    const from = world.position(id);
    const to = world.position(targetId);
    if (!withinRange(delta(to.x, from.x), delta(to.y, from.y), TRACTOR_RANGE)) {
      finish(world, id, fields, ctx, VERB_SET_TRACTOR, OUT_OF_RANGE, -1);
      return;
    }
  }
  let desired = energy < boxes ? energy : boxes;
  const boxClamped = desired < energy;
  const old = fields[H.tractorPaid]!;
  if (desired > old) {
    const afford = rulesDiv(fields[H.battery100]!, ENERGY_SCALE);
    const room = afford > 0 ? afford : 0;
    if (old + room < desired) desired = old + room;
  }
  const short = desired < (energy < boxes ? energy : boxes);
  if (desired > old) fields[H.battery100] = fields[H.battery100]! - (desired - old) * ENERGY_SCALE;
  else refundBattery(fields, old - desired);
  fields[H.tractorPaid] = desired;
  fields[H.tractorMode] = mode;
  fields[H.tractorRest] = 0;
  if (mode === TRACTOR_REINFORCE) {
    fields[H.tractorTarget] = 0;
    fields[H.tractorLink] = 0;
  } else {
    fields[H.tractorTarget] = targetId as number;
    const oppose = targetFields ? targetFields[H.tractorPaid]! : 0;
    fields[H.tractorLink] = desired > oppose ? 1 : 0;
  }
  let reason: number = OK;
  if (short) reason = OVER_DRAW;
  else if (boxClamped) reason = P3.tractorCapped;
  else if (fields[H.tractorLink] === 0 && mode !== TRACTOR_REINFORCE) reason = P3.tractorBroken;
  finish(world, id, fields, ctx, VERB_SET_TRACTOR, reason, desired);
}

function payCloak(fields: number[], tick: number, period: number): boolean {
  const cost100 = fields[H.cloakCost]! * ENERGY_SCALE;
  if (cost100 <= 0 || fields[H.battery100]! < cost100) return false;
  fields[H.battery100] = fields[H.battery100]! - cost100;
  fields[H.cloakNextPay] = ((tick >>> 0) + (period >>> 0)) | 0;
  return true;
}

function applySetCloak(world: World, cmd: Command, ctx: TickContext, period: number): void {
  if (!need(cmd.payload, 2)) throw new Error('cloak payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const on = readI32(cmd.payload, 4);
  const fields = liveShip(world, id);
  const blocked = gate(fields);
  if (!fields || blocked !== null) {
    emitRule(ctx, id as number, blocked ?? NO_SUCH_SHIP, -1);
    return;
  }
  if (on < 0) {
    finish(world, id, fields, ctx, VERB_SET_CLOAK, NEGATIVE, -1);
    return;
  }
  if (fields[H.cloakCost]! <= 0) {
    finish(world, id, fields, ctx, VERB_SET_CLOAK, P3.noCloak, -1);
    return;
  }
  const wantOn = on !== 0;
  const state = fields[H.cloakState]!;
  if (wantOn && (state === CLOAK_OFF || state === CLOAK_DISENGAGING)) {
    if (!payCloak(fields, ctx.tick as number, period)) {
      finish(world, id, fields, ctx, VERB_SET_CLOAK, OVER_DRAW, 0);
      return;
    }
    fields[H.cloakState] = CLOAK_ENGAGING;
    fields[H.cloakTicks] = CLOAK_TICKS;
  } else if (!wantOn && (state === CLOAK_ON || state === CLOAK_ENGAGING)) {
    fields[H.cloakState] = CLOAK_DISENGAGING;
    fields[H.cloakTicks] = CLOAK_TICKS;
  }
  finish(world, id, fields, ctx, VERB_SET_CLOAK, OK, fields[H.cloakState]!);
}

function shipStep(world: World, id: EntityId): number[] | null {
  if (world.getFields(id, 'kind')[0] === ENTITY_KIND.seeker) return null;
  const fields = readHull(world, id);
  if (fields[H.classCode] === 0 || fields[H.classCode] === CLASS_FIGHTER || fields[H.destroyed] === 1) return null;
  return fields;
}

function cloakSystem(period: number): SimSystem {
  return {
    id: 'cloak',
    phase: 'energy',
    priority: 10,
    step(world, ctx) {
      const now = ctx.tick as number;
      for (const id of world.liveIds()) {
        const fields = shipStep(world, id);
        if (!fields) continue;
        const state = fields[H.cloakState]!;
        if (state === CLOAK_OFF) continue;
        if (state === CLOAK_ENGAGING || state === CLOAK_DISENGAGING) {
          const left = fields[H.cloakTicks]! - 1;
          if (left <= 0) {
            fields[H.cloakState] = state === CLOAK_ENGAGING ? CLOAK_ON : CLOAK_OFF;
            fields[H.cloakTicks] = 0;
            if (fields[H.cloakState] === CLOAK_OFF) fields[H.cloakNextPay] = 0;
          } else {
            fields[H.cloakTicks] = left;
          }
        }
        if (fields[H.cloakState] !== CLOAK_OFF) {
          const due = fields[H.cloakNextPay]! >>> 0;
          if (due !== 0 && now >= due && !payCloak(fields, now, period)) {
            fields[H.cloakState] = CLOAK_OFF;
            fields[H.cloakTicks] = 0;
            fields[H.cloakNextPay] = 0;
            remember(fields, VERB_SET_CLOAK, P3.cloakCollapsed, 0);
            writeHull(world, id, fields);
            emitRule(ctx, id as number, P3.cloakCollapsed, 0);
            continue;
          }
        }
        writeHull(world, id, fields);
      }
      spotCloaks(world, ctx);
    },
  };
}

function spotCloaks(world: World, ctx: TickContext): void {
  const ids: EntityId[] = [];
  const rows: number[][] = [];
  for (const id of world.liveIds()) {
    const fields = shipStep(world, id);
    if (!fields) continue;
    fields[H.spottedBy] = 0;
    ids.push(id);
    rows.push(fields);
  }
  for (let s = 0; s < ids.length; s++) {
    const searcher = rows[s]!;
    const searcherId = ids[s]!;
    for (let t = 0; t < ids.length; t++) {
      if (s === t) continue;
      const target = rows[t]!;
      if (target[H.cloakState] !== CLOAK_ON) continue;
      const from = world.position(searcherId);
      const to = world.position(ids[t]!);
      const dx = delta(to.x, from.x);
      const dy = delta(to.y, from.y);
      if (cloakVisible(CLOAK_ON, 0, (searcherId as number) & 0xffff, searcher[H.scanners]!, dx, dy)) continue;
      let chance = searcher[H.specialSensors]! * SPECIAL_SENSOR_CHANCE_PER_BOX;
      if (chance > EW_HIT_DENOM) chance = EW_HIT_DENOM;
      if (chance <= 0) continue;
      if (!ctx.rng.stream('combat').chance(chance, EW_HIT_DENOM)) continue;
      const bit = spotBit((searcherId as number) & 0xffff);
      if (bit === 0) continue;
      target[H.spottedBy] = (target[H.spottedBy]! | bit) | 0;
    }
  }
  for (let i = 0; i < ids.length; i++) writeHull(world, ids[i]!, rows[i]!);
}

function narrowMove(q: I64): number | null {
  const lo = q.lo | 0;
  const signHi = lo < 0 ? -1 : 0;
  if (q.hi !== signHi) return null;
  return lo;
}

function shiftAlong(dx: number, dy: number, step: number): { x: number; y: number } | null {
  if (step === 0) return { x: 0, y: 0 };
  const dist = isqrt64(distSq(dx | 0, dy | 0));
  if (dist <= 0) return { x: 0, y: 0 };
  let travel = step;
  if (travel > dist) travel = dist;
  if (travel < -dist) travel = -dist;
  const mx = narrowMove(divFloorI64byI32(mulI32ToI64(dx | 0, travel), dist));
  const my = narrowMove(divFloorI64byI32(mulI32ToI64(dy | 0, travel), dist));
  if (mx === null || my === null) return null;
  return { x: mx, y: my };
}

function pullShare(total: number, rest: number, period: number): { step: number; rest: number } {
  if (total < 0 || rest < 0 || period <= 0) throw new Error('tractor share');
  const sum = rest + total;
  if (sum > 2147483647) throw new Error('tractor share');
  const step = rulesDiv(sum, period);
  return { step, rest: sum - step * period };
}

function breakLink(fields: number[], ctx: TickContext, id: EntityId, world: World): void {
  const was = fields[H.tractorLink] === 1;
  fields[H.tractorLink] = 0;
  fields[H.tractorRest] = 0;
  if (!was) {
    writeHull(world, id, fields);
    return;
  }
  remember(fields, VERB_SET_TRACTOR, P3.tractorBroken, 0);
  writeHull(world, id, fields);
  emitRule(ctx, id as number, P3.tractorBroken, 0);
}

function tractorSystem(period: number): SimSystem {
  return {
    id: 'tractor',
    phase: 'movement',
    priority: -1,
    step(world, ctx) {
      const pending: EntityId[] = [];
      for (const id of world.liveIds()) {
        const fields = shipStep(world, id);
        if (!fields) continue;
        fields[H.speedOverride] = -1;
        writeHull(world, id, fields);
        pending.push(id);
      }
      for (const id of pending) {
        const fields = readHull(world, id);
        const mode = fields[H.tractorMode]!;
        if (mode !== TRACTOR_HOLD && mode !== TRACTOR_REPEL) continue;
        if (fields[H.tractorPaid]! <= 0) {
          breakLink(fields, ctx, id, world);
          continue;
        }
        const targetId = asEntityId(fields[H.tractorTarget]! >>> 0);
        const target = liveShip(world, targetId);
        if (!target || gate(target) !== null) {
          breakLink(fields, ctx, id, world);
          continue;
        }
        const from = world.position(id);
        const to = world.position(targetId);
        const dx = delta(to.x, from.x);
        const dy = delta(to.y, from.y);
        if (!withinRange(dx, dy, TRACTOR_RANGE)) {
          breakLink(fields, ctx, id, world);
          continue;
        }
        const margin = fields[H.tractorPaid]! - target[H.tractorPaid]!;
        if (margin <= 0) {
          breakLink(fields, ctx, id, world);
          continue;
        }
        fields[H.tractorLink] = 1;
        let pullPoints = margin * TRACTOR_PULL_PER_POINT;
        if (pullPoints > PULL_CAP) pullPoints = PULL_CAP;
        const total = pullPoints * FX_ONE;
        const share = pullShare(total, fields[H.tractorRest]!, period);
        fields[H.tractorRest] = share.rest;
        // Hold drags the target back along the line. Repel pushes it further away.
        const dirX = mode === TRACTOR_HOLD ? -dx : dx;
        const dirY = mode === TRACTOR_HOLD ? -dy : dy;
        const moved = shiftAlong(dirX, dirY, share.step);
        if (moved) {
          const pos = world.position(targetId);
          world.setPosition(targetId, add(pos.x, fxRaw(moved.x)), add(pos.y, fxRaw(moved.y)));
        }
        target[H.speedOverride] = 0;
        const slowed = fields[H.speed]! - TRACTOR_SELF_SLOW;
        fields[H.speedOverride] = slowed > 0 ? slowed : 0;
        writeHull(world, targetId, target);
        writeHull(world, id, fields);
      }
    },
  };
}

export interface Phase3Bundle {
  readonly systems: readonly SimSystem[];
  readonly handlers: readonly CommandHandler[];
}

export function createPhase3(rulesTurnTicks: number): Phase3Bundle {
  if (!Number.isInteger(rulesTurnTicks) || rulesTurnTicks < 1) throw new Error('rules turn ticks');
  const handlers: CommandHandler[] = [
    { kind: VERB_SET_EW, apply: applySetEw },
    { kind: VERB_SET_WEAPON_MODE, apply: applySetWeaponMode },
    { kind: VERB_SET_TRACTOR, apply: applySetTractor },
    {
      kind: VERB_SET_CLOAK,
      apply(world, cmd, ctx) {
        applySetCloak(world, cmd, ctx, rulesTurnTicks);
      },
    },
  ];
  return {
    systems: [cloakSystem(rulesTurnTicks), tractorSystem(rulesTurnTicks)],
    handlers,
  };
}
