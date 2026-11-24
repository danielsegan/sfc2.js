/**
 * Web Audio output. Samples are decoded from bytes the caller already
 * read out of the player's install. Nothing is written back.
 */
import type { SoundIndex } from '@sfc2js/formats';
import { emptyBoard, filenamesForCues, triggerCue, createCosmeticRng, type BoardState, type CueShot } from '../../engine/audio/board.ts';
import type { CueId } from '../../engine/audio/cues.ts';

export interface VolumeLevels {
  master: number;
  effects: number;
  alerts: number;
  ui: number;
}

const STORAGE_KEY = 'sfc2js.volume.v1';

export interface GameAudio {
  unlock(): void;
  setVolume(partial: Partial<VolumeLevels>): void;
  levels(): VolumeLevels;
  loadIndex(index: SoundIndex, read: (path: string) => Promise<Uint8Array | null>): Promise<number>;
  play(cues: readonly CueId[], nowMs: number): void;
}

export function createGameAudio(): GameAudio {
  const levels = readLevels();
  let catalog: SoundIndex | null = null;
  let board: BoardState = emptyBoard();
  const rng = createCosmeticRng(0x51c2);
  const buffers = new Map<string, AudioBuffer>();
  const pending = new Set<string>();
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let effects: GainNode | null = null;
  let alerts: GainNode | null = null;
  let ui: GainNode | null = null;
  let reader: ((path: string) => Promise<Uint8Array | null>) | null = null;

  function ensure(): void {
    if (context) return;
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    context = new Ctx();
    master = context.createGain();
    effects = context.createGain();
    alerts = context.createGain();
    ui = context.createGain();
    effects.connect(master);
    alerts.connect(master);
    ui.connect(master);
    master.connect(context.destination);
    applyGains();
  }

  function applyGains(): void {
    if (master) master.gain.value = levels.master;
    if (effects) effects.gain.value = levels.effects;
    if (alerts) alerts.gain.value = levels.alerts;
    if (ui) ui.gain.value = levels.ui;
  }

  function bus(category: CueShot['category']): GainNode | null {
    if (category === 'alerts') return alerts;
    if (category === 'ui') return ui;
    return effects;
  }

  async function fetchOne(filename: string): Promise<void> {
    if (!reader || buffers.has(filename) || pending.has(filename)) return;
    pending.add(filename);
    try {
      const bytes = await reader(filename);
      ensure();
      if (!bytes || !context) return;
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const decoded = await context.decodeAudioData(copy);
      buffers.set(filename, decoded);
    } catch {
      // A compressed or foreign sample stays silent. The file is not copied.
    } finally {
      pending.delete(filename);
    }
  }

  function start(shot: CueShot): void {
    const buffer = buffers.get(shot.filename);
    const target = bus(shot.category);
    if (!buffer || !context || !target) {
      void fetchOne(shot.filename);
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = shot.loop;
    const gain = context.createGain();
    gain.gain.value = shot.entryGain;
    source.connect(gain);
    gain.connect(target);
    source.start();
  }

  return {
    unlock() {
      ensure();
      void context?.resume();
    },
    setVolume(partial) {
      if (partial.master !== undefined) levels.master = clamp01(partial.master);
      if (partial.effects !== undefined) levels.effects = clamp01(partial.effects);
      if (partial.alerts !== undefined) levels.alerts = clamp01(partial.alerts);
      if (partial.ui !== undefined) levels.ui = clamp01(partial.ui);
      applyGains();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
      } catch {
        // Storage can be blocked. The sliders still move the live gains.
      }
    },
    levels: () => ({ ...levels }),
    async loadIndex(index, read) {
      catalog = index;
      board = emptyBoard();
      reader = read;
      const names = filenamesForCues(index);
      await Promise.all(names.map((name) => fetchOne(name)));
      return names.length;
    },
    play(cues, nowMs) {
      if (!catalog) return;
      for (const cue of cues) {
        const result = triggerCue(catalog, board, cue, nowMs, rng);
        board = result.state;
        if (result.shot) start(result.shot);
      }
    },
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? 1 : value;
}

function readLevels(): VolumeLevels {
  const base = { master: 0.8, effects: 0.9, alerts: 0.9, ui: 0.5 };
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return base;
    const parsed = JSON.parse(text) as Partial<VolumeLevels>;
    return {
      master: clamp01(parsed.master ?? base.master),
      effects: clamp01(parsed.effects ?? base.effects),
      alerts: clamp01(parsed.alerts ?? base.alerts),
      ui: clamp01(parsed.ui ?? base.ui),
    };
  } catch {
    return base;
  }
}
