/** Pure shield-facing selection and the pending reinforcement amount. */

export const FACING_COUNT = 6;

export const FACING_NAMES = [
  'Bow',
  'Forward starboard',
  'Aft starboard',
  'Stern',
  'Aft port',
  'Forward port',
] as const;

/** Integer energy points. The original CE 2.670 slider detent is TO VERIFY. */
export const REINFORCE_STEP = 1;
export const REINFORCE_MAX = 100;

export function isFacing(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < FACING_COUNT;
}

export function normalizeFacings(selected: readonly number[]): number[] {
  return [...new Set(selected.filter(isFacing))].sort((a, b) => a - b);
}

export function selectFacing(selected: readonly number[], facing: number, additive: boolean): number[] {
  if (!isFacing(facing)) return normalizeFacings(selected);
  if (additive) {
    const next = new Set(normalizeFacings(selected));
    if (next.has(facing)) next.delete(facing);
    else next.add(facing);
    return [...next].sort((a, b) => a - b);
  }
  return [facing];
}

/** Centre-ship toggle: all facings, then none on the next call. */
export function toggleAllFacings(selected: readonly number[]): number[] {
  return normalizeFacings(selected).length === FACING_COUNT ? [] : [0, 1, 2, 3, 4, 5];
}

/**
 * Integer energy points, 0..100, same clamp as setFacing / setGeneral.
 * Step is 1; whether CE 2.670 used a coarser slider detent is TO VERIFY.
 */
export function clampReinforceAmount(value: number): number {
  if (!Number.isInteger(value) || value < 0) return 0;
  return value > REINFORCE_MAX ? REINFORCE_MAX : value;
}

export function formatFacingList(selected: readonly number[]): string {
  const facings = normalizeFacings(selected);
  if (facings.length === 0) return 'None';
  if (facings.length === FACING_COUNT) return 'All';
  return facings.map((index) => FACING_NAMES[index] ?? String(index)).join(', ');
}
