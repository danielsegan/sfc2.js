/**
 * Pure UI helpers for the Energy Management and Damage Control / Repair
 * Officer MFD pages. Reads from SelfView / DamageView only and builds
 * payloads for #156 DuelMatch verbs.
 */
import type { DamageSystem, EnergyReadout } from '../../engine/view/view-model.ts';

export type EnergyCategory = 'movement' | 'weapons' | 'shields' | 'ecm' | 'tractors';

export interface EnergyPriorities {
  readonly movement: number;
  readonly weapons: number;
  readonly shields: number;
  readonly tractors: number;
  readonly ecm: number;
}

export const DEFAULT_ENERGY_PRIORITIES: EnergyPriorities = {
  movement: 3,
  weapons: 3,
  shields: 3,
  tractors: 3,
  ecm: 3,
};

export interface EnergyRowDef {
  readonly id: EnergyCategory;
  readonly label: string;
  readonly action: `energy.priority.${EnergyCategory}`;
  readonly title: string;
}

/** Order matches the CE 2.670 Energy Allocation rows. */
export const ENERGY_ROWS: readonly EnergyRowDef[] = [
  {
    id: 'movement',
    label: 'Engines',
    action: 'energy.priority.movement',
    title: 'Set Energy Priority of Engines (left-click cycles 5→1)',
  },
  {
    id: 'weapons',
    label: 'Weapons',
    action: 'energy.priority.weapons',
    title: 'Set Energy Priority of Weapons (left-click cycles 5→1)',
  },
  {
    id: 'shields',
    label: 'Shields',
    action: 'energy.priority.shields',
    title: 'Set Energy Priority of Shields (left-click cycles 5→1)',
  },
  {
    id: 'ecm',
    label: 'EW',
    action: 'energy.priority.ecm',
    title: 'Set Energy Priority of EW (left-click cycles 5→1)',
  },
  {
    id: 'tractors',
    label: 'Tractors',
    action: 'energy.priority.tractors',
    title: 'Set Energy Priority of Tractors (left-click cycles 5→1)',
  },
];

/**
 * CE priority button cycle: left-click decrements 5 → 4 → 3 → 2 → 1 → 5
 * (1 is paid first). Out-of-range values reset to 5.
 */
export function cycleEnergyPriority(current: number): number {
  if (!Number.isInteger(current) || current <= 1 || current > 5) return 5;
  return current - 1;
}

export function nextEnergyPriorities(
  current: EnergyPriorities,
  category: EnergyCategory,
): EnergyPriorities {
  return {
    movement: category === 'movement' ? cycleEnergyPriority(current.movement) : current.movement,
    weapons: category === 'weapons' ? cycleEnergyPriority(current.weapons) : current.weapons,
    shields: category === 'shields' ? cycleEnergyPriority(current.shields) : current.shields,
    tractors: category === 'tractors' ? cycleEnergyPriority(current.tractors) : current.tractors,
    ecm: category === 'ecm' ? cycleEnergyPriority(current.ecm) : current.ecm,
  };
}

export function isEnergyCategory(value: string): value is EnergyCategory {
  return value === 'movement' || value === 'weapons' || value === 'shields' || value === 'ecm' || value === 'tractors';
}

export type EnergyMeterInput = Pick<
  EnergyReadout,
  'generation' | 'demand' | 'surplus' | 'draws' | 'lastReason'
> & {
  readonly desired?: Partial<Record<EnergyCategory, number>>;
};

export interface EnergyRowValues {
  readonly allocated: number;
  readonly desired: number | null;
  readonly barPct: number;
}

export function energyScaleMax(energy: Pick<EnergyReadout, 'generation' | 'demand'>): number {
  return Math.max(energy.generation, energy.demand, 1);
}

export function energyRowValues(energy: EnergyMeterInput, category: EnergyCategory): EnergyRowValues {
  const allocated = Math.max(0, energy.draws[category]);
  const explicit = energy.desired?.[category];
  let desired: number | null = null;
  if (typeof explicit === 'number' && Number.isFinite(explicit)) {
    desired = Math.max(0, explicit);
  } else if (energy.lastReason !== 'overDraw' && energy.surplus >= 0) {
    // When not in overdraw, paid draws equal what the system asked for.
    desired = allocated;
  }
  const scale = energyScaleMax(energy);
  const barPct = Math.round(Math.max(0, Math.min(1, allocated / scale)) * 100);
  return { allocated, desired, barPct };
}

export function formatEnergyValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export interface RepairSystemDef {
  readonly id: string;
  readonly label: string;
  readonly action: string;
}

export const REPAIR_SYSTEMS: readonly RepairSystemDef[] = [
  { id: 'bridge', label: 'Bridge', action: 'repair.prioritize.bridge' },
  { id: 'hullForward', label: 'Fwd Hull', action: 'repair.prioritize.hullForward' },
  { id: 'hullCenter', label: 'Ctr Hull', action: 'repair.prioritize.hullCenter' },
  { id: 'hullAft', label: 'Aft Hull', action: 'repair.prioritize.hullAft' },
  { id: 'sensors', label: 'Sensors', action: 'repair.prioritize.sensors' },
  { id: 'armor', label: 'Armor', action: 'repair.prioritize.armor' },
  { id: 'extra', label: 'Aux', action: 'repair.prioritize.extra' },
];

export const REPAIR_SYSTEM_IDS: readonly string[] = REPAIR_SYSTEMS.map((sys) => sys.id);

export function isRepairSystemId(id: string): boolean {
  return REPAIR_SYSTEM_IDS.includes(id);
}

export function repairSystemLabel(id: string): string {
  return REPAIR_SYSTEMS.find((sys) => sys.id === id)?.label ?? id;
}

export function defaultRepairQueue(): string[] {
  return [...REPAIR_SYSTEM_IDS];
}

/**
 * Promote `targetId` to the front of the repair queue while keeping the
 * remaining queued order (and falling back to the rest of the hull systems
 * so repairing cascades to the next damaged system automatically).
 */
export function prioritizeRepairSystem(currentQueue: readonly string[], targetId: string): string[] {
  if (!isRepairSystemId(targetId)) return [...currentQueue];
  const out: string[] = [targetId];
  for (const id of currentQueue) {
    if (id !== targetId && isRepairSystemId(id) && !out.includes(id)) out.push(id);
  }
  for (const id of REPAIR_SYSTEM_IDS) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function repairQueueRank(queue: readonly string[], id: string): number | null {
  const index = queue.indexOf(id);
  return index >= 0 ? index + 1 : null;
}

export function repairSystemHealth(sys: Pick<DamageSystem, 'boxesLeft' | 'boxesTotal' | 'repairing'>): {
  readonly ratio: number;
  readonly state: 'intact' | 'damaged' | 'destroyed' | 'repairing';
} {
  if (sys.repairing) {
    const ratio = sys.boxesTotal > 0 ? Math.max(0, Math.min(1, sys.boxesLeft / sys.boxesTotal)) : 1;
    return { ratio, state: 'repairing' };
  }
  if (sys.boxesTotal <= 0) return { ratio: 1, state: 'intact' };
  const ratio = Math.max(0, Math.min(1, sys.boxesLeft / sys.boxesTotal));
  if (sys.boxesLeft <= 0) return { ratio: 0, state: 'destroyed' };
  if (sys.boxesLeft < sys.boxesTotal) return { ratio, state: 'damaged' };
  return { ratio: 1, state: 'intact' };
}
