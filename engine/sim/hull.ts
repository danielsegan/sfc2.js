/**
 * Per-ship component layout. Every field is an int32 in the world tables,
 * so the sim state hash covers allocation, shields, mounts, and photon shots.
 */
import type { EntityId } from '../core/brands.ts';
import { ENTITY_KIND, type World, type WorldSnap } from './world.ts';

export const HULL = 'hull';
export const MOUNT = 'mount';
export const MOUNT_SLOTS = 25;
export const MOUNT_STRIDE = 8;

export const H = {
  classCode: 0,
  destroyed: 1,
  disabled: 2,
  fcPaid: 3,
  speed: 4,
  moveCost100: 5,
  turnMode: 6,
  acceleration: 7,
  crew: 8,
  minCrew: 9,
  capacitor100: 10,
  warp100: 11,
  impulse100: 12,
  apr100: 13,
  battery100: 14,
  batteryCapacity100: 15,
  planPeriod: 16,
  planTicksLeft: 17,
  planTickIndex: 18,
  lsUnpaid: 19,
  facing0: 20,
  shield0: 26,
  shieldMax0: 32,
  lastVerb: 38,
  lastReason: 39,
  lastStatus: 40,
  lastApplied: 41,
  armor: 42,
  bridge: 43,
  hullForward: 44,
  hullCenter: 45,
  hullAft: 46,
  sensors: 47,
  extra: 48,
  lastHitFacing: 49,
  lastHitDamage: 50,
  lastHitAbsorbed: 51,
  lastHitPen: 52,
  shotSeq: 53,
  stealth: 54,
  scanners: 55,
  specialSensors: 56,
  ecmPaid: 57,
  eccmPaid: 58,
  cloakCost: 59,
  cloakState: 60,
  cloakTicks: 61,
  cloakNextPay: 62,
  tractors: 63,
  tractorMode: 64,
  tractorTarget: 65,
  tractorPaid: 66,
  tractorLink: 67,
  tractorRest: 68,
  /** -1 means cruise uses ordered speed. A non-negative value replaces it for this tick. */
  speedOverride: 69,
  spottedBy: 70,
  /**
   * Actual speed in hundredths of a speed point.
   * -1 means this hull has no ramp: cruise and the turn curve use ordered speed.
   */
  speedActual100: 71,
  /** Bresenham remainder for the actual-speed ramp. */
  speedRampAcc: 72,
  /** Fractional ordered speed, 0–99 hundredths, added to `speed`. */
  speedFrac100: 73,
  /** Leftover shield hundredths when a hit is not a whole point. Six facings. */
  shieldFrac0: 74,
  /** Leftover penetrating hundredths, promoted to a chart point at 100. */
  damageFrac: 80,
  /** 0 is Red Alert. 1 is Green Alert. */
  alert: 81,
} as const;

export const HULL_FIELDS = 82;

/** One in-flight heavy weapon. Rows live on seeker entities, not on the ship. */
export const SHOT = 'shot';
export const SHOT_FIELDS = 11;

export const S = {
  live: 0,
  owner: 1,
  target: 2,
  remaining: 3,
  speed: 4,
  damage: 5,
  prox: 6,
  mode: 7,
  seq: 8,
  /** 1 = damage is whole points. 100 = damage is hundredths of a point. */
  unit: 9,
  /** Ticks of flight left. 0 means the shot is not on a life clock. */
  life: 10,
} as const;

export const M = {
  weaponId: 0,
  arcId: 1,
  charge100: 2,
  boxes: 3,
  boxesMax: 4,
  mode: 5,
  budget100: 6,
  ticksCharging: 7,
} as const;

export interface HullMem {
  fields: number[];
}

export interface MountMem {
  weaponId: number;
  arcId: number;
  charge100: number;
  boxes: number;
  boxesMax: number;
  mode: number;
  budget100: number;
  ticksCharging: number;
}

export interface ShotMem {
  live: number;
  owner: number;
  target: number;
  remaining: number;
  speed: number;
  damage: number;
  prox: number;
  mode: number;
  seq: number;
  unit: number;
  life: number;
}

export interface ShipSystems {
  armor: number;
  bridge: number;
  hullForward: number;
  hullCenter: number;
  hullAft: number;
  sensors: number;
  extraDamage: number;
}

export interface LastHit {
  facing: number;
  damage: number;
  absorbed: number;
  penetrating: number;
}

export function emptyHull(): number[] {
  const fields: number[] = [];
  for (let i = 0; i < HULL_FIELDS; i++) fields.push(0);
  return fields;
}

export function readHull(world: World, id: EntityId): number[] {
  return world.getFields(id, HULL);
}

export function writeHull(world: World, id: EntityId, fields: readonly number[]): void {
  world.setFields(id, HULL, fields);
}

export function emptyMounts(): MountMem[] {
  const out: MountMem[] = [];
  for (let i = 0; i < MOUNT_SLOTS; i++) {
    out.push({
      weaponId: 0,
      arcId: 0,
      charge100: 0,
      boxes: 0,
      boxesMax: 0,
      mode: 0,
      budget100: 0,
      ticksCharging: 0,
    });
  }
  return out;
}

export function readMounts(world: World, id: EntityId): MountMem[] {
  const raw = world.getFields(id, MOUNT);
  const out = emptyMounts();
  for (let s = 0; s < MOUNT_SLOTS; s++) {
    const b = s * MOUNT_STRIDE;
    const row = out[s]!;
    row.weaponId = raw[b + M.weaponId]!;
    row.arcId = raw[b + M.arcId]!;
    row.charge100 = raw[b + M.charge100]!;
    row.boxes = raw[b + M.boxes]!;
    row.boxesMax = raw[b + M.boxesMax]!;
    row.mode = raw[b + M.mode]!;
    row.budget100 = raw[b + M.budget100]!;
    row.ticksCharging = raw[b + M.ticksCharging]!;
  }
  return out;
}

export function readShot(world: World, id: EntityId): ShotMem {
  const raw = world.getFields(id, SHOT);
  return {
    live: raw[S.live]!,
    owner: raw[S.owner]!,
    target: raw[S.target]!,
    remaining: raw[S.remaining]!,
    speed: raw[S.speed]!,
    damage: raw[S.damage]!,
    prox: raw[S.prox]!,
    mode: raw[S.mode]!,
    seq: raw[S.seq]!,
    unit: raw[S.unit]! > 0 ? raw[S.unit]! : 1,
    life: raw[S.life] ?? 0,
  };
}

export function writeShot(world: World, id: EntityId, shot: ShotMem): void {
  world.setFields(id, SHOT, [
    shot.live,
    shot.owner,
    shot.target,
    shot.remaining,
    shot.speed,
    shot.damage,
    shot.prox,
    shot.mode,
    shot.seq,
    shot.unit > 0 ? shot.unit : 1,
    shot.life > 0 ? shot.life : 0,
  ]);
}

export function writeMounts(world: World, id: EntityId, mounts: readonly MountMem[]): void {
  const raw: number[] = [];
  for (let s = 0; s < MOUNT_SLOTS; s++) {
    const row = mounts[s]!;
    raw.push(
      row.weaponId,
      row.arcId,
      row.charge100,
      row.boxes,
      row.boxesMax,
      row.mode,
      row.budget100,
      row.ticksCharging,
    );
  }
  world.setFields(id, MOUNT, raw);
}

export function shieldAt(fields: readonly number[], facing: number): number {
  return fields[H.shield0 + facing]!;
}

export function setShieldAt(fields: number[], facing: number, value: number): void {
  fields[H.shield0 + facing] = value | 0;
}

export function shieldMaxAt(fields: readonly number[], facing: number): number {
  return fields[H.shieldMax0 + facing]!;
}

export function facingBudgetAt(fields: readonly number[], facing: number): number {
  return fields[H.facing0 + facing]!;
}

export function setFacingBudgetAt(fields: number[], facing: number, value: number): void {
  fields[H.facing0 + facing] = value | 0;
}

function tableData(snap: WorldSnap, id: string): readonly number[] | undefined {
  for (const table of snap.tables) {
    if (table.id === id) return table.data;
  }
  return undefined;
}

export interface ShipView {
  readonly live: boolean;
  readonly classCode: number;
  readonly destroyed: number;
  readonly disabled: number;
  readonly fcPaid: number;
  readonly speed: number;
  readonly moveCost100: number;
  readonly turnMode: number;
  readonly acceleration: number;
  readonly crew: number;
  readonly minCrew: number;
  readonly capacitor100: number;
  readonly warp100: number;
  readonly impulse100: number;
  readonly apr100: number;
  readonly battery100: number;
  readonly batteryCapacity100: number;
  readonly shields: readonly number[];
  readonly shieldsMax: readonly number[];
  readonly facingBudget: readonly number[];
  readonly lastVerb: number;
  readonly lastReason: number;
  readonly lastStatus: number;
  readonly lastApplied: number;
  readonly systems: ShipSystems;
  readonly lastHit: LastHit;
  readonly heading: number;
  readonly mounts: readonly MountMem[];
  readonly stealth: number;
  readonly scanners: number;
  readonly specialSensors: number;
  readonly ecmPaid: number;
  readonly eccmPaid: number;
  readonly cloakCost: number;
  readonly cloakState: number;
  readonly cloakTicks: number;
  readonly tractors: number;
  readonly tractorMode: number;
  readonly tractorTarget: number;
  readonly tractorPaid: number;
  readonly tractorLink: number;
  readonly speedOverride: number;
  readonly spottedBy: number;
  readonly speedActual100: number;
  readonly speedFrac100: number;
}

export function shipView(snap: WorldSnap, index: number): ShipView {
  const live = snap.live[index] === 1;
  const hull = tableData(snap, HULL);
  const mount = tableData(snap, MOUNT);
  const heading = tableData(snap, 'heading');
  const base = index * HULL_FIELDS;
  const fields: number[] = [];
  for (let i = 0; i < HULL_FIELDS; i++) fields.push(live && hull ? hull[base + i]! : 0);
  const shields: number[] = [];
  const shieldsMax: number[] = [];
  const facingBudget: number[] = [];
  for (let i = 0; i < 6; i++) {
    shields.push(fields[H.shield0 + i]!);
    shieldsMax.push(fields[H.shieldMax0 + i]!);
    facingBudget.push(fields[H.facing0 + i]!);
  }
  const mounts = emptyMounts();
  if (live && mount) {
    const mbase = index * MOUNT_SLOTS * MOUNT_STRIDE;
    for (let s = 0; s < MOUNT_SLOTS; s++) {
      const b = mbase + s * MOUNT_STRIDE;
      const row = mounts[s]!;
      row.weaponId = mount[b + M.weaponId]!;
      row.arcId = mount[b + M.arcId]!;
      row.charge100 = mount[b + M.charge100]!;
      row.boxes = mount[b + M.boxes]!;
      row.boxesMax = mount[b + M.boxesMax]!;
      row.mode = mount[b + M.mode]!;
      row.budget100 = mount[b + M.budget100]!;
      row.ticksCharging = mount[b + M.ticksCharging]!;
    }
  }
  return {
    live,
    classCode: fields[H.classCode]!,
    destroyed: fields[H.destroyed]!,
    disabled: fields[H.disabled]!,
    fcPaid: fields[H.fcPaid]!,
    speed: fields[H.speed]!,
    moveCost100: fields[H.moveCost100]!,
    turnMode: fields[H.turnMode]!,
    acceleration: fields[H.acceleration]!,
    crew: fields[H.crew]!,
    minCrew: fields[H.minCrew]!,
    capacitor100: fields[H.capacitor100]!,
    warp100: fields[H.warp100]!,
    impulse100: fields[H.impulse100]!,
    apr100: fields[H.apr100]!,
    battery100: fields[H.battery100]!,
    batteryCapacity100: fields[H.batteryCapacity100]!,
    shields,
    shieldsMax,
    facingBudget,
    lastVerb: fields[H.lastVerb]!,
    lastReason: fields[H.lastReason]!,
    lastStatus: fields[H.lastStatus]!,
    lastApplied: fields[H.lastApplied]!,
    systems: {
      armor: fields[H.armor]!,
      bridge: fields[H.bridge]!,
      hullForward: fields[H.hullForward]!,
      hullCenter: fields[H.hullCenter]!,
      hullAft: fields[H.hullAft]!,
      sensors: fields[H.sensors]!,
      extraDamage: fields[H.extra]!,
    },
    lastHit: {
      facing: fields[H.lastHitFacing]!,
      damage: fields[H.lastHitDamage]!,
      absorbed: fields[H.lastHitAbsorbed]!,
      penetrating: fields[H.lastHitPen]!,
    },
    heading: live && heading ? heading[index]! : 0,
    mounts,
    stealth: fields[H.stealth]!,
    scanners: fields[H.scanners]!,
    specialSensors: fields[H.specialSensors]!,
    ecmPaid: fields[H.ecmPaid]!,
    eccmPaid: fields[H.eccmPaid]!,
    cloakCost: fields[H.cloakCost]!,
    cloakState: fields[H.cloakState]!,
    cloakTicks: fields[H.cloakTicks]!,
    tractors: fields[H.tractors]!,
    tractorMode: fields[H.tractorMode]!,
    tractorTarget: fields[H.tractorTarget]!,
    tractorPaid: fields[H.tractorPaid]!,
    tractorLink: fields[H.tractorLink]!,
    speedOverride: fields[H.speedOverride]!,
    spottedBy: fields[H.spottedBy]!,
    speedActual100: fields[H.speedActual100]!,
    speedFrac100: fields[H.speedFrac100]!,
  };
}

function shotFrom(raw: readonly number[], base: number): ShotMem {
  return {
    live: raw[base + S.live]!,
    owner: raw[base + S.owner]!,
    target: raw[base + S.target]!,
    remaining: raw[base + S.remaining]!,
    speed: raw[base + S.speed]!,
    damage: raw[base + S.damage]!,
    prox: raw[base + S.prox]!,
    mode: raw[base + S.mode]!,
    seq: raw[base + S.seq]!,
    unit: raw[base + S.unit]! > 0 ? raw[base + S.unit]! : 1,
    life: raw[base + S.life] ?? 0,
  };
}

/** In-flight seekers, in ascending entity index. Detonated shots are already freed. */
export function liveShots(snap: WorldSnap): ShotMem[] {
  const kind = tableData(snap, 'kind');
  const shot = tableData(snap, SHOT);
  const out: ShotMem[] = [];
  if (!kind || !shot) return out;
  for (let i = 0; i < snap.live.length; i++) {
    if (snap.live[i] !== 1) continue;
    if (kind[i] !== ENTITY_KIND.seeker) continue;
    out.push(shotFrom(shot, i * SHOT_FIELDS));
  }
  return out;
}
