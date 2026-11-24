import { fx } from '../../core/fx.ts';
import { createSim, type SimSystem } from '../../sim/sim.ts';
import {
  HELM,
  KIT_PATH,
  SPAWN,
  duelHandlers,
  helmPayload,
  motionTable,
  movement,
  spawnPayload,
} from './kit.ts';
import type { CorpusScript, Scenario } from './types.ts';

const AI_PATH = 'engine/replay/scenarios/ai-regen.ts';

/**
 * Slot 8 regenerates its own commands. The player log stays empty.
 * A draw from `ai` happens every tick so the stream moves even when nothing is queued.
 */
const captain: SimSystem = {
  id: 'synthetic-captain',
  phase: 'aiMission',
  priority: 0,
  step(world, ctx) {
    const tick = ctx.tick as number;
    ctx.rng.stream('ai').u32();
    if (tick === 1) {
      ctx.queue({
        slot: 8,
        kind: SPAWN,
        payload: spawnPayload(0, 0, 0, fx(1) as number),
      });
      return;
    }
    if (tick !== 4) return;
    const ids = world.liveIds();
    if (ids.length === 0) return;
    ctx.queue({
      slot: 8,
      kind: HELM,
      payload: helmPayload(ids[0] as number, 16384, fx(1) as number),
    });
  },
};

export const aiRegen: Scenario = {
  id: 'ai-regen',
  sourcePaths: [KIT_PATH, AI_PATH],
  create(seed: number) {
    return createSim({
      seed,
      tables: [motionTable],
      handlers: duelHandlers,
      systems: [captain, movement],
    });
  },
};

export const aiRegenScript: CorpusScript = {
  scenario: aiRegen,
  fileName: 'ai-regen.s2replay',
  seed: 0xa11,
  ticks: 16,
  slots: [0, 1],
  inputDelay: 0,
  hashPeriod: 1,
  commands: [],
};
