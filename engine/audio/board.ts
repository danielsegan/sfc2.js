/**
 * Pick one catalog row for a cue and decide whether it may play.
 * Volume here is the file's own 0–100 range. Master and category
 * gains stay on the output. The cosmetic RNG is not a sim stream.
 */
import type { SoundClass, SoundEntry, SoundIndex } from '@sfc2js/formats';
import { CUE_CATEGORY, CUE_IDS, type CueCategory, type CueId } from './cues.ts';

export interface CueShot {
  readonly cue: CueId;
  readonly filename: string;
  readonly entryGain: number;
  readonly category: CueCategory;
  readonly loop: boolean;
}

export interface BoardVoice {
  readonly className: string;
  readonly at: number;
}

export interface BoardState {
  readonly voices: readonly BoardVoice[];
  readonly lastByClass: Readonly<Record<string, number>>;
}

export function emptyBoard(): BoardState {
  return { voices: [], lastByClass: {} };
}

export function createCosmeticRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const VOICE_MS = 2000;

export function filenamesForCues(index: SoundIndex): string[] {
  const names: string[] = [];
  for (const cue of CUE_IDS) {
    for (const entry of index.entries) {
      if (!entry.filename || !matchesCue(entry, cue)) continue;
      if (entry.compress !== null && entry.compress !== 0) continue;
      if (!names.includes(entry.filename)) names.push(entry.filename);
    }
  }
  return names;
}

export function triggerCue(
  index: SoundIndex,
  state: BoardState,
  cue: CueId,
  nowMs: number,
  rng: () => number,
): { state: BoardState; shot: CueShot | null } {
  const entry = pickEntry(index, cue, rng);
  if (!entry || !entry.filename) return { state, shot: null };
  if (entry.compress !== null && entry.compress !== 0) return { state, shot: null };
  const voices = state.voices.filter((voice) => nowMs - voice.at < VOICE_MS);
  const last = { ...state.lastByClass };
  for (const name of entry.classes) {
    const spec = classByName(index, name);
    const interval = spec?.minIntervalSeconds ?? 0;
    const previous = last[name];
    if (interval > 0 && previous !== undefined && nowMs - previous < interval * 1000) {
      return { state: { voices, lastByClass: state.lastByClass }, shot: null };
    }
    const cap = spec?.maxAtOnce ?? null;
    const playing = voices.filter((voice) => voice.className === name);
    if (cap !== null && playing.length >= cap) {
      if (spec?.preempt === 'never') return { state: { voices, lastByClass: state.lastByClass }, shot: null };
      const oldest = playing.reduce((best, voice) => (voice.at < best.at ? voice : best));
      const drop = voices.findIndex((voice) => voice.className === name && voice.at === oldest.at);
      if (drop >= 0) voices.splice(drop, 1);
    }
  }
  const className = entry.classes[0] ?? '';
  if (className) last[className] = nowMs;
  for (const name of entry.classes) voices.push({ className: name, at: nowMs });
  return {
    state: { voices, lastByClass: last },
    shot: {
      cue,
      filename: entry.filename,
      entryGain: entryGain(entry, rng),
      category: CUE_CATEGORY[cue],
      loop: entry.loop,
    },
  };
}

export function pickEntry(index: SoundIndex, cue: CueId, rng: () => number): SoundEntry | null {
  const matches = index.entries.filter((entry) => entry.filename && matchesCue(entry, cue));
  if (matches.length === 0) return null;
  const grouped = matches.filter((entry) => entry.randomIndex !== null);
  const pool = grouped.length > 0 ? grouped.filter((entry) => entry.randomIndex === grouped[0]?.randomIndex) : matches;
  const ordered = pool.slice().sort((a, b) => (a.index ?? 1e9) - (b.index ?? 1e9) || a.line - b.line);
  if (grouped.length > 0 && ordered.length > 1) {
    const at = Math.floor(rng() * ordered.length);
    return ordered[at] ?? ordered[0] ?? null;
  }
  return ordered[0] ?? null;
}

function matchesCue(entry: SoundEntry, cue: CueId): boolean {
  const text = `${entry.identifier ?? ''} ${entry.description ?? ''} ${entry.classes.join(' ')}`.toLowerCase();
  const has = (word: string) => text.includes(word);
  if (cue === 'weapon.fire.phaser') return has('phaser') && has('fire') && !has('overload');
  if (cue === 'weapon.fire.photon') return has('photon') && has('fire');
  if (cue === 'weapon.fire.projectile') return has('fire') && (has('photon') || has('missile') || has('drone'));
  if (cue === 'impact.shield') return has('shield') && has('hit');
  if (cue === 'impact.hull') return has('hull') && has('hit');
  if (cue === 'shield.down') return has('shield') && (has('down') || has('lower'));
  if (cue === 'shield.raise') return has('shield') && has('raise');
  if (cue === 'alert.red') return has('red') && has('alert');
  if (cue === 'alert.yellow') return has('yellow') && has('alert');
  if (cue === 'ui.click') return has('beep') || (has('click') && has('ui'));
  return false;
}

function classByName(index: SoundIndex, name: string): SoundClass | undefined {
  const key = name.toLowerCase();
  return index.classes.find((row) => row.name.toLowerCase() === key);
}

function entryGain(entry: SoundEntry, rng: () => number): number {
  const min = entry.minVolume;
  const max = entry.maxVolume;
  let value = 100;
  if (min !== null && max !== null) value = min + (max - min) * rng();
  else if (max !== null) value = max;
  else if (min !== null) value = min;
  if (value < 0) return 0;
  if (value > 100) return 1;
  return value / 100;
}
