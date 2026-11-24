import { command } from '../../core/codec.ts';
import type { ShipSetup } from '../../sim/bind-shiplist.ts';
import { VERB_SPAWN, createCombat, spawnPayload } from '../../sim/combat.ts';
import { CLASS_SHIP, TURN_TEST_C } from '../../sim/rules-tables.ts';
import { createSim } from '../../sim/sim.ts';
import { VERB_ORDER_HELM, helmHandler, helmPayload } from '../../sim/helm.ts';
import {
  HEADING_ORDER_TABLE,
  VERB_ORDER_HEADING,
  createHeadingSteer,
  headingHandler,
  headingPayload,
} from '../../sim/heading.ts';
import type { CorpusScript, Scenario } from './types.ts';

const SCENARIO_PATH = 'engine/replay/scenarios/heading-order.ts';

/** First spawn in a fresh world: generation 1, index 0. */
const SHIP = 65536;

function setup(): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 0,
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: 0,
    turnMode: TURN_TEST_C,
    acceleration: 0,
    speed: 0,
    shields: [0, 0, 0, 0, 0, 0],
    shieldsMax: [0, 0, 0, 0, 0, 0],
    crew: 1,
    minCrew: 0,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    mounts: [],
  };
}

/**
 * Two ships. A heading order turns at the TEST-C cap, a yaw replaces
 * that order, then a later heading order replaces the yaw. The stored
 * heading is fixed; the second ship is not tracked.
 * The yaw handler is engine/sim/helm.ts and the per-tick steer is
 * engine/sim/heading.ts. Both are in simSourceHash.
 */
export const headingOrder: Scenario = {
  id: 'heading-order',
  sourcePaths: [SCENARIO_PATH],
  create(seed: number) {
    const combat = createCombat([setup(), setup()], { rulesTurnTicks: 30 });
    return createSim({
      seed,
      tables: [...combat.tables, HEADING_ORDER_TABLE],
      systems: [...combat.systems, createHeadingSteer()],
      handlers: [...combat.handlers, helmHandler, headingHandler],
    });
  },
};

export const headingOrderScript: CorpusScript = {
  scenario: headingOrder,
  fileName: 'heading-order.s2replay',
  seed: 0x0ea0,
  ticks: 12,
  slots: [0],
  inputDelay: 0,
  hashPeriod: 1,
  commands: [
    command(1, 0, 0, VERB_SPAWN, spawnPayload(0, 0, 0, 0)),
    command(1, 0, 1, VERB_SPAWN, spawnPayload(1, 0, 8, 0)),
    command(2, 0, 0, VERB_ORDER_HEADING, headingPayload(SHIP, 6000)),
    command(6, 0, 0, VERB_ORDER_HELM, helmPayload(SHIP, 2000)),
    command(8, 0, 0, VERB_ORDER_HEADING, headingPayload(SHIP, 12000)),
  ],
};
