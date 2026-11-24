import type { Tick } from '../core/brands.ts';
import { command, compareCommands, type Command } from '../core/codec.ts';

export interface Session {
  readonly localSlot: number;
  readonly inputDelay: number;
  issue(kind: number, payload: Uint8Array): void;
  canAdvance(tick: Tick | number): boolean;
  commandsFor(tick: Tick | number): readonly Command[];
  reportHash(tick: Tick | number, hash: number): void;
}

export interface RecordedHash {
  readonly tick: number;
  readonly hash: number;
}

/**
 * Single-player session. Delay 0 stamps the next tick, because a command
 * cannot apply to a tick that has already resolved. Delay 2..4 stamps
 * lastCompleted + delay, which is the agreed host range.
 */
export class LocalSession implements Session {
  readonly localSlot: number;
  readonly inputDelay: number;
  private readonly commands: Command[] = [];
  private readonly hashes: RecordedHash[] = [];
  private readonly currentTick: () => number;

  constructor(options: { localSlot?: number; inputDelay?: number; currentTick: () => number }) {
    this.localSlot = options.localSlot ?? 0;
    this.inputDelay = options.inputDelay ?? 0;
    this.currentTick = options.currentTick;
    if (!Number.isInteger(this.localSlot) || this.localSlot < 0 || this.localSlot > 5) {
      throw new Error('local slot must be 0..5');
    }
    if (this.inputDelay !== 0 && (this.inputDelay < 2 || this.inputDelay > 4)) {
      throw new Error('inputDelay must be 0 or 2..4');
    }
  }

  issue(kind: number, payload: Uint8Array): void {
    const current = this.currentTick() >>> 0;
    const target = this.inputDelay === 0 ? current + 1 : current + this.inputDelay;
    let seq = 0;
    for (const cmd of this.commands) {
      if ((cmd.tick as number) === target && cmd.slot === this.localSlot) seq += 1;
    }
    this.commands.push(command(target, this.localSlot, seq, kind, payload));
  }

  canAdvance(tick: Tick | number): boolean {
    return Number.isInteger(tick) && (tick as number) >= 0;
  }

  commandsFor(tick: Tick | number): readonly Command[] {
    const want = tick as number;
    const list: Command[] = [];
    for (const cmd of this.commands) {
      if ((cmd.tick as number) === want) list.push(cmd);
    }
    list.sort(compareCommands);
    return list;
  }

  reportHash(tick: Tick | number, hash: number): void {
    this.hashes.push({ tick: tick as number, hash: hash >>> 0 });
  }

  recordedHashes(): readonly RecordedHash[] {
    return this.hashes.slice();
  }
}

/** Peers exchange a hash every 10 ticks, including the initial tick 0. */
export function mpReportsHash(tick: number): boolean {
  return (tick >>> 0) % 10 === 0;
}
