import { createSim, type SimSystem } from '../../sim/sim.ts';
import type { CorpusScript, Scenario } from './types.ts';

const IDLE_PATH = 'engine/replay/scenarios/idle-rng.ts';

/** Draws combat and mission every tick and emits both rolls. No entities. */
const idleDraw: SimSystem = {
  id: 'synthetic-idle-draw',
  phase: 'cleanup',
  priority: 0,
  step(_world, ctx) {
    const combat = ctx.rng.stream('combat').int(6);
    const mission = ctx.rng.stream('mission').dice(1, 6);
    ctx.emit({ kind: 1, entity: 0, a: combat, b: mission });
  },
};

export const idleRng: Scenario = {
  id: 'idle-rng',
  sourcePaths: [IDLE_PATH],
  create(seed: number) {
    return createSim({ seed, systems: [idleDraw] });
  },
};

export const idleRngScript: CorpusScript = {
  scenario: idleRng,
  fileName: 'idle-rng.s2replay',
  seed: 7,
  ticks: 12,
  slots: [0],
  inputDelay: 0,
  hashPeriod: 1,
  commands: [],
};
