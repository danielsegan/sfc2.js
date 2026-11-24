import { angle16, cos16, sin16 } from '../../core/angle.ts';
import { asEntityId } from '../../core/brands.ts';
import { ByteBuf } from '../../core/bytes.ts';
import { add, delta, distSq, fxRaw, mul } from '../../core/fx.ts';
import type { CommandHandler, SimSystem } from '../../sim/sim.ts';
import type { TableSpec } from '../../sim/world.ts';

/** Synthetic verb ids. They are not game weapon or helm codes. */
export const SPAWN = 1;
export const HELM = 2;
export const FIRE = 3;

export const KIT_PATH = 'engine/replay/scenarios/kit.ts';

export const motionTable: TableSpec = { id: 'motion', fieldCount: 1 };

function readI32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) |
    0
  );
}

function pack(values: readonly number[]): Uint8Array {
  const buf = new ByteBuf();
  for (const value of values) buf.i32(value);
  return buf.toUint8();
}

export function spawnPayload(x: number, y: number, heading: number, speed: number): Uint8Array {
  return pack([x, y, heading, speed]);
}

export function helmPayload(entity: number, heading: number, speed: number): Uint8Array {
  return pack([entity, heading, speed]);
}

export function firePayload(shooter: number, target: number): Uint8Array {
  return pack([shooter, target]);
}

/** index | (generation << 16). The first spawn in a fresh world is generation 1 at index 0. */
export function packedId(index: number, generation = 1): number {
  return (index & 0xffff) | ((generation & 0xffff) << 16);
}

export const spawnHandler: CommandHandler = {
  kind: SPAWN,
  apply(world, cmd) {
    if (cmd.payload.length !== 16) throw new Error('spawn payload');
    const id = world.alloc('ship');
    world.setPosition(id, fxRaw(readI32(cmd.payload, 0)), fxRaw(readI32(cmd.payload, 4)));
    world.setHeading(id, angle16(readI32(cmd.payload, 8)));
    world.setFields(id, 'motion', [readI32(cmd.payload, 12)]);
  },
};

export const helmHandler: CommandHandler = {
  kind: HELM,
  apply(world, cmd) {
    if (cmd.payload.length !== 12) throw new Error('helm payload');
    const id = asEntityId(readI32(cmd.payload, 0));
    if (!world.isLive(id)) return;
    world.setHeading(id, angle16(readI32(cmd.payload, 4)));
    world.setFields(id, 'motion', [readI32(cmd.payload, 8)]);
  },
};

export const fireHandler: CommandHandler = {
  kind: FIRE,
  apply(world, cmd, ctx) {
    if (cmd.payload.length !== 8) throw new Error('fire payload');
    const shooter = asEntityId(readI32(cmd.payload, 0));
    const target = asEntityId(readI32(cmd.payload, 4));
    const live = world.isLive(shooter) && world.isLive(target) ? 1 : 0;
    const roll = live === 1 ? ctx.rng.stream('combat').int(100) : 0;
    ctx.emit({ kind: 3, entity: shooter as number, a: roll, b: target as number });
  },
};

export const duelHandlers: readonly CommandHandler[] = [spawnHandler, helmHandler, fireHandler];

/** One range unit of speed moves by cos/sin of the heading, in Q16.16, each tick. */
export const movement: SimSystem = {
  id: 'synthetic-move',
  phase: 'movement',
  priority: 0,
  step(world) {
    for (const id of world.liveIds()) {
      const speed = fxRaw(world.getFields(id, 'motion')[0]!);
      const heading = world.heading(id);
      const pos = world.position(id);
      world.setPosition(
        id,
        add(pos.x, mul(speed, cos16(heading))),
        add(pos.y, mul(speed, sin16(heading))),
      );
    }
  },
};

/** Puts the exact i64 distance of the first two ships into the event stream. */
export const rangePing: SimSystem = {
  id: 'synthetic-range',
  phase: 'cleanup',
  priority: 0,
  step(world, ctx) {
    const ids = world.liveIds();
    if (ids.length < 2) {
      ctx.emit({ kind: 9, entity: 0, a: 0, b: 0 });
      return;
    }
    const left = world.position(ids[0]!);
    const right = world.position(ids[1]!);
    const d2 = distSq(delta(left.x, right.x), delta(left.y, right.y));
    ctx.emit({ kind: 9, entity: ids[0] as number, a: d2.hi, b: d2.lo });
  },
};
