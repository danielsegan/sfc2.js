import { describe, expect, it } from 'vitest';
import {
  actionDef,
  actionFor,
  bindAction,
  chordFromEvent,
  defaultProfile,
  formatChord,
  isReserved,
} from './actions.ts';
import { createKeyTracker, sanitize } from './keymap.ts';
import {
  CLASSIC_BINDINGS,
  classicProfile,
  duplicateBindingIds,
  sameProfile,
  unknownBoundActions,
} from './presets.ts';

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
    expect(profile).toHaveProperty('weapons.offline', null);
    expect(profile).toHaveProperty('shields.down', null);
    expect(profile).toHaveProperty('shields.minimal', null);
    expect(profile).toHaveProperty('shields.up', null);
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
    expect(profile).toHaveProperty('view.zoomIn', null);
    expect(profile).toHaveProperty('view.zoomOut', null);
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

function ev(code: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}): ReturnType<typeof chordFromEvent> {
  return chordFromEvent({
    code,
    ctrlKey: mods.ctrl === true,
    shiftKey: mods.shift === true,
    altKey: mods.alt === true,
    metaKey: false,
  });
}

describe('SFC2 Classic keymap preset', () => {
  it('binds only actions that exist and has no duplicate chords', () => {
    for (const id of Object.keys(CLASSIC_BINDINGS)) {
      expect(actionDef(id), id).toBeDefined();
    }
    const profile = classicProfile();
    expect(unknownBoundActions(profile)).toEqual([]);
    expect(duplicateBindingIds(profile)).toEqual([]);
    expect(duplicateBindingIds(defaultProfile())).toEqual([]);
  });

  it('loads the CE-inspired bindings that have an action in this build', () => {
    const profile = classicProfile();
    expect(actionFor(profile, ev('KeyS'))).toBe('helm.speedUp');
    expect(actionFor(profile, ev('KeyA'))).toBe('helm.speedDown');
    expect(actionFor(profile, ev('Numpad0'))).toBe('helm.stop');
    expect(actionFor(profile, ev('KeyZ'))).toBe('weapons.fire');
    expect(actionFor(profile, ev('KeyZ', { shift: true }))).toBe('weapons.alphaStrike');
    expect(actionFor(profile, ev('Digit1'))).toBe('weapons.group1');
    expect(actionFor(profile, ev('Digit4'))).toBe('weapons.group4');
    expect(actionFor(profile, ev('Digit1', { ctrl: true }))).toBe('weapons.assign1');
    expect(actionFor(profile, ev('KeyY'))).toBe('target.next');
    expect(actionFor(profile, ev('KeyU'))).toBe('target.friendly');
    expect(actionFor(profile, ev('Backquote'))).toBe('target.nearest');
    expect(actionFor(profile, ev('Numpad8'))).toBe('shields.facing0');
    expect(actionFor(profile, ev('Numpad7'))).toBe('shields.facing5');
    expect(actionFor(profile, ev('KeyN'))).toBe('shields.reinforce');
    expect(actionFor(profile, ev('KeyN', { shift: true }))).toBe('shields.reinforceAll');
    expect(actionFor(profile, ev('KeyD'))).toBe('hud.toggleInterfaceBar');
    expect(actionFor(profile, ev('Tab'))).toBe('mfd.page.map');
    expect(actionFor(profile, ev('Quote'))).toBe('mfd.page.helm');
    expect(actionFor(profile, ev('Semicolon'))).toBe('mfd.page.repair');
    expect(actionFor(profile, ev('Period'))).toBe('mfd.page.energy');
    expect(actionFor(profile, ev('Slash'))).toBe('mfd.page.options');
    expect(actionFor(profile, ev('Digit0'))).toBe('mfd.page.comms');
    expect(actionFor(profile, ev('KeyX'))).toBe('ops.cloak');
    expect(actionFor(profile, ev('KeyM'))).toBe('craft.mine');
    expect(actionFor(profile, ev('Minus'))).toBe('view.zoomIn');
    expect(actionFor(profile, ev('Equal'))).toBe('view.zoomOut');
    expect(actionFor(profile, ev('NumpadAdd'))).toBe('view.mapZoomIn');
    expect(actionFor(profile, ev('NumpadSubtract'))).toBe('view.mapZoomOut');
    expect(actionFor(profile, ev('Pause'))).toBe('view.pause');
    expect(actionFor(profile, ev('NumpadDivide'))).toBe('helm.erratic');
  });

  it('leaves Modern defaults behind and keeps CE keys without an action unbound', () => {
    const profile = classicProfile();
    expect(actionFor(profile, ev('KeyW'))).toBeNull();
    expect(actionFor(profile, ev('KeyD'))).toBe('hud.toggleInterfaceBar');
    expect(actionFor(profile, ev('Space'))).toBeNull();
    expect(actionFor(profile, ev('KeyT'))).toBeNull();
    expect(actionFor(profile, ev('KeyR'))).toBeNull();
    expect(actionFor(profile, ev('F1'))).toBeNull();
    expect(actionFor(profile, ev('F4'))).toBeNull();
    expect(actionFor(profile, ev('Digit5'))).toBeNull();
    expect(actionFor(profile, ev('Digit6'))).toBeNull();
    expect(actionFor(profile, ev('Escape'))).toBeNull();
    expect(actionFor(profile, ev('KeyQ'))).toBeNull();
    expect(actionFor(profile, ev('Numpad5'))).toBeNull();
    expect(profile['weapons.group5']).toBeNull();
    expect(profile['weapons.group6']).toBeNull();
    expect(profile['view.camera']).toBeNull();
    expect(profile['view.map']).toBeNull();
    expect(profile['helm.turnLeft']).toBeNull();
    expect(profile['helm.reverse']).toBeNull();
    expect(profile['weapons.offline']).toBeNull();
    expect(profile['shields.down']).toBeNull();
    expect(profile['shields.minimal']).toBeNull();
    expect(profile['shields.up']).toBeNull();
  });

  it('starts on Modern and restores it after switching to Classic', () => {
    const keys = createKeyTracker(null);
    expect(keys.preset()).toBe('modern');
    expect(sameProfile(keys.profile(), defaultProfile())).toBe(true);
    keys.setPreset('classic');
    expect(keys.preset()).toBe('classic');
    expect(sameProfile(keys.profile(), classicProfile())).toBe(true);
    expect(actionFor(keys.profile(), ev('KeyS'))).toBe('helm.speedUp');
    keys.rebind('helm.speedUp', ev('KeyQ'));
    expect(actionFor(keys.profile(), ev('KeyQ'))).toBe('helm.speedUp');
    keys.setPreset('modern');
    expect(keys.preset()).toBe('modern');
    expect(sameProfile(keys.profile(), defaultProfile())).toBe(true);
    expect(actionFor(keys.profile(), ev('KeyW'))).toBe('helm.speedUp');
    expect(actionFor(keys.profile(), ev('KeyQ'))).toBe('helm.hetPort');
    keys.setPreset('classic');
    expect(actionFor(keys.profile(), ev('KeyQ'))).toBe('helm.speedUp');
    keys.reset();
    expect(sameProfile(keys.profile(), classicProfile())).toBe(true);
  });
});
