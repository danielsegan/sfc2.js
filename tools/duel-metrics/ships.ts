/**
 * Synthetic duel-metrics hulls. Nothing here is a shiplist row.
 * `turnHull` selects the integer curve already compiled into the sim.
 * Power, acceleration, and weapon costs are the duel-slice placeholders.
 */
import type { MountSetup, ShipSetup } from '../../engine/sim/bind-shiplist.ts';
import { CLASS_SHIP, ENERGY_SCALE, MODE_NORMAL, turnModeId } from '../../engine/sim/rules-tables.ts';

export const TICK_HZ = 30;
/** Placeholder rules-turn from docs/rules/data/constants.json (30 s × 30 Hz). */
export const RULES_TURN_TICKS = 900;
export const SEED = 0x0d0e1;
export const INPUT_DELAY = 0;

/** Speed points the player can order in one setEnergy. Shared by both hulls. */
export const ACCELERATION = 8;
/** Rule points of warp. Impulse and APR are 0. Battery is empty. */
export const WARP = 40;
/** Rule points of movement per speed point per rules-turn. */
export const MOVE_COST_POINTS = 1;

export const SPEEDS = [5, 10, 15, 20, 31] as const;
export const FIREPOWER_SPEEDS = [0, 10, 20, 31] as const;

/** 90° clockwise. Larger than one tick of yaw, so the first step shows the rate. */
export const HEADING_TARGET = 16384;

/**
 * Centers of the six shield bins on the uint16 circle.
 * Bin 0 is centered on relative bearing 0 (the bow). The step is 65536/6,
 * rounded to the integer whose `facingForRelative` result is that bin.
 */
export const BEARINGS = [0, 10923, 21845, 32768, 43691, 54613] as const;

/** Axis separation used when a shot comes from one of those bearings. */
export const SHIELD_RANGE = 8;

export const PHASER_CODE = 'Ph1';
export const PHOTON_CODE = 'Phot';
export const ARC_CODE = 'ALL';
/** How many phasers the firepower probe mounts, so the weapon budget can absorb the leftover. */
export const PHASER_COUNT = 10;

export const RANGE_BANDS: readonly { readonly band: string; readonly probes: readonly number[] }[] = [
  { band: '0', probes: [0] },
  { band: '1', probes: [1] },
  { band: '2-3', probes: [2, 3] },
  { band: '4-8', probes: [4, 8] },
  { band: '9-15', probes: [9, 10, 11, 15] },
  { band: '16-25', probes: [16, 20, 21, 25] },
  { band: '26+', probes: [26, 30] },
];

export interface ProbeShip {
  readonly id: 'F-CA-like' | 'K-D7-like';
  readonly turnHull: 'F-CA' | 'K-D7';
}

export const PROBE_SHIPS: readonly ProbeShip[] = [
  { id: 'F-CA-like', turnHull: 'F-CA' },
  { id: 'K-D7-like', turnHull: 'K-D7' },
];

function mount(slotIndex: number, weapon: string, chargePoints: number): MountSetup {
  return {
    slotIndex,
    weapon,
    arc: ARC_CODE,
    chargePoints,
    boxes: 1,
    mode: MODE_NORMAL,
    ticksCharging: 0,
  };
}

function base(turnHull: string, mounts: readonly MountSetup[], speed: number): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: WARP,
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: MOVE_COST_POINTS * ENERGY_SCALE,
    turnMode: turnModeId('C'),
    acceleration: ACCELERATION,
    speed,
    shields: [40, 40, 40, 40, 40, 40],
    shieldsMax: [40, 40, 40, 40, 40, 40],
    crew: 4,
    minCrew: 1,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    stealth: 0,
    scanners: 0,
    specialSensors: 0,
    tractors: 0,
    cloakCost: 0,
    turnHull,
    mounts,
  };
}

/** No weapons. Turn, acceleration, and movement-energy probes. */
export function motionSetup(turnHull: string): ShipSetup {
  return base(turnHull, [], 0);
}

/**
 * One pre-charged phaser and one empty photon.
 * Fire control is already paid so a shot is not rejected for that reason.
 */
export function weaponSetup(turnHull: string): ShipSetup {
  const ship = base(turnHull, [mount(0, PHASER_CODE, 4), mount(1, PHOTON_CODE, 0)], 0);
  return { ...ship, fcPaid: 1 };
}

/** Uncharged phasers, enough that leftover power fits in the weapon budget. */
export function powerSetup(turnHull: string): ShipSetup {
  const mounts: MountSetup[] = [];
  for (let slot = 0; slot < PHASER_COUNT; slot++) mounts.push(mount(slot, PHASER_CODE, 0));
  return base(turnHull, mounts, 0);
}
