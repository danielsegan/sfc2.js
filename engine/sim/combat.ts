/**
 * Energy allocation, six shields, phasers, and photon torpedoes for the Phase 2 duel.
 *
 * Commands apply in the input phase. The allocation system drips the plan in the
 * energy phase. A phaser hit resolves in the fire command, before that drip.
 * A photon launch stores a seeker. The flight system in the weapons phase moves
 * it, including on the launch tick, and applies the hit when it detonates.
 *
 * Payloads do not carry a tick. The session stamps tick, slot, and seq.
 * Every divisor is checked before the divide; fx saturation is not the rule.
 */
import { angle16 } from '../core/angle.ts';
import { asEntityId, type EntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import { delta, distSq, fx, fxRaw, isqrt64, sub } from '../core/fx.ts';
import { divFloorI64byI32, mulU32ToI64 } from '../core/i64.ts';
import type { CommandHandler, SimSystem, TickContext } from './sim.ts';
import { ENTITY_KIND, type TableSpec, type World } from './world.ts';
import { facingForRelative, relativeBearing, shotInArc, withinRange } from './arcs.ts';
import { disruptorShot } from './disruptor.ts';
import { rulesDiv } from './rules-div.ts';
import {
  allocationOrder,
  batteryForPool,
  captureSystems,
  reinforcementBlocked,
  rememberSettlement,
} from './power.ts';
import { createAccelRamp, stampAccel } from './accel.ts';
import { stampCurve, usesCurve } from './turn-curve.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import {
  emptyMounts,
  facingBudgetAt,
  H,
  HULL,
  HULL_FIELDS,
  MOUNT,
  MOUNT_SLOTS,
  MOUNT_STRIDE,
  readHull,
  readMounts,
  readShot,
  setFacingBudgetAt,
  setShieldAt,
  shieldAt,
  shieldMaxAt,
  writeHull,
  writeMounts,
  writeShot,
  SHOT,
  SHOT_FIELDS,
  type MountMem,
  type ShotMem,
} from './hull.ts';
import {
  EVENT_MISS,
  P3,
  createPhase3,
  fireBlocked,
  shotMisses,
  stampPhase3,
  targetHidden,
} from './phase3.ts';
import {
  CHART_POINT_SIZE,
  CLASS_FIGHTER,
  DAMAGE_CHART,
  DEFAULT_CREW_LOSS,
  DEFAULT_FC_HUNDREDTHS,
  DEFAULT_LIFE_HUNDREDTHS,
  DEFAULT_REINFORCE_CAP,
  DEFAULT_REINFORCE_PER_ENERGY,
  DEFAULT_RULES_TURN_TICKS,
  ENERGY_SCALE,
  FALLBACK_YAW_PER_TICK,
  INTERNAL_DISRUPTOR,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  ROW_BRIDGE,
  ROW_EXCESS,
  ROW_HULL,
  ROW_SENSORS,
  MODE_KEEP,
  MODE_NORMAL,
  MODE_OFFLINE,
  MODE_OVERLOAD,
  MODE_PROXIMITY,
  TURN_UNVERIFIED,
  arcId,
  turnHasRate,
  turnImmobile,
  weaponDef,
  weaponId,
  type WeaponDef,
} from './rules-tables.ts';

export const VERB_SPAWN = 1;
export const VERB_SET_ENERGY = 2;
export const VERB_SET_SHIELDS = 3;
export const VERB_DAMAGE_SHIELD = 4;
export const VERB_FIRE = 5;

export const EVENT_SPAWN = 1;
export const EVENT_RULE = 2;
export const EVENT_HIT = 3;

export const STATUS_APPLIED = 1;
export const STATUS_CLAMPED = 2;
export const STATUS_REJECTED = 3;

export const R = {
  ok: 0,
  noSuchShip: 1,
  shipDestroyed: 2,
  notAShip: 3,
  negativeValue: 4,
  badFacing: 5,
  unknownDraw: 6,
  unknownWeaponSlot: 7,
  notInDuelSlice: 8,
  notCharged: 9,
  noFireControl: 10,
  outOfArc: 11,
  outOfRange: 12,
  weaponDestroyed: 13,
  turnModeUnverified: 14,
  crewDisabled: 15,
  overDraw: 16,
  speedClamped: 17,
  immobile: 18,
  shieldAboveMax: 19,
  shieldDepleted: 20,
  chargeCapped: 21,
  reinforceCapped: 22,
  ewMiss: P3.ewMiss,
  noEw: P3.noEw,
  ewCapped: P3.ewCapped,
  noOverload: P3.noOverload,
  noTractor: P3.noTractor,
  badTarget: P3.badTarget,
  tractorBroken: P3.tractorBroken,
  noCloak: P3.noCloak,
  cloaked: P3.cloaked,
  notDetected: P3.notDetected,
  cloakCollapsed: P3.cloakCollapsed,
  tractorCapped: P3.tractorCapped,
} as const;

export const REASON_NAME = [
  'ok',
  'noSuchShip',
  'shipDestroyed',
  'notAShip',
  'negativeValue',
  'badFacing',
  'unknownDraw',
  'unknownWeaponSlot',
  'notInDuelSlice',
  'notCharged',
  'noFireControl',
  'outOfArc',
  'outOfRange',
  'weaponDestroyed',
  'turnModeUnverified',
  'crewDisabled',
  'overDraw',
  'speedClamped',
  'immobile',
  'shieldAboveMax',
  'shieldDepleted',
  'chargeCapped',
  'reinforceCapped',
  'ewMiss',
  'noEw',
  'ewCapped',
  'noOverload',
  'noTractor',
  'badTarget',
  'tractorBroken',
  'noCloak',
  'cloaked',
  'notDetected',
  'cloakCollapsed',
  'tractorCapped',
] as const;

const REASON_STATUS = [
  STATUS_APPLIED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
  STATUS_REJECTED,
  STATUS_CLAMPED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_CLAMPED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_REJECTED,
  STATUS_CLAMPED,
  STATUS_CLAMPED,
] as const;

const PAY_LIFE = 0;
const PAY_FC = 1;
const PAY_MOVE = 2;
const PAY_SHIELD = 3;
const PAY_WEAPON = 4;

const FLAG_LIFE = 1;
const FLAG_FC = 2;
const FLAG_UNKNOWN = 4;
/** The speed word is hundredths of a speed point, not whole points. */
const FLAG_SPEED_100 = 8;

export interface EnergyAsk {
  readonly slot: number;
  readonly request: number;
  /** MODE_KEEP leaves the mount mode unchanged. */
  readonly mode: number;
}

export interface CombatOptions {
  readonly rulesTurnTicks?: number;
  readonly reinforceCapPerTurn?: number;
  readonly reinforcePerEnergy?: number;
  /** Whole points. Omit to use the 1.5 / 1 defaults. */
  readonly lifeSupportCost?: number;
  readonly fireControlCost?: number;
  readonly crewLoss?: number;
}

interface ResolvedOptions {
  readonly rulesTurnTicks: number;
  readonly reinforceCapPerTurn: number;
  readonly reinforcePerEnergy: number;
  readonly lifeSupportCost100: number;
  readonly fireControlCost100: number;
  readonly crewLoss: number;
}

export interface CombatBundle {
  readonly tables: readonly TableSpec[];
  readonly systems: readonly SimSystem[];
  readonly handlers: readonly CommandHandler[];
}

export const COMBAT_TABLES: readonly TableSpec[] = [
  { id: HULL, fieldCount: HULL_FIELDS },
  { id: MOUNT, fieldCount: MOUNT_SLOTS * MOUNT_STRIDE },
  { id: SHOT, fieldCount: SHOT_FIELDS },
];

/** Facing 0, 1, and 5 are forward; 2 and 4 are centre; 3 is aft. */
const HULL_FIELD_BY_FACING = [
  H.hullForward,
  H.hullForward,
  H.hullCenter,
  H.hullAft,
  H.hullCenter,
  H.hullForward,
] as const;

function resolveOptions(options: CombatOptions | undefined): ResolvedOptions {
  const rulesTurnTicks = options?.rulesTurnTicks ?? DEFAULT_RULES_TURN_TICKS;
  if (!Number.isInteger(rulesTurnTicks) || rulesTurnTicks < 1) throw new Error('rules turn ticks');
  return {
    rulesTurnTicks,
    reinforceCapPerTurn: options?.reinforceCapPerTurn ?? DEFAULT_REINFORCE_CAP,
    reinforcePerEnergy: options?.reinforcePerEnergy ?? DEFAULT_REINFORCE_PER_ENERGY,
    lifeSupportCost100:
      options?.lifeSupportCost !== undefined ? scale(options.lifeSupportCost) : DEFAULT_LIFE_HUNDREDTHS,
    fireControlCost100:
      options?.fireControlCost !== undefined ? scale(options.fireControlCost) : DEFAULT_FC_HUNDREDTHS,
    crewLoss: options?.crewLoss ?? DEFAULT_CREW_LOSS,
  };
}

function words(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) writeU32(out, i * 4, values[i]! | 0);
  return out;
}

function readI32(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16) | (buf[offset + 3]! << 24)) | 0
  );
}

function need(buf: Uint8Array, wordsNeeded: number): boolean {
  return buf.length >= wordsNeeded * 4;
}

/**
 * floor(a * b / d) for non-negative a, b and d > 0. The product is an exact i64.
 * d == 0 is rejected here. The i64 helper's div0 throw is not the rules result.
 */
function floorMulDiv(a: number, b: number, d: number): number {
  if (!Number.isInteger(d) || d <= 0) throw new Error('rules divisor');
  if (a < 0 || b < 0) throw new Error('share');
  const q = divFloorI64byI32(mulU32ToI64(a >>> 0, b >>> 0), d | 0);
  if (q.hi !== 0) throw new Error('share overflow');
  return q.lo >>> 0;
}

/** Bresenham share so the shares of `total` across `period` ticks sum to `total`. */
export function tickShare(total: number, index: number, period: number): number {
  return floorMulDiv(total, index + 1, period) - floorMulDiv(total, index, period);
}

function scale(points: number): number {
  return points * ENERGY_SCALE;
}

function systemBoxes(value: number | undefined): number {
  const n = value ?? 0;
  if (!Number.isInteger(n) || n < 0) throw new Error('system boxes');
  return n;
}

/** Floored Q16.16 distance. Axis-aligned integer positions stay on a whole range unit. */
function launchRange(dx: number, dy: number): number {
  const raw = isqrt64(distSq(dx | 0, dy | 0));
  if (!Number.isInteger(raw) || raw < 0 || raw > 2147483647) throw new Error('range');
  return raw;
}

function penetratingPoints(damage: number, absorbed: number): number {
  const left = damage - absorbed;
  if (left <= 0) return 0;
  if (!Number.isInteger(CHART_POINT_SIZE) || CHART_POINT_SIZE <= 0) throw new Error('chart point size');
  return rulesDiv(left, CHART_POINT_SIZE);
}

function hullField(facing: number): number {
  if (facing < 0 || facing > 5) throw new Error('facing');
  return HULL_FIELD_BY_FACING[facing]!;
}

/**
 * Walk the placeholder chart once from `start`. A placed point returns false.
 * An empty walk, or excess with no pool left, destroys the ship and returns true.
 */
function placeChartPoint(fields: number[], start: number, facing: number): boolean {
  const n = DAMAGE_CHART.length;
  if (n <= 0 || start < 0 || start >= n) throw new Error('chart draw');
  let idx = start;
  for (let k = 0; k < n; k++) {
    const row = DAMAGE_CHART[idx]!;
    idx += 1;
    if (idx === n) idx = 0;
    if (row === ROW_EXCESS) {
      const extra = fields[H.extra]!;
      if (extra > 0) {
        fields[H.extra] = extra - 1;
        return false;
      }
      fields[H.destroyed] = 1;
      return true;
    }
    let index = 0;
    if (row === ROW_HULL) index = hullField(facing);
    else if (row === ROW_BRIDGE) index = H.bridge;
    else if (row === ROW_SENSORS) index = H.sensors;
    else throw new Error('chart row');
    const boxes = fields[index]!;
    if (boxes <= 0) continue;
    fields[index] = boxes - 1;
    return false;
  }
  fields[H.destroyed] = 1;
  return true;
}

function applyInternal(fields: number[], points: number, facing: number, ctx: TickContext): void {
  let left = points;
  const armor = fields[H.armor]!;
  const take = armor < left ? armor : left;
  fields[H.armor] = armor - take;
  left -= take;
  const n = DAMAGE_CHART.length;
  if (n <= 0) throw new Error('chart');
  while (left > 0 && fields[H.destroyed] !== 1) {
    left -= 1;
    const draw = ctx.rng.stream('combat').int(n);
    placeChartPoint(fields, draw, facing);
  }
}

function applyWeaponHit(
  fields: number[],
  facing: number,
  damage: number,
  unit: number,
  ctx: TickContext,
): { absorbed: number; penetrating: number } {
  const scaleUnit = unit > 1 ? unit : 1;
  const fracAt = H.shieldFrac0 + facing;
  const pooled = shieldAt(fields, facing) * scaleUnit + (scaleUnit > 1 ? fields[fracAt]! : 0);
  const absorbed = pooled < damage ? pooled : damage;
  const left = pooled - absorbed;
  const whole = rulesDiv(left, scaleUnit);
  setShieldAt(fields, facing, whole);
  if (scaleUnit > 1) fields[fracAt] = left - whole * scaleUnit;
  let wholePoints = rulesDiv(damage - absorbed, scaleUnit);
  if (scaleUnit > 1) {
    const rem = damage - absorbed - wholePoints * scaleUnit;
    let bank = fields[H.damageFrac]! + rem;
    const extra = rulesDiv(bank, scaleUnit);
    wholePoints += extra;
    bank -= extra * scaleUnit;
    fields[H.damageFrac] = bank;
  }
  const penetrating = penetratingPoints(wholePoints, 0);
  fields[H.lastHitFacing] = facing;
  fields[H.lastHitDamage] = damage;
  fields[H.lastHitAbsorbed] = absorbed;
  fields[H.lastHitPen] = penetrating;
  if (penetrating > 0) applyInternal(fields, penetrating, facing, ctx);
  return { absorbed, penetrating };
}

function emitRule(ctx: TickContext, entity: number, reason: number, applied: number): void {
  ctx.emit({ kind: EVENT_RULE, entity, a: reason, b: applied });
}

function remember(fields: number[], verb: number, reason: number, applied: number): void {
  fields[H.lastVerb] = verb;
  fields[H.lastReason] = reason;
  fields[H.lastStatus] = REASON_STATUS[reason]!;
  fields[H.lastApplied] = applied | 0;
}

function liveFields(world: World, id: EntityId): number[] | undefined {
  if (!world.isLive(id)) return undefined;
  return readHull(world, id);
}

export interface EnergyOrder {
  lifeSupport?: boolean;
  fireControl?: boolean;
  unknownDraw?: boolean;
  speed?: number;
  /** Hundredths of a speed point. When set, `speed` is ignored. */
  speedHundredths?: number;
  general?: number;
  specific?: readonly number[];
  weapons?: readonly EnergyAsk[];
}

/** Payload only. The session stamps tick, slot, and seq. */
export function spawnPayload(setupIndex: number, x: number, y: number, heading: number): Uint8Array {
  return words([setupIndex, x, y, heading]);
}

export function setEnergyPayload(entity: number, order: EnergyOrder): Uint8Array {
  const specific = order.specific ?? [0, 0, 0, 0, 0, 0];
  if (specific.length !== 6) throw new Error('specific facings');
  let flags = 0;
  if (order.lifeSupport) flags |= FLAG_LIFE;
  if (order.fireControl) flags |= FLAG_FC;
  if (order.unknownDraw) flags |= FLAG_UNKNOWN;
  const speedWord = order.speedHundredths !== undefined ? order.speedHundredths : (order.speed ?? 0);
  if (order.speedHundredths !== undefined) flags |= FLAG_SPEED_100;
  const weapons = order.weapons ?? [];
  const values = [entity, flags, speedWord, order.general ?? 0, ...specific, weapons.length];
  for (const ask of weapons) values.push(ask.slot, ask.request, ask.mode);
  return words(values);
}

export function setShieldsPayload(entity: number, facing: number, points: number): Uint8Array {
  return words([entity, facing, points]);
}

export function damageShieldPayload(entity: number, facing: number, points: number): Uint8Array {
  return words([entity, facing, points]);
}

export function firePayload(attacker: number, slotIndex: number, target: number): Uint8Array {
  return words([attacker, slotIndex, target]);
}

function splitGeneral(points: number): number[] {
  const whole = points > 0 ? points : 0;
  const base = rulesDiv(whole, 6);
  const rem = whole - base * 6;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push(base + (i < rem ? 1 : 0));
  return out;
}

function heavyFamily(internal: number): boolean {
  return internal === INTERNAL_PHOTON || internal === INTERNAL_DISRUPTOR;
}

function overloadHeavy(def: WeaponDef, mode: number): boolean {
  return mode === MODE_OVERLOAD && (def.internal === INTERNAL_PHOTON || def.internal === INTERNAL_DISRUPTOR);
}

function armCostPoints(def: WeaponDef, mode: number): number {
  if (def.internal === INTERNAL_PHASER) return def.chargeCost;
  if (overloadHeavy(def, mode)) return def.overloadArmCost;
  if (heavyFamily(def.internal)) return def.armCost;
  return 0;
}

function armTicksOf(def: WeaponDef, mode: number): number {
  if (overloadHeavy(def, mode)) return def.overloadArmTicks;
  return def.armTicks;
}

function perTurnCap(def: WeaponDef, mode: number, cost: number): number {
  const cap = overloadHeavy(def, mode) ? def.overloadArmPerTurn : def.armPerTurn;
  if (cap > 0) return scale(cap);
  return scale(cost);
}

function capacitorMax(mounts: readonly MountMem[]): number {
  let sum = 0;
  for (const mount of mounts) {
    const def = weaponDef(mount.weaponId);
    if (!def || def.internal !== INTERNAL_PHASER || def.chargeCost <= 0) continue;
    sum += scale(def.chargeCost);
  }
  return sum;
}

function pullCapacitor(mounts: readonly MountMem[], capacitor100: number): number {
  let left = capacitor100;
  for (const mount of mounts) {
    const def = weaponDef(mount.weaponId);
    if (!def || def.internal !== INTERNAL_PHASER || def.chargeCost <= 0) continue;
    const need = scale(def.chargeCost) - mount.charge100;
    if (need <= 0 || left <= 0) continue;
    const take = need < left ? need : left;
    mount.charge100 += take;
    left -= take;
  }
  return left;
}

function acceptedEnergy(mount: MountMem, def: WeaponDef, mode: number, request100: number, capacitor100: number, mounts: readonly MountMem[]): number {
  if (mode === MODE_OFFLINE) return 0;
  if (def.internal === INTERNAL_PHASER) {
    if (def.chargeCost <= 0) return 0;
    const need = scale(def.chargeCost) - mount.charge100;
    const capRoom = capacitorMax(mounts) - capacitor100;
    const room = (need > 0 ? need : 0) + (capRoom > 0 ? capRoom : 0);
    return request100 < room ? request100 : room;
  }
  if (heavyFamily(def.internal)) {
    const cost = armCostPoints(def, mode);
    if (cost <= 0) return 0;
    const need = scale(cost) - mount.charge100;
    const cap = perTurnCap(def, mode, cost);
    const filling = need > 0 ? need : 0;
    const room = filling < cap ? filling : cap;
    const armed = mount.charge100 >= scale(cost) && mount.ticksCharging >= armTicksOf(def, mode);
    const hold = armed && def.holdCost > 0 ? scale(def.holdCost) : 0;
    const accept = room + hold;
    return request100 < accept ? request100 : accept;
  }
  return 0;
}

interface PaidAsk {
  slot: number;
  mode: number;
  accepted: number;
  paid: number;
}

/** Place a ship or PF. Callers copy a carrier position afterwards when launching. */
export function placeSetup(world: World, setup: ShipSetup, x: number, y: number, heading: number): EntityId {
  if (setup.shields.length !== 6 || setup.shieldsMax.length !== 6) throw new Error('shields');
  const kind = setup.classCode === CLASS_FIGHTER ? 'fighter' : 'ship';
  const id = world.alloc(kind);
  const fields: number[] = [];
  for (let i = 0; i < HULL_FIELDS; i++) fields.push(0);
  fields[H.classCode] = setup.classCode;
  fields[H.destroyed] = setup.destroyed;
  fields[H.disabled] = setup.disabled;
  fields[H.fcPaid] = setup.fcPaid;
  fields[H.speed] = setup.speed;
  fields[H.moveCost100] = setup.moveCost100;
  fields[H.turnMode] = setup.turnMode;
  fields[H.acceleration] = setup.acceleration;
  fields[H.crew] = setup.crew;
  fields[H.minCrew] = setup.minCrew;
  fields[H.warp100] = scale(setup.warp);
  fields[H.impulse100] = scale(setup.impulse);
  fields[H.apr100] = scale(setup.apr);
  fields[H.battery100] = scale(setup.battery);
  fields[H.batteryCapacity100] = scale(setup.batteryCapacity);
  for (let i = 0; i < 6; i++) {
    setShieldAt(fields, i, setup.shields[i]!);
    fields[H.shieldMax0 + i] = setup.shieldsMax[i]!;
  }
  fields[H.armor] = systemBoxes(setup.systems?.armor);
  fields[H.bridge] = systemBoxes(setup.systems?.bridge);
  fields[H.hullForward] = systemBoxes(setup.systems?.hullForward);
  fields[H.hullCenter] = systemBoxes(setup.systems?.hullCenter);
  fields[H.hullAft] = systemBoxes(setup.systems?.hullAft);
  fields[H.sensors] = systemBoxes(setup.systems?.sensors);
  fields[H.extra] = systemBoxes(setup.systems?.extraDamage);
  fields[H.lastHitFacing] = -1;
  stampPhase3(fields, setup);
  const mounts = emptyMounts();
  for (const mount of setup.mounts) {
    if (mount.slotIndex < 0 || mount.slotIndex >= MOUNT_SLOTS) throw new Error('slot');
    const row = mounts[mount.slotIndex]!;
    if (row.weaponId !== 0) throw new Error('duplicate slot');
    row.weaponId = weaponId(mount.weapon);
    row.arcId = mount.arc == null ? 0 : arcId(mount.arc);
    row.charge100 = scale(mount.chargePoints);
    row.boxes = mount.boxes;
    row.boxesMax = mount.boxes;
    row.mode = mount.mode;
    row.ticksCharging = mount.ticksCharging;
  }
  world.setPosition(id, fx(x), fx(y));
  world.setHeading(id, angle16(heading));
  writeHull(world, id, fields);
  writeMounts(world, id, mounts);
  captureSystems(world, id, fields);
  stampCurve(world, id, setup.classCode === CLASS_FIGHTER ? undefined : setup.turnHull);
  stampAccel(world, id, setup.classCode === CLASS_FIGHTER ? undefined : setup.turnHull, setup.speed);
  return id;
}

function applySpawn(world: World, cmd: Command, ctx: TickContext, setups: readonly ShipSetup[]): void {
  if (!need(cmd.payload, 4)) throw new Error('spawn payload');
  const index = readI32(cmd.payload, 0);
  const setup = setups[index];
  if (!setup) throw new Error('setup index');
  const id = placeSetup(world, setup, readI32(cmd.payload, 4), readI32(cmd.payload, 8), readI32(cmd.payload, 12));
  ctx.emit({ kind: EVENT_SPAWN, entity: id as number, a: index, b: 0 });
  // Once per hull. Later speed and yaw orders keep moving on the fallback cap.
  // A hull on the measured turn curve does not use that cap, so it is not warned.
  if (setup.classCode !== CLASS_FIGHTER && setup.turnMode === TURN_UNVERIFIED && usesCurve(world, id) === 0) {
    emitRule(ctx, id as number, R.turnModeUnverified, FALLBACK_YAW_PER_TICK);
  }
}

function applySetShields(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 3)) throw new Error('shield payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const facing = readI32(cmd.payload, 4);
  const points = readI32(cmd.payload, 8);
  const fields = liveFields(world, id);
  if (!fields) {
    emitRule(ctx, id as number, R.noSuchShip, -1);
    return;
  }
  if (fields[H.classCode] === CLASS_FIGHTER) {
    emitRule(ctx, id as number, R.notAShip, -1);
    return;
  }
  if (fields[H.destroyed] === 1) {
    emitRule(ctx, id as number, R.shipDestroyed, -1);
    return;
  }
  if (!Number.isInteger(facing) || facing < 0 || facing > 5) {
    emitRule(ctx, id as number, R.badFacing, -1);
    return;
  }
  if (points < 0) {
    emitRule(ctx, id as number, R.negativeValue, -1);
    return;
  }
  const max = shieldMaxAt(fields, facing);
  if (points > max) {
    setShieldAt(fields, facing, max);
    remember(fields, VERB_SET_SHIELDS, R.shieldAboveMax, max);
    writeHull(world, id, fields);
    emitRule(ctx, id as number, R.shieldAboveMax, max);
    return;
  }
  setShieldAt(fields, facing, points);
  remember(fields, VERB_SET_SHIELDS, R.ok, points);
  writeHull(world, id, fields);
  emitRule(ctx, id as number, R.ok, points);
}

function applyDamageShield(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 3)) throw new Error('shield payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const facing = readI32(cmd.payload, 4);
  const points = readI32(cmd.payload, 8);
  const fields = liveFields(world, id);
  if (!fields) {
    emitRule(ctx, id as number, R.noSuchShip, -1);
    return;
  }
  if (fields[H.classCode] === CLASS_FIGHTER) {
    emitRule(ctx, id as number, R.notAShip, -1);
    return;
  }
  if (fields[H.destroyed] === 1) {
    emitRule(ctx, id as number, R.shipDestroyed, -1);
    return;
  }
  if (!Number.isInteger(facing) || facing < 0 || facing > 5) {
    emitRule(ctx, id as number, R.badFacing, -1);
    return;
  }
  if (points < 0) {
    emitRule(ctx, id as number, R.negativeValue, -1);
    return;
  }
  const current = shieldAt(fields, facing);
  const removed = current < points ? current : points;
  setShieldAt(fields, facing, current - removed);
  const reason = removed < points ? R.shieldDepleted : R.ok;
  remember(fields, VERB_DAMAGE_SHIELD, reason, removed);
  writeHull(world, id, fields);
  emitRule(ctx, id as number, reason, removed);
}

function applySetEnergy(world: World, cmd: Command, ctx: TickContext, options: ResolvedOptions): void {
  if (!need(cmd.payload, 11)) throw new Error('energy payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const flags = readI32(cmd.payload, 4);
  const speedReq = readI32(cmd.payload, 8);
  const general = readI32(cmd.payload, 12);
  const specific: number[] = [];
  for (let i = 0; i < 6; i++) specific.push(readI32(cmd.payload, 16 + i * 4));
  const weaponCount = readI32(cmd.payload, 40);
  if (weaponCount < 0 || !need(cmd.payload, 11 + weaponCount * 3)) throw new Error('energy payload');
  const asks: EnergyAsk[] = [];
  for (let i = 0; i < weaponCount; i++) {
    const base = 44 + i * 12;
    asks.push({
      slot: readI32(cmd.payload, base),
      request: readI32(cmd.payload, base + 4),
      mode: readI32(cmd.payload, base + 8),
    });
  }
  const fields = liveFields(world, id);
  if (!fields) {
    emitRule(ctx, id as number, R.noSuchShip, -1);
    return;
  }
  if (fields[H.classCode] === CLASS_FIGHTER) {
    emitRule(ctx, id as number, R.notAShip, -1);
    return;
  }
  if (fields[H.destroyed] === 1) {
    emitRule(ctx, id as number, R.shipDestroyed, -1);
    return;
  }
  if ((flags & FLAG_UNKNOWN) !== 0) {
    emitRule(ctx, id as number, R.unknownDraw, -1);
    return;
  }
  if (speedReq < 0 || general < 0) {
    emitRule(ctx, id as number, R.negativeValue, -1);
    return;
  }
  for (const amount of specific) {
    if (amount < 0) {
      emitRule(ctx, id as number, R.negativeValue, -1);
      return;
    }
  }
  const mounts = readMounts(world, id);
  for (const ask of asks) {
    if (ask.slot < 0 || ask.slot >= MOUNT_SLOTS || mounts[ask.slot]!.weaponId === 0) {
      emitRule(ctx, id as number, R.unknownWeaponSlot, -1);
      return;
    }
    if (ask.request < 0) {
      emitRule(ctx, id as number, R.negativeValue, -1);
      return;
    }
    const def = weaponDef(mounts[ask.slot]!.weaponId);
    if (!def || (def.internal !== INTERNAL_PHASER && !heavyFamily(def.internal))) {
      emitRule(ctx, id as number, R.notInDuelSlice, -1);
      return;
    }
    if (ask.mode !== MODE_KEEP && (ask.mode < MODE_NORMAL || ask.mode > MODE_PROXIMITY)) {
      emitRule(ctx, id as number, R.notInDuelSlice, -1);
      return;
    }
    if (def.internal === INTERNAL_PHASER && ask.mode !== MODE_KEEP && ask.mode !== MODE_NORMAL) {
      emitRule(ctx, id as number, R.notInDuelSlice, -1);
      return;
    }
  }
  // Letters and other known unverified tokens have a fallback rate.
  // This refusal is only a mode id outside that table.
  if (speedReq > 0 && turnHasRate(fields[H.turnMode]!) === 0) {
    emitRule(ctx, id as number, R.turnModeUnverified, -1);
    return;
  }

  const speedHundredths = (flags & FLAG_SPEED_100) !== 0;
  let speed = speedHundredths ? rulesDiv(speedReq, ENERGY_SCALE) : speedReq;
  let speedFrac = speedHundredths ? speedReq - speed * ENERGY_SCALE : 0;
  if (speedFrac < 0) speedFrac = 0;
  let immobileClamp = false;
  let accelClamp = false;
  const absentAccel = fields[H.acceleration]! < 0;
  const ramps = fields[H.speedActual100]! >= 0;
  if (turnImmobile(fields[H.turnMode]!) === 1 || absentAccel) {
    if (speed > 0 || speedFrac > 0) immobileClamp = true;
    speed = 0;
    speedFrac = 0;
  } else if (!ramps) {
    const accel = fields[H.acceleration]!;
    const current = fields[H.speed]!;
    const deltaSpeed = speed - current;
    const gap = deltaSpeed < 0 ? -deltaSpeed : deltaSpeed;
    if (gap > accel) {
      speed = current + (deltaSpeed > 0 ? accel : -accel);
      speedFrac = 0;
      accelClamp = true;
    }
  }

  for (const ask of asks) {
    const mount = mounts[ask.slot]!;
    if (ask.mode !== MODE_KEEP && ask.mode !== mount.mode) {
      mount.charge100 = 0;
      mount.ticksCharging = 0;
    }
    if (ask.mode !== MODE_KEEP) mount.mode = ask.mode;
  }
  let capacitor = pullCapacitor(mounts, fields[H.capacitor100]!);

  const paidAsks: PaidAsk[] = [];
  let chargeCapped = false;
  let weaponDesired = 0;
  for (const ask of asks) {
    const mount = mounts[ask.slot]!;
    const def = weaponDef(mount.weaponId)!;
    const mode = mount.mode;
    const request100 = scale(ask.request);
    const accepted = acceptedEnergy(mount, def, mode, request100, capacitor, mounts);
    if (accepted < request100) chargeCapped = true;
    paidAsks.push({ slot: ask.slot, mode, accepted, paid: 0 });
    weaponDesired += accepted;
  }

  const facing = splitGeneral(general);
  for (let i = 0; i < 6; i++) facing[i] = facing[i]! + specific[i]!;
  let uncapped = 0;
  for (const points of facing) uncapped += points;
  let reinforceCapped = false;
  for (let i = 0; i < 6; i++) {
    const room = shieldMaxAt(fields, i) - shieldAt(fields, i);
    const roomPoints = room > 0 ? room : 0;
    let capped = facing[i]!;
    if (capped > options.reinforceCapPerTurn) capped = options.reinforceCapPerTurn;
    if (capped > roomPoints) capped = roomPoints;
    if (capped < facing[i]!) reinforceCapped = true;
    facing[i] = capped;
  }
  if (reinforcementBlocked(world, id)) {
    for (let i = 0; i < 6; i++) facing[i] = 0;
  }
  let shieldPoints = 0;
  for (const points of facing) shieldPoints += points;

  const lifeOn = (flags & FLAG_LIFE) !== 0;
  const fcOn = (flags & FLAG_FC) !== 0;
  const moveCost100 = fields[H.moveCost100]!;
  // A non-positive move cost spends nothing. Never divide by it.
  const movementAsked =
    moveCost100 > 0 ? moveCost100 * speed + rulesDiv(moveCost100 * speedFrac, ENERGY_SCALE) : 0;
  const desired = [
    lifeOn ? options.lifeSupportCost100 : 0,
    fcOn ? options.fireControlCost100 : 0,
    movementAsked,
    scale(shieldPoints),
    weaponDesired,
  ];
  const gen = fields[H.warp100]! + fields[H.impulse100]! + fields[H.apr100]!;
  let pool = gen + batteryForPool(world, id, fields[H.battery100]!);
  const paid = [0, 0, 0, 0, 0];
  const order = allocationOrder(world, id);
  for (let n = 0; n < order.length; n++) {
    const k = order[n]!;
    const give = desired[k]! < pool ? desired[k]! : pool;
    paid[k] = give;
    pool -= give;
  }
  if (paid[PAY_MOVE]! < desired[PAY_MOVE]! && moveCost100 > 0) {
    const affordable = rulesDiv(paid[PAY_MOVE]!, moveCost100);
    const used = moveCost100 * affordable;
    let leftover = paid[PAY_MOVE]! - used;
    paid[PAY_MOVE] = used;
    speed = affordable;
    speedFrac = 0;
    const shieldShort = desired[PAY_SHIELD]! - paid[PAY_SHIELD]!;
    const giveS = leftover < shieldShort ? leftover : shieldShort;
    paid[PAY_SHIELD]! += giveS;
    leftover -= giveS;
    const weaponShort = desired[PAY_WEAPON]! - paid[PAY_WEAPON]!;
    const giveW = leftover < weaponShort ? leftover : weaponShort;
    paid[PAY_WEAPON]! += giveW;
  }
  const snapped = rulesDiv(paid[PAY_SHIELD]!, ENERGY_SCALE) * ENERGY_SCALE;
  const frac = paid[PAY_SHIELD]! - snapped;
  paid[PAY_SHIELD] = snapped;
  if (frac > 0) {
    const weaponShort = desired[PAY_WEAPON]! - paid[PAY_WEAPON]!;
    const giveW = frac < weaponShort ? frac : weaponShort;
    paid[PAY_WEAPON]! += giveW;
  }
  let pointBudget = rulesDiv(paid[PAY_SHIELD]!, ENERGY_SCALE);
  let have = 0;
  for (const points of facing) have += points;
  if (pointBudget < have) {
    let over = have - pointBudget;
    for (let i = 5; i >= 0 && over > 0; i--) {
      const cut = facing[i]! < over ? facing[i]! : over;
      facing[i] = facing[i]! - cut;
      over -= cut;
    }
  }
  let weaponLeft = paid[PAY_WEAPON]!;
  for (const ask of paidAsks) {
    const give = ask.accepted < weaponLeft ? ask.accepted : weaponLeft;
    ask.paid = give;
    weaponLeft -= give;
  }

  const paidTotal = paid[0]! + paid[1]! + paid[2]! + paid[3]! + paid[4]!;
  let battery = fields[H.battery100]!;
  const fromBattery = paidTotal > gen ? paidTotal - gen : 0;
  battery -= fromBattery;
  if (battery < 0) battery = 0;
  const surplus = gen - (paidTotal < gen ? paidTotal : gen);
  const room = fields[H.batteryCapacity100]! - battery;
  let recharge = room < surplus ? room : surplus;
  if (recharge < 0) recharge = 0;
  battery += recharge;

  const short =
    paid[PAY_LIFE]! < desired[PAY_LIFE]! ||
    paid[PAY_FC]! < desired[PAY_FC]! ||
    paid[PAY_MOVE]! < movementAsked ||
    paid[PAY_SHIELD]! < desired[PAY_SHIELD]! ||
    paid[PAY_WEAPON]! < desired[PAY_WEAPON]!;
  let reason: number = R.ok;
  if (short) reason = R.overDraw;
  else if (accelClamp) reason = R.speedClamped;
  else if (immobileClamp) reason = R.immobile;
  else if (reinforceCapped && uncapped > shieldPoints) reason = R.reinforceCapped;
  else if (chargeCapped) reason = R.chargeCapped;

  rememberSettlement(
    world,
    id,
    gen,
    desired[0]! + desired[1]! + desired[2]! + desired[3]! + desired[4]!,
    paid[PAY_MOVE]!,
    paid[PAY_WEAPON]!,
    paid[PAY_SHIELD]!,
    paid[PAY_LIFE]! + paid[PAY_FC]!,
    desired[PAY_MOVE]!,
    desired[PAY_WEAPON]!,
    desired[PAY_SHIELD]!,
    desired[PAY_LIFE]! + desired[PAY_FC]!,
  );
  fields[H.speed] = speed;
  fields[H.speedFrac100] = speedFrac;
  fields[H.fcPaid] = fcOn && paid[PAY_FC]! >= desired[PAY_FC]! ? 1 : 0;
  fields[H.battery100] = battery;
  fields[H.capacitor100] = capacitor;
  fields[H.planPeriod] = options.rulesTurnTicks;
  fields[H.planTicksLeft] = options.rulesTurnTicks;
  fields[H.planTickIndex] = 0;
  fields[H.lsUnpaid] = lifeOn && paid[PAY_LIFE]! < desired[PAY_LIFE]! ? 1 : 0;
  for (let i = 0; i < 6; i++) setFacingBudgetAt(fields, i, facing[i]!);
  for (const mount of mounts) mount.budget100 = 0;
  for (const ask of paidAsks) mounts[ask.slot]!.budget100 = ask.paid;
  remember(fields, VERB_SET_ENERGY, reason, paidTotal);
  writeHull(world, id, fields);
  writeMounts(world, id, mounts);
  emitRule(ctx, id as number, reason, paidTotal);
}

function mountReady(mount: MountMem, def: WeaponDef): boolean {
  if (mount.mode === MODE_OFFLINE) return false;
  if (def.internal === INTERNAL_PHASER) {
    if (def.chargeCost <= 0) return false;
    return mount.charge100 >= scale(def.chargeCost);
  }
  if (heavyFamily(def.internal)) {
    const cost = armCostPoints(def, mount.mode);
    const ticks = armTicksOf(def, mount.mode);
    if (cost <= 0) return false;
    return mount.charge100 >= scale(cost) && mount.ticksCharging >= ticks;
  }
  return false;
}

function shotDamage(
  def: WeaponDef,
  mode: number,
  dx: number,
  dy: number,
  ctx: TickContext,
): { amount: number; unit: number } | undefined {
  if (def.internal === INTERNAL_PHASER) {
    for (const band of def.bands) {
      if (!withinRange(dx, dy, band.maxRange)) continue;
      const unit = band.hundredths === 1 ? ENERGY_SCALE : 1;
      if (band.roll === 1) {
        const span = band.max - band.min + 1;
        return { amount: band.min + ctx.rng.stream('combat').int(span), unit };
      }
      return { amount: band.damage, unit };
    }
    return undefined;
  }
  if (def.internal === INTERNAL_PHOTON && mode === MODE_NORMAL && def.bands.length > 0) {
    for (const band of def.bands) {
      if (!withinRange(dx, dy, band.maxRange)) continue;
      return { amount: band.damage, unit: band.hundredths === 1 ? ENERGY_SCALE : 1 };
    }
    return undefined;
  }
  if (def.internal === INTERNAL_DISRUPTOR) {
    return disruptorShot(def, mode, dx, dy, ctx.rng.stream('combat'));
  }
  if (def.internal === INTERNAL_PHOTON) {
    if (!withinRange(dx, dy, def.maxRange)) return undefined;
    if (mode === MODE_OVERLOAD) return { amount: def.overloadDamage, unit: 1 };
    if (mode === MODE_PROXIMITY) return { amount: def.proxDamage, unit: 1 };
    return { amount: def.directDamage, unit: 1 };
  }
  return undefined;
}

function applyFire(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 3)) throw new Error('fire payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const slotIndex = readI32(cmd.payload, 4);
  const targetId = asEntityId(readU32(cmd.payload, 8));
  const fields = liveFields(world, id);
  if (!fields) {
    emitRule(ctx, id as number, R.noSuchShip, -1);
    return;
  }
  if (fields[H.classCode] === CLASS_FIGHTER) {
    emitRule(ctx, id as number, R.notAShip, -1);
    return;
  }
  if (fields[H.destroyed] === 1) {
    emitRule(ctx, id as number, R.shipDestroyed, -1);
    return;
  }
  if (fields[H.disabled] === 1 || fields[H.crew]! < fields[H.minCrew]!) {
    emitRule(ctx, id as number, R.crewDisabled, -1);
    return;
  }
  const mounts = readMounts(world, id);
  if (slotIndex < 0 || slotIndex >= MOUNT_SLOTS || mounts[slotIndex]!.weaponId === 0) {
    emitRule(ctx, id as number, R.unknownWeaponSlot, -1);
    return;
  }
  const mount = mounts[slotIndex]!;
  const def = weaponDef(mount.weaponId);
  if (!def || (def.internal !== INTERNAL_PHASER && !heavyFamily(def.internal))) {
    emitRule(ctx, id as number, R.notInDuelSlice, -1);
    return;
  }
  if (mount.boxes <= 0) {
    emitRule(ctx, id as number, R.weaponDestroyed, -1);
    return;
  }
  if (mount.mode === MODE_OFFLINE) {
    emitRule(ctx, id as number, R.notCharged, -1);
    return;
  }
  if (!mountReady(mount, def)) {
    emitRule(ctx, id as number, R.notCharged, -1);
    return;
  }
  if (fields[H.fcPaid] !== 1) {
    emitRule(ctx, id as number, R.noFireControl, -1);
    return;
  }
  const cloakBlock = fireBlocked(fields);
  if (cloakBlock !== null) {
    emitRule(ctx, id as number, cloakBlock, -1);
    return;
  }
  const target = liveFields(world, targetId);
  if (!target) {
    emitRule(ctx, id as number, R.noSuchShip, -1);
    return;
  }
  if (target[H.classCode] === CLASS_FIGHTER) {
    emitRule(ctx, id as number, R.notAShip, -1);
    return;
  }
  if (target[H.destroyed] === 1) {
    emitRule(ctx, id as number, R.shipDestroyed, -1);
    return;
  }
  const from = world.position(id);
  const to = world.position(targetId);
  const dx = delta(to.x, from.x);
  const dy = delta(to.y, from.y);
  if (!shotInArc(world.heading(id) as number, dx, dy, mount.arcId, def.omni)) {
    emitRule(ctx, id as number, R.outOfArc, -1);
    return;
  }
  const shotHit = shotDamage(def, mount.mode, dx, dy, ctx);
  if (!shotHit) {
    emitRule(ctx, id as number, R.outOfRange, -1);
    return;
  }
  const damage = shotHit.amount;
  const unit = shotHit.unit;
  if (targetHidden(world, id, targetId, fields, target)) {
    emitRule(ctx, id as number, R.notDetected, -1);
    return;
  }
  mount.charge100 = 0;
  mount.ticksCharging = 0;
  remember(fields, VERB_FIRE, R.ok, damage);
  if (def.internal === INTERNAL_PHOTON) {
    const seq = fields[H.shotSeq]! + 1;
    if (seq <= 0) throw new Error('shot seq');
    fields[H.shotSeq] = seq;
    const shotId = world.alloc('seeker');
    world.setPosition(shotId, from.x, from.y);
    const shot: ShotMem = {
      live: 1,
      owner: id as number,
      target: targetId as number,
      remaining: launchRange(dx, dy),
      speed: fx(def.projectileSpeed) as number,
      damage,
      prox: fx(def.proxRadius) as number,
      mode: mount.mode,
      seq,
      unit,
    };
    writeShot(world, shotId, shot);
    writeMounts(world, id, mounts);
    writeHull(world, id, fields);
    emitRule(ctx, id as number, R.ok, damage);
    return;
  }
  const incoming = relativeBearing(world.heading(targetId) as number, delta(from.x, to.x), delta(from.y, to.y));
  const facing = facingForRelative(incoming);
  const same = (id as number) === (targetId as number);
  const victim = same ? fields : target;
  if (shotMisses(ctx, fields, victim)) {
    remember(fields, VERB_FIRE, R.ewMiss, 0);
    writeMounts(world, id, mounts);
    writeHull(world, id, fields);
    if (!same) writeHull(world, targetId, target);
    emitRule(ctx, id as number, R.ewMiss, 0);
    return;
  }
  const hit = applyWeaponHit(victim, facing, damage, unit, ctx);
  writeMounts(world, id, mounts);
  writeHull(world, id, fields);
  if (!same) writeHull(world, targetId, target);
  emitRule(ctx, id as number, R.ok, damage);
  ctx.emit({ kind: EVENT_HIT, entity: targetId as number, a: facing, b: hit.absorbed });
}

function orderedShotIds(world: World): EntityId[] {
  const ids: EntityId[] = [];
  const owners: number[] = [];
  const seqs: number[] = [];
  for (const id of world.liveIds()) {
    if (world.getFields(id, 'kind')[0] !== ENTITY_KIND.seeker) continue;
    const shot = readShot(world, id);
    if (shot.live !== 1) continue;
    const owner = shot.owner & 0xffff;
    let at = ids.length;
    for (let i = 0; i < ids.length; i++) {
      const earlier = owner < owners[i]! || (owner === owners[i] && (shot.seq >>> 0) < (seqs[i]! >>> 0));
      if (earlier) {
        at = i;
        break;
      }
    }
    ids.splice(at, 0, id);
    owners.splice(at, 0, owner);
    seqs.splice(at, 0, shot.seq);
  }
  return ids;
}

function impactShot(world: World, shot: ShotMem, ctx: TickContext): void {
  const owner = asEntityId(shot.owner);
  const targetId = asEntityId(shot.target);
  if (!world.isLive(owner) || !world.isLive(targetId)) return;
  const target = readHull(world, targetId);
  if (target[H.classCode] === CLASS_FIGHTER || target[H.destroyed] === 1) return;
  const from = world.position(owner);
  const to = world.position(targetId);
  const incoming = relativeBearing(
    world.heading(targetId) as number,
    delta(from.x, to.x),
    delta(from.y, to.y),
  );
  const ownerFields = readHull(world, owner);
  if (shotMisses(ctx, ownerFields, target)) {
    ctx.emit({ kind: EVENT_MISS, entity: targetId as number, a: 0, b: shot.damage });
    return;
  }
  const facing = facingForRelative(incoming);
  const hit = applyWeaponHit(target, facing, shot.damage, shot.unit > 0 ? shot.unit : 1, ctx);
  writeHull(world, targetId, target);
  ctx.emit({ kind: EVENT_HIT, entity: targetId as number, a: facing, b: hit.absorbed });
}

function flyShots(world: World, ctx: TickContext): void {
  const ids = orderedShotIds(world);
  for (const id of ids) {
    const shot = readShot(world, id);
    if (shot.live !== 1) continue;
    const remaining = sub(fxRaw(shot.remaining), fxRaw(shot.speed)) as number;
    const prox = shot.mode === MODE_PROXIMITY && remaining <= shot.prox;
    const direct = shot.mode !== MODE_PROXIMITY && remaining <= 0;
    if (!prox && !direct) {
      shot.remaining = remaining;
      writeShot(world, id, shot);
      continue;
    }
    shot.live = 0;
    shot.remaining = remaining;
    writeShot(world, id, shot);
    world.despawn(id);
    impactShot(world, shot, ctx);
  }
}

function drip(world: World, options: ResolvedOptions): void {
  for (const id of world.liveIds()) {
    if (world.getFields(id, 'kind')[0] === ENTITY_KIND.seeker) continue;
    const fields = readHull(world, id);
    if (fields[H.planTicksLeft]! <= 0) continue;
    const period = fields[H.planPeriod]!;
    const index = fields[H.planTickIndex]!;
    if (period <= 0) continue;
    const mounts = readMounts(world, id);
    for (let facing = 0; facing < 6; facing++) {
      const share = tickShare(facingBudgetAt(fields, facing), index, period);
      const room = shieldMaxAt(fields, facing) - shieldAt(fields, facing);
      let gain = share * options.reinforcePerEnergy;
      if (gain > room) gain = room;
      if (gain < 0) gain = 0;
      setShieldAt(fields, facing, shieldAt(fields, facing) + gain);
    }
    let capacitor = fields[H.capacitor100]!;
    const capMax = capacitorMax(mounts);
    for (const mount of mounts) {
      if (mount.weaponId === 0) continue;
      const share = tickShare(mount.budget100, index, period);
      const def = weaponDef(mount.weaponId);
      if (!def) continue;
      if (mount.budget100 > 0) mount.ticksCharging += 1;
      const cost = armCostPoints(def, mount.mode);
      const cost100 = scale(cost);
      const room = cost100 - mount.charge100;
      const roomPos = room > 0 ? room : 0;
      const toMount = cost <= 0 ? 0 : share < roomPos ? share : roomPos;
      mount.charge100 += toMount;
      const overflow = share - toMount;
      if (overflow > 0 && def.internal === INTERNAL_PHASER) {
        const capRoom = capMax - capacitor;
        const stored = capRoom > 0 ? (overflow < capRoom ? overflow : capRoom) : 0;
        capacitor += stored;
      }
    }
    fields[H.capacitor100] = capacitor;
    fields[H.planTickIndex] = index + 1;
    fields[H.planTicksLeft] = fields[H.planTicksLeft]! - 1;
    if (fields[H.planTicksLeft] === 0) {
      for (const mount of mounts) {
        const def = weaponDef(mount.weaponId);
        if (!def || def.holdCost <= 0 || !heavyFamily(def.internal)) continue;
        const cost = armCostPoints(def, mount.mode);
        const ticks = armTicksOf(def, mount.mode);
        const armed = cost > 0 && mount.charge100 >= scale(cost) && mount.ticksCharging >= ticks;
        if (armed && mount.budget100 < scale(def.holdCost)) {
          mount.charge100 = 0;
          mount.ticksCharging = 0;
        }
      }
    }
    if (fields[H.planTicksLeft] === 0 && fields[H.lsUnpaid] === 1) {
      let crew = fields[H.crew]! - options.crewLoss;
      if (crew < 0) crew = 0;
      fields[H.crew] = crew;
      if (crew < fields[H.minCrew]!) fields[H.disabled] = 1;
      fields[H.lsUnpaid] = 0;
    }
    writeHull(world, id, fields);
    writeMounts(world, id, mounts);
  }
}

export function createCombat(setups: readonly ShipSetup[], options?: CombatOptions): CombatBundle {
  const resolved = resolveOptions(options);
  const allocation: SimSystem = {
    id: 'allocation',
    phase: 'energy',
    priority: 0,
    step(world) {
      drip(world, resolved);
    },
  };
  const flight: SimSystem = {
    id: 'flight',
    phase: 'weapons',
    priority: 0,
    step(world, ctx) {
      flyShots(world, ctx);
    },
  };
  const handlers: CommandHandler[] = [
    {
      kind: VERB_SPAWN,
      apply(world, cmd, ctx) {
        applySpawn(world, cmd, ctx, setups);
      },
    },
    {
      kind: VERB_SET_ENERGY,
      apply(world, cmd, ctx) {
        applySetEnergy(world, cmd, ctx, resolved);
      },
    },
    {
      kind: VERB_SET_SHIELDS,
      apply(world, cmd, ctx) {
        applySetShields(world, cmd, ctx);
      },
    },
    {
      kind: VERB_DAMAGE_SHIELD,
      apply(world, cmd, ctx) {
        applyDamageShield(world, cmd, ctx);
      },
    },
    {
      kind: VERB_FIRE,
      apply(world, cmd, ctx) {
        applyFire(world, cmd, ctx);
      },
    },
  ];
  const phase3 = createPhase3(resolved.rulesTurnTicks);
  return {
    tables: COMBAT_TABLES,
    systems: [allocation, flight, createAccelRamp(), ...phase3.systems],
    handlers: [...handlers, ...phase3.handlers],
  };
}
