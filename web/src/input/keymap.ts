/**
 * Live key state for the active keymap preset. Held actions are
 * read each frame. One-shot actions return from `press`. Storage is
 * optional so tests can stay on a pure profile.
 */
import {
  ACTIONS,
  actionDef,
  actionFor,
  bindAction,
  chordFromEvent,
  defaultProfile,
  sameChord,
  type BindResult,
  type Chord,
  type Profile,
} from './actions.ts';
import {
  DEFAULT_KEYMAP_PRESET,
  classicProfile,
  isKeymapPresetId,
  stockProfile,
  type KeymapPresetId,
} from './presets.ts';

const STORAGE_KEY = 'sfc2js.keymap.v1';

export interface KeymapStore {
  readonly preset: KeymapPresetId;
  readonly profiles: Readonly<Partial<Record<KeymapPresetId, Profile>>>;
}

export interface KeyTracker {
  press(event: KeyboardEvent): string | null;
  release(event: KeyboardEvent): void;
  blur(): void;
  held(id: string): boolean;
  profile(): Profile;
  preset(): KeymapPresetId;
  setPreset(id: KeymapPresetId): void;
  rebind(id: string, next: Chord | null): BindResult;
  reset(): void;
}

export function createKeyTracker(load: KeymapStore | Profile | null = readStore()): KeyTracker {
  const initial = hydrateStore(load);
  let preset = initial.preset;
  const profiles: Record<KeymapPresetId, Profile> = {
    modern: initial.profiles.modern,
    classic: initial.profiles.classic,
  };
  let profile = profiles[preset];

  const codes = new Set<string>();
  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;

  function modifiers(event: KeyboardEvent): void {
    ctrl = event.ctrlKey;
    shift = event.shiftKey;
    alt = event.altKey;
    meta = event.metaKey;
  }

  function persist(): void {
    profiles[preset] = profile;
    writeStore({ preset, profiles: { modern: profiles.modern, classic: profiles.classic } });
  }

  return {
    press(event) {
      codes.add(event.code);
      modifiers(event);
      const id = actionFor(profile, chordFromEvent(event));
      const def = id ? actionDef(id) : undefined;
      if (!def || def.hold) return null;
      if (event.repeat && !def.repeat) return null;
      return id;
    },
    release(event) {
      codes.delete(event.code);
      modifiers(event);
    },
    blur() {
      codes.clear();
      ctrl = false;
      shift = false;
      alt = false;
      meta = false;
    },
    held(id) {
      const bound = profile[id];
      if (!bound || !codes.has(bound.code)) return false;
      return bound.ctrl === ctrl && bound.shift === shift && bound.alt === alt && bound.meta === meta;
    },
    profile: () => profile,
    preset: () => preset,
    setPreset(id) {
      if (id === preset) return;
      profiles[preset] = profile;
      preset = id;
      profile = profiles[id];
      persist();
    },
    rebind(id, next) {
      const result = bindAction(profile, id, next);
      profile = result.profile;
      persist();
      return result;
    },
    reset() {
      profile = stockProfile(preset);
      persist();
    },
  };
}

export function hydrateStore(raw: KeymapStore | Profile | null): { preset: KeymapPresetId; profiles: Record<KeymapPresetId, Profile> } {
  const modern = defaultProfile();
  const classic = classicProfile();
  if (!raw) return { preset: DEFAULT_KEYMAP_PRESET, profiles: { modern, classic } };
  if (isStore(raw)) {
    return {
      preset: isKeymapPresetId(raw.preset) ? raw.preset : DEFAULT_KEYMAP_PRESET,
      profiles: {
        modern: sanitize(raw.profiles.modern ?? modern),
        classic: sanitizeFrom(classic, raw.profiles.classic ?? classic),
      },
    };
  }
  return { preset: DEFAULT_KEYMAP_PRESET, profiles: { modern: sanitize(raw), classic } };
}

function isStore(value: object): value is KeymapStore {
  return 'preset' in value && 'profiles' in value;
}

/** Apply saved chords onto the Modern default, including explicit unbinds. */
export function sanitize(raw: Profile | null): Profile {
  return sanitizeFrom(defaultProfile(), raw);
}

function sanitizeFrom(base: Profile, raw: Profile | null): Profile {
  const profile = { ...base };
  if (!raw) return profile;
  for (const action of ACTIONS) {
    const value = raw[action.id];
    if (value === null) {
      profile[action.id] = null;
      continue;
    }
    if (!value || typeof value.code !== 'string') continue;
    const next = {
      code: value.code,
      ctrl: value.ctrl === true,
      shift: value.shift === true,
      alt: value.alt === true,
      meta: value.meta === true,
    };
    if (sameChord(next, profile[action.id] ?? null)) continue;
    const bound = bindAction(profile, action.id, next);
    if (!bound.rejected) Object.assign(profile, bound.profile);
  }
  return profile;
}

export function readStore(): KeymapStore | Profile | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    return JSON.parse(text) as KeymapStore | Profile;
  } catch {
    return null;
  }
}

export function writeStore(store: KeymapStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private mode and tests can refuse storage. The profile still works.
  }
}

/** @deprecated Use readStore. Kept for a flat Modern profile in older saves. */
export function readProfile(): Profile | null {
  const raw = readStore();
  if (!raw) return null;
  if (isStore(raw)) return raw.profiles.modern ?? null;
  return raw;
}

export function writeProfile(profile: Profile): void {
  writeStore({
    preset: DEFAULT_KEYMAP_PRESET,
    profiles: { modern: profile, classic: classicProfile() },
  });
}
