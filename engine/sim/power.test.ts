import { describe, expect, it } from 'vitest';
import { command, type Command } from '../core/codec.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import { CLASS_SHIP, ENERGY_SCALE, MODE_NORMAL, MODE_OVERLOAD, TURN_TEST_C } from './rules-tables.ts';
import {
  VERB_FIRE,
  VERB_SET_ENERGY,
  VERB_SPAWN,
  createCombat,
  firePayload,
  setEnergyPayload,
  spawnPayload,
} from './combat.ts';
import { createSim, type Sim } from './sim.ts';
import { buildViewModel } from '../view/view-model.ts';
import { H, HULL_FIELDS, shipView } from './hull.ts';
import { World } from './world.ts';
import type { TickContext } from './sim.ts';
import { VERB_SET_WEAPON_MODE, setWeaponModePayload } from './phase3.ts';
import {
  POWER_FIELDS,
  POWER_TABLE,
  PP,
  REPAIR_EVERY_TICKS,
  SYS_BRIDGE,
  VERB_SET_BATTERY,
  VERB_SET_PRIORITIES,
  VERB_SET_SHIELD_STATE,
  batteryPayload,
  createPowerRepair,
  powerHandlers,
  priorityPayload,
  shieldStatePayload,
  systemCode,
  SHIELD_DOWN,
  SHIELD_MINIMAL,
} from './power.ts';

const SHIP = 65536;
const FOE = 65537;

function hull(overrides: Partial<ShipSetup> = {}): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 10,
    impulse: 0,
    apr: 0,
    battery: 5,
    batteryCapacity: 5,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_C,
    acceleration: 100,
    speed: 0,
    shields: [10, 10, 10, 10, 10, 10],
    shieldsMax: [10, 10, 10, 10, 10, 10],
    crew: 4,
    minCrew: 1,
    fcPaid: 1,
    destroyed: 0,
    disabled: 0,
    systems: { bridge: 2, hullForward: 4, sensors: 2 },
    mounts: [
      {
        slotIndex: 0,
        weapon: 'TEST-PHOT',
        arc: 'TEST-ALL',
        chargePoints: 8,
        boxes: 1,
        mode: MODE_OVERLOAD,
        ticksCharging: 4,
      },
    ],
    ...overrides,
  };
}

function boot(setups: readonly ShipSetup[]): Sim {
  const combat = createCombat(setups, { rulesTurnTicks: 1 });
  return createSim({
    seed: 1,
    tables: [...combat.tables, POWER_TABLE],
    systems: [...combat.systems, createPowerRepair()],
    handlers: [...combat.handlers, ...powerHandlers],
  });
}

function go(sim: Sim, tick: number, script: [number, Uint8Array][]): void {
  const cmds: Command[] = [];
  if (tick === 1) {
    cmds.push(command(1, 0, 0, VERB_SPAWN, spawnPayload(0, 0, 0, 0)));
    if (sim) {
      /* second ship is spawned by the caller when present */
    }
  }
  script.forEach(([kind, payload], i) => cmds.push(command(tick, 1, i, kind, payload)));
  sim.step(cmds);
}

describe('energy priorities and repair', () => {
  it('pays a higher-priority weapon before movement', () => {
    const sim = boot([
      hull({
        battery: 0,
        batteryCapacity: 0,
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
      }),
    ]);
    go(sim, 1, []);
    go(sim, 2, [
      [VERB_SET_PRIORITIES, priorityPayload(SHIP, 5, 1, 3, 3, 3)],
      [
        VERB_SET_ENERGY,
        setEnergyPayload(SHIP, {
          speed: 6,
          weapons: [{ slot: 0, request: 6, mode: MODE_NORMAL }],
        }),
      ],
    ]);
    const ship = shipView(sim.snapshot().world, 0);
    expect(ship.speed).toBe(4);
    expect(ship.mounts[0]!.charge100 + ship.capacitor100).toBe(6 * ENERGY_SCALE);
  });

  it('does not spend the battery when discharge is off, and still stores surplus', () => {
    const sim = boot([hull({ warp: 4, battery: 5, mounts: [] })]);
    go(sim, 1, []);
    go(sim, 2, [
      [VERB_SET_BATTERY, batteryPayload(SHIP, 0)],
      [VERB_SET_ENERGY, setEnergyPayload(SHIP, { speed: 6 })],
    ]);
    const held = shipView(sim.snapshot().world, 0);
    expect(held.speed).toBe(4);
    expect(held.battery100).toBe(5 * ENERGY_SCALE);
    const open = boot([hull({ warp: 4, battery: 5, mounts: [] })]);
    go(open, 1, []);
    go(open, 2, [[VERB_SET_ENERGY, setEnergyPayload(SHIP, { speed: 6 })]]);
    expect(shipView(open.snapshot().world, 0).speed).toBe(6);
    expect(shipView(open.snapshot().world, 0).battery100).toBe(3 * ENERGY_SCALE);
  });

  it('publishes desired power above the paid draw when the plant is short', () => {
    const sim = boot([hull({ warp: 4, battery: 5, mounts: [] })]);
    go(sim, 1, []);
    go(sim, 2, [
      [VERB_SET_BATTERY, batteryPayload(SHIP, 0)],
      [
        VERB_SET_ENERGY,
        setEnergyPayload(SHIP, { speed: 6 }),
      ],
    ]);
    const snap = sim.snapshot();
    const view = buildViewModel({ prev: snap, curr: snap, alpha: 0, events: [], selfIndex: 0 });
    const energy = view.self?.energy;
    expect(energy?.desired.movement).toBe(6);
    expect(energy?.draws.movement).toBe(4);
    expect(energy?.desired.weapons).toBe(0);
    expect(energy?.draws.weapons).toBe(0);
    expect(energy?.desired.shields).toBe(0);
    expect(energy?.draws.shields).toBe(0);
    expect(view.self?.damage.repairPoints).toBe(0);
  });

  it('drops shields, raises the basic facing, and refuses reinforcement while down', () => {
    const sim = boot([hull({ mounts: [] })]);
    go(sim, 1, []);
    go(sim, 2, [[VERB_SET_SHIELD_STATE, shieldStatePayload(SHIP, SHIELD_DOWN)]]);
    expect(shipView(sim.snapshot().world, 0).shields[0]).toBe(0);
    go(sim, 3, [[VERB_SET_ENERGY, setEnergyPayload(SHIP, { general: 4 })]]);
    expect(shipView(sim.snapshot().world, 0).shields[0]).toBe(0);
    go(sim, 4, [[VERB_SET_SHIELD_STATE, shieldStatePayload(SHIP, SHIELD_MINIMAL)]]);
    expect(shipView(sim.snapshot().world, 0).shields[0]).toBe(10);
  });

  it('repairs one box of the queued system after the placeholder interval', () => {
    const world = new World([
      { id: 'hull', fieldCount: HULL_FIELDS },
      POWER_TABLE,
    ]);
    const id = world.alloc('ship');
    const fields = new Array<number>(HULL_FIELDS).fill(0);
    fields[H.bridge] = 1;
    world.setFields(id, 'hull', fields);
    const row = new Array<number>(POWER_FIELDS).fill(0);
    row[PP.max0] = 2;
    row[PP.repair0] = SYS_BRIDGE;
    world.setFields(id, POWER_TABLE.id, row);
    const repair = createPowerRepair();
    const ctx = {} as TickContext;
    for (let i = 0; i < REPAIR_EVERY_TICKS; i++) repair.step(world, ctx);
    expect(world.getFields(id, 'hull')[H.bridge]).toBe(2);
    expect(systemCode('bridge')).toBe(SYS_BRIDGE);
  });

  it('fires an overload photon for its overload damage and refuses an offline mount', () => {
    const sim = boot([
      hull(),
      hull({
        mounts: [
          {
            slotIndex: 0,
            weapon: 'TEST-PH',
            arc: 'TEST-ALL',
            chargePoints: 4,
            boxes: 1,
            mode: MODE_NORMAL,
            ticksCharging: 0,
          },
        ],
      }),
    ]);
    const cmds: Command[] = [
      command(1, 0, 0, VERB_SPAWN, spawnPayload(0, 0, 0, 0)),
      command(1, 0, 1, VERB_SPAWN, spawnPayload(1, 2, 0, 0)),
    ];
    sim.step(cmds);
    const hit = sim.step([command(2, 0, 0, VERB_FIRE, firePayload(SHIP, 0, FOE))]);
    expect(hit.events.some((event) => event.kind === 2 && event.a === 0 && event.b === 12)).toBe(true);
    sim.step([command(3, 0, 0, VERB_SET_WEAPON_MODE, setWeaponModePayload(FOE, 0, 3))]);
    const denied = sim.step([command(4, 0, 0, VERB_FIRE, firePayload(FOE, 0, SHIP))]);
    expect(denied.events.some((event) => event.kind === 2 && event.entity === FOE && event.a === 9)).toBe(true);
  });
});
