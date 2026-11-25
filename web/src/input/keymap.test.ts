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
    expect(actionFor(profile, chordFromEvent({ code: 'Backquote', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('hud.toggleInterfaceBar');
    expect(actionFor(profile, chordFromEvent({ code: 'KeyQ', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('helm.hetPort');
    expect(actionFor(profile, chordFromEvent({ code: 'KeyF', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('helm.hetStarboard');
    expect(profile).toHaveProperty('weapons.selectAll', null);
    expect(profile).toHaveProperty('weapons.alphaStrike', null);
    expect(profile).toHaveProperty('weapons.normal', null);
    expect(profile).toHaveProperty('weapons.proximity', null);
    expect(actionFor(profile, chordFromEvent({ code: 'Numpad8', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('shields.facing0');
    expect(actionFor(profile, chordFromEvent({ code: 'Numpad5', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('shields.selectAll');
    expect(actionFor(profile, chordFromEvent({ code: 'KeyN', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('shields.reinforce');
    expect(actionFor(profile, chordFromEvent({ code: 'KeyN', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false }))).toBe('shields.reinforceAll');
    expect(actionFor(profile, chordFromEvent({ code: 'KeyM', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }))).toBe('view.map');
    expect(actionFor(profile, chordFromEvent({ code: 'Equal', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false }))).toBe('view.mapZoomIn');
    expect(actionFor(profile, chordFromEvent({ code: 'Minus', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false }))).toBe('view.mapZoomOut');
    expect(profile).toHaveProperty('mfd.page.helm', null);
    expect(profile).toHaveProperty('mfd.page.map', null);
    expect(profile).toHaveProperty('mfd.page.comms', null);
    expect(profile).toHaveProperty('shields.general', null);
    expect(actionFor(profile, { code: 'MouseMiddle', ctrl: false, shift: false, alt: false, meta: false })).toBe('view.orbitMiddle');
    expect(actionFor(profile, { code: 'MouseLeft', ctrl: false, shift: false, alt: true, meta: false })).toBe('view.orbitAlt');
    expect(actionFor(profile, { code: 'MouseLeft', ctrl: false, shift: false, alt: false, meta: false })).toBeNull();
    expect(actionFor(profile, { code: 'MouseRight', ctrl: false, shift: false, alt: false, meta: false })).toBeNull();
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
