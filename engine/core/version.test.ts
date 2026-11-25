import { describe, expect, it } from 'vitest';
import { REPLAY_FORMAT, simSourceHash, versionHash } from './version.ts';

const enc = new TextEncoder();

describe('version hash', () => {
  it('pins the combine vectors', () => {
    const sources = [
      { path: 'engine/sim/b.ts', bytes: enc.encode('b') },
      { path: 'engine/core/a.ts', bytes: enc.encode('a') },
    ];
    expect(simSourceHash(sources)).toBe(0x93bfb71e);
    expect(versionHash(1, 0, 0)).toBe(0x95a46444);
    expect(versionHash(1, 0x12345678, 0x9abcdef0)).toBe(0xf76f0aa9);
    expect(versionHash(REPLAY_FORMAT, simSourceHash(sources), 0x11111111)).toBe(
      versionHash(2, 0x93bfb71e, 0x11111111),
    );
    expect(versionHash(2, 0x93bfb71e, 0x11111111)).not.toBe(versionHash(1, 0x93bfb71e, 0x11111111));
  });

  it('mixes format, sim sources, and data, and ignores files the caller omits', () => {
    const sources = [
      { path: 'engine/sim/b.ts', bytes: enc.encode('b') },
      { path: 'engine/core/a.ts', bytes: enc.encode('a') },
    ];
    const source = simSourceHash(sources);
    const data = 0x11111111;
    const combined = versionHash(REPLAY_FORMAT, source, data);
    expect(simSourceHash(sources.slice().reverse())).toBe(source);
    expect(versionHash(REPLAY_FORMAT, source, data)).toBe(combined);
    const edited = simSourceHash([
      sources[1]!,
      { path: sources[0]!.path, bytes: enc.encode('B') },
    ]);
    expect(edited).not.toBe(source);
    expect(versionHash(REPLAY_FORMAT, edited, data)).not.toBe(combined);
    expect(versionHash(REPLAY_FORMAT, source, data + 1)).not.toBe(combined);
    expect(simSourceHash(sources)).toBe(source);
  });
});
