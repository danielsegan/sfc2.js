import { describe, expect, it } from 'vitest';
import { fx } from '../core/fx.ts';
import { LocalSession } from '../net/session.ts';
import { createSim, type Sim, type StepResult } from './sim.ts';
import {
  CLASS_SHIP,
  DEFAULT_RULES_TURN_TICKS,
  DISRUPTOR_MAX_RANGE,
  DISRUPTOR_OVERLOAD_MAX_RANGE,
  ENERGY_SCALE,
  MODE_NORMAL,
  MODE_OVERLOAD,
  TURN_TEST_C,
  weaponDef,
  weaponId,
} from './rules-tables.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import {
  EVENT_RULE,
  R,
  VERB_FIRE,
  VERB_SPAWN,
  createCombat,
  firePayload,
  spawnPayload,
  type CombatOptions,
} from './combat.ts';
import { disruptorShot } from './disruptor.ts';

const RANGES = [0, 1, 2, 3, 4, 8, 11, 15, 20, 25] as const;
const NORMAL_DAMAGE = [5, 5, 5, 4, 4, 3, 3, 3, 2, 2] as const;

function always(hit: boolean): { chance: (num: number, den: number) => boolean; calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    chance(num: number, den: number) {
      calls.push(num, den);
      return hit;
    },
  };
}

function shotAt(rangeUnits: number, mode: number, hit: boolean) {
  const def = weaponDef(weaponId('Dis1'));
  if (!def) throw new Error('Dis1');
  const roll = always(hit);
  const dx = fx(rangeUnits) as number;
  return { result: disruptorShot(def, mode, dx, 0, roll), calls: roll.calls };
}

describe('disruptor table', () => {
  it('deals the measured normal damage at each listed range, with the edge on the inner band', () => {
    const def = weaponDef(weaponId('Dis1'));
    expect(def?.maxRange).toBe(DISRUPTOR_MAX_RANGE);
    expect(def?.bands[def.bands.length - 1]?.maxRange).toBe(DISRUPTOR_MAX_RANGE);
    expect(def?.overloadArmCost).toBe(4);
    expect(def?.overloadArmPerTurn).toBe(4);
    expect(def?.overloadBands[def.overloadBands.length - 1]?.maxRange).toBe(DISRUPTOR_OVERLOAD_MAX_RANGE);
    for (let i = 0; i < RANGES.length; i++) {
      const range = RANGES[i]! * 1000;
      expect(shotAt(range, MODE_NORMAL, true).result).toEqual({ amount: NORMAL_DAMAGE[i], unit: 1 });
    }
    expect(shotAt(1000, MODE_NORMAL, true).result?.amount).toBe(5);
    expect(shotAt(1099, MODE_NORMAL, true).result?.amount).toBe(5);
    expect(shotAt(1100, MODE_NORMAL, true).result?.amount).toBe(5);
    expect(shotAt(2000, MODE_NORMAL, true).result?.amount).toBe(5);
    expect(shotAt(2099, MODE_NORMAL, true).result?.amount).toBe(5);
    expect(shotAt(2100, MODE_NORMAL, true).result?.amount).toBe(4);
    expect(shotAt(5000, MODE_NORMAL, true).result?.amount).toBe(4);
    expect(shotAt(5099, MODE_NORMAL, true).result?.amount).toBe(4);
    expect(shotAt(5100, MODE_NORMAL, true).result?.amount).toBe(3);
    expect(shotAt(16000, MODE_NORMAL, true).result?.amount).toBe(3);
    expect(shotAt(16099, MODE_NORMAL, true).result?.amount).toBe(3);
    expect(shotAt(16100, MODE_NORMAL, true).result?.amount).toBe(2);
    expect(shotAt(DISRUPTOR_MAX_RANGE, MODE_NORMAL, true).result?.amount).toBe(2);
    expect(shotAt(DISRUPTOR_MAX_RANGE + 1, MODE_NORMAL, true).result).toBeUndefined();
  });

  it('stores 66.7% as 667/1000 and does not draw on a certain hit', () => {
    expect(shotAt(1099, MODE_NORMAL, false).calls).toEqual([]);
    expect(shotAt(1100, MODE_NORMAL, true).calls).toEqual([4, 5]);
    const mid = shotAt(8000, MODE_NORMAL, true);
    expect(mid.calls).toEqual([667, 1000]);
    expect(mid.result?.amount).toBe(3);
    const certain = shotAt(0, MODE_NORMAL, false);
    expect(certain.calls).toEqual([]);
    expect(certain.result?.amount).toBe(5);
    const miss = shotAt(1500, MODE_NORMAL, false);
    expect(miss.calls).toEqual([4, 5]);
    expect(miss.result).toEqual({ amount: 0, unit: 1 });
  });

  it('caps overload at 9k and deals 0 past that cutoff', () => {
    expect(shotAt(0, MODE_OVERLOAD, true).result?.amount).toBe(10);
    expect(shotAt(0, MODE_OVERLOAD, false).calls).toEqual([]);
    expect(shotAt(2000, MODE_OVERLOAD, true).result?.amount).toBe(10);
    expect(shotAt(2099, MODE_OVERLOAD, true).result?.amount).toBe(10);
    expect(shotAt(2100, MODE_OVERLOAD, true).result?.amount).toBe(8);
    expect(shotAt(4900, MODE_OVERLOAD, true).result?.amount).toBe(8);
    expect(shotAt(4999, MODE_OVERLOAD, true).result?.amount).toBe(8);
    expect(shotAt(5000, MODE_OVERLOAD, true).result?.amount).toBe(6);
    expect(shotAt(DISRUPTOR_OVERLOAD_MAX_RANGE, MODE_OVERLOAD, true).result?.amount).toBe(6);
    expect(shotAt(DISRUPTOR_OVERLOAD_MAX_RANGE + 1, MODE_OVERLOAD, true).result).toBeUndefined();
    expect(shotAt(4000, MODE_OVERLOAD, true).calls).toEqual([81, 100]);
    expect(shotAt(4999, MODE_OVERLOAD, true).calls).toEqual([81, 100]);
    expect(shotAt(5000, MODE_OVERLOAD, true).calls).toEqual([83, 100]);
  });
});

function disruptorShip(mode: number, charge: number): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 10,
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_C,
    acceleration: 100,
    speed: 0,
    shields: [40, 40, 40, 40, 40, 40],
    shieldsMax: [40, 40, 40, 40, 40, 40],
    crew: 4,
    minCrew: 1,
    fcPaid: 1,
    destroyed: 0,
    disabled: 0,
    mounts: [
      {
        slotIndex: 0,
        weapon: 'Dis1',
        arc: 'ALL',
        chargePoints: charge,
        boxes: 1,
        mode,
        ticksCharging: DEFAULT_RULES_TURN_TICKS,
      },
    ],
  };
}

const sessions = new Map<Sim, LocalSession>();

function boot(setups: readonly ShipSetup[], options?: CombatOptions): Sim {
  const combat = createCombat(setups, options);
  const sim = createSim({
    seed: 1,
    tables: combat.tables,
    systems: combat.systems,
    handlers: combat.handlers,
  });
  sessions.set(sim, new LocalSession({ inputDelay: 0, currentTick: () => sim.tick as number }));
  return sim;
}

function play(sim: Sim, kind: number, payload: Uint8Array): StepResult {
  const session = sessions.get(sim);
  if (!session) throw new Error('session');
  session.issue(kind, payload);
  const next = ((sim.tick as number) + 1) >>> 0;
  return sim.step(session.commandsFor(next));
}

describe('disruptor fire', () => {
  it('applies 5 at range 0 and rejects a shot past the measured 31k cutoff', () => {
    const close = boot([disruptorShip(MODE_NORMAL, 2), disruptorShip(MODE_NORMAL, 0)]);
    play(close, VERB_SPAWN, spawnPayload(0, 0, 0, 0));
    play(close, VERB_SPAWN, spawnPayload(1, 0, 0, 0));
    const hit = play(close, VERB_FIRE, firePayload(65536, 0, 65537));
    const rule = hit.events.find((event) => event.kind === EVENT_RULE);
    expect(rule?.a).toBe(R.ok);
    expect(rule?.b).toBe(5);

    const far = boot([disruptorShip(MODE_NORMAL, 2), disruptorShip(MODE_NORMAL, 0)]);
    play(far, VERB_SPAWN, spawnPayload(0, 0, 0, 0));
    play(far, VERB_SPAWN, spawnPayload(1, DISRUPTOR_MAX_RANGE + 1, 0, 0));
    const miss = play(far, VERB_FIRE, firePayload(65536, 0, 65537));
    expect(miss.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.outOfRange);
  });

  it('applies 10 for a point-blank overload and nothing past 9k', () => {
    const close = boot([disruptorShip(MODE_OVERLOAD, 4), disruptorShip(MODE_NORMAL, 0)]);
    play(close, VERB_SPAWN, spawnPayload(0, 0, 0, 0));
    play(close, VERB_SPAWN, spawnPayload(1, 0, 0, 0));
    const hit = play(close, VERB_FIRE, firePayload(65536, 0, 65537));
    const rule = hit.events.find((event) => event.kind === EVENT_RULE);
    expect(rule?.a).toBe(R.ok);
    expect(rule?.b).toBe(10);

    const far = boot([disruptorShip(MODE_OVERLOAD, 4), disruptorShip(MODE_NORMAL, 0)]);
    play(far, VERB_SPAWN, spawnPayload(0, 0, 0, 0));
    play(far, VERB_SPAWN, spawnPayload(1, DISRUPTOR_OVERLOAD_MAX_RANGE + 1, 0, 0));
    const none = play(far, VERB_FIRE, firePayload(65536, 0, 65537));
    expect(none.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.outOfRange);
  });
});
