/**
 * Keymap presets. Modern is the default (Daniel, 2026-11-24).
 * SFC2 Classic is an opt-in profile written from the CE 2.670
 * Hot Keys notes (Wintermute, 2026-11-25). Only actions that
 * already exist are bound; CE keys with no verb stay unbound.
 */
import {
  ACTIONS,
  actionDef,
  chord,
  defaultProfile,
  sameChord,
  type Chord,
  type Profile,
} from './actions.ts';

export const KEYMAP_PRESET_IDS = ['modern', 'classic'] as const;

export type KeymapPresetId = (typeof KEYMAP_PRESET_IDS)[number];

export const DEFAULT_KEYMAP_PRESET: KeymapPresetId = 'modern';

export const KEYMAP_PRESET_LABELS: Readonly<Record<KeymapPresetId, string>> = {
  modern: 'Modern',
  classic: 'SFC2 Classic',
};

export function isKeymapPresetId(value: string): value is KeymapPresetId {
  return (KEYMAP_PRESET_IDS as readonly string[]).includes(value);
}

/**
 * Classic chords, taken from the CE Hot Keys tabs and the PR 6 brief.
 * Conflicts with Modern (WASD, Space, F1–F4, M, Tab, `) are resolved
 * inside this table: the Classic preset replaces those defaults.
 */
export const CLASSIC_BINDINGS: Readonly<Record<string, Chord>> = {
  'helm.speedUp': chord('KeyS'),
  'helm.speedDown': chord('KeyA'),
  'helm.stop': chord('Numpad0'),
  'helm.erratic': chord('NumpadDivide'),
  'helm.hetOrdered': chord('Numpad5'),
  'helm.het180': chord('NumpadAdd'),
  'weapons.fire': chord('KeyZ'),
  'weapons.alphaStrike': chord('KeyZ', { shift: true }),
  'weapons.group1': chord('Digit1'),
  'weapons.group2': chord('Digit2'),
  'weapons.group3': chord('Digit3'),
  'weapons.group4': chord('Digit4'),
  'weapons.assign1': chord('Digit1', { ctrl: true }),
  'weapons.assign2': chord('Digit2', { ctrl: true }),
  'weapons.assign3': chord('Digit3', { ctrl: true }),
  'weapons.assign4': chord('Digit4', { ctrl: true }),
  'shields.facing0': chord('Numpad8'),
  'shields.facing1': chord('Numpad9'),
  'shields.facing2': chord('Numpad3'),
  'shields.facing3': chord('Numpad2'),
  'shields.facing4': chord('Numpad1'),
  'shields.facing5': chord('Numpad7'),
  'shields.reinforce': chord('KeyN'),
  'shields.reinforceAll': chord('KeyN', { shift: true }),
  'target.next': chord('KeyY'),
  'target.friendly': chord('KeyU'),
  'target.nearest': chord('Backquote'),
  'ops.cloak': chord('KeyX'),
  'craft.mine': chord('KeyM'),
  'hud.toggleInterfaceBar': chord('KeyD'),
  'mfd.page.helm': chord('Quote'),
  'mfd.page.repair': chord('Semicolon'),
  'mfd.page.map': chord('Tab'),
  'mfd.page.energy': chord('Period'),
  'mfd.page.options': chord('Slash'),
  'mfd.page.comms': chord('Digit0'),
  'view.mapZoomIn': chord('Equal', { shift: true }),
  'view.mapZoomOut': chord('NumpadSubtract'),
  'view.zoomIn': chord('Minus'),
  'view.zoomOut': chord('Equal'),
  'view.pause': chord('Pause'),
  'view.orbitMiddle': chord('MouseMiddle'),
  'view.orbitAlt': chord('MouseLeft', { alt: true }),
  'view.orbitLeft': chord('ArrowLeft', { alt: true }),
  'view.orbitRight': chord('ArrowRight', { alt: true }),
};

export function stockProfile(preset: KeymapPresetId): Profile {
  return preset === 'classic' ? classicProfile() : defaultProfile();
}

export function classicProfile(): Profile {
  const profile: Profile = {};
  for (const action of ACTIONS) profile[action.id] = null;
  for (const [id, binding] of Object.entries(CLASSIC_BINDINGS)) {
    if (!actionDef(id)) continue;
    profile[id] = binding;
  }
  return profile;
}

export function duplicateBindingIds(profile: Profile): string[][] {
  const groups = new Map<string, string[]>();
  for (const action of ACTIONS) {
    const binding = profile[action.id] ?? null;
    if (!binding) continue;
    const key = chordKey(binding);
    const list = groups.get(key) ?? [];
    list.push(action.id);
    groups.set(key, list);
  }
  return [...groups.values()].filter((list) => list.length > 1);
}

export function unknownBoundActions(profile: Profile): string[] {
  return Object.keys(profile).filter((id) => profile[id] && !actionDef(id));
}

function chordKey(value: Chord): string {
  return `${value.code}:${value.ctrl ? 1 : 0}${value.shift ? 1 : 0}${value.alt ? 1 : 0}${value.meta ? 1 : 0}`;
}

export function sameProfile(a: Profile, b: Profile): boolean {
  for (const action of ACTIONS) {
    if (!sameChord(a[action.id] ?? null, b[action.id] ?? null)) return false;
  }
  return true;
}
