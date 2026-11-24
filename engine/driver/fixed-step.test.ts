import { describe, expect, it } from 'vitest';
import type { Command } from '../core/codec.ts';
import { add, fx } from '../core/fx.ts';
import { mpReportsHash, LocalSession, type Session } from '../net/session.ts';
import { createSim, type Sim } from '../sim/sim.ts';
import { createDriver } from './fixed-step.ts';

const TICK_MS = 1000 / 30;

function harness(seed: number, speed: number) {
  const sim = createSim({
    seed,
    handlers: [
      {
        kind: 1,
        apply(world, cmd) {
          const id = world.alloc('ship');
          const x = (cmd.payload[0]! | (cmd.payload[1]! << 8) | (cmd.payload[2]! << 16) | (cmd.payload[3]! << 24)) | 0;
          world.setPosition(id, fx(x), fx(0));
        },
      },
    ],
    systems: [
      {
        id: 'drift',
        phase: 'movement',
        priority: 0,
        step(world, ctx) {
          for (const id of world.liveIds()) {
            const pos = world.position(id);
            world.setPosition(id, add(pos.x, fx(ctx.rng.stream('combat').int(3))), pos.y);
          }
        },
      },
    ],
  });
  const session = new LocalSession({ currentTick: () => sim.tick as number });
  const payload = new Uint8Array(4);
  payload[0] = 2;
  session.issue(1, payload);
  const driver = createDriver({ sim, session, speed });
  return { sim, session, driver };
}

describe('fixed-step driver', () => {
  it('produces the same hash sequence at 1x, 2x, and 4x', () => {
    const once = (speed: number, frames: number) => {
      const { session, driver } = harness(4, speed);
      for (let i = 0; i < frames; i++) driver.frame(TICK_MS);
      return session.recordedHashes().map((row) => row.hash);
    };
    const at1 = once(1, 8);
    expect(at1).toHaveLength(8);
    expect(once(2, 4)).toEqual(at1);
    expect(once(4, 2)).toEqual(at1);
  });

  it('pauses at speed 0, banks a half tick, and drops the backlog past 8 steps', () => {
    const paused = harness(1, 0);
    paused.driver.frame(TICK_MS);
    expect(paused.sim.tick).toBe(0);

    const half = harness(1, 1);
    const first = half.driver.frame(TICK_MS / 2);
    expect(first.steps).toBe(0);
    expect(first.alpha).toBeCloseTo(0.5, 5);
    const second = half.driver.frame(TICK_MS / 2);
    expect(second.steps).toBe(1);
    expect(half.sim.tick).toBe(1);

    const live = createSim({ seed: 1 });
    const session = new LocalSession({ currentTick: () => live.tick as number });
    const driver = createDriver({ sim: live, session, speed: 4 });
    expect(driver.frame(250).steps).toBe(8);
    expect(live.tick).toBe(8);
    expect(driver.frame(0).steps).toBe(0);
    expect(live.tick).toBe(8);
  });

  it('does not bank time while the session cannot advance', () => {
    const sim = createSim({ seed: 1 });
    const session = new Gate(sim);
    const driver = createDriver({ sim, session, speed: 1 });
    session.open = false;
    expect(driver.frame(TICK_MS).steps).toBe(0);
    session.open = true;
    expect(driver.frame(0).steps).toBe(0);
    expect(driver.frame(TICK_MS).steps).toBe(1);
  });

  it('keeps 64 snapshots and reports MP hashes on every 10th tick', () => {
    const sim = createSim({ seed: 2 });
    const session = new LocalSession({ currentTick: () => sim.tick as number });
    const driver = createDriver({ sim, session, speed: 1 });
    for (let i = 0; i < 70; i++) driver.frame(TICK_MS);
    expect(driver.ring.size).toBe(64);
    expect(driver.ring.at(0)?.tick).toBe(70);
    expect(driver.ring.at(63)?.tick).toBe(7);
    expect(mpReportsHash(0)).toBe(true);
    expect(mpReportsHash(10)).toBe(true);
    expect(mpReportsHash(11)).toBe(false);
  });
});

class Gate implements Session {
  readonly localSlot = 0;
  readonly inputDelay = 0;
  open = true;
  private readonly sim: Sim;
  constructor(sim: Sim) {
    this.sim = sim;
  }
  issue(): void {}
  canAdvance(): boolean {
    return this.open && (this.sim.tick as number) >= 0;
  }
  commandsFor(): readonly Command[] {
    return [];
  }
  reportHash(): void {}
}
