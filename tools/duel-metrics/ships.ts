/**
 * Synthetic duel-metrics hulls. Nothing here is a shiplist row.
 * `turnHull` selects the integer curve already compiled into the sim.
 * Power and the speed ramp are the observed defaults for these two hulls.
 * A real install still supplies power and the turn-curve key from its own files.
 */
import type { MountSetup, ShipSetup } from '../../engine/sim/bind-shiplist.ts';
import {
  CLASS_SHIP,
  DEFAULT_RULES_TURN_TICKS,
  ENERGY_SCALE,
  MODE_NORMAL,
  MODE_OVERLOAD,
  TICK_HZ,
  turnModeId,
  weaponDef,
  weaponId,
} from '../../engine/sim/rules-tables.ts';

export { TICK_HZ };
/** The sim's named rules-turn (`RULES_TURN_SECONDS` × 30 Hz). */
export const RULES_TURN_TICKS = DEFAULT_RULES_TURN_TICKS;
export const SEED = 0x0d0e1;
export const INPUT_DELAY = 0;

/** Rule points of movement per speed point per rules-turn. */
export const MOVE_COST_POINTS = 1;

export const SPEEDS = [5, 10, 15, 20, 31] as const;
/** F-CA turn sample at the observed high-speed point, in speed hundredths. */
export const FCA_HIGH_SPEED_HUNDREDTHS = 3050;

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
export const DISRUPTOR_CODE = 'Dis1';
export const ARC_CODE = 'ALL';
/** How many phasers the firepower probe mounts, so the weapon budget can absorb the leftover. */
export const PHASER_COUNT = 10;

/** One range in each observed phaser group, plus one step past the reach. */
export const PHASER_RANGES = [0, 1, 3, 4, 5, 8, 12, 20, 28, 31] as const;

/** One range in each observed photon group, plus one step past the reach. */
export const PHOTON_RANGES = [1, 2, 3, 4, 8, 11, 20, 31] as const;
/** Thousands of range units. 1 here is 1000 range units. */
export const DISRUPTOR_RANGES = [0, 1, 2, 3, 4, 8, 11, 15, 20, 25, 31, 32] as const;
export const DISRUPTOR_OVERLOAD_RANGES = [0, 2, 4, 9, 10] as const;

export interface ProbeShip {
  readonly id: 'F-CA-like' | 'K-D7-like';
  readonly turnHull: 'F-CA' | 'K-D7';
  readonly warp: number;
  readonly heavy: typeof PHOTON_CODE | typeof DISRUPTOR_CODE;
}

export const PROBE_SHIPS: readonly ProbeShip[] = [
  { id: 'F-CA-like', turnHull: 'F-CA', warp: 34, heavy: PHOTON_CODE },
  { id: 'K-D7-like', turnHull: 'K-D7', warp: 39, heavy: DISRUPTOR_CODE },
];

export function plantOf(turnHull: string): number {
  for (const ship of PROBE_SHIPS) {
    if (ship.turnHull === turnHull) return ship.warp;
  }
  return PROBE_SHIPS[0]!.warp;
}

function mount(slotIndex: number, weapon: string, chargePoints: number, ticksCharging = 0): MountSetup {
  return {
    slotIndex,
    weapon,
    arc: ARC_CODE,
    chargePoints,
    boxes: 1,
    mode: MODE_NORMAL,
    ticksCharging,
  };
}

function base(turnHull: string, mounts: readonly MountSetup[], speed: number): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: plantOf(turnHull),
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: MOVE_COST_POINTS * ENERGY_SCALE,
    turnMode: turnModeId('C'),
    acceleration: 8,
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
 * One pre-charged phaser and one empty heavy mount.
 * Fire control is already paid so a shot is not rejected for that reason.
 */
export function weaponSetup(turnHull: string): ShipSetup {
  const heavy = turnHull === 'K-D7' ? DISRUPTOR_CODE : PHOTON_CODE;
  const ship = base(turnHull, [mount(0, PHASER_CODE, 4), mount(1, heavy, 0)], 0);
  return { ...ship, fcPaid: 1 };
}

/** A disruptor that is already armed, so a damage probe does not wait out arming. */
export function armedDisruptorSetup(mode: number): ShipSetup {
  const armTicks = weaponDef(weaponId(DISRUPTOR_CODE))?.armTicks ?? 0;
  const charge = mode === MODE_OVERLOAD ? 4 : 2;
  const heavy = mount(0, DISRUPTOR_CODE, charge, armTicks);
  const ship = base('K-D7', [{ ...heavy, mode }], 0);
  return { ...ship, fcPaid: 1 };
}

/** A photon that is already armed, so a damage probe does not wait out arming. */
export function armedPhotonSetup(turnHull: string): ShipSetup {
  const armTicks = weaponDef(weaponId(PHOTON_CODE))?.armTicks ?? 0;
  const ship = base(turnHull, [mount(0, PHOTON_CODE, 4, armTicks)], 0);
  return { ...ship, fcPaid: 1 };
}

/** Uncharged phasers, enough that leftover power fits in the weapon budget. */
export function powerSetup(turnHull: string): ShipSetup {
  const mounts: MountSetup[] = [];
  for (let slot = 0; slot < PHASER_COUNT; slot++) mounts.push(mount(slot, PHASER_CODE, 0));
  return base(turnHull, mounts, 0);
}
