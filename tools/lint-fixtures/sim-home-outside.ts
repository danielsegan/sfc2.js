/**
 * Proof fixture for tools/check-sim-home.mjs. Not part of the build.
 * Each definition below must be reported.
 */
import type { CommandHandler, SimSystem } from '../../engine/sim/sim.ts';
import type { TableSpec } from '../../engine/sim/world.ts';

export const outsideTable: TableSpec = { id: 'outside', fieldCount: 1 };

export const outsideHandler: CommandHandler = {
  kind: 1,
  apply() {},
};

export function outsideSystem(): SimSystem {
  return {
    id: 'outside',
    phase: 'movement',
    priority: 0,
    step() {},
  };
}
