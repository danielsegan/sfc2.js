/**
 * Pure HUD selection helpers. Group assignment and firing still go
 * through DuelMatch verbs in commands.ts; this module never writes
 * to the sim.
 */

export function supportsProximity(weapon: { family: string } | undefined | null): boolean {
  return weapon?.family === 'photon';
}

export function toggleSlot(selected: readonly number[], slot: number): number[] {
  if (selected.includes(slot)) return selected.filter((item) => item !== slot);
  return [...selected, slot];
}

export function selectAllSlots(weapons: readonly { slotIndex: number }[]): number[] {
  const slots: number[] = [];
  for (const weapon of weapons) {
    if (!slots.includes(weapon.slotIndex)) slots.push(weapon.slotIndex);
  }
  return slots;
}

/** Move every selected mount into `group`, removing them from the other groups. */
export function assignSlotsToGroup(groups: number[][], group: number, slots: readonly number[]): void {
  if (group < 0 || group >= groups.length) return;
  const unique: number[] = [];
  for (const slot of slots) {
    if (!unique.includes(slot)) unique.push(slot);
  }
  for (const list of groups) {
    for (let index = list.length - 1; index >= 0; index--) {
      if (unique.includes(list[index]!)) list.splice(index, 1);
    }
  }
  const target = groups[group];
  if (!target) return;
  for (const slot of unique) target.push(slot);
}
