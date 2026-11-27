/**
 * Synthetic skirmish catalog. Empires are the roster names from the plan.
 * Hull numbers are the duel-slice placeholders, not a copied ship chart.
 * Two classes differ so a slot picker has a real choice.
 */
import type { ShipSetup } from '../sim/bind-shiplist.ts';
import {
  CLASS_SHIP,
  ENERGY_SCALE,
  MODE_NORMAL,
  TURN_TEST_C,
} from '../sim/rules-tables.ts';
import type { RosterEntry } from './fixture.ts';
import type { HullTint, PlaceholderShape } from './placeholder-mod.ts';

export interface SkirmishEmpire {
  readonly id: string;
  readonly name: string;
  readonly accent: string;
  readonly tint: HullTint;
}

export interface SkirmishClass {
  readonly id: string;
  readonly name: string;
  readonly shape: PlaceholderShape;
  readonly warp: number;
  readonly shields: readonly [number, number, number, number, number, number];
  readonly photon: boolean;
  /** Row in the measured turn curves. Cruiser is F-CA; the D7-shaped frigate is K-D7. */
  readonly turnHull: string;
}

export const SKIRMISH_EMPIRES: readonly SkirmishEmpire[] = [
  { id: 'federation', name: 'Federation', accent: '#4F8FD6', tint: { r: 79, g: 143, b: 214 } },
  { id: 'klingon', name: 'Klingon', accent: '#B23A3A', tint: { r: 178, g: 58, b: 58 } },
  { id: 'romulan', name: 'Romulan', accent: '#3FA36B', tint: { r: 63, g: 163, b: 107 } },
  { id: 'lyran', name: 'Lyran', accent: '#D9A441', tint: { r: 217, g: 164, b: 65 } },
  { id: 'hydran', name: 'Hydran', accent: '#3FB5A8', tint: { r: 63, g: 181, b: 168 } },
  { id: 'gorn', name: 'Gorn', accent: '#7FA640', tint: { r: 127, g: 166, b: 64 } },
  { id: 'isc', name: 'ISC', accent: '#D0D4DA', tint: { r: 208, g: 212, b: 218 } },
  { id: 'mirak', name: 'Mirak', accent: '#C46A2E', tint: { r: 196, g: 106, b: 46 } },
  { id: 'orion', name: 'Orion', accent: '#9B6BD1', tint: { r: 155, g: 107, b: 209 } },
];

export const SKIRMISH_CLASSES: readonly SkirmishClass[] = [
  {
    id: 'cruiser',
    name: 'Fixture cruiser',
    shape: 'ca',
    warp: 20,
    shields: [12, 10, 8, 8, 8, 10],
    photon: true,
    turnHull: 'F-CA',
  },
  {
    id: 'frigate',
    name: 'Fixture frigate',
    shape: 'd7',
    warp: 16,
    shields: [8, 8, 10, 8, 10, 8],
    photon: false,
    turnHull: 'K-D7',
  },
];

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

export function empireById(id: string): SkirmishEmpire | undefined {
  for (const empire of SKIRMISH_EMPIRES) {
    if (empire.id === id) return empire;
  }
  return undefined;
}

export function classById(id: string): SkirmishClass | undefined {
  for (const hull of SKIRMISH_CLASSES) {
    if (hull.id === id) return hull;
  }
  return undefined;
}

export function syntheticSetup(classId: string): ShipSetup {
  const hull = classById(classId) ?? SKIRMISH_CLASSES[0]!;
  const shields = [hull.shields[0], hull.shields[1], hull.shields[2], hull.shields[3], hull.shields[4], hull.shields[5]];
  return {
    classCode: CLASS_SHIP,
    warp: hull.warp,
    impulse: 0,
    apr: 0,
    battery: 4,
    batteryCapacity: 8,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_C,
    acceleration: 8,
    speed: 0,
    turnHull: hull.turnHull,
    shields,
    shieldsMax: shields.slice(),
    crew: 4,
    minCrew: 1,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    mounts: hull.photon ? [phaser, photon] : [phaser],
  };
}

export function syntheticRoster(empireId: string, classId: string): RosterEntry {
  const empire = empireById(empireId) ?? SKIRMISH_EMPIRES[0]!;
  const hull = classById(classId) ?? SKIRMISH_CLASSES[0]!;
  return {
    name: `${empire.name} ${hull.name}`,
    empire: empire.name,
    accent: empire.accent,
    modelFile: hull.shape === 'd7' ? 'test-d7.mod' : 'test-ca.mod',
  };
}

/** Integer layout. Side 0 faces +x from the west. Index 0 sits to port of the line. */
export function linePosition(indexOnSide: number, countOnSide: number, side: 0 | 1): { x: number; y: number; heading: number } {
  const count = countOnSide < 1 ? 1 : countOnSide;
  const y = indexOnSide * 6 - (count - 1) * 3;
  return {
    x: side === 0 ? -12 : 12,
    y,
    heading: side === 0 ? 0 : 32768,
  };
}
