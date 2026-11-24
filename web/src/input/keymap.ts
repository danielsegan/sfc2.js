/**
 * Live key state for the modern profile. Held actions are read each
 * frame. One-shot actions return from `press`. Storage is optional so
 * tests can stay on the pure profile.
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

const STORAGE_KEY = 'sfc2js.keymap.v1';

export interface KeyTracker {
  press(event: KeyboardEvent): string | null;
  release(event: KeyboardEvent): void;
  blur(): void;
  held(id: string): boolean;
  profile(): Profile;
  rebind(id: string, next: Chord | null): BindResult;
  reset(): void;
}

export function createKeyTracker(load: Profile | null = readProfile()): KeyTracker {
  let profile = sanitize(load);
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
    rebind(id, next) {
      const result = bindAction(profile, id, next);
      profile = result.profile;
      writeProfile(profile);
      return result;
    },
    reset() {
      profile = defaultProfile();
      writeProfile(profile);
    },
  };
}

export function sanitize(raw: Profile | null): Profile {
  const profile = defaultProfile();
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

export function readProfile(): Profile | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    return JSON.parse(text) as Profile;
  } catch {
    return null;
  }
}

export function writeProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Private mode and tests can refuse storage. The profile still works.
  }
}
