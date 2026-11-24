import { parseFtrlist } from '../../../tools/formats/ftrlist.ts';
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
import { CRUISE_TABLE, createCruise } from '../../duel/cruise.ts';
import { helmHandler } from '../../duel/helm.ts';
import {
  BAY_FIGHTER,
  BAY_PF,
  VERB_SET_BAY,
  VERB_SET_SIDE,
  VERB_SET_STORES,
  bindFtrlist,
  createSmallcraft,
  setBayPayload,
  setSidePayload,
  setStoresPayload,
} from '../../sim/smallcraft.ts';
import { CLASS_PF, CLASS_SHIP, ENERGY_SCALE, MODE_NORMAL, TURN_TEST_A, TURN_TEST_C } from '../../sim/rules-tables.ts';
import { createSim, type SimSystem } from '../../sim/sim.ts';
import type { CorpusScript, Scenario } from './types.ts';

const SCENARIO_PATH = 'engine/replay/scenarios/every-empire.ts';

/**
 * Six AI ships, one per empire on the Phase 3 line.
 * Federation, Klingon, Romulan, Lyran, Hydran, and Gorn each have a
 * Conquest file and a custom mission file in the CE 2.670 inventory.
 * ISC, Mirak, and Orion stay on the skirmish picker and use this same captain.
 *
 * Hull numbers are the duel-slice placeholders. Nothing here is a copied chart.
 * The rules turn is 4 ticks so arming, shield repair, and the mine arm line up
 * inside the recorded budget. That length is a fixture choice.
 */
export const EVERY_EMPIRE_TICKS = 40;

const PERIOD = 4;
const PF_SETUP = 6;

const FIGHTER_LIST = [
  'Race\tType\tSpeed\tNum\tWeapon1\tArc\tShots\tDamage',
  'fixture\tfixture-ftr\t4\t1\tPh3\tFH\t2\t3',
].join('\n');

export const EVERY_EMPIRE_LINE = [
  'Federation',
  'Klingon',
  'Romulan',
  'Lyran',
  'Hydran',
  'Gorn',
] as const;

const phaser = {
  slotIndex: 0,
  weapon: 'TEST-PH',
  arc: 'TEST-FA',
  chargePoints: 0,
  boxes: 1,
  mode: MODE_NORMAL,
  ticksCharging: 0,
} as const;

const photon = {
  slotIndex: 1,
  weapon: 'TEST-PHOT',
  arc: 'TEST-FA',
  chargePoints: 0,
  boxes: 1,
  mode: MODE_NORMAL,
  ticksCharging: 0,
} as const;

interface Layout {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly side: 0 | 1;
}

/** Pairs sit on their own y so each captain keeps the ship across from it. */
const LAYOUT: readonly Layout[] = [
  { x: 0, y: 0, heading: 0, side: 0 },
  { x: 0, y: 48, heading: 0, side: 0 },
  { x: 0, y: -48, heading: 32768, side: 0 },
  { x: 2, y: 0, heading: 32768, side: 1 },
  { x: 2, y: 48, heading: 32768, side: 1 },
  { x: 6, y: -48, heading: 32768, side: 1 },
];

interface Fit {
  readonly photon: boolean;
  readonly phaser: boolean;
  readonly shields: readonly number[];
  readonly shieldsMax: readonly number[];
  readonly tractors: number;
  readonly cloakCost: number;
  readonly mines: number;
  readonly boarding: number;
  readonly security: number;
  readonly bay: { kind: number; type: number; count: number } | null;
}

const THICK = [12, 10, 8, 8, 8, 10];

function fit(partial: Pick<Fit, 'photon' | 'phaser'> & Partial<Fit>): Fit {
  return {
    photon: partial.photon,
    phaser: partial.phaser,
    shields: partial.shields ?? THICK,
    shieldsMax: partial.shieldsMax ?? THICK,
    tractors: partial.tractors ?? 0,
    cloakCost: partial.cloakCost ?? 0,
    mines: partial.mines ?? 0,
    boarding: partial.boarding ?? 0,
    security: partial.security ?? 1,
    bay: partial.bay ?? null,
  };
}

const FITS: readonly Fit[] = [
  fit({ photon: true, phaser: true, tractors: 2, bay: { kind: BAY_PF, type: PF_SETUP, count: 1 } }),
  fit({ photon: true, phaser: true, boarding: 3 }),
  fit({
    photon: false,
    phaser: true,
    shields: [1, 1, 1, 4, 1, 1],
    shieldsMax: [6, 6, 6, 8, 6, 6],
    cloakCost: 2,
    mines: 2,
    security: 0,
  }),
  fit({ photon: true, phaser: true }),
  fit({ photon: true, phaser: true, bay: { kind: BAY_FIGHTER, type: 0, count: 2 } }),
  fit({ photon: false, phaser: false, security: 0 }),
];

function fighters() {
  const parsed = parseFtrlist(FIGHTER_LIST);
  for (const item of parsed.diagnostics) {
    if (item.severity === 'error') throw new Error(item.code);
  }
  const rows = bindFtrlist(parsed.data);
  if (rows.length !== 1) throw new Error('fixture fighter');
  return rows;
}

function ship(fit: Fit): ShipSetup {
  const mounts = [];
  if (fit.phaser) mounts.push(phaser);
  if (fit.photon) mounts.push(photon);
  return {
    classCode: CLASS_SHIP,
    warp: 20,
    impulse: 0,
    apr: 0,
    battery: 8,
    batteryCapacity: 8,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_C,
    acceleration: 8,
    speed: 0,
    shields: fit.shields.slice(),
    shieldsMax: fit.shieldsMax.slice(),
    crew: 4,
    minCrew: 1,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    stealth: 0,
    scanners: 0,
    specialSensors: 0,
    tractors: fit.tractors,
    cloakCost: fit.cloakCost,
    systems: { sensors: 4, bridge: 1, extraDamage: 1 },
    mounts,
  };
}

function pf(): ShipSetup {
  return {
    classCode: CLASS_PF,
    warp: 4,
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_A,
    acceleration: 4,
    speed: 0,
    shields: [6, 4, 4, 4, 4, 4],
    shieldsMax: [6, 4, 4, 4, 4, 4],
    crew: 1,
    minCrew: 0,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    mounts: [phaser],
  };
}

function setups(): ShipSetup[] {
  const rows = FITS.map((fit) => ship(fit));
  rows.push(pf());
  return rows;
}

const bootstrap: SimSystem = {
  id: 'every-empire-bootstrap',
  phase: 'aiMission',
  priority: 0,
  step(_world, ctx) {
    if ((ctx.tick as number) !== 1) return;
    for (let i = 0; i < LAYOUT.length; i++) {
      const at = LAYOUT[i]!;
      ctx.queue({ slot: 255, kind: VERB_SPAWN, payload: spawnPayload(i, at.x, at.y, at.heading) });
    }
    for (let i = 0; i < LAYOUT.length; i++) {
      const id = (i & 0xffff) | (1 << 16);
      const fit = FITS[i]!;
      ctx.queue({
        slot: 255,
        kind: VERB_SET_ALLEGIANCE,
        payload: allegiancePayload(id, LAYOUT[i]!.side, CONTROL_AI),
      });
      ctx.queue({ slot: 255, kind: VERB_SET_SIDE, payload: setSidePayload(id, LAYOUT[i]!.side) });
      ctx.queue({
        slot: 255,
        kind: VERB_SET_STORES,
        payload: setStoresPayload(id, fit.mines, fit.boarding, fit.security),
      });
      if (fit.bay) {
        ctx.queue({
          slot: 255,
          kind: VERB_SET_BAY,
          payload: setBayPayload(id, 0, fit.bay.kind, fit.bay.type, fit.bay.count),
        });
      }
    }
  },
};

export const everyEmpire: Scenario = {
  id: 'every-empire',
  sourcePaths: [SCENARIO_PATH],
  create(seed: number) {
    const rows = setups();
    const combat = createCombat(rows, { rulesTurnTicks: PERIOD });
    const craft = createSmallcraft({ fighters: fighters(), setups: rows });
    return createSim({
      seed,
      tables: [...combat.tables, CRUISE_TABLE, ALLEGIANCE_TABLE, ...craft.tables],
      systems: [...combat.systems, createCruise(PERIOD), ...craft.systems, bootstrap, createCaptain()],
      handlers: [...combat.handlers, helmHandler, allegianceHandler, ...craft.handlers],
    });
  },
};

export const everyEmpireScript: CorpusScript = {
  scenario: everyEmpire,
  fileName: 'every-empire.s2replay',
  seed: 0x0e11,
  ticks: EVERY_EMPIRE_TICKS,
  slots: [0],
  inputDelay: 0,
  hashPeriod: 1,
  commands: [],
};
