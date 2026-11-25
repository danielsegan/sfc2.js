/**
 * Moves a hull at its stored speed. Speed is range units per rules-turn.
 * Each tick takes a Bresenham share of that distance along the heading,
 * so a full turn of shares sums to the speed. The remainder lives in the
 * `cruise` table and is hashed with the rest of the world.
 *
 * setEnergy writes the speed. This system only reads it.
 */
import { cos16, sin16 } from '../core/angle.ts';
import { add, FX_ONE, fxRaw, mul } from '../core/fx.ts';
import type { SimSystem } from './sim.ts';
import type { TableSpec } from './world.ts';
import { H, readHull } from './hull.ts';
import { rulesDiv } from './rules-div.ts';

export const CRUISE = 'cruise';

export const CRUISE_TABLE: TableSpec = { id: CRUISE, fieldCount: 1 };

const IDIV_MAX = 2147483647;

export function createCruise(rulesTurnTicks: number): SimSystem {
  if (!Number.isInteger(rulesTurnTicks) || rulesTurnTicks < 1) throw new Error('rules turn ticks');
  return {
    id: 'cruise',
    phase: 'movement',
    priority: 0,
    step(world) {
      for (const id of world.liveIds()) {
        const fields = readHull(world, id);
        if (fields[H.classCode] === 0 || fields[H.destroyed] === 1) continue;
        const override = fields[H.speedOverride]!;
        const actual = fields[H.speedActual100] ?? -1;
        const useActual = override < 0 && actual >= 0;
        const speed = override >= 0 ? override : fields[H.speed]!;
        const speed100 = useActual ? actual : speed * 100;
        if (speed100 <= 0) {
          world.setFields(id, CRUISE, [0]);
          continue;
        }
        const carried = world.getFields(id, CRUISE)[0]!;
        const denom = useActual ? rulesTurnTicks * 100 : rulesTurnTicks;
        const addend = useActual ? speed100 * FX_ONE : speed * FX_ONE;
        const sum = carried + addend;
        if (sum > IDIV_MAX || sum < 0) {
          world.setFields(id, CRUISE, [0]);
          continue;
        }
        const step = rulesDiv(sum, denom);
        const rest = sum - step * denom;
        world.setFields(id, CRUISE, [rest]);
        if (step === 0) continue;
        const mag = fxRaw(step);
        const heading = world.heading(id);
        const pos = world.position(id);
        world.setPosition(
          id,
          add(pos.x, mul(mag, cos16(heading))),
          add(pos.y, mul(mag, sin16(heading))),
        );
      }
    },
  };
}
