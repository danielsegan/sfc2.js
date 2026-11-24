import { describe, expect, it } from 'vitest';
import {
  actionFor,
  bindAction,
  chordFromEvent,
  defaultProfile,
  formatChord,
  isReserved,
} from './actions.ts';
import { createKeyTracker, sanitize } from './keymap.ts';

describe('modern keymap', () => {
  it('uses WASD, space, and the documented chords', () => {
    const profile = defaultProfile();
    expect(actionFor(profile, chordFromEvent({ code: 'KeyW', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('helm.speedUp');
    expect(actionFor(profile, chordFromEvent({ code: 'KeyA', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('helm.turnLeft');
    expect(actionFor(profile, chordFromEvent({ code: 'Space', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('weapons.fire');
    expect(actionFor(profile, chordFromEvent({ code: 'Tab', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false }))).toBe('target.prev');
    expect(actionFor(profile, chordFromEvent({ code: 'Digit1', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }))).toBe('weapons.assign1');
    expect(actionFor(profile, chordFromEvent({ code: 'KeyG', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false }))).toBe('ops.repel');
    expect(formatChord(profile['helm.stop'] ?? null)).toBe('X');
  });

  it('swaps a conflict and refuses a browser-reserved chord', () => {
    const profile = defaultProfile();
    const swapped = bindAction(profile, 'helm.stop', { code: 'KeyW', ctrl: false, shift: false, alt: false, meta: false });
    expect(swapped.swapped).toBe('helm.speedUp');
    expect(actionFor(swapped.profile, { code: 'KeyW', ctrl: false, shift: false, alt: false, meta: false })).toBe('helm.stop');
    expect(actionFor(swapped.profile, { code: 'KeyX', ctrl: false, shift: false, alt: false, meta: false })).toBe('helm.speedUp');
    const refused = bindAction(profile, 'helm.stop', { code: 'KeyW', ctrl: true, shift: false, alt: false, meta: false });
    expect(refused.rejected).toBe('reserved');
    expect(isReserved({ code: 'F5', ctrl: false, shift: false, alt: false, meta: false })).toBe(true);
    expect(refused.profile).toBe(profile);
  });

  it('tracks holds separately from one-shot keys', () => {
    const keys = createKeyTracker(sanitize(null));
    const down = (code: string, repeat = false) =>
      keys.press({ code, repeat, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false } as KeyboardEvent);
    expect(down('KeyA')).toBeNull();
    expect(keys.held('helm.turnLeft')).toBe(true);
    expect(down('KeyW')).toBe('helm.speedUp');
    expect(down('KeyW', true)).toBe('helm.speedUp');
    expect(down('Space', true)).toBeNull();
    keys.release({ code: 'KeyA', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false } as KeyboardEvent);
    expect(keys.held('helm.turnLeft')).toBe(false);
    keys.blur();
    expect(keys.held('helm.turnRight')).toBe(false);
  });
});
