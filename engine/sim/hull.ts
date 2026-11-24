/**
 * Per-ship component layout. Every field is an int32 in the world tables,
 * so the sim state hash covers allocation, shields, and mounts.
 */
import type { EntityId } from '../core/brands.ts';
import type { World, WorldSnap } from './world.ts';

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
} as const;

export const HULL_FIELDS = 42;

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
  readonly heading: number;
  readonly mounts: readonly MountMem[];
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
    heading: live && heading ? heading[index]! : 0,
    mounts,
  };
}
