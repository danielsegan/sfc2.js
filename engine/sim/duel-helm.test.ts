import { describe, expect, it } from 'vitest';
import { command, type Command } from '../core/codec.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import { CLASS_SHIP, ENERGY_SCALE, MODE_NORMAL, TURN_TEST_C } from './rules-tables.ts';
import { VERB_SET_ENERGY, VERB_SPAWN, createCombat, setEnergyPayload, spawnPayload } from './combat.ts';
import { createSim, type Sim, type SimEvent } from './sim.ts';
import { shipView } from './hull.ts';
import { readHelmView } from './helm.ts';
import { VERB_ORDER_HET } from './heading.ts';
import { EVENT_HET, HET_BREAKDOWN, HET_INVALID_DIR, HET_ORDERED, createHetTurn, hetAnglePayload, hetHandler, hetPayload } from './het.ts';
import { HET_TABLE, TURN_CURVE_TABLE } from './turn-curve.ts';
import {
  CAPACITOR_RATE_SCALE,
  DUEL_HELM_TABLE,
  EMER_RECOVER_TICKS,
  ERRATIC_HIT_PENALTY,
  VERB_ORDER_EMER_DECEL,
  VERB_SET_CAPACITOR_RATE,
  VERB_SET_ERRATIC,
  capacitorRatePayload,
  createDuelHelm,
  duelHelmHandlers,
  emerPayload,
  erraticPayload,
} from './duel-helm.ts';

const SHIP = 65536;

function phaserShip(speed = 0): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 20,
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_C,
    acceleration: 100,
    speed,
    shields: [0, 0, 0, 0, 0, 0],
    shieldsMax: [20, 20, 20, 20, 20, 20],
    crew: 4,
    minCrew: 1,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    mounts: [
      {
        slotIndex: 0,
        weapon: 'TEST-PH',
        arc: 'TEST-FA',
        chargePoints: 0,
        boxes: 1,
        mode: MODE_NORMAL,
        ticksCharging: 0,
      },
    ],
  };
}

function build(seed = 1): Sim {
  const combat = createCombat([phaserShip()], { rulesTurnTicks: 1 });
  return createSim({
    seed,
    tables: [...combat.tables, TURN_CURVE_TABLE, HET_TABLE, DUEL_HELM_TABLE],
    systems: [...combat.systems, createHetTurn(), createDuelHelm()],
    handlers: [...combat.handlers, hetHandler, ...duelHelmHandlers],
  });
}

function step(sim: Sim, tick: number, script: [number, Uint8Array][]): readonly SimEvent[] {
  const cmds: Command[] = [];
  if (tick === 1) cmds.push(command(1, 0, 0, VERB_SPAWN, spawnPayload(0, 0, 0, 0)));
  script.forEach(([kind, payload], i) => cmds.push(command(tick, 1, i, kind, payload)));
  return sim.step(cmds).events;
}

describe('phase 2 helm orders', () => {
  it('cuts speed to 0 and refuses to get underway during recovery', () => {
    const sim = build();
    step(sim, 1, []);
    const before = shipView(sim.snapshot().world, 0);
    expect(before.speed).toBe(0);
    step(sim, 2, [[VERB_SET_ENERGY, setEnergyPayload(SHIP, { speed: 8 })]]);
    expect(shipView(sim.snapshot().world, 0).speed).toBe(8);
    step(sim, 3, [[VERB_ORDER_EMER_DECEL, emerPayload(SHIP)]]);
    const stopped = shipView(sim.snapshot().world, 0);
    expect(stopped.speed).toBe(0);
    expect(stopped.shields[0]).toBe(8);
    step(sim, 4, [[VERB_SET_ENERGY, setEnergyPayload(SHIP, { speed: 10 })]]);
    expect(shipView(sim.snapshot().world, 0).speed).toBe(0);
    expect(shipView(sim.snapshot().world, 0).lastReason).toBeGreaterThan(0);
    const helm = sim.snapshot().world.tables.find((table) => table.id === 'duelHelm');
    expect(helm?.data[2]).toBe(EMER_RECOVER_TICKS - 2);
  });

  it('stores half the phaser request when the capacitor rate is half', () => {
    const full = build();
    step(full, 1, []);
    step(full, 2, [
      [VERB_SET_CAPACITOR_RATE, capacitorRatePayload(SHIP, CAPACITOR_RATE_SCALE)],
      [VERB_SET_ENERGY, setEnergyPayload(SHIP, { weapons: [{ slot: 0, request: 8, mode: MODE_NORMAL }] })],
    ]);
    const half = build();
    step(half, 1, []);
    step(half, 2, [
      [VERB_SET_CAPACITOR_RATE, capacitorRatePayload(SHIP, CAPACITOR_RATE_SCALE / 2)],
      [VERB_SET_ENERGY, setEnergyPayload(SHIP, { weapons: [{ slot: 0, request: 8, mode: MODE_NORMAL }] })],
    ]);
    const fullShip = shipView(full.snapshot().world, 0);
    const halfShip = shipView(half.snapshot().world, 0);
    expect(fullShip.mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(halfShip.mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(fullShip.capacitor100).toBe(4 * ENERGY_SCALE);
    expect(halfShip.capacitor100).toBe(2 * ENERGY_SCALE);
  });

  it('accepts a free-angle sweep, including 180°, and rejects a wider one', () => {
    const sim = build();
    step(sim, 1, []);
    const ordered = step(sim, 2, [[VERB_ORDER_HET, hetAnglePayload(SHIP, 32768)]]);
    expect(ordered.find((event) => event.kind === EVENT_HET)?.a).toBe(HET_ORDERED);
    expect(ordered.find((event) => event.kind === EVENT_HET)?.b).toBe(32768);
    const other = build();
    step(other, 1, []);
    const wide = step(other, 2, [[VERB_ORDER_HET, hetAnglePayload(SHIP, 32769)]]);
    expect(wide.find((event) => event.kind === EVENT_HET)?.a).toBe(HET_INVALID_DIR);
  });

  it('drops HET success while erratic and can break down on the combat stream', () => {
    const sim = build();
    step(sim, 1, []);
    step(sim, 2, [[VERB_SET_ERRATIC, erraticPayload(SHIP, 1)]]);
    const helm = readHelmView(sim.snapshot().world, 0);
    expect(helm.erraticActive).toBe(true);
    expect(helm.hetSuccessChance).toBe(75);
    let broke = false;
    let passed = false;
    for (let seed = 1; seed <= 30; seed++) {
      const trial = build(seed);
      step(trial, 1, []);
      step(trial, 2, [[VERB_SET_ERRATIC, erraticPayload(SHIP, 1)]]);
      const again = build(seed);
      step(again, 1, []);
      step(again, 2, [[VERB_SET_ERRATIC, erraticPayload(SHIP, 1)]]);
      const left = step(trial, 3, [[VERB_ORDER_HET, hetPayload(SHIP, 1)]]);
      const right = step(again, 3, [[VERB_ORDER_HET, hetPayload(SHIP, 1)]]);
      expect(trial.stateHash()).toBe(again.stateHash());
      const code = left.find((event) => event.kind === EVENT_HET)?.a;
      expect(right.find((event) => event.kind === EVENT_HET)?.a).toBe(code);
      if (code === HET_BREAKDOWN) broke = true;
      if (code === HET_ORDERED) passed = true;
    }
    expect(broke).toBe(true);
    expect(passed).toBe(true);
    expect(ERRATIC_HIT_PENALTY).toBe(15);
  });
});
