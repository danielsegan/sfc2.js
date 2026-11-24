import type { Tick } from './brands.ts';
import { asTick } from './brands.ts';
import { readU16, readU32, writeU16, writeU32 } from './bytes.ts';

/** Command envelope. Canonical order is (tick, slot, seq). */
export interface Command {
  readonly tick: Tick;
  readonly slot: number;
  readonly seq: number;
  readonly kind: number;
  readonly payload: Uint8Array;
}

export interface CommandBody {
  readonly slot: number;
  readonly kind: number;
  readonly payload: Uint8Array;
}

export type DecodeResult =
  | { ok: true; command: Command; next: number }
  | { ok: false; error: string };

export function compareCommands(a: Command, b: Command): number {
  if (a.tick !== b.tick) return (a.tick as number) < (b.tick as number) ? -1 : 1;
  if (a.slot !== b.slot) return a.slot - b.slot;
  return a.seq - b.seq;
}

export function sameCommandKey(a: Command, b: Command): boolean {
  return a.tick === b.tick && a.slot === b.slot && a.seq === b.seq;
}

function copyPayload(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
}

/** Header is 10 bytes: u32 tick, u8 slot, u16 seq, u8 kind, u16 len, then payload. */
export function encodeCommand(cmd: Command): Uint8Array {
  if ((cmd.slot | 0) !== cmd.slot || cmd.slot < 0 || cmd.slot > 255) throw new Error('slot');
  if ((cmd.seq | 0) !== cmd.seq || cmd.seq < 0 || cmd.seq > 65535) throw new Error('seq');
  if ((cmd.kind | 0) !== cmd.kind || cmd.kind < 0 || cmd.kind > 255) throw new Error('kind');
  if (cmd.payload.length > 65535) throw new Error('payload length');
  const out = new Uint8Array(10 + cmd.payload.length);
  writeU32(out, 0, cmd.tick as number);
  out[4] = cmd.slot & 0xff;
  writeU16(out, 5, cmd.seq);
  out[7] = cmd.kind & 0xff;
  writeU16(out, 8, cmd.payload.length);
  out.set(cmd.payload, 10);
  return out;
}

export function decodeCommand(bytes: Uint8Array, offset = 0): DecodeResult {
  if (!Number.isInteger(offset) || offset < 0 || offset > bytes.length) {
    return { ok: false, error: 'offset' };
  }
  if (bytes.length - offset < 10) return { ok: false, error: 'short header' };
  const len = readU16(bytes, offset + 8);
  const start = offset + 10;
  if (bytes.length - start < len) return { ok: false, error: 'short payload' };
  const payload = bytes.slice(start, start + len);
  return {
    ok: true,
    command: {
      tick: asTick(readU32(bytes, offset)),
      slot: bytes[offset + 4]!,
      seq: readU16(bytes, offset + 5),
      kind: bytes[offset + 7]!,
      payload,
    },
    next: start + len,
  };
}

export type BundleResult = { ok: true; commands: readonly Command[] } | { ok: false; error: string };

/** u32 count, then that many commands. Duplicates fail. The result is sorted (tick, slot, seq). */
export function encodeCommands(cmds: readonly Command[]): Uint8Array {
  const parts = cmds.map(encodeCommand);
  let n = 4;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  writeU32(out, 0, cmds.length);
  let offset = 4;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function decodeCommands(bytes: Uint8Array): BundleResult {
  if (bytes.length < 4) return { ok: false, error: 'short bundle' };
  const count = readU32(bytes, 0);
  if (count > bytes.length) return { ok: false, error: 'count' };
  const commands: Command[] = [];
  let offset = 4;
  for (let i = 0; i < count; i++) {
    const decoded = decodeCommand(bytes, offset);
    if (!decoded.ok) return decoded;
    commands.push(decoded.command);
    offset = decoded.next;
  }
  if (offset !== bytes.length) return { ok: false, error: 'trailing bytes' };
  commands.sort(compareCommands);
  for (let i = 1; i < commands.length; i++) {
    if (sameCommandKey(commands[i - 1]!, commands[i]!)) return { ok: false, error: 'duplicate' };
  }
  return { ok: true, commands };
}

export function command(tick: number, slot: number, seq: number, kind: number, payload: Uint8Array): Command {
  return { tick: asTick(tick), slot, seq, kind, payload: copyPayload(payload) };
}
