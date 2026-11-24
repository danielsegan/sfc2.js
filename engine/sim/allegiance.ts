/**
 * Which side a ship is on, and whether a captain drives it.
 * The command is verb 7. Helm is verb 6. Combat verbs stay 1–5.
 * The payload is entity, side, and control. It does not carry a tick.
 *
 * Side is stored as 1 or 2 so a zeroed row means "not assigned".
 * Unassigned ships stay hostile to each other, which is the 1v1 duel.
 */
import { asEntityId } from '../core/brands.ts';
import { readU32, writeU32 } from '../core/bytes.ts';
import type { Command } from '../core/codec.ts';
import type { CommandHandler } from './sim.ts';
import type { TableSpec, World, WorldSnap } from './world.ts';
import { H, readHull } from './hull.ts';
import { CLASS_FIGHTER } from './rules-tables.ts';

export const ALLEGIANCE = 'allegiance';
export const ALLEGIANCE_FIELDS = 5;

export const ALLEGIANCE_TABLE: TableSpec = { id: ALLEGIANCE, fieldCount: ALLEGIANCE_FIELDS };

/** Combat verbs are 1–5 and helm is 6. This match registers 7 beside them. */
export const VERB_SET_ALLEGIANCE = 7;

export const CONTROL_MANUAL = 0;
export const CONTROL_AI = 1;

export const MODE_ENGAGE = 0;
export const MODE_RETREAT = 1;

export const A = {
  side: 0,
  control: 1,
  mode: 2,
  target: 3,
  think: 4,
} as const;

export interface AllegianceView {
  /** -1 when the row was never assigned. Otherwise 0 or 1. */
  readonly side: number;
  readonly control: number;
  readonly mode: number;
  readonly target: number;
}

export function allegiancePayload(entity: number, side: number, control: number): Uint8Array {
  const out = new Uint8Array(12);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, side | 0);
  writeU32(out, 8, control | 0);
  return out;
}

function readI32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}

export function readAllegiance(snap: WorldSnap, index: number): AllegianceView {
  let data: readonly number[] | undefined;
  let width = ALLEGIANCE_FIELDS;
  for (const table of snap.tables) {
    if (table.id !== ALLEGIANCE) continue;
    data = table.data;
    width = table.fieldCount;
  }
  if (!data || width < 4) return { side: -1, control: 0, mode: 0, target: 0 };
  const base = index * width;
  const code = data[base + A.side] ?? 0;
  let side = -1;
  if (code === 1) side = 0;
  else if (code === 2) side = 1;
  return {
    side,
    control: data[base + A.control] ?? 0,
    mode: data[base + A.mode] ?? 0,
    target: data[base + A.target] ?? 0,
  };
}

function apply(world: World, cmd: Command): void {
  if (cmd.payload.length !== 12) throw new Error('allegiance payload');
  const id = asEntityId(readU32(cmd.payload, 0));
  const side = readI32(cmd.payload, 4);
  const control = readI32(cmd.payload, 8);
  if (!world.isLive(id)) return;
  if (side !== 0 && side !== 1) return;
  if (control !== CONTROL_MANUAL && control !== CONTROL_AI) return;
  const hull = readHull(world, id);
  if (hull[H.classCode] === 0 || hull[H.classCode] === CLASS_FIGHTER) return;
  world.setFields(id, ALLEGIANCE, [side + 1, control, MODE_ENGAGE, 0, 0]);
}

export const allegianceHandler: CommandHandler = {
  kind: VERB_SET_ALLEGIANCE,
  apply(world, cmd) {
    apply(world, cmd);
  },
};
