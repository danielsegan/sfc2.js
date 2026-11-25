/**
 * Energy priorities, the battery switch, shield readiness, and the repair
 * queue. The table is opt-in. Without it, allocation stays life, fire
 * control, movement, shields, weapons, and the battery still covers a
 * shortfall. Magnitudes without a CE reading are in
 * docs/rules/needs-ce-reading.md.
 */
import constants from '../../docs/rules/data/constants.json' with { type: 'json' };
import { asEntityId, type EntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler, SimSystem } from './sim.ts';
import type { TableSpec, World, WorldSnap } from './world.ts';
import { H, readHull, writeHull } from './hull.ts';

export const VERB_SET_PRIORITIES = 28;
export const VERB_SET_BATTERY = 29;
export const VERB_SET_REPAIR = 30;
export const VERB_SET_SHIELD_STATE = 31;

export const POWER = 'powerPlan';

export const SHIELD_DOWN = 1;
export const SHIELD_MINIMAL = 2;
export const SHIELD_UP = 3;

export const BATTERY_OFF = 2;

export const SYS_BRIDGE = 1;
export const SYS_HULL_FWD = 2;
export const SYS_HULL_CEN = 3;
export const SYS_HULL_AFT = 4;
export const SYS_SENSORS = 5;
export const SYS_ARMOR = 6;
export const SYS_EXTRA = 7;

const SYS_COUNT = 7;
const QUEUE = 8;

export const PP = {
  priMove: 0,
  priWpn: 1,
  priShd: 2,
  priTrac: 3,
  priEcm: 4,
  batteryMode: 5,
  shieldState: 6,
  repair0: 7,
  clock: 15,
  max0: 16,
  crewMax: 23,
  gen: 24,
  demand: 25,
  surplus: 26,
  drawMove: 27,
  drawWpn: 28,
  drawShd: 29,
  drawOther: 30,
  desMove: 31,
  desWpn: 32,
  desShd: 33,
  desOther: 34,
} as const;

export const POWER_FIELDS = 35;

export const POWER_TABLE: TableSpec = { id: POWER, fieldCount: POWER_FIELDS };

function tableInt(value: number, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(name);
  return value;
}

/** One box restored this often. Placeholder. */
export const REPAIR_EVERY_TICKS = tableInt(constants.repairEveryTicks, 'repairEveryTicks', 1, 100000);
/** Unset priority slots use this. 1 is highest. Placeholder until a CE reading. */
export const DEFAULT_PRIORITY = tableInt(constants.defaultEnergyPriority, 'defaultEnergyPriority', 1, 5);

const SYS_FIELD = [
  0,
  H.bridge,
  H.hullForward,
  H.hullCenter,
  H.hullAft,
  H.sensors,
  H.armor,
  H.extra,
] as const;

const SYS_NAME = ['', 'bridge', 'hullForward', 'hullCenter', 'hullAft', 'sensors', 'armor', 'extra'] as const;

export function systemCode(name: string): number {
  for (let i = 1; i < SYS_NAME.length; i++) {
    if (SYS_NAME[i] === name) return i;
  }
  return 0;
}

export function systemName(code: number): string {
  if (code < 1 || code >= SYS_NAME.length) return '';
  return SYS_NAME[code] ?? '';
}

function rowOf(world: World, id: EntityId): number[] | null {
  if (!world.hasTable(POWER) || !world.isLive(id)) return null;
  return world.getFields(id, POWER);
}

function writeRow(world: World, id: EntityId, row: readonly number[]): void {
  world.setFields(id, POWER, row);
}

function priorityAt(row: readonly number[], index: number): number {
  const stored = row[index] ?? 0;
  if (stored >= 1 && stored <= 5) return stored;
  return DEFAULT_PRIORITY;
}

/** Life and fire control stay ahead of the five sliders. 1 is paid before 5. */
export function allocationOrder(world: World, id: EntityId): readonly number[] {
  const row = rowOf(world, id);
  if (!row) return [0, 1, 2, 3, 4];
  const cats = [
    { i: 0, p: 0, t: 0 },
    { i: 1, p: 0, t: 1 },
    { i: 2, p: priorityAt(row, PP.priMove), t: 2 },
    { i: 3, p: priorityAt(row, PP.priShd), t: 3 },
    { i: 4, p: priorityAt(row, PP.priWpn), t: 4 },
  ];
  cats.sort((a, b) => a.p - b.p || a.t - b.t);
  const out: number[] = [];
  for (const cat of cats) out.push(cat.i);
  return out;
}

/** Battery added to the pay pool. Unset means the battery still covers a shortfall. */
export function batteryForPool(world: World, id: EntityId, battery100: number): number {
  const row = rowOf(world, id);
  if (!row || row[PP.batteryMode] !== BATTERY_OFF) return battery100;
  return 0;
}

/** Down and Minimal do not take reinforcement energy. Up does. */
export function reinforcementBlocked(world: World, id: EntityId): boolean {
  const row = rowOf(world, id);
  if (!row) return false;
  const state = row[PP.shieldState] ?? 0;
  return state === SHIELD_DOWN || state === SHIELD_MINIMAL;
}

export function rememberSettlement(
  world: World,
  id: EntityId,
  gen: number,
  demand: number,
  move: number,
  weapons: number,
  shields: number,
  other: number,
  wantMove: number,
  wantWeapons: number,
  wantShields: number,
  wantOther: number,
): void {
  const row = rowOf(world, id);
  if (!row) return;
  row[PP.gen] = gen;
  row[PP.demand] = demand;
  row[PP.surplus] = gen - demand;
  row[PP.drawMove] = move;
  row[PP.drawWpn] = weapons;
  row[PP.drawShd] = shields;
  row[PP.drawOther] = other;
  row[PP.desMove] = wantMove;
  row[PP.desWpn] = wantWeapons;
  row[PP.desShd] = wantShields;
  row[PP.desOther] = wantOther;
  writeRow(world, id, row);
}

export function captureSystems(world: World, id: EntityId, fields: readonly number[]): void {
  const row = rowOf(world, id);
  if (!row) return;
  for (let code = 1; code <= SYS_COUNT; code++) {
    row[PP.max0 + code - 1] = fields[SYS_FIELD[code]!] ?? 0;
  }
  row[PP.crewMax] = fields[H.crew] ?? 0;
  writeRow(world, id, row);
}

function applyPriorities(world: World, cmd: Command): void {
  if (cmd.payload.length < 24) throw new Error('priority payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const row = rowOf(world, id);
  if (!row) return;
  const slots = [PP.priMove, PP.priWpn, PP.priShd, PP.priTrac, PP.priEcm];
  for (let i = 0; i < slots.length; i++) {
    const value = readU32(cmd.payload, 4 + i * 4) | 0;
    if (value < 1 || value > 5) return;
    row[slots[i]!] = value;
  }
  writeRow(world, id, row);
}

function applyBattery(world: World, cmd: Command): void {
  if (cmd.payload.length < 8) throw new Error('battery payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const on = readU32(cmd.payload, 4) | 0;
  const row = rowOf(world, id);
  if (!row) return;
  if (on !== 0 && on !== 1) return;
  row[PP.batteryMode] = on === 1 ? 1 : BATTERY_OFF;
  writeRow(world, id, row);
}

function applyRepair(world: World, cmd: Command): void {
  if (cmd.payload.length < 8) throw new Error('repair payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const count = readU32(cmd.payload, 4) | 0;
  const row = rowOf(world, id);
  if (!row) return;
  if (count < 0 || count > QUEUE || cmd.payload.length < 8 + count * 4) return;
  for (let i = 0; i < QUEUE; i++) row[PP.repair0 + i] = 0;
  for (let i = 0; i < count; i++) {
    const code = readU32(cmd.payload, 8 + i * 4) | 0;
    if (code < 1 || code > SYS_COUNT) return;
    row[PP.repair0 + i] = code;
  }
  writeRow(world, id, row);
}

function applyShieldState(world: World, cmd: Command): void {
  if (cmd.payload.length < 8) throw new Error('shield state payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const state = readU32(cmd.payload, 4) | 0;
  const row = rowOf(world, id);
  if (!row) return;
  if (state !== SHIELD_DOWN && state !== SHIELD_MINIMAL && state !== SHIELD_UP) return;
  const fields = readHull(world, id);
  row[PP.shieldState] = state;
  for (let facing = 0; facing < 6; facing++) {
    const max = fields[H.shieldMax0 + facing] ?? 0;
    fields[H.shield0 + facing] = state === SHIELD_DOWN ? 0 : max;
    fields[H.facing0 + facing] = 0;
  }
  writeHull(world, id, fields);
  writeRow(world, id, row);
}

function repairOne(world: World, id: EntityId, row: number[]): void {
  const fields = readHull(world, id);
  for (let i = 0; i < QUEUE; i++) {
    const code = row[PP.repair0 + i] ?? 0;
    if (code < 1 || code > SYS_COUNT) continue;
    const at = SYS_FIELD[code]!;
    const max = row[PP.max0 + code - 1] ?? 0;
    const cur = fields[at] ?? 0;
    if (cur >= max) continue;
    fields[at] = cur + 1;
    writeHull(world, id, fields);
    return;
  }
}

function tickOne(world: World, id: EntityId): void {
  const row = rowOf(world, id);
  if (!row) return;
  const clock = (row[PP.clock] ?? 0) + 1;
  if (clock < REPAIR_EVERY_TICKS) {
    row[PP.clock] = clock;
    writeRow(world, id, row);
    return;
  }
  row[PP.clock] = 0;
  writeRow(world, id, row);
  repairOne(world, id, row);
}

export function createPowerRepair(): SimSystem {
  return {
    id: 'power-repair',
    phase: 'cleanup',
    priority: 0,
    step(world) {
      if (!world.hasTable(POWER)) return;
      for (const id of world.liveIds()) tickOne(world, id);
    },
  };
}

function words(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) writeU32(out, i * 4, values[i]! | 0);
  return out;
}

export function priorityPayload(
  entity: number,
  movement: number,
  weapons: number,
  shields: number,
  tractors: number,
  ecm: number,
): Uint8Array {
  return words([entity, movement, weapons, shields, tractors, ecm]);
}

export function batteryPayload(entity: number, discharge: number): Uint8Array {
  return words([entity, discharge]);
}

export function repairPayload(entity: number, codes: readonly number[]): Uint8Array {
  return words([entity, codes.length, ...codes]);
}

export function shieldStatePayload(entity: number, state: number): Uint8Array {
  return words([entity, state]);
}

export const powerHandlers: readonly CommandHandler[] = [
  { kind: VERB_SET_PRIORITIES, apply: applyPriorities },
  { kind: VERB_SET_BATTERY, apply: applyBattery },
  { kind: VERB_SET_REPAIR, apply: applyRepair },
  { kind: VERB_SET_SHIELD_STATE, apply: applyShieldState },
];

export interface PowerView {
  readonly priorities: {
    readonly movement: number;
    readonly weapons: number;
    readonly shields: number;
    readonly tractors: number;
    readonly ecm: number;
  };
  readonly batteryDischarging: boolean;
  readonly shieldState: 'down' | 'minimal' | 'up';
  readonly generation: number;
  readonly demand: number;
  readonly surplus: number;
  readonly draws: {
    readonly movement: number;
    readonly weapons: number;
    readonly shields: number;
    readonly tractors: number;
    readonly ecm: number;
    readonly other: number;
    readonly cloak: number;
  };
  /** Asked amount before the plant shortfall. Same units as `draws`. */
  readonly desired: {
    readonly movement: number;
    readonly weapons: number;
    readonly shields: number;
    readonly tractors: number;
    readonly ecm: number;
    readonly other: number;
    readonly cloak: number;
  };
  readonly repairQueue: readonly string[];
  readonly systemMax: readonly number[];
  readonly crewMax: number;
}

function snapRow(snap: WorldSnap, index: number): readonly number[] | null {
  if (index < 0 || snap.live[index] !== 1) return null;
  for (const table of snap.tables) {
    if (table.id !== POWER) continue;
    const base = index * table.fieldCount;
    const out: number[] = [];
    for (let i = 0; i < POWER_FIELDS; i++) out.push(table.data[base + i] ?? 0);
    return out;
  }
  return null;
}

export function readPower(snap: WorldSnap, index: number): PowerView | null {
  const row = snapRow(snap, index);
  if (!row) return null;
  const state = row[PP.shieldState] ?? 0;
  const queue: string[] = [];
  for (let i = 0; i < QUEUE; i++) {
    const name = systemName(row[PP.repair0 + i] ?? 0);
    if (name !== '') queue.push(name);
  }
  const max: number[] = [];
  for (let code = 1; code <= SYS_COUNT; code++) max.push(row[PP.max0 + code - 1] ?? 0);
  const shieldState = state === SHIELD_DOWN ? 'down' : state === SHIELD_MINIMAL ? 'minimal' : 'up';
  return {
    priorities: {
      movement: priorityAt(row, PP.priMove),
      weapons: priorityAt(row, PP.priWpn),
      shields: priorityAt(row, PP.priShd),
      tractors: priorityAt(row, PP.priTrac),
      ecm: priorityAt(row, PP.priEcm),
    },
    batteryDischarging: row[PP.batteryMode] !== BATTERY_OFF,
    shieldState,
    generation: row[PP.gen] ?? 0,
    demand: row[PP.demand] ?? 0,
    surplus: row[PP.surplus] ?? 0,
    draws: {
      movement: row[PP.drawMove] ?? 0,
      weapons: row[PP.drawWpn] ?? 0,
      shields: row[PP.drawShd] ?? 0,
      tractors: 0,
      ecm: 0,
      other: row[PP.drawOther] ?? 0,
      cloak: 0,
    },
    desired: {
      movement: row[PP.desMove] ?? 0,
      weapons: row[PP.desWpn] ?? 0,
      shields: row[PP.desShd] ?? 0,
      tractors: 0,
      ecm: 0,
      other: row[PP.desOther] ?? 0,
      cloak: 0,
    },
    repairQueue: queue,
    systemMax: max,
    crewMax: row[PP.crewMax] ?? 0,
  };
}
