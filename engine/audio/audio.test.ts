import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSounds } from '@sfc2js/formats';
import { createCosmeticRng, emptyBoard, pickEntry, triggerCue } from './board.ts';
import { cuesForFrame, emptyAudioMemory, type AudioFrame } from './cues.ts';
import { readSoundIndex } from './load-index.ts';

const fixture = parseSounds(readFileSync('tools/fixtures/formats/sounds/minimal.txt', 'utf8'), {
  file: 'assets/sounds/sounds.txt',
}).data;

function frame(partial: Partial<AudioFrame> = {}): AudioFrame {
  return {
    events: partial.events ?? [],
    weapons: partial.weapons ?? [],
    shields: partial.shields ?? [],
    shotIds: partial.shotIds ?? [],
    selfId: partial.selfId,
  };
}

describe('cue mapping', () => {
  it('plays a phaser when a ready mount fires and a hit lands', () => {
    const memory = { ready: [0], shotIds: [] };
    const result = cuesForFrame(
      frame({
        weapons: [{ slotIndex: 0, family: 'phaser', ready: false }],
        shields: [{ current: 8 }],
        events: [{ kind: 'hit', tick: 1, ship: 2, facing: 0, amount: 3 }],
      }),
      memory,
    );
    expect(result.cues).toEqual(['weapon.fire.phaser', 'impact.shield']);
  });

  it('plays a photon when a new shot appears, and a hull hit when the facing is empty', () => {
    const result = cuesForFrame(
      frame({
        weapons: [{ slotIndex: 1, family: 'photon', ready: false }],
        shields: [{ current: 0 }],
        shotIds: [9],
        selfId: 1,
        events: [{ kind: 'hit', tick: 2, ship: 1, facing: 0, amount: 4 }],
      }),
      { ready: [1], shotIds: [] },
    );
    expect(result.cues).toEqual(['weapon.fire.photon', 'impact.hull', 'shield.down']);
  });

  it('does not treat a mode change as a shot when nothing was hit', () => {
    const result = cuesForFrame(
      frame({ weapons: [{ slotIndex: 0, family: 'phaser', ready: false }] }),
      { ready: [0], shotIds: [] },
    );
    expect(result.cues).toEqual([]);
    expect(result.memory.ready).toEqual([]);
  });

  it('raises an alert cue from a critical event and from overdraw', () => {
    const result = cuesForFrame(
      frame({
        events: [
          { kind: 'alert', tick: 1, id: 'shieldDepleted', severity: 'warn', ship: 1, amount: 0 },
          { kind: 'alert', tick: 1, id: 'overDraw', severity: 'warn', ship: 1, amount: 0 },
          { kind: 'alert', tick: 1, id: 'hull', severity: 'crit', ship: 1, amount: 0 },
        ],
      }),
      emptyAudioMemory(),
    );
    expect(result.cues).toEqual(['shield.down', 'alert.red', 'alert.yellow']);
  });
});

describe('sound board', () => {
  it('resolves invented cue names to the fixture filenames', () => {
    const rng = createCosmeticRng(1);
    const phaser = pickEntry(fixture, 'weapon.fire.phaser', rng);
    expect(['sounds/test-phaser.wav', 'sounds/test-phaser-alt.wav']).toContain(phaser?.filename);
    expect(pickEntry(fixture, 'impact.shield', () => 0)?.filename).toBe('sounds/test-shield-hit.wav');
    expect(pickEntry(fixture, 'shield.raise', () => 0)?.identifier).toBe('testRaiseShield');
    expect(pickEntry(fixture, 'alert.red', () => 0)?.identifier).toBe('testRedAlert');
    expect(pickEntry(fixture, 'ui.click', () => 0)).toBeNull();
  });

  it('skips a class that is already at its cap when preempt is never', () => {
    const rng = () => 0;
    const first = triggerCue(fixture, emptyBoard(), 'impact.shield', 0, rng);
    expect(first.shot?.filename).toBe('sounds/test-shield-hit.wav');
    const second = triggerCue(fixture, first.state, 'impact.shield', 100, rng);
    expect(second.shot).toBeNull();
    const later = triggerCue(fixture, first.state, 'impact.shield', 5000, rng);
    expect(later.shot?.filename).toBe('sounds/test-shield-hit.wav');
  });

  it('refuses Interplay-compressed rows', () => {
    const index = parseSounds(
      'wave\tcompressed\tsounds/skip.wav\tinvented phaser fire\t\t2\t\t\t\t\t\t\t\t\t3\t\t\t10\tTest Effects\t\t\t80\t80\nclass\tTest Effects\t1\t4\n',
    ).data;
    const played = triggerCue(index, emptyBoard(), 'weapon.fire.phaser', 0, () => 0);
    expect(played.shot).toBeNull();
  });
});

describe('readSoundIndex', () => {
  it('uses the first non-empty candidate and skips a missing path', async () => {
    const files = new Map<string, Uint8Array>([
      ['Assets/Sounds/sounds.txt', new TextEncoder().encode('class\tTest Effects\t1\t4\nwave\ttestRedAlert\tsounds/test-red.wav\tinvented red alert\n')],
    ]);
    const found = await readSoundIndex(async (path) => files.get(path) ?? null);
    expect(found?.file).toBe('Assets/Sounds/sounds.txt');
    expect(found?.index.classes[0]?.name).toBe('Test Effects');
    expect(await readSoundIndex(async () => null)).toBeNull();
  });
});
