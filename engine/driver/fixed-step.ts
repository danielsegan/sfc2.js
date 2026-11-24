/**
 * Frame driver. It owns the only clock accumulator. The sim never sees dt.
 *
 * Time is an integer count of 1/30000 s (1000 units = one 30 Hz tick), so a
 * tick is exact. Sub-tick remainder is kept for alpha. Whole ticks past the
 * 8-step cap are dropped rather than banked.
 */
import type { Tick } from '../core/brands.ts';
import type { Session } from '../net/session.ts';
import type { Sim, Snapshot } from '../sim/sim.ts';

const UNITS_PER_MS = 30;
const UNITS_PER_TICK = 1000;
const MAX_FRAME_MS = 250;
const MAX_STEPS = 8;

export interface FrameResult {
  readonly steps: number;
  readonly alpha: number;
  readonly tick: Tick;
}

export class SnapshotRing {
  readonly capacity = 64;
  private readonly slots: (Snapshot | undefined)[] = new Array<Snapshot | undefined>(64);
  private write = 0;
  private count = 0;

  push(snapshot: Snapshot): void {
    this.slots[this.write] = snapshot;
    this.write = (this.write + 1) % 64;
    if (this.count < 64) this.count += 1;
  }

  get size(): number {
    return this.count;
  }

  /** Age 0 is the newest snapshot. */
  at(age: number): Snapshot | undefined {
    if (!Number.isInteger(age) || age < 0 || age >= this.count) return undefined;
    const index = (this.write - 1 - age + 128) % 64;
    return this.slots[index];
  }
}

export interface FixedStepDriver {
  readonly ring: SnapshotRing;
  frame(frameDtMs: number): FrameResult;
  /** More ticks per second. Zero pauses. This does not write sim state. */
  setSpeed(speed: number): void;
}

export function createDriver(options: { sim: Sim; session: Session; speed: number }): FixedStepDriver {
  if (!Number.isFinite(options.speed) || options.speed < 0) throw new Error('speed');
  const { sim, session } = options;
  let speed = options.speed;
  const ring = new SnapshotRing();
  let acc = 0;
  return {
    ring,
    setSpeed(next: number): void {
      if (!Number.isFinite(next) || next < 0) throw new Error('speed');
      speed = next;
    },
    frame(frameDtMs: number): FrameResult {
      const ms = frameDtMs < 0 ? 0 : frameDtMs > MAX_FRAME_MS ? MAX_FRAME_MS : frameDtMs;
      const units = Math.round(ms * UNITS_PER_MS);
      acc += Math.round(units * speed);
      let steps = 0;
      while (
        acc >= UNITS_PER_TICK &&
        steps < MAX_STEPS &&
        session.canAdvance((sim.tick as number) + 1)
      ) {
        const next = (sim.tick as number) + 1;
        const result = sim.step(session.commandsFor(next));
        session.reportHash(result.tick, result.hash);
        ring.push(sim.snapshot());
        acc -= UNITS_PER_TICK;
        steps += 1;
      }
      if (acc >= UNITS_PER_TICK) acc = acc % UNITS_PER_TICK;
      return { steps, alpha: acc / UNITS_PER_TICK, tick: sim.tick };
    },
  };
}
