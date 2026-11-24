import type { ShipSetup } from '../../sim/bind-shiplist.ts';
import { createCombat, spawnPayload, VERB_SPAWN } from '../../sim/combat.ts';
import {
  ALLEGIANCE_TABLE,
  CONTROL_AI,
  VERB_SET_ALLEGIANCE,
  allegianceHandler,
  allegiancePayload,
} from '../../sim/allegiance.ts';
import { createCaptain } from '../../sim/captain.ts';
import { CRUISE_TABLE, createCruise } from '../../sim/cruise.ts';
import { helmHandler } from '../../sim/helm.ts';
import { CLASS_SHIP, ENERGY_SCALE, MODE_NORMAL, TURN_TEST_C } from '../../sim/rules-tables.ts';
import { createSim, type SimSystem } from '../../sim/sim.ts';
import type { CorpusScript, Scenario } from './types.ts';

const SCENARIO_PATH = 'engine/replay/scenarios/skirmish-3v3.ts';
const PERIOD = 30;

/**
 * Six AI ships, three a side. The player log stays empty.
 * Captains respawn their own helm, energy, and fire orders.
 */
const bootstrap: SimSystem = {
  id: 'skirmish-bootstrap',
  phase: 'aiMission',
  priority: 0,
  step(_world, ctx) {
    if ((ctx.tick as number) !== 1) return;
    for (let i = 0; i < LAYOUT.length; i++) {
      const ship = LAYOUT[i]!;
      ctx.queue({
        slot: 255,
        kind: VERB_SPAWN,
        payload: spawnPayload(i, ship.x, ship.y, ship.heading),
      });
    }
    for (let i = 0; i < LAYOUT.length; i++) {
      const id = (i & 0xffff) | (1 << 16);
      ctx.queue({
        slot: 255,
        kind: VERB_SET_ALLEGIANCE,
        payload: allegiancePayload(id, LAYOUT[i]!.side, CONTROL_AI),
      });
    }
  },
};

function ship(shields: readonly number[], arc: string): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 20,
    impulse: 0,
    apr: 0,
    battery: 4,
    batteryCapacity: 8,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_C,
    acceleration: 8,
    speed: 0,
    shields: shields.slice(),
    shieldsMax: shields.slice(),
    crew: 4,
    minCrew: 1,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    mounts: [
      {
        slotIndex: 0,
        weapon: 'TEST-PH',
        arc,
        chargePoints: 0,
        boxes: 1,
        mode: MODE_NORMAL,
        ticksCharging: 0,
      },
      {
        slotIndex: 1,
        weapon: 'TEST-PHOT',
        arc: 'TEST-FA',
        chargePoints: 0,
        boxes: 1,
        mode: MODE_NORMAL,
        ticksCharging: 0,
      },
    ],
  };
}

const BOW = [12, 10, 8, 8, 8, 10];
const PORT = [4, 18, 6, 6, 6, 8];

const LAYOUT = [
  { x: -10, y: -6, heading: 0, side: 0 as const },
  { x: -10, y: 0, heading: 0, side: 0 as const },
  { x: -10, y: 6, heading: 0, side: 0 as const },
  { x: 10, y: -6, heading: 32768, side: 1 as const },
  { x: 10, y: 0, heading: 32768, side: 1 as const },
  { x: 10, y: 6, heading: 32768, side: 1 as const },
];

function setups(): ShipSetup[] {
  return [
    ship(BOW, 'TEST-FA'),
    ship(PORT, 'TEST-ALL'),
    ship(BOW, 'TEST-FA'),
    ship(BOW, 'TEST-FA'),
    ship(PORT, 'TEST-ALL'),
    ship(BOW, 'TEST-FA'),
  ];
}

export const skirmish3v3: Scenario = {
  id: 'skirmish-3v3',
  sourcePaths: [SCENARIO_PATH],
  create(seed: number) {
    const combat = createCombat(setups(), { rulesTurnTicks: PERIOD });
    return createSim({
      seed,
      tables: [...combat.tables, CRUISE_TABLE, ALLEGIANCE_TABLE],
      systems: [...combat.systems, createCruise(PERIOD), bootstrap, createCaptain()],
      handlers: [...combat.handlers, helmHandler, allegianceHandler],
    });
  },
};

export const skirmish3v3Script: CorpusScript = {
  scenario: skirmish3v3,
  fileName: 'skirmish-3v3.s2replay',
  seed: 0x33e3,
  ticks: 64,
  slots: [0],
  inputDelay: 0,
  hashPeriod: 1,
  commands: [],
};
