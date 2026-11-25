/**
 * Measured disruptor damage. A hit deals a fixed amount. A miss deals 0
 * and does not roll damage. 66.7% is stored as 667/1000. Certainty does
 * not draw on the combat stream.
 */
import { withinRange } from './arcs.ts';
import { MODE_NORMAL, MODE_OVERLOAD, type RangeBand, type WeaponDef } from './rules-tables.ts';

export interface HitRoll {
  chance(num: number, den: number): boolean;
}

export function disruptorShot(
  def: WeaponDef,
  mode: number,
  dx: number,
  dy: number,
  roll: HitRoll,
): { amount: number; unit: number } | undefined {
  const bands = mode === MODE_OVERLOAD ? def.overloadBands : mode === MODE_NORMAL ? def.bands : null;
  if (!bands) return undefined;
  for (const band of bands) {
    if (!withinRange(dx, dy, band.maxRange)) continue;
    return { amount: bandDamage(band, roll), unit: 1 };
  }
  return undefined;
}

function bandDamage(band: RangeBand, roll: HitRoll): number {
  if (band.hitNum >= band.hitDen) return band.damage;
  if (band.hitNum <= 0) return 0;
  return roll.chance(band.hitNum, band.hitDen) ? band.damage : 0;
}
