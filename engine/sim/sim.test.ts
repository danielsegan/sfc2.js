import { describe, expect, it } from 'vitest';
import { asEntityId } from '../core/brands.ts';
import { command, type Command } from '../core/codec.ts';
import { add, fx, fxRaw } from '../core/fx.ts';
import { xxhash32 } from '../core/xxhash32.ts';
import { createSim, hashEvents, type CommandHandler, type Sim, type SimSystem, type Snapshot } from './sim.ts';

const SPAWN = 1;
const DESPAWN = 2;

function i32Bytes(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    const v = values[i]! >>> 0;
    out[i * 4] = v & 0xff;
    out[i * 4 + 1] = (v >>> 8) & 0xff;
    out[i * 4 + 2] = (v >>> 16) & 0xff;
    out[i * 4 + 3] = (v >>> 24) & 0xff;
  }
  return out;
}

function readI32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) | 0
  );
}

const handlers: readonly CommandHandler[] = [
  {
    kind: SPAWN,
    apply(world, cmd) {
      const id = world.alloc('ship');
      world.setPosition(id, fxRaw(readI32(cmd.payload, 0)), fxRaw(readI32(cmd.payload, 4)));
    },
  },
  {
    kind: DESPAWN,
    apply(world, cmd) {
      world.despawn(asEntityId(readI32(cmd.payload, 0)));
    },
  },
];

const drift: SimSystem = {
  id: 'drift',
  phase: 'movement',
  priority: 0,
  step(world, ctx) {
    for (const id of world.liveIds()) {
      const pos = world.position(id);
      world.setPosition(id, add(pos.x, fx(ctx.rng.stream('combat').int(4))), pos.y);
    }
    ctx.emit({ kind: 7, entity: 0, a: ctx.rng.stream('mission').dice(1, 6), b: 0 });
  },
};

function make(seed = 5): Sim {
  return createSim({ seed, handlers, systems: [drift] });
}

function spawn(tick: number, slot: number, seq: number, x: number, y: number): Command {
  return command(tick, slot, seq, SPAWN, i32Bytes([x, y]));
}

function livePosition(snap: Snapshot, index: number): { x: number; y: number } | undefined {
  if (snap.world.live[index] !== 1) return undefined;
  const table = snap.world.tables.find((item) => item.id === 'position');
  if (!table) return undefined;
  return { x: table.data[index * 2]!, y: table.data[index * 2 + 1]! };
}

describe('sim loop', () => {
  it('has no document and step takes only commands', () => {
    expect('document' in globalThis).toBe(false);
    const sim = make();
    expect(sim.tick).toBe(0);
    const result = sim.step([]);
    expect(result.tick).toBe(1);
    expect(result.hash).toBe(sim.stateHash());
    expect(result.eventHash).toBe(hashEvents(result.events));
    expect(result.hash).toBe(xxhash32(sim.canonicalBytes(), 0));
  });

  it('repeats a seeded run, and a different seed does not', () => {
    const left = hashes(5, 12);
    const right = hashes(5, 12);
    expect(left).toEqual(right);
    expect(left.length).toBe(12);
    expect(hashes(6, 12)[0]).not.toBe(left[0]);
  });

  it('applies commands in canonical order and rejects duplicates or the wrong tick', () => {
    const a = spawn(1, 0, 0, fx(1) as number, 0);
    const b = spawn(1, 1, 0, fx(2) as number, 0);
    const forward = make().step([a, b]).hash;
    const backward = make().step([b, a]).hash;
    expect(forward).toBe(backward);
    expect(() => make().step([a, a])).toThrow(/duplicate/);
    expect(() => make().step([command(2, 0, 0, SPAWN, i32Bytes([0, 0]))])).toThrow(/different tick/);
  });

  it('spawns in the input phase, moves the same tick, and frees on the next tick', () => {
    const seen: boolean[] = [];
    const sim = createSim({
      seed: 1,
      handlers,
      systems: [
        drift,
        {
          id: 'watch',
          phase: 'cleanup',
          priority: 0,
          step(world) {
            const ids = world.liveIds();
            seen.push(ids.length > 0 && world.isLive(ids[0]!));
          },
        },
      ],
    });
    const spawned = sim.step([spawn(1, 0, 0, fx(3) as number, fx(4) as number)]);
    expect(spawned.events).toHaveLength(1);
    const snap = sim.snapshot();
    const pos = livePosition(snap, 0);
    expect(pos?.y).toBe(fx(4) as number);
    expect(pos?.x).toBeGreaterThanOrEqual(fx(3) as number);
    expect(pos?.x).toBeLessThan((fx(3) as number) + (fx(4) as number));
    const id = snap.world.generations[0] === 1 ? 0x00010000 : 0;
    seen.length = 0;
    sim.step([command(2, 0, 0, DESPAWN, i32Bytes([id]))]);
    expect(seen).toEqual([true]);
    expect(sim.snapshot().world.live[0]).toBe(0);
    const reused = sim.step([spawn(3, 0, 0, 0, 0)]);
    expect(reused.tick).toBe(3);
    expect(sim.snapshot().world.generations[0]).toBe(2);
  });

  it('runs systems by phase, then priority, then id', () => {
    const sim = createSim({
      seed: 1,
      systems: [
        { id: 'b', phase: 'movement', priority: 1, step() {} },
        { id: 'a', phase: 'movement', priority: 1, step() {} },
        { id: 'early', phase: 'movement', priority: 0, step() {} },
        { id: 'zap', phase: 'weapons', priority: 5, step() {} },
        { id: 'in', phase: 'input', priority: 0, step() {} },
      ],
    });
    expect(sim.resolvedSystemIds()).toEqual(['in', 'early', 'a', 'b', 'zap']);
  });

  it('applies an AI command on the next tick and keeps it in the hash', () => {
    const captain: SimSystem = {
      id: 'captain',
      phase: 'aiMission',
      priority: 0,
      step(_world, ctx) {
        if ((ctx.tick as number) === 1) ctx.queue({ slot: 8, kind: SPAWN, payload: i32Bytes([fx(1) as number, 0]) });
      },
    };
    const run = () => {
      const sim = createSim({ seed: 8, handlers, systems: [captain] });
      const first = sim.step([]);
      expect(sim.snapshot().world.live.includes(1)).toBe(false);
      expect(sim.snapshot().queued).toHaveLength(1);
      const second = sim.step([]);
      expect(sim.snapshot().world.live[0]).toBe(1);
      return [first.hash, second.hash];
    };
    expect(run()).toEqual(run());
    expect(() =>
      createSim({
        seed: 1,
        systems: [
          {
            id: 'late',
            phase: 'movement',
            priority: 0,
            step(_w, ctx) {
              ctx.queue({ slot: 8, kind: 1, payload: new Uint8Array() });
            },
          },
        ],
      }).step([]),
    ).toThrow(/aiMission/);
  });

  it('restores a snapshot, including through structured clone, and continues the hash sequence', () => {
    const full = hashes(15, 8);
    const sim = make(15);
    for (let i = 0; i < 3; i++) sim.step([]);
    const snap = sim.snapshot();
    const resumed = make(15);
    resumed.restore(structuredClone(snap));
    expect(resumed.stateHash()).toBe(sim.stateHash());
    const tail: number[] = [];
    for (let i = 0; i < 5; i++) tail.push(resumed.step([]).hash);
    expect(tail).toEqual(full.slice(3));
  });
});

function hashes(seed: number, ticks: number): number[] {
  const sim = make(seed);
  const out: number[] = [];
  for (let i = 0; i < ticks; i++) out.push(sim.step([]).hash);
  return out;
}
