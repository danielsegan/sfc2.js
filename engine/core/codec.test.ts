import { describe, expect, it } from 'vitest';
import { command, decodeCommand, decodeCommands, encodeCommand, encodeCommands } from './codec.ts';
import { createStreamFromState } from './rng.ts';

describe('command codec', () => {
  it('round-trips a little-endian envelope and sorts a bundle', () => {
    const first = command(4, 0, 1, 9, Uint8Array.from([1, 2, 3]));
    const second = command(4, 1, 0, 2, Uint8Array.from([9]));
    const bytes = encodeCommands([second, first]);
    expect(bytes[0]).toBe(2);
    const decoded = decodeCommands(bytes);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.commands.map((cmd) => [cmd.slot, cmd.seq, cmd.kind])).toEqual([
      [0, 1, 9],
      [1, 0, 2],
    ]);
    expect(Array.from(decoded.commands[0]!.payload)).toEqual([1, 2, 3]);
    const again = decodeCommands(encodeCommands(decoded.commands));
    expect(again).toEqual(decoded);
    const single = decodeCommand(encodeCommand(first));
    expect(single.ok).toBe(true);
    if (single.ok) expect(single.next).toBe(13);
  });

  it('rejects duplicates, truncated buffers, and random bytes without throwing', () => {
    const dup = command(1, 0, 0, 1, new Uint8Array());
    expect(decodeCommands(encodeCommands([dup, dup])).ok).toBe(false);
    expect(decodeCommand(new Uint8Array(4)).ok).toBe(false);
    const header = encodeCommand(command(1, 0, 0, 1, Uint8Array.from([1, 2])));
    expect(decodeCommand(header.slice(0, header.length - 1)).ok).toBe(false);
    const rng = createStreamFromState([1, 2, 3, 4]);
    for (let i = 0; i < 40; i++) {
      const len = rng.int(48);
      const buf = new Uint8Array(len);
      for (let j = 0; j < len; j++) buf[j] = rng.int(256);
      expect(() => decodeCommand(buf)).not.toThrow();
      expect(() => decodeCommands(buf)).not.toThrow();
    }
  });

  it('restarts seq at 0 for each tick when the session stamps commands', async () => {
    const { LocalSession } = await import('../net/session.ts');
    let tick = 0;
    const session = new LocalSession({ currentTick: () => tick });
    session.issue(1, new Uint8Array());
    session.issue(2, new Uint8Array());
    const first = session.commandsFor(1);
    expect(first.map((cmd) => cmd.seq)).toEqual([0, 1]);
    tick = 1;
    session.issue(1, new Uint8Array());
    expect(session.commandsFor(2).map((cmd) => cmd.seq)).toEqual([0]);
    expect(() => new LocalSession({ inputDelay: 1, currentTick: () => 0 })).toThrow(/inputDelay/);
    const delayed = new LocalSession({ inputDelay: 3, currentTick: () => 10 });
    delayed.issue(4, Uint8Array.from([7]));
    expect((delayed.commandsFor(13)[0]?.tick as number) ?? 0).toBe(13);
  });
});
