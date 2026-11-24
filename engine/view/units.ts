/**
 * Display conversion for the HUD. Floats are allowed here.
 * The sim keeps Q16.16 and energy hundredths. This file is the only
 * place those become numbers a person reads.
 */

export const FX_ONE = 65536;
export const ENERGY_SCALE = 100;
export const FULL_CIRCLE = 65536;

/** Range units from a Q16.16 raw coordinate. */
export function toDisplayRange(raw: number): number {
  return raw / FX_ONE;
}

/** Degrees clockwise from the bow, for labels. */
export function toDisplayHeading(bam: number): number {
  const wrapped = ((bam % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
  return (wrapped * 360) / FULL_CIRCLE;
}

/** Rule energy from the sim's hundredths. */
export function toDisplayEnergy(scaled: number): number {
  return scaled / ENERGY_SCALE;
}

export function blendScalar(prev: number, curr: number, alpha: number): number {
  return prev + (curr - prev) * alpha;
}
