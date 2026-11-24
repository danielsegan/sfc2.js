import { asTick, type Tick } from '../core/brands.ts';
import { ByteBuf } from '../core/bytes.ts';
import {
  command,
  compareCommands,
  sameCommandKey,
  type Command,
  type CommandBody,
} from '../core/codec.ts';
import { EMPTY_GAME_DATABASE, type GameDatabase } from '../core/database.ts';
import { setFxLogTick } from '../core/fx.ts';
import { createRngStreams, type RngStreams } from '../core/rng.ts';
import { xxhash32 } from '../core/xxhash32.ts';
import { World, type TableSpec, type WorldSnap } from './world.ts';

export const PHASES = [
  'input',
  'aiMission',
  'energy',
  'movement',
  'weapons',
  'damage',
  'cleanup',
] as const;

export type Phase = (typeof PHASES)[number];

export interface SimEvent {
  readonly tick: Tick;
  readonly kind: number;
  readonly entity: number;
  readonly a: number;
  readonly b: number;
}

export interface TickContext {
  readonly tick: Tick;
  readonly rng: RngStreams;
  readonly db: GameDatabase;
  emit(event: { kind: number; entity: number; a: number; b: number }): void;
  queue(body: CommandBody): void;
}

export interface SimSystem {
  readonly id: string;
  readonly phase: Phase;
  readonly priority: number;
  step(world: World, ctx: TickContext): void;
}

export interface CommandHandler {
  readonly kind: number;
  apply(world: World, command: Command, ctx: TickContext): void;
}

export interface SnapshotCommand {
  readonly tick: number;
  readonly slot: number;
  readonly seq: number;
  readonly kind: number;
  readonly payload: Uint8Array;
}

export interface Snapshot {
  readonly tick: number;
  readonly rng: readonly (readonly [number, number, number, number])[];
  readonly world: WorldSnap;
  readonly queued: readonly SnapshotCommand[];
}

export interface StepResult {
  readonly tick: Tick;
  readonly events: readonly SimEvent[];
  readonly hash: number;
  readonly eventHash: number;
}

export interface Sim {
  readonly tick: Tick;
  step(commands: readonly Command[]): StepResult;
  snapshot(): Snapshot;
  restore(snapshot: Snapshot): void;
  stateHash(): number;
  canonicalBytes(): Uint8Array;
  resolvedSystemIds(): readonly string[];
}

export interface CreateSimOptions {
  readonly seed: number;
  readonly database?: GameDatabase;
  readonly systems?: readonly SimSystem[];
  readonly handlers?: readonly CommandHandler[];
  readonly tables?: readonly TableSpec[];
}

export function hashEvents(events: readonly SimEvent[]): number {
  const buf = new ByteBuf();
  buf.u32(events.length);
  for (const event of events) {
    buf.u32(event.tick as number);
    buf.i32(event.kind);
    buf.i32(event.entity);
    buf.i32(event.a);
    buf.i32(event.b);
  }
  return xxhash32(buf.toUint8(), 0);
}

function phaseRank(phase: Phase): number {
  for (let i = 0; i < PHASES.length; i++) {
    if (PHASES[i] === phase) return i;
  }
  throw new Error('unknown phase');
}

function isInternalSlot(slot: number): boolean {
  return (slot >= 8 && slot <= 15) || slot === 255;
}

function copyBytes(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
}

function freezeSnapshot(snap: Snapshot): Snapshot {
  Object.freeze(snap.rng);
  for (const row of snap.rng) Object.freeze(row);
  Object.freeze(snap.queued);
  for (const cmd of snap.queued) Object.freeze(cmd);
  Object.freeze(snap.world.generations);
  Object.freeze(snap.world.live);
  Object.freeze(snap.world.retired);
  Object.freeze(snap.world.pendingDespawn);
  Object.freeze(snap.world.tables);
  for (const table of snap.world.tables) {
    Object.freeze(table.data);
    Object.freeze(table);
  }
  Object.freeze(snap.world);
  return Object.freeze(snap);
}

class Simulation implements Sim {
  private tickValue = 0;
  private runningTick = 0;
  private phase: Phase = 'input';
  private readonly rng: RngStreams;
  private readonly db: GameDatabase;
  private readonly world: World;
  private readonly handlers: (CommandHandler | undefined)[];
  private readonly byPhase: SimSystem[][];
  private readonly order: readonly string[];
  private queued: Command[] = [];
  private events: SimEvent[] = [];
  private readonly ctx: TickContext;

  constructor(options: CreateSimOptions) {
    this.rng = createRngStreams(options.seed);
    this.db = options.database ?? EMPTY_GAME_DATABASE;
    this.world = new World(options.tables ?? []);
    this.handlers = [];
    for (let i = 0; i < 256; i++) this.handlers.push(undefined);
    for (const handler of options.handlers ?? []) {
      if (!Number.isInteger(handler.kind) || handler.kind < 0 || handler.kind > 255) {
        throw new Error('handler kind');
      }
      if (this.handlers[handler.kind]) throw new Error('duplicate handler');
      this.handlers[handler.kind] = handler;
    }
    const systems = (options.systems ?? []).slice();
    for (let i = 0; i < systems.length; i++) {
      const sys = systems[i]!;
      if (sys.id.length === 0) throw new Error('system id');
      if (!Number.isInteger(sys.priority)) throw new Error('system priority');
      phaseRank(sys.phase);
      for (let j = i + 1; j < systems.length; j++) {
        if (systems[j]!.id === sys.id) throw new Error(`duplicate system ${sys.id}`);
      }
    }
    systems.sort((a, b) => {
      const rank = phaseRank(a.phase) - phaseRank(b.phase);
      if (rank !== 0) return rank;
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
    this.order = systems.map((sys) => sys.id);
    this.byPhase = PHASES.map(() => []);
    for (const sys of systems) this.byPhase[phaseRank(sys.phase)]!.push(sys);
    const self = this;
    this.ctx = {
      get tick() {
        return asTick(self.runningTick);
      },
      rng: this.rng,
      db: this.db,
      emit(event) {
        self.events.push({
          tick: asTick(self.runningTick),
          kind: event.kind | 0,
          entity: event.entity | 0,
          a: event.a | 0,
          b: event.b | 0,
        });
      },
      queue(body) {
        self.queueInternal(body);
      },
    };
  }

  get tick(): Tick {
    return asTick(this.tickValue);
  }

  resolvedSystemIds(): readonly string[] {
    return this.order;
  }

  step(commands: readonly Command[]): StepResult {
    const next = (this.tickValue + 1) >>> 0;
    setFxLogTick(next);
    for (const cmd of commands) {
      if ((cmd.tick as number) !== next) throw new Error('command is for a different tick');
    }
    const pending = this.queued;
    this.queued = [];
    const merged = pending.slice();
    for (const cmd of commands) merged.push(cmd);
    merged.sort(compareCommands);
    for (let i = 1; i < merged.length; i++) {
      if (sameCommandKey(merged[i - 1]!, merged[i]!)) throw new Error('duplicate command');
    }
    this.runningTick = next;
    this.events = [];
    for (let p = 0; p < PHASES.length; p++) {
      const phase = PHASES[p]!;
      this.phase = phase;
      if (phase === 'input') this.applyAll(merged);
      const group = this.byPhase[p]!;
      for (const sys of group) sys.step(this.world, this.ctx);
      if (phase === 'cleanup') this.world.flushDespawns();
    }
    this.tickValue = next;
    const events = this.events.slice();
    const hash = this.stateHash();
    return { tick: asTick(next), events, hash, eventHash: hashEvents(events) };
  }

  snapshot(): Snapshot {
    const queued: SnapshotCommand[] = [];
    for (const cmd of this.queued) {
      queued.push({
        tick: cmd.tick as number,
        slot: cmd.slot,
        seq: cmd.seq,
        kind: cmd.kind,
        payload: copyBytes(cmd.payload),
      });
    }
    return freezeSnapshot({
      tick: this.tickValue,
      rng: this.rng.states(),
      world: this.world.capture(),
      queued,
    });
  }

  restore(snapshot: Snapshot): void {
    this.tickValue = snapshot.tick >>> 0;
    this.runningTick = this.tickValue;
    this.rng.restore(snapshot.rng);
    this.world.restore(snapshot.world);
    this.queued = [];
    for (const cmd of snapshot.queued) {
      this.queued.push(command(cmd.tick, cmd.slot, cmd.seq, cmd.kind, cmd.payload));
    }
    this.events = [];
  }

  stateHash(): number {
    return xxhash32(this.canonicalBytes(), 0);
  }

  canonicalBytes(): Uint8Array {
    const buf = new ByteBuf();
    buf.u32(this.tickValue);
    const states = this.rng.states();
    for (const state of states) {
      buf.u32(state[0]);
      buf.u32(state[1]);
      buf.u32(state[2]);
      buf.u32(state[3]);
    }
    this.world.writeState(buf);
    const queued = this.queued.slice().sort(compareCommands);
    buf.u32(queued.length);
    for (const cmd of queued) {
      buf.u32(cmd.tick as number);
      buf.u32(cmd.slot);
      buf.u32(cmd.seq);
      buf.u32(cmd.kind);
      buf.u32(cmd.payload.length);
      buf.bytes(cmd.payload);
    }
    return buf.toUint8();
  }

  private applyAll(commands: readonly Command[]): void {
    for (const cmd of commands) {
      if (cmd.kind < 0 || cmd.kind > 255) throw new Error('command kind');
      const handler = this.handlers[cmd.kind];
      if (!handler) throw new Error(`no handler for command kind ${String(cmd.kind)}`);
      handler.apply(this.world, cmd, this.ctx);
    }
  }

  private queueInternal(body: CommandBody): void {
    if (this.phase !== 'aiMission') throw new Error('queue is only valid in aiMission');
    if (!isInternalSlot(body.slot)) throw new Error('queue slot');
    if (!Number.isInteger(body.kind) || body.kind < 0 || body.kind > 255) throw new Error('queue kind');
    let seq = 0;
    for (const cmd of this.queued) {
      if (cmd.slot === body.slot) seq += 1;
    }
    if (seq > 65535) throw new Error('seq overflow');
    this.queued.push(
      command((this.runningTick + 1) >>> 0, body.slot, seq, body.kind, copyBytes(body.payload)),
    );
  }
}

export function createSim(options: CreateSimOptions): Sim {
  return new Simulation(options);
}
