/**
 * Fighters, PFs, mines, and boarding raids.
 *
 * Commands apply in the input phase. Fighter and recovering-PF steering
 * runs in AI/mission, before cruise. Mines, strikes, docking, and rearm
 * run in weapons, after cruise, so a craft can arrive and dock on the
 * same tick.
 *
 * Fighter steering does not draw a stream. Raid dice use the combat stream,
 * attack die then defense die. Rejected commands do not draw.
 *
 * Numbers come from docs/rules/data/smallcraft.json. They are synthetic.
 */
import { angle16, atan2_16, shortestArc } from '../core/angle.ts';
import { asEntityId, type EntityId } from '../core/brands.ts';
import { writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import { cmpI64, delta, distSq, type Fx } from '../core/fx.ts';
import type { Ftrlist, FtrlistRow } from '../../tools/formats/ftrlist.ts';
import spec from '../../docs/rules/data/smallcraft.json' with { type: 'json' };
import { facingForRelative, relativeBearing, withinRange } from './arcs.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import {
  EVENT_HIT,
  EVENT_RULE,
  EVENT_SPAWN,
  R,
  placeSetup,
} from './combat.ts';
import {
  H,
  HULL_FIELDS,
  emptyMounts,
  readHull,
  setShieldAt,
  shieldAt,
  writeHull,
  writeMounts,
} from './hull.ts';
import {
  CLASS_FIGHTER,
  CLASS_PF,
  FALLBACK_YAW_PER_TICK,
  TURN_H,
  TURN_TEST_A,
  TURN_TEST_C,
  TURN_UNVERIFIED,
  arcId,
  weaponId,
} from './rules-tables.ts';
import type { CommandHandler, SimSystem, TickContext } from './sim.ts';
import { ENTITY_KIND, type TableSpec, type World, type WorldSnap } from './world.ts';

function take(name: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(name);
  return value;
}

export const BAY_COUNT = take('bayCount', spec.bayCount, 1, 8);
export const REARM_TICKS = take('rearmTicks', spec.rearmTicks, 1, 100000);
export const ENDURANCE_TICKS = take('enduranceTicks', spec.enduranceTicks, 1, 100000);
export const FIGHTER_YAW = take('fighterYawPerTick', spec.fighterYawPerTick, 0, 32767);
export const STRIKE_RANGE = take('strikeRange', spec.strikeRange, 0, 8192);
export const STRIKE_DAMAGE = take('strikeDamage', spec.strikeDamage, 0, 100000);
export const STRIKE_PERIOD = take('strikePeriod', spec.strikePeriod, 1, 100000);
export const DOCK_RANGE = take('dockRange', spec.dockRange, 0, 8192);
export const PF_RECOVER_SPEED = take('pfRecoverSpeed', spec.pfRecoverSpeed, 0, 32);
export const MINE_ARM_TICKS = take('mineArmTicks', spec.mineArmTicks, 1, 100000);
export const MINE_DETECT_RANGE = take('mineDetectRange', spec.mineDetectRange, 0, 8192);
export const MINE_BLAST_RANGE = take('mineBlastRange', spec.mineBlastRange, 0, 8192);
export const MINE_DAMAGE = take('mineDamage', spec.mineDamage, 0, 100000);
export const TRANSPORTER_RANGE = take('transporterRange', spec.transporterRange, 0, 8192);

export const CRAFT = 'craft';
export const BAY = 'bay';

export const C = {
  side: 0,
  sideSet: 1,
  role: 2,
  owner: 3,
  state: 4,
  hp: 5,
  timer: 6,
  typeId: 7,
  bay: 8,
  strikeWait: 9,
  mines: 10,
  boarding: 11,
  security: 12,
  detected: 13,
} as const;

export const CRAFT_FIELDS = 14;

export const BAY_STRIDE = 5;
export const B = {
  kind: 0,
  type: 1,
  ready: 2,
  queue: 3,
  left: 4,
} as const;

export const BAY_FIELDS = BAY_COUNT * BAY_STRIDE;

export const ROLE_FIGHTER = 1;
export const ROLE_MINE = 2;
export const ROLE_PF = 3;

export const STATE_OUT = 1;
export const STATE_RETURN = 2;
const STATE_ARMING = 1;
const STATE_ARMED = 2;

const BAY_NONE = 0;
export const BAY_FIGHTER = 1;
export const BAY_PF = 2;

const RAID_HIT_AND_RUN = 0;
const RAID_BOARDING = 1;

/** Verbs 7–19 are left for other Phase 3 systems. Helm is 6. Combat is 1–5. */
export const VERB_SET_SIDE = 20;
export const VERB_SET_STORES = 21;
export const VERB_SET_BAY = 22;
export const VERB_LAUNCH_FIGHTER = 23;
export const VERB_RECALL = 24;
export const VERB_LAUNCH_PF = 25;
export const VERB_LAY_MINE = 26;
export const VERB_RAID = 27;

export const EVENT_CRAFT = 17;
export const EVENT_CRAFT_NOTE = 18;

export const NOTE_LAUNCHED = 1;
export const NOTE_DOCKED = 2;
export const NOTE_ARMED = 3;
export const NOTE_DETECTED = 4;
export const NOTE_DETONATED = 5;
export const NOTE_STRIKE = 6;
export const NOTE_REARMED = 7;

export const NOTE_NAME = [
  '',
  'launched',
  'docked',
  'mineArmed',
  'mineDetected',
  'mineDetonated',
  'fighterStrike',
  'rearmed',
] as const;

export const CR = {
  ok: 0,
  noSuchShip: 1,
  shipDestroyed: 2,
  notAShip: 3,
  negativeValue: 4,
  bayEmpty: 5,
  badBay: 6,
  unknownCraft: 7,
  noMines: 8,
  outOfRange: 9,
  noParties: 10,
  sameSide: 11,
  badRaid: 12,
  raidRepulsed: 13,
  boardingRepulsed: 14,
} as const;

export const CRAFT_REASON = [
  'ok',
  'noSuchShip',
  'shipDestroyed',
  'notAShip',
  'negativeValue',
  'bayEmpty',
  'badBay',
  'unknownCraft',
  'noMines',
  'outOfRange',
  'noParties',
  'sameSide',
  'badRaid',
  'raidRepulsed',
  'boardingRepulsed',
] as const;

export interface FighterType {
  readonly key: string;
  readonly race: string;
  readonly typeName: string;
  readonly speed: number;
  readonly damage: number;
  readonly weapon: string;
  readonly arc: string;
  readonly load: number;
}

export interface SmallcraftOptions {
  readonly fighters: readonly FighterType[];
  readonly setups: readonly ShipSetup[];
}

export interface SmallcraftBundle {
  readonly tables: readonly TableSpec[];
  readonly systems: readonly SimSystem[];
  readonly handlers: readonly CommandHandler[];
}

export interface CraftReadout {
  readonly side: number;
  readonly fighterReady: number;
  readonly pfReady: number;
  readonly rearming: number;
  readonly mines: number;
  readonly boarding: number;
  readonly security: number;
}

const FIELD_RACE = ['Race', 'race'];
const FIELD_TYPE = ['Type', 'type', 'Type Name', 'type name'];
const FIELD_SPEED = ['Speed', 'speed'];
const FIELD_DAMAGE = ['Damage', 'damage'];

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

function need(buf: Uint8Array, count: number): boolean {
  return buf.length >= count * 4;
}

export function setSidePayload(entity: number, side: number): Uint8Array {
  return words([entity, side]);
}

export function setStoresPayload(entity: number, mines: number, boarding: number, security: number): Uint8Array {
  return words([entity, mines, boarding, security]);
}

export function setBayPayload(entity: number, bay: number, kind: number, type: number, count: number): Uint8Array {
  return words([entity, bay, kind, type, count]);
}

export function launchFighterPayload(entity: number, bay: number): Uint8Array {
  return words([entity, bay]);
}

export function recallPayload(entity: number): Uint8Array {
  return words([entity]);
}

export function launchPfPayload(entity: number, bay: number): Uint8Array {
  return words([entity, bay]);
}

export function layMinePayload(entity: number): Uint8Array {
  return words([entity]);
}

export function raidPayload(entity: number, target: number, mode: number, commit: number): Uint8Array {
  return words([entity, target, mode, commit]);
}

function readField(row: FtrlistRow, names: readonly string[]): string | number | undefined {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row.fields, name)) return row.fields[name];
  }
  return undefined;
}

function textOf(value: string | number | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** Empty is 0. A non-integer or a negative drops the row. */
function wholeOf(value: string | number | undefined): number | null {
  if (value === undefined) return 0;
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value) || value < 0 || value > 1000000) return null;
  return value;
}

/**
 * Bind parser output to the integer catalog launch uses.
 * The first `race:type` key wins. A bad speed or damage skips that row.
 */
export function bindFtrlist(list: Ftrlist): FighterType[] {
  const out: FighterType[] = [];
  for (const row of list.rows) {
    const race = textOf(readField(row, FIELD_RACE));
    const typeName = textOf(readField(row, FIELD_TYPE));
    if (typeName.length === 0) continue;
    const speed = wholeOf(readField(row, FIELD_SPEED));
    const damage = wholeOf(readField(row, FIELD_DAMAGE));
    if (speed === null || damage === null) continue;
    const key = `${race}:${typeName}`;
    let seen = false;
    for (const prev of out) {
      if (prev.key === key) seen = true;
    }
    if (seen) continue;
    let weapon = '';
    let arc = '';
    let load = 0;
    for (const group of row.weapons) {
      if (group.weapon == null || group.weapon.length === 0) continue;
      weapon = group.weapon;
      arc = group.arc ?? '';
      load = group.load != null && Number.isInteger(group.load) && group.load >= 0 ? group.load : 0;
      break;
    }
    out.push({ key, race, typeName, speed, damage, weapon, arc, load });
  }
  return out;
}

function readCraft(world: World, id: EntityId): number[] {
  return world.getFields(id, CRAFT);
}

function writeCraft(world: World, id: EntityId, row: readonly number[]): void {
  world.setFields(id, CRAFT, row);
}

function readBays(world: World, id: EntityId): number[] {
  return world.getFields(id, BAY);
}

function writeBays(world: World, id: EntityId, row: readonly number[]): void {
  world.setFields(id, BAY, row);
}

function bayAt(row: number[], index: number): number[] {
  const base = index * BAY_STRIDE;
  return [
    row[base + B.kind]!,
    row[base + B.type]!,
    row[base + B.ready]!,
    row[base + B.queue]!,
    row[base + B.left]!,
  ];
}

function putBay(row: number[], index: number, bay: readonly number[]): void {
  const base = index * BAY_STRIDE;
  row[base + B.kind] = bay[0]!;
  row[base + B.type] = bay[1]!;
  row[base + B.ready] = bay[2]!;
  row[base + B.queue] = bay[3]!;
  row[base + B.left] = bay[4]!;
}

function emitCraft(ctx: TickContext, entity: number, reason: number, applied: number): void {
  ctx.emit({ kind: EVENT_CRAFT, entity, a: reason, b: applied });
}

function emitNote(ctx: TickContext, entity: number, note: number, value: number): void {
  ctx.emit({ kind: EVENT_CRAFT_NOTE, entity, a: note, b: value });
}

function blankCraft(): number[] {
  const row: number[] = [];
  for (let i = 0; i < CRAFT_FIELDS; i++) row.push(0);
  return row;
}

function carrierRow(world: World, id: EntityId, ctx: TickContext): number[] | null {
  if (!world.isLive(id)) {
    emitCraft(ctx, id as number, CR.noSuchShip, -1);
    return null;
  }
  const fields = readHull(world, id);
  if (fields[H.classCode] === CLASS_FIGHTER || fields[H.classCode] === 0) {
    emitCraft(ctx, id as number, CR.notAShip, -1);
    return null;
  }
  if (fields[H.destroyed] === 1) {
    emitCraft(ctx, id as number, CR.shipDestroyed, -1);
    return null;
  }
  return readCraft(world, id);
}

function setSpeed(world: World, id: EntityId, speed: number): void {
  const fields = readHull(world, id);
  fields[H.speed] = speed;
  writeHull(world, id, fields);
}

function yawCap(mode: number): number {
  if (mode === TURN_TEST_A) return 8000;
  if (mode === TURN_H) return 0;
  if (mode === TURN_TEST_C || mode === TURN_UNVERIFIED) return FALLBACK_YAW_PER_TICK;
  return FALLBACK_YAW_PER_TICK;
}

function steer(world: World, id: EntityId, targetX: Fx, targetY: Fx, speed: number, cap: number): void {
  const pos = world.position(id);
  const dx = delta(targetX, pos.x);
  const dy = delta(targetY, pos.y);
  const heading = world.heading(id);
  const desired = atan2_16(dy, dx);
  let yaw = shortestArc(heading, desired);
  if (yaw > cap) yaw = cap;
  if (yaw < -cap) yaw = -cap;
  world.setHeading(id, angle16((heading as number) + yaw));
  setSpeed(world, id, speed);
}

function separated(world: World, a: EntityId, b: EntityId): { dx: number; dy: number } {
  const pa = world.position(a);
  const pb = world.position(b);
  return { dx: delta(pb.x, pa.x), dy: delta(pb.y, pa.y) };
}

function hostile(world: World, id: EntityId, side: number): boolean {
  if (!world.isLive(id)) return false;
  const kind = world.getFields(id, 'kind')[0]!;
  if (kind !== ENTITY_KIND.ship) return false;
  const fields = readHull(world, id);
  if (fields[H.destroyed] === 1 || fields[H.classCode] === 0 || fields[H.classCode] === CLASS_FIGHTER) return false;
  const row = readCraft(world, id);
  return row[C.sideSet] === 1 && row[C.side] !== side;
}

function nearestHostile(world: World, self: EntityId, side: number): EntityId | null {
  let best: EntityId | null = null;
  let bestD = distSq(0, 0);
  const origin = world.position(self);
  for (const id of world.liveIds()) {
    if ((id as number) === (self as number)) continue;
    if (!hostile(world, id, side)) continue;
    const pos = world.position(id);
    const d2 = distSq(delta(pos.x, origin.x), delta(pos.y, origin.y));
    if (best === null || cmpI64(d2, bestD) < 0) {
      best = id;
      bestD = d2;
    }
  }
  return best;
}

function blastVictim(world: World, mine: EntityId, owner: number): EntityId | null {
  let best: EntityId | null = null;
  let bestD = distSq(0, 0);
  const origin = world.position(mine);
  for (const id of world.liveIds()) {
    if ((id as number) === owner) continue;
    const kind = world.getFields(id, 'kind')[0]!;
    if (kind !== ENTITY_KIND.ship && kind !== ENTITY_KIND.fighter) continue;
    const fields = readHull(world, id);
    if (fields[H.destroyed] === 1 || fields[H.classCode] === 0) continue;
    const pos = world.position(id);
    const dx = delta(pos.x, origin.x);
    const dy = delta(pos.y, origin.y);
    if (!withinRange(dx, dy, MINE_BLAST_RANGE)) continue;
    const d2 = distSq(dx, dy);
    if (best === null || cmpI64(d2, bestD) < 0) {
      best = id;
      bestD = d2;
    }
  }
  return best;
}

function detector(world: World, mine: EntityId, side: number): EntityId | null {
  const origin = world.position(mine);
  for (const id of world.liveIds()) {
    const kind = world.getFields(id, 'kind')[0]!;
    if (kind !== ENTITY_KIND.ship && kind !== ENTITY_KIND.fighter) continue;
    const fields = readHull(world, id);
    if (fields[H.classCode] === 0 || fields[H.destroyed] === 1) continue;
    const row = readCraft(world, id);
    if (row[C.sideSet] !== 1 || row[C.side] === side) continue;
    const pos = world.position(id);
    const dx = delta(pos.x, origin.x);
    const dy = delta(pos.y, origin.y);
    if (withinRange(dx, dy, MINE_DETECT_RANGE)) return id;
  }
  return null;
}

function chipFacing(world: World, target: EntityId, fromX: Fx, fromY: Fx, points: number): { applied: number; facing: number; absorbed: number } {
  const fields = readHull(world, target);
  if (fields[H.classCode] === CLASS_FIGHTER) {
    const row = readCraft(world, target);
    const hp = row[C.hp]!;
    const take = hp < points ? hp : points;
    row[C.hp] = hp - take;
    writeCraft(world, target, row);
    if (row[C.hp]! <= 0) world.despawn(target);
    return { applied: take, facing: 0, absorbed: 0 };
  }
  const pos = world.position(target);
  const dx = delta(fromX, pos.x);
  const dy = delta(fromY, pos.y);
  const facing = facingForRelative(relativeBearing(world.heading(target) as number, dx, dy));
  const current = shieldAt(fields, facing);
  const absorbed = current < points ? current : points;
  setShieldAt(fields, facing, current - absorbed);
  let left = points - absorbed;
  const armor = fields[H.armor]!;
  const armorTake = armor < left ? armor : left;
  fields[H.armor] = armor - armorTake;
  left -= armorTake;
  const extra = fields[H.extra]!;
  const extraTake = extra < left ? extra : left;
  fields[H.extra] = extra - extraTake;
  left -= extraTake;
  fields[H.lastHitFacing] = facing;
  fields[H.lastHitDamage] = points;
  fields[H.lastHitAbsorbed] = absorbed;
  fields[H.lastHitPen] = points - absorbed;
  writeHull(world, target, fields);
  return { applied: points - left, facing, absorbed };
}

function chipBox(fields: number[]): number {
  const order = [H.sensors, H.bridge, H.extra];
  for (const index of order) {
    const boxes = fields[index]!;
    if (boxes > 0) {
      fields[index] = boxes - 1;
      return 1;
    }
  }
  return 0;
}

function launchFighter(
  world: World,
  carrier: EntityId,
  bayIndex: number,
  fighters: readonly FighterType[],
  ctx: TickContext,
): void {
  const craft = carrierRow(world, carrier, ctx);
  if (!craft) return;
  if (bayIndex < 0 || bayIndex >= BAY_COUNT) {
    emitCraft(ctx, carrier as number, CR.badBay, -1);
    return;
  }
  const bays = readBays(world, carrier);
  const bay = bayAt(bays, bayIndex);
  if (bay[0] !== BAY_FIGHTER || bay[2]! <= 0) {
    emitCraft(ctx, carrier as number, CR.bayEmpty, -1);
    return;
  }
  const type = fighters[bay[1]!];
  if (!type) {
    emitCraft(ctx, carrier as number, CR.unknownCraft, -1);
    return;
  }
  bay[2] = bay[2]! - 1;
  putBay(bays, bayIndex, bay);
  writeBays(world, carrier, bays);
  const id = world.alloc('fighter');
  const fields: number[] = [];
  for (let i = 0; i < HULL_FIELDS; i++) fields.push(0);
  fields[H.classCode] = CLASS_FIGHTER;
  fields[H.turnMode] = TURN_TEST_A;
  fields[H.speedOverride] = -1;
  fields[H.acceleration] = type.speed;
  fields[H.crew] = 1;
  fields[H.lastHitFacing] = -1;
  const mounts = emptyMounts();
  const wid = type.weapon.length > 0 ? weaponId(type.weapon) : 0;
  if (wid !== 0) {
    const mount = mounts[0]!;
    mount.weaponId = wid;
    mount.arcId = type.arc.length > 0 ? arcId(type.arc) : 0;
    mount.boxes = type.load > 0 ? type.load : 1;
    mount.boxesMax = mount.boxes;
  }
  const pos = world.position(carrier);
  world.setPosition(id, pos.x, pos.y);
  world.setHeading(id, world.heading(carrier));
  writeHull(world, id, fields);
  writeMounts(world, id, mounts);
  const row = blankCraft();
  row[C.side] = craft[C.side]!;
  row[C.sideSet] = craft[C.sideSet]!;
  row[C.role] = ROLE_FIGHTER;
  row[C.owner] = carrier as number;
  row[C.state] = STATE_OUT;
  row[C.hp] = type.damage > 0 ? type.damage : 1;
  row[C.timer] = ENDURANCE_TICKS;
  row[C.typeId] = bay[1]!;
  row[C.bay] = bayIndex;
  writeCraft(world, id, row);
  ctx.emit({ kind: EVENT_SPAWN, entity: id as number, a: bay[1]!, b: 1 });
  emitCraft(ctx, id as number, CR.ok, 1);
  emitNote(ctx, id as number, NOTE_LAUNCHED, carrier as number);
}

function launchPf(
  world: World,
  carrier: EntityId,
  bayIndex: number,
  setups: readonly ShipSetup[],
  ctx: TickContext,
): void {
  const craft = carrierRow(world, carrier, ctx);
  if (!craft) return;
  if (bayIndex < 0 || bayIndex >= BAY_COUNT) {
    emitCraft(ctx, carrier as number, CR.badBay, -1);
    return;
  }
  const bays = readBays(world, carrier);
  const bay = bayAt(bays, bayIndex);
  if (bay[0] !== BAY_PF || bay[2]! <= 0) {
    emitCraft(ctx, carrier as number, CR.bayEmpty, -1);
    return;
  }
  const setup = setups[bay[1]!];
  if (!setup || setup.classCode !== CLASS_PF) {
    emitCraft(ctx, carrier as number, CR.unknownCraft, -1);
    return;
  }
  bay[2] = bay[2]! - 1;
  putBay(bays, bayIndex, bay);
  writeBays(world, carrier, bays);
  const heading = world.heading(carrier) as number;
  const id = placeSetup(world, setup, 0, 0, heading);
  const pos = world.position(carrier);
  world.setPosition(id, pos.x, pos.y);
  world.setHeading(id, world.heading(carrier));
  const row = readCraft(world, id);
  row[C.side] = craft[C.side]!;
  row[C.sideSet] = craft[C.sideSet]!;
  row[C.role] = ROLE_PF;
  row[C.owner] = carrier as number;
  row[C.state] = STATE_OUT;
  row[C.typeId] = bay[1]!;
  row[C.bay] = bayIndex;
  writeCraft(world, id, row);
  ctx.emit({ kind: EVENT_SPAWN, entity: id as number, a: bay[1]!, b: 2 });
  if (setup.turnMode === TURN_UNVERIFIED) {
    ctx.emit({ kind: EVENT_RULE, entity: id as number, a: R.turnModeUnverified, b: FALLBACK_YAW_PER_TICK });
  }
  emitCraft(ctx, id as number, CR.ok, 1);
  emitNote(ctx, id as number, NOTE_LAUNCHED, carrier as number);
}

function applySetSide(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 2)) throw new Error('side payload');
  const id = asEntityId(readI32(cmd.payload, 0));
  const side = readI32(cmd.payload, 4);
  const craft = carrierRow(world, id, ctx);
  if (!craft) return;
  if (side !== 0 && side !== 1) {
    emitCraft(ctx, id as number, CR.badBay, -1);
    return;
  }
  craft[C.side] = side;
  craft[C.sideSet] = 1;
  writeCraft(world, id, craft);
  emitCraft(ctx, id as number, CR.ok, side);
}

function applySetStores(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 4)) throw new Error('stores payload');
  const id = asEntityId(readI32(cmd.payload, 0));
  const mines = readI32(cmd.payload, 4);
  const boarding = readI32(cmd.payload, 8);
  const security = readI32(cmd.payload, 12);
  const craft = carrierRow(world, id, ctx);
  if (!craft) return;
  if (mines < 0 || boarding < 0 || security < 0) {
    emitCraft(ctx, id as number, CR.negativeValue, -1);
    return;
  }
  craft[C.mines] = mines;
  craft[C.boarding] = boarding;
  craft[C.security] = security;
  writeCraft(world, id, craft);
  emitCraft(ctx, id as number, CR.ok, mines + boarding);
}

function applySetBay(
  world: World,
  cmd: Command,
  ctx: TickContext,
  fighters: readonly FighterType[],
  setups: readonly ShipSetup[],
): void {
  if (!need(cmd.payload, 5)) throw new Error('bay payload');
  const id = asEntityId(readI32(cmd.payload, 0));
  const bayIndex = readI32(cmd.payload, 4);
  const kind = readI32(cmd.payload, 8);
  const type = readI32(cmd.payload, 12);
  const count = readI32(cmd.payload, 16);
  if (!carrierRow(world, id, ctx)) return;
  if (bayIndex < 0 || bayIndex >= BAY_COUNT) {
    emitCraft(ctx, id as number, CR.badBay, -1);
    return;
  }
  if (count < 0) {
    emitCraft(ctx, id as number, CR.negativeValue, -1);
    return;
  }
  if (kind !== BAY_NONE && kind !== BAY_FIGHTER && kind !== BAY_PF) {
    emitCraft(ctx, id as number, CR.badBay, -1);
    return;
  }
  if (kind === BAY_FIGHTER && !fighters[type]) {
    emitCraft(ctx, id as number, CR.unknownCraft, -1);
    return;
  }
  if (kind === BAY_PF) {
    const setup = setups[type];
    if (!setup || setup.classCode !== CLASS_PF) {
      emitCraft(ctx, id as number, CR.unknownCraft, -1);
      return;
    }
  }
  const bays = readBays(world, id);
  const bay = bayAt(bays, bayIndex);
  bay[0] = kind === BAY_NONE ? BAY_NONE : kind;
  bay[1] = kind === BAY_NONE ? 0 : type;
  bay[2] = kind === BAY_NONE ? 0 : count;
  bay[3] = 0;
  bay[4] = 0;
  putBay(bays, bayIndex, bay);
  writeBays(world, id, bays);
  emitCraft(ctx, id as number, CR.ok, count);
}

function applyLaunchFighter(world: World, cmd: Command, ctx: TickContext, fighters: readonly FighterType[]): void {
  if (!need(cmd.payload, 2)) throw new Error('launch payload');
  launchFighter(world, asEntityId(readI32(cmd.payload, 0)), readI32(cmd.payload, 4), fighters, ctx);
}

function applyRecall(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 1)) throw new Error('recall payload');
  const id = asEntityId(readI32(cmd.payload, 0));
  if (!world.isLive(id)) {
    emitCraft(ctx, id as number, CR.noSuchShip, -1);
    return;
  }
  const row = readCraft(world, id);
  if (row[C.role] !== ROLE_FIGHTER && row[C.role] !== ROLE_PF) {
    emitCraft(ctx, id as number, CR.unknownCraft, -1);
    return;
  }
  const fields = readHull(world, id);
  if (fields[H.destroyed] === 1) {
    emitCraft(ctx, id as number, CR.shipDestroyed, -1);
    return;
  }
  row[C.state] = STATE_RETURN;
  writeCraft(world, id, row);
  emitCraft(ctx, id as number, CR.ok, 1);
}

function applyLaunchPf(world: World, cmd: Command, ctx: TickContext, setups: readonly ShipSetup[]): void {
  if (!need(cmd.payload, 2)) throw new Error('launch payload');
  launchPf(world, asEntityId(readI32(cmd.payload, 0)), readI32(cmd.payload, 4), setups, ctx);
}

function applyLayMine(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 1)) throw new Error('mine payload');
  const id = asEntityId(readI32(cmd.payload, 0));
  const craft = carrierRow(world, id, ctx);
  if (!craft) return;
  if (craft[C.mines]! <= 0) {
    emitCraft(ctx, id as number, CR.noMines, -1);
    return;
  }
  craft[C.mines] = craft[C.mines]! - 1;
  writeCraft(world, id, craft);
  const mine = world.alloc('mapObject');
  const pos = world.position(id);
  world.setPosition(mine, pos.x, pos.y);
  world.setHeading(mine, world.heading(id));
  const row = blankCraft();
  row[C.side] = craft[C.side]!;
  row[C.sideSet] = craft[C.sideSet]!;
  row[C.role] = ROLE_MINE;
  row[C.owner] = id as number;
  row[C.state] = STATE_ARMING;
  row[C.hp] = MINE_DAMAGE;
  row[C.timer] = MINE_ARM_TICKS;
  writeCraft(world, mine, row);
  emitCraft(ctx, mine as number, CR.ok, 1);
  emitNote(ctx, mine as number, NOTE_LAUNCHED, id as number);
}

function applyRaid(world: World, cmd: Command, ctx: TickContext): void {
  if (!need(cmd.payload, 4)) throw new Error('raid payload');
  const id = asEntityId(readI32(cmd.payload, 0));
  const target = asEntityId(readI32(cmd.payload, 4));
  const mode = readI32(cmd.payload, 8);
  const commit = readI32(cmd.payload, 12);
  const craft = carrierRow(world, id, ctx);
  if (!craft) return;
  if (mode !== RAID_HIT_AND_RUN && mode !== RAID_BOARDING) {
    emitCraft(ctx, id as number, CR.badRaid, -1);
    return;
  }
  if (!world.isLive(target)) {
    emitCraft(ctx, id as number, CR.noSuchShip, -1);
    return;
  }
  const victimHull = readHull(world, target);
  if (victimHull[H.classCode] === CLASS_FIGHTER || victimHull[H.classCode] === 0) {
    emitCraft(ctx, id as number, CR.notAShip, -1);
    return;
  }
  if (victimHull[H.destroyed] === 1) {
    emitCraft(ctx, id as number, CR.shipDestroyed, -1);
    return;
  }
  const defender = readCraft(world, target);
  if (craft[C.sideSet] !== 1 || defender[C.sideSet] !== 1 || craft[C.side] === defender[C.side]) {
    emitCraft(ctx, id as number, CR.sameSide, -1);
    return;
  }
  const gap = separated(world, id, target);
  if (!withinRange(gap.dx, gap.dy, TRANSPORTER_RANGE)) {
    emitCraft(ctx, id as number, CR.outOfRange, -1);
    return;
  }
  if (mode === RAID_HIT_AND_RUN) {
    if (craft[C.boarding]! < 1) {
      emitCraft(ctx, id as number, CR.noParties, -1);
      return;
    }
    const attack = ctx.rng.stream('combat').dice(1, 6) + 1;
    const defense = ctx.rng.stream('combat').dice(1, 6) + defender[C.security]!;
    if (attack <= defense) {
      emitCraft(ctx, id as number, CR.raidRepulsed, 0);
      return;
    }
    const boxed = chipBox(victimHull);
    writeHull(world, target, victimHull);
    emitCraft(ctx, id as number, CR.ok, boxed);
    return;
  }
  if (commit < 1 || commit > craft[C.boarding]!) {
    emitCraft(ctx, id as number, CR.noParties, -1);
    return;
  }
  craft[C.boarding] = craft[C.boarding]! - commit;
  writeCraft(world, id, craft);
  const attack = ctx.rng.stream('combat').dice(1, 6) + commit;
  const defense = ctx.rng.stream('combat').dice(1, 6) + defender[C.security]!;
  if (attack <= defense) {
    emitCraft(ctx, id as number, CR.boardingRepulsed, 0);
    return;
  }
  const have = defender[C.boarding]!;
  const strip = have < commit ? have : commit;
  defender[C.boarding] = have - strip;
  writeCraft(world, target, defender);
  const boxed = chipBox(victimHull);
  writeHull(world, target, victimHull);
  emitCraft(ctx, id as number, CR.ok, strip + boxed);
}

function guideFighter(world: World, id: EntityId, fighters: readonly FighterType[]): void {
  const row = readCraft(world, id);
  if (row[C.role] !== ROLE_FIGHTER) return;
  if (row[C.state] === STATE_OUT) {
    if (row[C.timer]! > 0) row[C.timer] = row[C.timer]! - 1;
    if (row[C.timer]! <= 0) row[C.state] = STATE_RETURN;
  }
  const type = fighters[row[C.typeId]!];
  const speed = type ? type.speed : 0;
  const owner = asEntityId(row[C.owner]!);
  if (row[C.state] === STATE_RETURN) {
    writeCraft(world, id, row);
    if (!world.isLive(owner)) {
      setSpeed(world, id, 0);
      return;
    }
    const home = world.position(owner);
    const pos = world.position(id);
    const dx = delta(home.x, pos.x);
    const dy = delta(home.y, pos.y);
    if (withinRange(dx, dy, DOCK_RANGE)) setSpeed(world, id, 0);
    else steer(world, id, home.x, home.y, speed, FIGHTER_YAW);
    return;
  }
  writeCraft(world, id, row);
  if (row[C.sideSet] !== 1) {
    setSpeed(world, id, 0);
    return;
  }
  const target = nearestHostile(world, id, row[C.side]!);
  if (!target) {
    setSpeed(world, id, 0);
    return;
  }
  const pos = world.position(target);
  const self = world.position(id);
  const dx = delta(pos.x, self.x);
  const dy = delta(pos.y, self.y);
  const run = withinRange(dx, dy, STRIKE_RANGE) ? 0 : speed;
  steer(world, id, pos.x, pos.y, run, FIGHTER_YAW);
}

function guidePf(world: World, id: EntityId): void {
  const row = readCraft(world, id);
  if (row[C.role] !== ROLE_PF || row[C.state] !== STATE_RETURN) return;
  const owner = asEntityId(row[C.owner]!);
  if (!world.isLive(owner)) {
    setSpeed(world, id, 0);
    return;
  }
  const home = world.position(owner);
  const pos = world.position(id);
  const dx = delta(home.x, pos.x);
  const dy = delta(home.y, pos.y);
  if (withinRange(dx, dy, DOCK_RANGE)) {
    setSpeed(world, id, 0);
    return;
  }
  const cap = yawCap(readHull(world, id)[H.turnMode]!);
  steer(world, id, home.x, home.y, PF_RECOVER_SPEED, cap);
}

function dock(world: World, id: EntityId, ctx: TickContext): void {
  const row = readCraft(world, id);
  if (row[C.state] !== STATE_RETURN) return;
  if (row[C.role] !== ROLE_FIGHTER && row[C.role] !== ROLE_PF) return;
  const owner = asEntityId(row[C.owner]!);
  if (!world.isLive(owner)) return;
  const home = world.position(owner);
  const pos = world.position(id);
  if (!withinRange(delta(home.x, pos.x), delta(home.y, pos.y), DOCK_RANGE)) return;
  const bays = readBays(world, owner);
  const bayIndex = row[C.bay]!;
  if (bayIndex < 0 || bayIndex >= BAY_COUNT) return;
  const bay = bayAt(bays, bayIndex);
  bay[3] = bay[3]! + 1;
  if (bay[4] === 0) bay[4] = REARM_TICKS;
  putBay(bays, bayIndex, bay);
  writeBays(world, owner, bays);
  world.despawn(id);
  emitNote(ctx, id as number, NOTE_DOCKED, bayIndex);
}

function rearm(world: World, id: EntityId, ctx: TickContext): void {
  const kind = world.getFields(id, 'kind')[0]!;
  if (kind !== ENTITY_KIND.ship) return;
  const bays = readBays(world, id);
  let changed = false;
  for (let i = 0; i < BAY_COUNT; i++) {
    const bay = bayAt(bays, i);
    if (bay[4]! <= 0) continue;
    bay[4] = bay[4]! - 1;
    if (bay[4] === 0 && bay[3]! > 0) {
      bay[3] = bay[3]! - 1;
      bay[2] = bay[2]! + 1;
      if (bay[3]! > 0) bay[4] = REARM_TICKS;
      emitNote(ctx, id as number, NOTE_REARMED, bay[2]!);
    }
    putBay(bays, i, bay);
    changed = true;
  }
  if (changed) writeBays(world, id, bays);
}

function strike(world: World, id: EntityId, ctx: TickContext): void {
  const row = readCraft(world, id);
  if (row[C.role] !== ROLE_FIGHTER || row[C.state] !== STATE_OUT || row[C.sideSet] !== 1) return;
  const target = nearestHostile(world, id, row[C.side]!);
  if (!target) return;
  const pos = world.position(target);
  const self = world.position(id);
  const dx = delta(pos.x, self.x);
  const dy = delta(pos.y, self.y);
  if (!withinRange(dx, dy, STRIKE_RANGE)) return;
  if (row[C.strikeWait]! <= 0) {
    const from = world.position(id);
    const hit = chipFacing(world, target, from.x, from.y, STRIKE_DAMAGE);
    row[C.strikeWait] = STRIKE_PERIOD;
    if (hit.absorbed > 0) ctx.emit({ kind: EVENT_HIT, entity: target as number, a: hit.facing, b: hit.absorbed });
    emitNote(ctx, id as number, NOTE_STRIKE, hit.applied);
  }
  row[C.strikeWait] = row[C.strikeWait]! - 1;
  writeCraft(world, id, row);
}

function armMines(world: World, id: EntityId, ctx: TickContext): void {
  const row = readCraft(world, id);
  if (row[C.role] !== ROLE_MINE) return;
  if (row[C.state] === STATE_ARMING) {
    if (row[C.timer]! > 0) row[C.timer] = row[C.timer]! - 1;
    if (row[C.timer]! <= 0) {
      row[C.state] = STATE_ARMED;
      emitNote(ctx, id as number, NOTE_ARMED, 0);
    }
    writeCraft(world, id, row);
  }
  if (row[C.state] !== STATE_ARMED) return;
  if (row[C.detected] !== 1 && row[C.sideSet] === 1) {
    const seen = detector(world, id, row[C.side]!);
    if (seen) {
      row[C.detected] = 1;
      writeCraft(world, id, row);
      emitNote(ctx, id as number, NOTE_DETECTED, seen as number);
    }
  }
  const victim = blastVictim(world, id, row[C.owner]!);
  if (!victim) return;
  const from = world.position(id);
  const hit = chipFacing(world, victim, from.x, from.y, row[C.hp]!);
  if (hit.absorbed > 0) ctx.emit({ kind: EVENT_HIT, entity: victim as number, a: hit.facing, b: hit.absorbed });
  emitNote(ctx, id as number, NOTE_DETONATED, hit.applied);
  row[C.state] = 0;
  writeCraft(world, id, row);
  world.despawn(id);
}

function tableOf(snap: WorldSnap, id: string): readonly number[] | null {
  for (const table of snap.tables) {
    if (table.id === id) return table.data;
  }
  return null;
}

export function entitySide(snap: WorldSnap, index: number): number {
  const data = tableOf(snap, CRAFT);
  if (!data || snap.live[index] !== 1) return -1;
  const base = index * CRAFT_FIELDS;
  if ((data[base + C.sideSet] ?? 0) !== 1) return -1;
  return data[base + C.side] ?? 0;
}

export function craftReadout(snap: WorldSnap, index: number): CraftReadout {
  const empty: CraftReadout = {
    side: -1,
    fighterReady: 0,
    pfReady: 0,
    rearming: 0,
    mines: 0,
    boarding: 0,
    security: 0,
  };
  if (snap.live[index] !== 1) return empty;
  const craft = tableOf(snap, CRAFT);
  const bays = tableOf(snap, BAY);
  if (!craft || !bays) return empty;
  const base = index * CRAFT_FIELDS;
  let fighterReady = 0;
  let pfReady = 0;
  let rearming = 0;
  const bayBase = index * BAY_FIELDS;
  for (let i = 0; i < BAY_COUNT; i++) {
    const at = bayBase + i * BAY_STRIDE;
    const kind = bays[at + B.kind] ?? 0;
    const ready = bays[at + B.ready] ?? 0;
    rearming += bays[at + B.queue] ?? 0;
    if (kind === BAY_FIGHTER) fighterReady += ready;
    if (kind === BAY_PF) pfReady += ready;
  }
  return {
    side: (craft[base + C.sideSet] ?? 0) === 1 ? (craft[base + C.side] ?? 0) : -1,
    fighterReady,
    pfReady,
    rearming,
    mines: craft[base + C.mines] ?? 0,
    boarding: craft[base + C.boarding] ?? 0,
    security: craft[base + C.security] ?? 0,
  };
}

function packed(snap: WorldSnap, index: number): number {
  const gen = snap.generations[index] ?? 0;
  return (index & 0xffff) | ((gen & 0xffff) << 16);
}

export function ownedCraft(snap: WorldSnap, owner: number): number[] {
  const craft = tableOf(snap, CRAFT);
  if (!craft) return [];
  const out: number[] = [];
  for (let index = 0; index < snap.live.length; index++) {
    if (snap.live[index] !== 1) continue;
    const base = index * CRAFT_FIELDS;
    const role = craft[base + C.role] ?? 0;
    if (role !== ROLE_FIGHTER && role !== ROLE_PF) continue;
    if ((craft[base + C.owner] ?? 0) !== owner) continue;
    if ((craft[base + C.state] ?? 0) === 0) continue;
    out.push(packed(snap, index));
  }
  return out;
}

export const SMALLCRAFT_TABLES: readonly TableSpec[] = [
  { id: CRAFT, fieldCount: CRAFT_FIELDS },
  { id: BAY, fieldCount: BAY_FIELDS },
];

export function createSmallcraft(options: SmallcraftOptions): SmallcraftBundle {
  const fighters = options.fighters;
  const setups = options.setups;
  const guide: SimSystem = {
    id: 'craft-guide',
    phase: 'aiMission',
    priority: 0,
    step(world) {
      for (const id of world.liveIds()) {
        const kind = world.getFields(id, 'kind')[0]!;
        if (kind === ENTITY_KIND.fighter) guideFighter(world, id, fighters);
        else if (kind === ENTITY_KIND.ship) guidePf(world, id);
      }
    },
  };
  const worldStep: SimSystem = {
    id: 'craft-world',
    phase: 'weapons',
    priority: 10,
    step(world, ctx) {
      const ids = world.liveIds();
      for (const id of ids) armMines(world, id, ctx);
      for (const id of ids) {
        if (!world.isLive(id)) continue;
        strike(world, id, ctx);
      }
      for (const id of world.liveIds()) rearm(world, id, ctx);
      for (const id of ids) {
        if (!world.isLive(id)) continue;
        dock(world, id, ctx);
      }
    },
  };
  const handlers: CommandHandler[] = [
    { kind: VERB_SET_SIDE, apply: (world, cmd, ctx) => applySetSide(world, cmd, ctx) },
    { kind: VERB_SET_STORES, apply: (world, cmd, ctx) => applySetStores(world, cmd, ctx) },
    { kind: VERB_SET_BAY, apply: (world, cmd, ctx) => applySetBay(world, cmd, ctx, fighters, setups) },
    { kind: VERB_LAUNCH_FIGHTER, apply: (world, cmd, ctx) => applyLaunchFighter(world, cmd, ctx, fighters) },
    { kind: VERB_RECALL, apply: (world, cmd, ctx) => applyRecall(world, cmd, ctx) },
    { kind: VERB_LAUNCH_PF, apply: (world, cmd, ctx) => applyLaunchPf(world, cmd, ctx, setups) },
    { kind: VERB_LAY_MINE, apply: (world, cmd, ctx) => applyLayMine(world, cmd, ctx) },
    { kind: VERB_RAID, apply: (world, cmd, ctx) => applyRaid(world, cmd, ctx) },
  ];
  return { tables: SMALLCRAFT_TABLES, systems: [guide, worldStep], handlers };
}
