import { readU16, readU32, writeU16, writeU32 } from '../core/bytes.ts';
import {
  command,
  compareCommands,
  decodeCommand,
  encodeCommands,
  sameCommandKey,
  type Command,
} from '../core/codec.ts';
import type { Snapshot, SnapshotCommand } from '../sim/sim.ts';

/** ASCII magic. The format number lives in the next field, not in these bytes. */
export const REPLAY_MAGIC = new Uint8Array([
  0x53, 0x46, 0x43, 0x32, 0x52, 0x50, 0x4c, 0x59,
]);

export const REPLAY_EXTENSION = '.s2replay';

/** Caps so a corrupt file cannot make CI walk a huge buffer. */
const MAX_TICKS = 100_000;
const MAX_ID_LEN = 64;
const MAX_SETTINGS = 64;
const MAX_BLOB = 1_000_000;

export interface ReplaySettings {
  readonly inputDelay: number;
  readonly hashPeriod: number;
}

export interface HashSample {
  readonly tick: number;
  readonly stateHash: number;
  readonly eventHash: number;
}

export interface ReplayFile {
  readonly replayFormat: number;
  readonly simSourceHash: number;
  readonly dataHash: number;
  readonly versionHash: number;
  readonly scenarioHash: number;
  readonly seed: number;
  readonly tickCount: number;
  readonly scenarioId: string;
  readonly settings: ReplaySettings;
  readonly slots: readonly number[];
  readonly snapshot: Snapshot;
  readonly commands: readonly Command[];
  readonly hashes: readonly HashSample[];
}

export type DecodeReplay =
  | { readonly ok: true; readonly replay: ReplayFile }
  | { readonly ok: false; readonly error: string };

class Writer {
  private bytes = new Uint8Array(256);
  private length = 0;

  private grow(extra: number): void {
    if (this.length + extra <= this.bytes.length) return;
    let cap = this.bytes.length;
    while (cap < this.length + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.bytes.subarray(0, this.length));
    this.bytes = next;
  }

  u8(value: number): void {
    this.grow(1);
    this.bytes[this.length] = value & 0xff;
    this.length += 1;
  }

  u16(value: number): void {
    this.grow(2);
    writeU16(this.bytes, this.length, value);
    this.length += 2;
  }

  u32(value: number): void {
    this.grow(4);
    writeU32(this.bytes, this.length, value);
    this.length += 4;
  }

  i32(value: number): void {
    this.u32(value | 0);
  }

  bytesOf(src: Uint8Array): void {
    this.grow(src.length);
    this.bytes.set(src, this.length);
    this.length += src.length;
  }

  done(): Uint8Array {
    return this.bytes.slice(0, this.length);
  }
}

class Reader {
  private offset = 0;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  private need(n: number): void {
    if (!Number.isInteger(n) || n < 0 || this.offset + n > this.bytes.length) {
      throw new Error('truncated');
    }
  }

  u8(): number {
    this.need(1);
    const value = this.bytes[this.offset]!;
    this.offset += 1;
    return value;
  }

  u16(): number {
    this.need(2);
    const value = readU16(this.bytes, this.offset);
    this.offset += 2;
    return value;
  }

  u32(): number {
    this.need(4);
    const value = readU32(this.bytes, this.offset);
    this.offset += 4;
    return value;
  }

  i32(): number {
    return this.u32() | 0;
  }

  bytesOf(n: number): Uint8Array {
    this.need(n);
    const slice = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }

  ascii(n: number): string {
    const raw = this.bytesOf(n);
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      const code = raw[i]!;
      if (code < 0x20 || code > 0x7e) throw new Error('non-ascii');
      out += String.fromCharCode(code);
    }
    return out;
  }

  expectEnd(): void {
    if (this.offset !== this.bytes.length) throw new Error('trailing bytes');
  }
}

export function isPlayerSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot <= 5;
}

export function isValidInputDelay(delay: number): boolean {
  return delay === 0 || (delay >= 2 && delay <= 4);
}

/** Ticks that must carry a hash sample. Tick 0 and the final tick are always included. */
export function sampleTicks(tickCount: number, hashPeriod: number): number[] {
  const out: number[] = [];
  for (let tick = 0; tick <= tickCount; tick++) {
    if (tick === 0 || tick === tickCount || tick % hashPeriod === 0) out.push(tick);
  }
  return out;
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) throw new Error('non-ascii');
    out[i] = code;
  }
  return out;
}

function validScenarioId(id: string): boolean {
  if (id.length === 0 || id.length > MAX_ID_LEN) return false;
  for (let i = 0; i < id.length; i++) {
    const code = id.charCodeAt(i);
    const digit = code >= 0x30 && code <= 0x39;
    const lower = code >= 0x61 && code <= 0x7a;
    const dash = code === 0x2d;
    if (!digit && !lower && !dash) return false;
  }
  if (id.charCodeAt(0) === 0x2d || id.charCodeAt(id.length - 1) === 0x2d) return false;
  return true;
}

export function encodeSettings(settings: ReplaySettings): Uint8Array {
  if (!isValidInputDelay(settings.inputDelay)) throw new Error('inputDelay');
  if (!Number.isInteger(settings.hashPeriod) || settings.hashPeriod < 1 || settings.hashPeriod > 65535) {
    throw new Error('hashPeriod');
  }
  const out = new Uint8Array(4);
  out[0] = 1;
  out[1] = settings.inputDelay & 0xff;
  writeU16(out, 2, settings.hashPeriod);
  return out;
}

export function decodeSettings(bytes: Uint8Array): ReplaySettings {
  if (bytes.length !== 4) throw new Error('settings length');
  if (bytes[0] !== 1) throw new Error('settings version');
  const inputDelay = bytes[1]!;
  const hashPeriod = readU16(bytes, 2);
  if (!isValidInputDelay(inputDelay)) throw new Error('inputDelay');
  if (hashPeriod < 1) throw new Error('hashPeriod');
  return { inputDelay, hashPeriod };
}

function encodeSnapshot(snap: Snapshot): Uint8Array {
  const w = new Writer();
  w.u32(snap.tick >>> 0);
  w.u32(snap.rng.length);
  for (const row of snap.rng) {
    if (row.length !== 4) throw new Error('rng width');
    w.u32(row[0]);
    w.u32(row[1]);
    w.u32(row[2]);
    w.u32(row[3]);
  }
  const world = snap.world;
  if (
    world.generations.length !== world.slotCount ||
    world.live.length !== world.slotCount ||
    world.retired.length !== world.slotCount
  ) {
    throw new Error('slot width');
  }
  w.u32(world.slotCount);
  for (let i = 0; i < world.slotCount; i++) {
    w.u32(world.generations[i]!);
    w.u32(world.live[i]!);
    w.u32(world.retired[i]!);
  }
  w.u32(world.pendingDespawn.length);
  for (const id of world.pendingDespawn) w.u32(id >>> 0);
  w.u32(world.tables.length);
  for (const table of world.tables) {
    const id = asciiBytes(table.id);
    w.u16(id.length);
    w.bytesOf(id);
    w.u16(table.fieldCount);
    w.u32(table.data.length);
    for (const value of table.data) w.i32(value);
  }
  const queued: Command[] = [];
  for (const cmd of snap.queued) {
    queued.push(command(cmd.tick, cmd.slot, cmd.seq, cmd.kind, cmd.payload));
  }
  const bundle = encodeCommands(queued);
  w.u32(bundle.length);
  w.bytesOf(bundle);
  return w.done();
}

function readBundle(
  bytes: Uint8Array,
  mode: 'log' | 'queue',
): { ok: true; commands: Command[] } | { ok: false; error: string } {
  if (bytes.length < 4) return { ok: false, error: 'short bundle' };
  const count = readU32(bytes, 0);
  if (count > bytes.length) return { ok: false, error: 'count' };
  const commands: Command[] = [];
  let offset = 4;
  for (let i = 0; i < count; i++) {
    const decoded = decodeCommand(bytes, offset);
    if (!decoded.ok) return decoded;
    const cmd = decoded.command;
    if (mode === 'log' && !isPlayerSlot(cmd.slot)) {
      return { ok: false, error: 'internal slot must not be logged' };
    }
    if (mode === 'log' && commands.length > 0) {
      const cmp = compareCommands(commands[commands.length - 1]!, cmd);
      if (cmp === 0) return { ok: false, error: 'duplicate' };
      if (cmp > 0) return { ok: false, error: 'commands are not in canonical order' };
    }
    commands.push(cmd);
    offset = decoded.next;
  }
  if (offset !== bytes.length) return { ok: false, error: 'trailing bytes' };
  if (mode === 'queue') {
    const copy = commands.slice().sort(compareCommands);
    for (let i = 1; i < copy.length; i++) {
      if (sameCommandKey(copy[i - 1]!, copy[i]!)) return { ok: false, error: 'duplicate' };
    }
  }
  return { ok: true, commands };
}

function decodeSnapshot(bytes: Uint8Array): Snapshot {
  const r = new Reader(bytes);
  const tick = r.u32();
  const streamCount = r.u32();
  if (streamCount !== 3) throw new Error('rng streams');
  const rng: [number, number, number, number][] = [];
  for (let i = 0; i < streamCount; i++) {
    rng.push([r.u32(), r.u32(), r.u32(), r.u32()]);
  }
  const slotCount = r.u32();
  if (slotCount > 65536) throw new Error('slot count');
  const generations: number[] = [];
  const live: number[] = [];
  const retired: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    generations.push(r.u32());
    live.push(r.u32());
    retired.push(r.u32());
  }
  const pendingCount = r.u32();
  if (pendingCount > slotCount) throw new Error('pending count');
  const pendingDespawn: number[] = [];
  for (let i = 0; i < pendingCount; i++) pendingDespawn.push(r.u32());
  const tableCount = r.u32();
  if (tableCount > 64) throw new Error('table count');
  const tables: Snapshot['world']['tables'][number][] = [];
  for (let i = 0; i < tableCount; i++) {
    const idLen = r.u16();
    if (idLen === 0 || idLen > MAX_ID_LEN) throw new Error('table id');
    const id = r.ascii(idLen);
    const fieldCount = r.u16();
    if (fieldCount === 0) throw new Error('table width');
    const n = r.u32();
    if (n !== slotCount * fieldCount) throw new Error('table data');
    const data: number[] = [];
    for (let k = 0; k < n; k++) data.push(r.i32());
    tables.push({ id, fieldCount, data });
  }
  const bundleLen = r.u32();
  if (bundleLen > MAX_BLOB) throw new Error('queued length');
  const bundle = readBundle(r.bytesOf(bundleLen), 'queue');
  if (!bundle.ok) throw new Error(bundle.error);
  r.expectEnd();
  const queued: SnapshotCommand[] = [];
  for (const cmd of bundle.commands) {
    queued.push({
      tick: cmd.tick as number,
      slot: cmd.slot,
      seq: cmd.seq,
      kind: cmd.kind,
      payload: cmd.payload,
    });
  }
  return {
    tick,
    rng,
    world: { slotCount, generations, live, retired, pendingDespawn, tables },
    queued,
  };
}

export function commandLogError(
  commands: readonly Command[],
  slots: readonly number[],
  tickCount: number,
): string | null {
  const allowed: number[] = [];
  for (const slot of slots) allowed.push(slot);
  const groups: number[][] = [];
  const groupKey: string[] = [];
  for (const cmd of commands) {
    const tick = cmd.tick as number;
    if (!Number.isInteger(tick) || tick < 1 || tick > tickCount) return 'command tick';
    let found = false;
    for (const slot of allowed) {
      if (slot === cmd.slot) found = true;
    }
    if (!found) return 'command slot is not in the header';
    const key = `${String(tick)}:${String(cmd.slot)}`;
    let index = -1;
    for (let i = 0; i < groupKey.length; i++) {
      if (groupKey[i] === key) index = i;
    }
    if (index < 0) {
      groupKey.push(key);
      groups.push([cmd.seq]);
    } else {
      groups[index]!.push(cmd.seq);
    }
  }
  for (const seqs of groups) {
    const sorted = seqs.slice().sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i) return 'seq must be dense from 0';
    }
  }
  return null;
}

function hashListError(hashes: readonly HashSample[], tickCount: number, hashPeriod: number): string | null {
  const expect = sampleTicks(tickCount, hashPeriod);
  if (hashes.length !== expect.length) return 'hash count';
  for (let i = 0; i < expect.length; i++) {
    const sample = hashes[i]!;
    if (sample.tick !== expect[i]) return 'hash tick cadence';
  }
  return null;
}

export function encodeReplay(replay: ReplayFile): Uint8Array {
  if (!validScenarioId(replay.scenarioId)) throw new Error('scenario id');
  if (!Number.isInteger(replay.tickCount) || replay.tickCount < 1 || replay.tickCount > MAX_TICKS) {
    throw new Error('tickCount');
  }
  if (!Number.isInteger(replay.seed) || replay.seed < 0 || replay.seed > 0xffffffff) throw new Error('seed');
  const slots = replay.slots;
  if (slots.length === 0 || slots.length > 6) throw new Error('slots');
  for (let i = 0; i < slots.length; i++) {
    if (!isPlayerSlot(slots[i]!)) throw new Error('slots');
    if (i > 0 && slots[i]! <= slots[i - 1]!) throw new Error('slots are not strictly increasing');
  }
  const logError = commandLogError(replay.commands, slots, replay.tickCount);
  if (logError) throw new Error(logError);
  for (let i = 1; i < replay.commands.length; i++) {
    if (compareCommands(replay.commands[i - 1]!, replay.commands[i]!) >= 0) {
      throw new Error('commands are not in canonical order');
    }
  }
  const cadence = hashListError(replay.hashes, replay.tickCount, replay.settings.hashPeriod);
  if (cadence) throw new Error(cadence);
  const settings = encodeSettings(replay.settings);
  const id = asciiBytes(replay.scenarioId);
  const snapshot = encodeSnapshot(replay.snapshot);
  if (snapshot.length > MAX_BLOB) throw new Error('snapshot length');
  const bundle = encodeCommands(replay.commands);
  if (bundle.length > MAX_BLOB) throw new Error('command length');
  const w = new Writer();
  w.bytesOf(REPLAY_MAGIC);
  w.u32(replay.replayFormat);
  w.u32(replay.simSourceHash);
  w.u32(replay.dataHash);
  w.u32(replay.versionHash);
  w.u32(replay.scenarioHash);
  w.u32(replay.seed);
  w.u32(replay.tickCount);
  w.u16(id.length);
  w.bytesOf(id);
  w.u32(settings.length);
  w.bytesOf(settings);
  w.u8(slots.length);
  for (const slot of slots) w.u8(slot);
  w.u32(snapshot.length);
  w.bytesOf(snapshot);
  w.u32(bundle.length);
  w.bytesOf(bundle);
  w.u32(replay.hashes.length);
  for (const sample of replay.hashes) {
    w.u32(sample.tick);
    w.u32(sample.stateHash);
    w.u32(sample.eventHash);
  }
  return w.done();
}

/** Encode and decode a snapshot. Used to prove the tick-0 image round-trips, including queued commands. */
export function roundTripSnapshot(snap: Snapshot): Snapshot {
  return decodeSnapshot(encodeSnapshot(snap));
}

export function decodeReplay(bytes: Uint8Array): DecodeReplay {
  try {
    const r = new Reader(bytes);
    for (let i = 0; i < REPLAY_MAGIC.length; i++) {
      if (r.u8() !== REPLAY_MAGIC[i]) return { ok: false, error: 'not a replay file' };
    }
    const replayFormat = r.u32();
    const simSourceHash = r.u32();
    const dataHash = r.u32();
    const versionHash = r.u32();
    const scenarioHash = r.u32();
    const seed = r.u32();
    const tickCount = r.u32();
    if (tickCount < 1 || tickCount > MAX_TICKS) return { ok: false, error: 'tickCount' };
    const idLen = r.u16();
    if (idLen === 0 || idLen > MAX_ID_LEN) return { ok: false, error: 'scenario id' };
    const scenarioId = r.ascii(idLen);
    if (!validScenarioId(scenarioId)) return { ok: false, error: 'scenario id' };
    const settingsLen = r.u32();
    if (settingsLen === 0 || settingsLen > MAX_SETTINGS) return { ok: false, error: 'settings length' };
    const settings = decodeSettings(r.bytesOf(settingsLen));
    const slotCount = r.u8();
    if (slotCount === 0 || slotCount > 6) return { ok: false, error: 'slots' };
    const slots: number[] = [];
    for (let i = 0; i < slotCount; i++) {
      const slot = r.u8();
      if (!isPlayerSlot(slot)) return { ok: false, error: 'slots' };
      if (slots.length > 0 && slot <= slots[slots.length - 1]!) {
        return { ok: false, error: 'slots are not strictly increasing' };
      }
      slots.push(slot);
    }
    const snapshotLen = r.u32();
    if (snapshotLen > MAX_BLOB) return { ok: false, error: 'snapshot length' };
    const snapshot = decodeSnapshot(r.bytesOf(snapshotLen));
    const commandLen = r.u32();
    if (commandLen > MAX_BLOB) return { ok: false, error: 'command length' };
    const bundle = readBundle(r.bytesOf(commandLen), 'log');
    if (!bundle.ok) return bundle;
    const logError = commandLogError(bundle.commands, slots, tickCount);
    if (logError) return { ok: false, error: logError };
    const hashCount = r.u32();
    if (hashCount > tickCount + 1) return { ok: false, error: 'hash count' };
    const hashes: HashSample[] = [];
    for (let i = 0; i < hashCount; i++) {
      hashes.push({ tick: r.u32(), stateHash: r.u32(), eventHash: r.u32() });
    }
    r.expectEnd();
    const cadence = hashListError(hashes, tickCount, settings.hashPeriod);
    if (cadence) return { ok: false, error: cadence };
    return {
      ok: true,
      replay: {
        replayFormat,
        simSourceHash,
        dataHash,
        versionHash,
        scenarioHash,
        seed,
        tickCount,
        scenarioId,
        settings,
        slots,
        snapshot,
        commands: bundle.commands,
        hashes,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'decode';
    return { ok: false, error: message };
  }
}
