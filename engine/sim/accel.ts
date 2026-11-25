/**
 * Actual-speed ramp for hulls listed in docs/rules/data/accel.json.
 * Ordered speed is set by setEnergy and is what movement energy pays for.
 * Actual speed, in hundredths of a speed point, walks toward that order.
 * Hulls that are not listed leave speedActual100 at -1 and keep the
 * per-order acceleration clamp. Cruise and the turn curve read actual
 * speed only when it is non-negative.
 */
import accelJson from '../../docs/rules/data/accel.json' with { type: 'json' };
import type { EntityId } from '../core/brands.ts';
import type { SimSystem } from './sim.ts';
import type { World } from './world.ts';
import { H, readHull, writeHull } from './hull.ts';
import { rulesDiv } from './rules-div.ts';
import { NORMAL_CURVE, TC, curveRow } from './turn-curve.ts';

interface BandJson {
  upToHundredths?: number;
  gainHundredths?: number;
  overTicks?: number;
}

interface HullJson {
  bands?: readonly BandJson[];
}

interface AccelJson {
  decelHundredths?: number;
  decelTicks?: number;
  hullOrder?: readonly string[];
  hulls: Readonly<Record<string, HullJson | undefined>>;
}

interface Band {
  readonly upTo: number;
  readonly gain: number;
  readonly over: number;
}

interface AccelHull {
  readonly key: string;
  readonly bands: readonly Band[];
}

function intField(value: number | undefined, name: string, min: number, max: number): number {
  if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(name);
  return value;
}

function compile(raw: AccelJson): { decelHundredths: number; decelTicks: number; hulls: readonly AccelHull[] } {
  const order = raw.hullOrder;
  if (!order || order.length < 1) throw new Error('accel hullOrder');
  const decelHundredths = intField(raw.decelHundredths, 'accel decelHundredths', 1, 100000);
  const decelTicks = intField(raw.decelTicks, 'accel decelTicks', 1, 100000);
  const hulls: AccelHull[] = [];
  for (let i = 0; i < order.length; i++) {
    const key = order[i]!;
    for (let j = 0; j < i; j++) {
      if (order[j] === key) throw new Error(`accel duplicate ${key}`);
    }
    const src = raw.hulls[key];
    const rows = src?.bands;
    if (!rows || rows.length < 1) throw new Error(`accel ${key} bands`);
    const bands: Band[] = [];
    for (const row of rows) {
      const where = `accel ${key}`;
      const next: Band = {
        upTo: intField(row.upToHundredths, `${where} upToHundredths`, 1, 1000000),
        gain: intField(row.gainHundredths, `${where} gainHundredths`, 1, 1000000),
        over: intField(row.overTicks, `${where} overTicks`, 1, 1000000),
      };
      const prev = bands[bands.length - 1];
      if (prev && next.upTo <= prev.upTo) throw new Error(`${where} speed order`);
      bands.push(next);
    }
    hulls.push({ key, bands });
  }
  return { decelHundredths, decelTicks, hulls };
}

const TABLE = compile(accelJson as AccelJson);

export const ACCEL_DECEL_HUNDREDTHS = TABLE.decelHundredths;
export const ACCEL_DECEL_TICKS = TABLE.decelTicks;

/** 1 when this hull name has an observed actual-speed ramp. */
export function accelHull(turnHull: string | undefined): number {
  if (turnHull === undefined) return 0;
  for (const hull of TABLE.hulls) {
    if (hull.key === turnHull) return 1;
  }
  return 0;
}

function bandsFor(key: string): readonly Band[] | null {
  for (const hull of TABLE.hulls) {
    if (hull.key === key) return hull.bands;
  }
  return null;
}

function bandAt(bands: readonly Band[], actual: number): Band {
  for (const band of bands) {
    if (actual < band.upTo) return band;
  }
  return bands[bands.length - 1]!;
}

/** Actual speed at spawn. -1 when this hull does not ramp. */
export function stampAccel(world: World, id: EntityId, turnHull: string | undefined, speed: number): void {
  const fields = readHull(world, id);
  if (accelHull(turnHull) !== 1) {
    fields[H.speedActual100] = -1;
    fields[H.speedRampAcc] = 0;
    fields[H.speedFrac100] = 0;
    writeHull(world, id, fields);
    return;
  }
  const whole = speed > 0 ? speed : 0;
  fields[H.speedActual100] = whole * 100;
  fields[H.speedRampAcc] = 0;
  fields[H.speedFrac100] = 0;
  writeHull(world, id, fields);
}

function hullKey(world: World, id: EntityId): string {
  const row = curveRow(world, id);
  if (!row || row[TC.enabled] !== 1) return '';
  return NORMAL_CURVE.rows[row[TC.normal]!]?.key ?? '';
}

/** Movement phase, before HET and the heading steer. No-op without an actual speed. */
export function createAccelRamp(): SimSystem {
  return {
    id: 'accel-ramp',
    phase: 'movement',
    priority: -3,
    step(world) {
      for (const id of world.liveIds()) stepOne(world, id);
    },
  };
}

function stepOne(world: World, id: EntityId): void {
  const fields = readHull(world, id);
  const actual = fields[H.speedActual100]!;
  if (actual < 0 || fields[H.classCode] === 0 || fields[H.destroyed] === 1) return;
  const frac = fields[H.speedFrac100]!;
  const ordered = fields[H.speed]! * 100 + frac;
  if (actual === ordered) {
    if (fields[H.speedRampAcc] !== 0) {
      fields[H.speedRampAcc] = 0;
      writeHull(world, id, fields);
    }
    return;
  }
  const bands = bandsFor(hullKey(world, id));
  if (!bands) return;
  let acc = fields[H.speedRampAcc]!;
  let next = actual;
  if (next < ordered) {
    const band = bandAt(bands, next);
    acc += band.gain;
    const gained = rulesDiv(acc, band.over);
    acc -= gained * band.over;
    next += gained;
    if (next > ordered) {
      next = ordered;
      acc = 0;
    }
  } else {
    acc += ACCEL_DECEL_HUNDREDTHS;
    const lost = rulesDiv(acc, ACCEL_DECEL_TICKS);
    acc -= lost * ACCEL_DECEL_TICKS;
    next -= lost;
    if (next < ordered) {
      next = ordered;
      acc = 0;
    }
  }
  fields[H.speedActual100] = next;
  fields[H.speedRampAcc] = acc;
  writeHull(world, id, fields);
}
