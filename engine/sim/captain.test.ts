import { describe, expect, it } from 'vitest';
import { command } from '../core/codec.ts';
import { readU32 } from '../core/bytes.ts';
import { VERB_ORDER_HELM, helmHandler, helmPayload } from '../duel/helm.ts';
import { createSim } from './sim.ts';
import { createCombat, VERB_FIRE, VERB_SET_ENERGY, VERB_SPAWN, firePayload, spawnPayload } from './combat.ts';
import { CRUISE_TABLE, createCruise } from '../duel/cruise.ts';
import { CLASS_SHIP, ENERGY_SCALE, MODE_NORMAL, TURN_TEST_A } from './rules-tables.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import {
  ALLEGIANCE_TABLE,
  CONTROL_AI,
  CONTROL_MANUAL,
  VERB_SET_ALLEGIANCE,
  allegianceHandler,
  allegiancePayload,
} from './allegiance.ts';
import { createCaptain } from './captain.ts';
import { VERB_SET_CLOAK, VERB_SET_EW } from './phase3.ts';
import { shipView } from './hull.ts';

function hull(overrides: Partial<ShipSetup> = {}): ShipSetup {
  const shields = overrides.shields ?? [12, 10, 8, 8, 8, 10];
  const shieldsMax = overrides.shieldsMax ?? shields.slice();
  return {
    classCode: overrides.classCode ?? CLASS_SHIP,
    warp: overrides.warp ?? 20,
    impulse: overrides.impulse ?? 0,
    apr: overrides.apr ?? 0,
    battery: overrides.battery ?? 0,
    batteryCapacity: overrides.batteryCapacity ?? 8,
    moveCost100: overrides.moveCost100 ?? ENERGY_SCALE,
    turnMode: overrides.turnMode ?? TURN_TEST_A,
    acceleration: overrides.acceleration ?? 8,
    speed: overrides.speed ?? 0,
    shields,
    shieldsMax,
    crew: overrides.crew ?? 4,
    minCrew: overrides.minCrew ?? 1,
    fcPaid: overrides.fcPaid ?? 0,
    destroyed: overrides.destroyed ?? 0,
    disabled: overrides.disabled ?? 0,
    stealth: overrides.stealth ?? 0,
    scanners: overrides.scanners ?? 0,
    specialSensors: overrides.specialSensors ?? 0,
    tractors: overrides.tractors ?? 0,
    cloakCost: overrides.cloakCost ?? 0,
    systems: overrides.systems,
    mounts: overrides.mounts ?? [
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

function boot(setups: readonly ShipSetup[], seed = 1) {
  const combat = createCombat(setups, { rulesTurnTicks: 4 });
  return createSim({
    seed,
    tables: [...combat.tables, CRUISE_TABLE, ALLEGIANCE_TABLE],
    systems: [...combat.systems, createCruise(4), createCaptain()],
    handlers: [...combat.handlers, helmHandler, allegianceHandler],
  });
}

function pack(index: number): number {
  return (index & 0xffff) | (1 << 16);
}

function opening(setups: readonly { x: number; y: number; heading: number; side: 0 | 1; control: number }[]) {
  const cmds: { kind: number; payload: Uint8Array }[] = [];
  for (let i = 0; i < setups.length; i++) {
    const spawn = setups[i]!;
    cmds.push({ kind: VERB_SPAWN, payload: spawnPayload(i, spawn.x, spawn.y, spawn.heading) });
  }
  for (let i = 0; i < setups.length; i++) {
    const spawn = setups[i]!;
    cmds.push({
      kind: VERB_SET_ALLEGIANCE,
      payload: allegiancePayload(pack(i), spawn.side, spawn.control),
    });
  }
  return cmds;
}

function step(sim: ReturnType<typeof boot>, bodies: readonly { kind: number; payload: Uint8Array }[] = []) {
  const tick = (sim.tick as number) + 1;
  sim.step(bodies.map((body, seq) => command(tick, 0, seq, body.kind, body.payload)));
}

function i32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}

describe('ai captains', () => {
  it('turns the strongest shield toward the enemy through the helm verb', () => {
    const shooter = hull({
      shields: [1, 30, 1, 1, 1, 1],
      shieldsMax: [1, 30, 1, 1, 1, 1],
      acceleration: 0,
      mounts: [
        {
          slotIndex: 0,
          weapon: 'TEST-PH',
          arc: 'TEST-ALL',
          chargePoints: 0,
          boxes: 1,
          mode: MODE_NORMAL,
          ticksCharging: 0,
        },
      ],
    });
    const target = hull({ acceleration: 0 });
    const sim = boot([shooter, target]);
    step(sim, opening([
      { x: 0, y: 0, heading: 0, side: 0, control: CONTROL_AI },
      { x: 10, y: 0, heading: 32768, side: 1, control: CONTROL_MANUAL },
    ]));
    const first = sim.snapshot().queued.find((cmd) => cmd.kind === VERB_ORDER_HELM);
    expect(first?.slot).toBe(8);
    expect(first?.payload).toEqual(helmPayload(pack(0), -8000));
    step(sim);
    expect(shipView(sim.snapshot().world, 0).heading).toBe(57536);
    const second = sim.snapshot().queued.find((cmd) => cmd.kind === VERB_ORDER_HELM);
    expect(second?.payload).toEqual(helmPayload(pack(0), -2922));
    step(sim);
    expect(shipView(sim.snapshot().world, 0).heading).toBe(54614);
  });

  it('retreats when the shields are low and asks for flee speed', () => {
    const shooter = hull({
      shields: [1, 1, 1, 2, 1, 1],
      shieldsMax: [12, 12, 12, 12, 12, 12],
      acceleration: 0,
    });
    const sim = boot([shooter, hull()]);
    step(sim, opening([
      { x: 0, y: 0, heading: 0, side: 0, control: CONTROL_AI },
      { x: 10, y: 0, heading: 0, side: 1, control: CONTROL_MANUAL },
    ]));
    const helm = sim.snapshot().queued.find((cmd) => cmd.kind === VERB_ORDER_HELM);
    const energy = sim.snapshot().queued.find((cmd) => cmd.kind === VERB_SET_ENERGY);
    expect(helm?.payload).toEqual(helmPayload(pack(0), -8000));
    expect(energy).toBeDefined();
    expect(i32(energy!.payload, 8)).toBe(6);
    expect(energy?.slot).toBe(8);
    expect(energy?.kind).toBe(VERB_SET_ENERGY);
  });

  it('fires only at the other side, and leaves a manual ship alone', () => {
    const sim = boot([hull(), hull(), hull()], 9);
    const other = boot([hull(), hull(), hull()], 9);
    step(sim, opening([
      { x: 0, y: 0, heading: 0, side: 0, control: CONTROL_AI },
      { x: 0, y: 6, heading: 0, side: 0, control: CONTROL_MANUAL },
      { x: 8, y: 0, heading: 32768, side: 1, control: CONTROL_AI },
    ]));
    step(other, opening([
      { x: 0, y: 0, heading: 0, side: 0, control: CONTROL_AI },
      { x: 0, y: 6, heading: 0, side: 0, control: CONTROL_MANUAL },
      { x: 8, y: 0, heading: 32768, side: 1, control: CONTROL_AI },
    ]));
    let fired = 0;
    for (let i = 0; i < 16; i++) {
      expect(sim.stateHash()).toBe(other.stateHash());
      for (const cmd of sim.snapshot().queued) {
        expect(cmd.slot).toBeGreaterThanOrEqual(8);
        expect(cmd.slot).toBeLessThanOrEqual(15);
        const entity = i32(cmd.payload, 0);
        expect(entity === pack(0) || entity === pack(2)).toBe(true);
        if (cmd.kind === VERB_FIRE) {
          fired += 1;
          const target = i32(cmd.payload, 8);
          expect(target === pack(0) || target === pack(2)).toBe(true);
          expect(cmd.payload).toEqual(firePayload(entity, 0, target));
        }
      }
      step(sim);
      step(other);
    }
    expect(fired).toBeGreaterThan(0);
    expect(sim.stateHash()).toBe(other.stateHash());
  });

  it('leaves the ai stream alone when the target and the shield are unique', () => {
    const setups = [hull({ acceleration: 0 }), hull({ acceleration: 0 })];
    const sim = boot(setups);
    const idle = boot(setups);
    const bodies = opening([
      { x: 0, y: 0, heading: 0, side: 0, control: CONTROL_AI },
      { x: 8, y: 0, heading: 32768, side: 1, control: CONTROL_MANUAL },
    ]);
    step(sim, bodies);
    step(sim);
    expect(shipView(sim.snapshot().world, 0).speed).toBe(0);
    expect(sim.snapshot().rng[0]).toEqual(idle.snapshot().rng[0]);
    expect(sim.snapshot().rng[1]).toEqual(idle.snapshot().rng[1]);
  });

  it('buys one ECCM while fighting and raises a cloak when it runs', () => {
    const fighter = hull({
      systems: { sensors: 4 },
      battery: 4,
      batteryCapacity: 8,
      scanners: 0,
      specialSensors: 0,
    });
    const sim = boot([fighter, hull()]);
    step(sim, opening([
      { x: 0, y: 0, heading: 0, side: 0, control: CONTROL_AI },
      { x: 8, y: 0, heading: 32768, side: 1, control: CONTROL_MANUAL },
    ]));
    expect(sim.snapshot().queued.some((cmd) => cmd.kind === VERB_SET_EW)).toBe(true);
    step(sim);
    expect(shipView(sim.snapshot().world, 0).eccmPaid).toBe(1);
    expect(shipView(sim.snapshot().world, 0).ecmPaid).toBe(0);

    const runner = hull({
      shields: [1, 1, 1, 1, 1, 1],
      shieldsMax: [8, 8, 8, 8, 8, 8],
      cloakCost: 2,
      battery: 8,
      batteryCapacity: 8,
    });
    const fleeing = boot([runner, hull()]);
    step(fleeing, opening([
      { x: 0, y: 0, heading: 0, side: 0, control: CONTROL_AI },
      { x: 8, y: 0, heading: 32768, side: 1, control: CONTROL_MANUAL },
    ]));
    expect(fleeing.snapshot().queued.some((cmd) => cmd.kind === VERB_SET_CLOAK)).toBe(true);
    step(fleeing);
    expect(shipView(fleeing.snapshot().world, 0).cloakState).toBe(1);
  });
});
