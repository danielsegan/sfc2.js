/**
 * Deterministic checks for EW, overload arming, tractors, and cloaks.
 * Seeds and the combat stream are the only randomness. No clock.
 */
import { describe, expect, it } from 'vitest';
import { createRngStreams } from '../core/rng.ts';
import { fx } from '../core/fx.ts';
import { LocalSession } from '../net/session.ts';
import { createSim, type Sim, type StepResult } from './sim.ts';
import { parseShiplist } from '../../tools/formats/shiplist.ts';
import { bindShiplistRow, type ShipSetup } from './bind-shiplist.ts';
import {
  CLASS_SHIP,
  CLOAK_TICKS,
  ENERGY_SCALE,
  MODE_NORMAL,
  MODE_OVERLOAD,
  TURN_TEST_C,
} from './rules-tables.ts';
import { shipView } from './hull.ts';
import {
  EVENT_HIT,
  EVENT_RULE,
  EVENT_SPAWN,
  R,
  VERB_FIRE,
  VERB_SET_ENERGY,
  VERB_SPAWN,
  createCombat,
  firePayload,
  setEnergyPayload,
  spawnPayload,
} from './combat.ts';
import {
  CLOAK_ON,
  TRACTOR_HOLD,
  TRACTOR_OFF,
  TRACTOR_REINFORCE,
  TRACTOR_REPEL,
  VERB_SET_CLOAK,
  VERB_SET_EW,
  VERB_SET_TRACTOR,
  VERB_SET_WEAPON_MODE,
  ewShift,
  hitChance,
  setCloakPayload,
  setEwPayload,
  setTractorPayload,
  setWeaponModePayload,
} from './phase3.ts';

function cruiser(overrides: Partial<ShipSetup> = {}): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 20,
    impulse: 0,
    apr: 0,
    battery: 10,
    batteryCapacity: 10,
    moveCost100: ENERGY_SCALE,
    turnMode: TURN_TEST_C,
    acceleration: 100,
    speed: 0,
    shields: [0, 0, 0, 0, 0, 0],
    shieldsMax: [20, 20, 20, 20, 20, 20],
    crew: 4,
    minCrew: 1,
    fcPaid: 1,
    destroyed: 0,
    disabled: 0,
    stealth: 0,
    scanners: 0,
    specialSensors: 0,
    tractors: 4,
    cloakCost: 0,
    systems: { sensors: 6, bridge: 4, extraDamage: 4 },
    mounts: [
      {
        slotIndex: 0,
        weapon: 'TEST-PH',
        arc: 'TEST-FA',
        chargePoints: 4,
        boxes: 1,
        mode: MODE_NORMAL,
        ticksCharging: 0,
      },
    ],
    ...overrides,
  };
}

const sessions = new Map<Sim, LocalSession>();

function boot(seed: number, setups: readonly ShipSetup[], rulesTurnTicks = 30): Sim {
  const combat = createCombat(setups, { rulesTurnTicks });
  const sim = createSim({
    seed,
    tables: combat.tables,
    systems: combat.systems,
    handlers: combat.handlers,
  });
  sessions.set(sim, new LocalSession({ inputDelay: 0, currentTick: () => sim.tick as number }));
  return sim;
}

function play(sim: Sim, issues: readonly { kind: number; payload: Uint8Array }[] = []): StepResult {
  const session = sessions.get(sim);
  if (!session) throw new Error('session');
  for (const issue of issues) session.issue(issue.kind, issue.payload);
  const next = ((sim.tick as number) + 1) >>> 0;
  return sim.step(session.commandsFor(next));
}

function rule(result: StepResult): { a: number; b: number } {
  const event = result.events.find((item) => item.kind === EVENT_RULE);
  if (!event) throw new Error('missing rule');
  return event;
}

function predictMiss(seed: number, shift: number): boolean {
  const chance = hitChance(shift);
  if (chance.num >= chance.den) return false;
  if (chance.num <= 0) return true;
  return !createRngStreams(seed).stream('combat').chance(chance.num, chance.den);
}

function spawnPair(sim: Sim, x0: number, x1: number): { attacker: number; target: number } {
  const result = play(sim, [
    { kind: VERB_SPAWN, payload: spawnPayload(0, x0, 0, 0) },
    { kind: VERB_SPAWN, payload: spawnPayload(1, x1, 0, 32768) },
  ]);
  const spawned = result.events.filter((event) => event.kind === EVENT_SPAWN);
  return { attacker: spawned[0]!.entity, target: spawned[1]!.entity };
}

function rawX(sim: Sim, index: number): number {
  const snap = sim.snapshot().world;
  for (const table of snap.tables) {
    if (table.id !== 'position') continue;
    return table.data[index * 2] ?? 0;
  }
  throw new Error('position');
}

describe('electronic warfare', () => {
  it('treats a non-negative shift as a certain hit and does not move the chart draws', () => {
    const plain = boot(1, [cruiser(), cruiser()]);
    const matched = boot(1, [cruiser(), cruiser()]);
    const a = spawnPair(plain, 0, 0);
    const b = spawnPair(matched, 0, 0);
    play(matched, [
      { kind: VERB_SET_EW, payload: setEwPayload(b.attacker, 0, 2) },
    ]);
    play(matched, [
      { kind: VERB_SET_EW, payload: setEwPayload(b.target, 2, 0) },
    ]);
    const left = play(plain, [{ kind: VERB_FIRE, payload: firePayload(a.attacker, 0, a.target) }]);
    const right = play(matched, [{ kind: VERB_FIRE, payload: firePayload(b.attacker, 0, b.target) }]);
    expect(rule(left).a).toBe(R.ok);
    expect(rule(right).a).toBe(R.ok);
    expect(shipView(plain.snapshot().world, 1).systems).toEqual(shipView(matched.snapshot().world, 1).systems);
    expect(left.events.some((event) => event.kind === EVENT_HIT)).toBe(true);
  });

  it('follows the combat stream for a defender ECM advantage, including free stealth', () => {
    let misses = 0;
    let hits = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const shift = ewShift(0, 1, 0);
      const missed = predictMiss(seed, shift);
      const paid = boot(seed, [cruiser(), cruiser()]);
      const quiet = boot(seed, [cruiser(), cruiser({ stealth: 1, systems: { sensors: 6 } })]);
      const ids = spawnPair(paid, 0, 0);
      const alt = spawnPair(quiet, 0, 0);
      play(paid, [{ kind: VERB_SET_EW, payload: setEwPayload(ids.target, 1, 0) }]);
      const fired = play(paid, [{ kind: VERB_FIRE, payload: firePayload(ids.attacker, 0, ids.target) }]);
      const stealthFired = play(quiet, [{ kind: VERB_FIRE, payload: firePayload(alt.attacker, 0, alt.target) }]);
      expect(rule(fired).a).toBe(rule(stealthFired).a);
      if (missed) {
        expect(rule(fired).a).toBe(R.ewMiss);
        expect(fired.events.some((event) => event.kind === EVENT_HIT)).toBe(false);
        misses += 1;
      } else {
        expect(rule(fired).a).toBe(R.ok);
        hits += 1;
      }
      expect(paid.stateHash()).toBe(bootHash(seed));
    }
    expect(misses).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
  });

  it('caps powered EW at sensor boxes and refuses a ship with none', () => {
    const sim = boot(1, [cruiser({ systems: { sensors: 1 }, scanners: 1, specialSensors: 1 }), cruiser()]);
    const ids = spawnPair(sim, 0, 4);
    const capped = play(sim, [{ kind: VERB_SET_EW, payload: setEwPayload(ids.attacker, 5, 1) }]);
    expect(rule(capped).a).toBe(R.ewCapped);
    expect(rule(capped).b).toBe(3);
    expect(shipView(sim.snapshot().world, 0).ecmPaid).toBe(3);
    expect(shipView(sim.snapshot().world, 0).eccmPaid).toBe(0);
    const blind = boot(1, [cruiser({ systems: { sensors: 0 }, scanners: 0, specialSensors: 0 }), cruiser()]);
    const blindIds = spawnPair(blind, 0, 4);
    const refused = play(blind, [{ kind: VERB_SET_EW, payload: setEwPayload(blindIds.attacker, 1, 0) }]);
    expect(rule(refused).a).toBe(R.noEw);
    expect(shipView(blind.snapshot().world, 0).battery100).toBe(10 * ENERGY_SCALE);
  });
});

function bootHash(seed: number): number {
  const again = boot(seed, [cruiser(), cruiser()]);
  const ids = spawnPair(again, 0, 0);
  play(again, [{ kind: VERB_SET_EW, payload: setEwPayload(ids.target, 1, 0) }]);
  play(again, [{ kind: VERB_FIRE, payload: firePayload(ids.attacker, 0, ids.target) }]);
  return again.stateHash();
}

describe('weapon overload', () => {
  function photon(): ShipSetup {
    return cruiser({
      mounts: [
        {
          slotIndex: 0,
          weapon: 'TEST-PHOT',
          arc: 'TEST-FA',
          chargePoints: 4,
          boxes: 1,
          mode: MODE_NORMAL,
          ticksCharging: 4,
        },
      ],
    });
  }

  it('zeroes charge when the arming mode changes and spends the overload cost', () => {
    const sim = boot(1, [photon(), cruiser({ mounts: [] })], 4);
    const ids = spawnPair(sim, 0, 2);
    const switched = play(sim, [
      { kind: VERB_SET_WEAPON_MODE, payload: setWeaponModePayload(ids.attacker, 0, MODE_OVERLOAD) },
    ]);
    expect(rule(switched).a).toBe(R.ok);
    expect(shipView(sim.snapshot().world, 0).mounts[0]?.charge100).toBe(0);
    expect(shipView(sim.snapshot().world, 0).mounts[0]?.mode).toBe(MODE_OVERLOAD);
    play(sim, [
      {
        kind: VERB_SET_ENERGY,
        payload: setEnergyPayload(ids.attacker, {
          fireControl: true,
          weapons: [{ slot: 0, request: 8, mode: -1 }],
        }),
      },
    ]);
    for (let i = 0; i < 3; i++) play(sim);
    expect(shipView(sim.snapshot().world, 0).mounts[0]?.charge100).toBe(8 * ENERGY_SCALE);
    const fired = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids.attacker, 0, ids.target) }]);
    expect(rule(fired).a).toBe(R.ok);
    expect(rule(fired).b).toBe(12);
    expect(shipView(sim.snapshot().world, 1).lastHit.damage).toBe(12);
  });

  it('refuses overload on a phaser and accepts the placeholder cost on Phot', () => {
    const sim = boot(1, [
      cruiser(),
      cruiser({
        mounts: [
          {
            slotIndex: 0,
            weapon: 'Phot',
            arc: 'TEST-FA',
            chargePoints: 0,
            boxes: 1,
            mode: MODE_NORMAL,
            ticksCharging: 0,
          },
        ],
      }),
    ]);
    const ids = spawnPair(sim, 0, 2);
    const phaser = play(sim, [
      { kind: VERB_SET_WEAPON_MODE, payload: setWeaponModePayload(ids.attacker, 0, MODE_OVERLOAD) },
    ]);
    expect(rule(phaser).a).toBe(R.notInDuelSlice);
    const empty = play(sim, [
      { kind: VERB_SET_WEAPON_MODE, payload: setWeaponModePayload(ids.target, 0, MODE_OVERLOAD) },
    ]);
    expect(rule(empty).a).toBe(R.ok);
    expect(shipView(sim.snapshot().world, 1).mounts[0]?.mode).toBe(MODE_OVERLOAD);
    expect(shipView(sim.snapshot().world, 1).mounts[0]?.charge100).toBe(0);
  });
});

describe('tractors', () => {
  it('pulls a weaker ship and stops its cruise speed for the tick', () => {
    const sim = boot(3, [cruiser(), cruiser()], 30);
    const ids = spawnPair(sim, 0, 3);
    const start = rawX(sim, 1);
    play(sim, [
      { kind: VERB_SET_TRACTOR, payload: setTractorPayload(ids.target, 0, TRACTOR_REINFORCE, 1) },
      { kind: VERB_SET_ENERGY, payload: setEnergyPayload(ids.attacker, { speed: 4 }) },
      { kind: VERB_SET_TRACTOR, payload: setTractorPayload(ids.attacker, ids.target, TRACTOR_HOLD, 3) },
    ]);
    const attacker = shipView(sim.snapshot().world, 0);
    const target = shipView(sim.snapshot().world, 1);
    expect(attacker.tractorLink).toBe(1);
    expect(attacker.speedOverride).toBe(3);
    expect(target.speedOverride).toBe(0);
    expect(rawX(sim, 1)).toBeLessThan(start);
    expect(rawX(sim, 1)).toBeGreaterThan(fx(0) as number);
  });

  it('breaks when the target matches the bid, and rejects a hull with no tractors', () => {
    const sim = boot(1, [cruiser(), cruiser()]);
    const ids = spawnPair(sim, 0, 3);
    play(sim, [{ kind: VERB_SET_TRACTOR, payload: setTractorPayload(ids.target, 0, TRACTOR_REINFORCE, 4) }]);
    const lost = play(sim, [
      { kind: VERB_SET_TRACTOR, payload: setTractorPayload(ids.attacker, ids.target, TRACTOR_HOLD, 3) },
    ]);
    expect(rule(lost).a).toBe(R.tractorBroken);
    expect(shipView(sim.snapshot().world, 0).tractorLink).toBe(0);
    const bare = boot(1, [cruiser({ tractors: 0 }), cruiser()]);
    const bareIds = spawnPair(bare, 0, 1);
    const none = play(bare, [
      { kind: VERB_SET_TRACTOR, payload: setTractorPayload(bareIds.attacker, bareIds.target, TRACTOR_REPEL, 1) },
    ]);
    expect(rule(none).a).toBe(R.noTractor);
    const self = play(sim, [
      { kind: VERB_SET_TRACTOR, payload: setTractorPayload(ids.attacker, ids.attacker, TRACTOR_HOLD, 1) },
    ]);
    expect(rule(self).a).toBe(R.badTarget);
    const far = boot(1, [cruiser(), cruiser()]);
    const farIds = spawnPair(far, 0, 8);
    const range = play(far, [
      { kind: VERB_SET_TRACTOR, payload: setTractorPayload(farIds.attacker, farIds.target, TRACTOR_HOLD, 1) },
    ]);
    expect(rule(range).a).toBe(R.outOfRange);
    const released = play(sim, [
      { kind: VERB_SET_TRACTOR, payload: setTractorPayload(ids.attacker, 0, TRACTOR_OFF, 0) },
    ]);
    expect(rule(released).a).toBe(R.ok);
    expect(shipView(sim.snapshot().world, 0).tractorPaid).toBe(0);
  });
});

describe('cloaking', () => {
  it('locks weapons until the cloak cycle finishes, then hides a distant target', () => {
    const shooter = cruiser({ cloakCost: 2, battery: 8, batteryCapacity: 8 });
    const victim = cruiser({ cloakCost: 2, battery: 8, batteryCapacity: 8, scanners: 0 });
    const sim = boot(1, [shooter, victim], 30);
    const ids = spawnPair(sim, 0, 8);
    const started = play(sim, [{ kind: VERB_SET_CLOAK, payload: setCloakPayload(ids.attacker, 1) }]);
    expect(rule(started).a).toBe(R.ok);
    expect(shipView(sim.snapshot().world, 0).cloakState).toBe(1);
    expect(shipView(sim.snapshot().world, 0).cloakTicks).toBe(CLOAK_TICKS - 1);
    const blocked = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids.attacker, 0, ids.target) }]);
    expect(rule(blocked).a).toBe(R.cloaked);
    expect(shipView(sim.snapshot().world, 0).mounts[0]?.charge100).toBe(4 * ENERGY_SCALE);
    for (let i = 2; i < CLOAK_TICKS; i++) play(sim);
    expect(shipView(sim.snapshot().world, 0).cloakState).toBe(CLOAK_ON);
    play(sim, [{ kind: VERB_SET_CLOAK, payload: setCloakPayload(ids.target, 1) }]);
    for (let i = 1; i < CLOAK_TICKS; i++) play(sim);
    expect(shipView(sim.snapshot().world, 1).cloakState).toBe(CLOAK_ON);
    play(sim, [{ kind: VERB_SET_CLOAK, payload: setCloakPayload(ids.attacker, 0) }]);
    for (let i = 1; i < CLOAK_TICKS; i++) play(sim);
    expect(shipView(sim.snapshot().world, 0).cloakState).toBe(0);
    const hidden = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids.attacker, 0, ids.target) }]);
    expect(rule(hidden).a).toBe(R.notDetected);
    expect(hidden.events.some((event) => event.kind === EVENT_HIT)).toBe(false);
  });

  it('detects a cloaked ship inside the base range and drops the cloak when the battery cannot pay', () => {
    const sim = boot(1, [cruiser({ scanners: 0 }), cruiser({ cloakCost: 2, battery: 4, batteryCapacity: 4 })], 30);
    const ids = spawnPair(sim, 0, 2);
    play(sim, [{ kind: VERB_SET_CLOAK, payload: setCloakPayload(ids.target, 1) }]);
    for (let i = 1; i < CLOAK_TICKS; i++) play(sim);
    const seen = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids.attacker, 0, ids.target) }]);
    expect(rule(seen).a).toBe(R.ok);
    expect(seen.events.some((event) => event.kind === EVENT_HIT)).toBe(true);

    const poor = boot(4, [cruiser({ cloakCost: 2, battery: 2, batteryCapacity: 2, fcPaid: 0 }), cruiser()], 2);
    const who = spawnPair(poor, 0, 6);
    const engaged = play(poor, [{ kind: VERB_SET_CLOAK, payload: setCloakPayload(who.attacker, 1) }]);
    expect(rule(engaged).a).toBe(R.ok);
    expect(shipView(poor.snapshot().world, 0).battery100).toBe(0);
    play(poor);
    const dropped = play(poor);
    expect(dropped.events.some((event) => event.kind === EVENT_RULE && event.a === R.cloakCollapsed)).toBe(true);
    expect(shipView(poor.snapshot().world, 0).cloakState).toBe(0);
    const unfit = boot(1, [cruiser({ cloakCost: 0 }), cruiser()]);
    const naked = spawnPair(unfit, 0, 1);
    const missing = play(unfit, [{ kind: VERB_SET_CLOAK, payload: setCloakPayload(naked.attacker, 1) }]);
    expect(rule(missing).a).toBe(R.noCloak);
  });
});

describe('shiplist fields', () => {
  it('binds stealth, cloak, tractors, and sensor boxes from the row', () => {
    const text = [
      'Race\tClass\tHull Type\tStealth\tCloak\tTractors\tSensors\tScanners\tSpecial Sensors',
      'test-empire\tTEST-EW-01\tCA\t-2\t4\t3\t5\t2\t1',
    ].join('\n');
    const parsed = parseShiplist(text, { file: 'Assets/Specs/shiplist.txt' });
    const ship = bindShiplistRow(parsed.data.rows[0]!, parsed.data.columns);
    expect(ship.stealth).toBe(-2);
    expect(ship.cloakCost).toBe(4);
    expect(ship.tractors).toBe(3);
    expect(ship.scanners).toBe(2);
    expect(ship.specialSensors).toBe(1);
    expect(ship.systems?.sensors).toBe(5);
  });
});
