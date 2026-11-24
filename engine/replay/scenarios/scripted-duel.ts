import { command } from '../../core/codec.ts';
import { fx } from '../../core/fx.ts';
import { createSim } from '../../sim/sim.ts';
import {
  FIRE,
  HELM,
  KIT_PATH,
  SPAWN,
  duelHandlers,
  firePayload,
  helmPayload,
  motionTable,
  movement,
  packedId,
  rangePing,
  spawnPayload,
} from './kit.ts';
import type { CorpusScript, Scenario } from './types.ts';

const DUEL_PATH = 'engine/replay/scenarios/scripted-duel.ts';

export const scriptedDuel: Scenario = {
  id: 'scripted-duel',
  sourcePaths: [KIT_PATH, DUEL_PATH],
  create(seed: number) {
    return createSim({
      seed,
      tables: [motionTable],
      handlers: duelHandlers,
      systems: [movement, rangePing],
    });
  },
};

const speed1 = fx(1) as number;
const speed2 = fx(2) as number;
const left = fx(-4) as number;
const right = fx(4) as number;

/**
 * Two ships on slots 0 and 1. Commands are stamped with the tick they apply in.
 * Same-tick commands use seq 0, then 1, per slot.
 */
export const scriptedDuelScript: CorpusScript = {
  scenario: scriptedDuel,
  fileName: 'scripted-duel.s2replay',
  seed: 0x5fc2,
  ticks: 20,
  slots: [0, 1],
  inputDelay: 0,
  hashPeriod: 1,
  commands: [
    command(1, 0, 0, SPAWN, spawnPayload(left, 0, 0, speed1)),
    command(1, 1, 0, SPAWN, spawnPayload(right, 0, 32768, speed1)),
    command(6, 1, 0, FIRE, firePayload(packedId(1), packedId(0))),
    command(8, 0, 0, HELM, helmPayload(packedId(0), 16384, speed1)),
    command(8, 0, 1, FIRE, firePayload(packedId(0), packedId(1))),
    command(12, 1, 0, HELM, helmPayload(packedId(1), 0, speed2)),
    command(18, 0, 0, HELM, helmPayload(packedId(0), 32768, speed1)),
  ],
};
