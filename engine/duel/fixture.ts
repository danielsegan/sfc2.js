/**
 * Synthetic one-on-one duel. Numbers are the project's placeholders,
 * not a copied ship chart. The web app boots this file unless the
 * player points it at their own install.
 *
 * Documented path: engine/duel/fixture.ts
 */
import {
  CLASS_SHIP,
  ENERGY_SCALE,
  MODE_NORMAL,
  TURN_TEST_C,
} from '../sim/rules-tables.ts';
import type { ShipSetup } from '../sim/bind-shiplist.ts';

export const SYNTHETIC_FIXTURE_PATH = 'engine/duel/fixture.ts';

export interface RosterEntry {
  readonly name: string;
  readonly empire: string;
  readonly accent: string;
  readonly modelFile: string;
}

export interface SpawnPoint {
  readonly setupIndex: number;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

function hull(mounts: ShipSetup['mounts']): ShipSetup {
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
    shields: [12, 10, 8, 8, 8, 10],
    shieldsMax: [12, 10, 8, 8, 8, 10],
    crew: 4,
    minCrew: 1,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    mounts,
  };
}

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

export function syntheticSetups(): readonly ShipSetup[] {
  return [
    hull([phaser, photon]),
    hull([phaser]),
  ];
}

/** Bow of the first hull faces +x. The second faces it from +x. */
export const SYNTHETIC_SPAWNS: readonly SpawnPoint[] = [
  { setupIndex: 0, x: -8, y: 0, heading: 0 },
  { setupIndex: 1, x: 8, y: 0, heading: 32768 },
];

export const SYNTHETIC_ROSTER: readonly RosterEntry[] = [
  {
    name: 'Test CA',
    empire: 'Federation',
    accent: '#4F8FD6',
    modelFile: 'test-ca.mod',
  },
  {
    name: 'Test D7',
    empire: 'Klingon',
    accent: '#B23A3A',
    modelFile: 'test-d7.mod',
  },
];

export const SYNTHETIC_PLAN = {
  lifeSupport: true,
  fireControl: true,
  speed: 4,
  general: 0,
  weaponRequest: null as number | null,
};
