import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cross, distSq, dot, fx } from '../core/fx.ts';
import { LocalSession } from '../net/session.ts';
import { createSim, type Sim, type StepResult } from './sim.ts';
import { bearingInArc, facingForRelative, relativeBearing, shotInArc, withinRange } from './arcs.ts';
import { bindShiplistRow, parseHundredths, type ShipSetup } from './bind-shiplist.ts';
import { parseShiplist } from '../../tools/formats/shiplist.ts';
import {
  CLASS_FIGHTER,
  CLASS_SHIP,
  DEFAULT_FIRE_CONTROL,
  DEFAULT_LIFE_SUPPORT,
  DEFAULT_REINFORCE_CAP,
  DEFAULT_REINFORCE_PER_ENERGY,
  DEFAULT_RULES_TURN_TICKS,
  ENERGY_SCALE,
  MODE_NORMAL,
  MODE_OVERLOAD,
  MODE_PROXIMITY,
  FALLBACK_YAW_PER_TICK,
  TURN_H,
  TURN_TEST_C,
  TURN_UNVERIFIED,
  ARC_CODES,
  WEAPON_CODES,
  arcDef,
  arcId,
  turnModeId,
} from './rules-tables.ts';
import { liveShots, shipView } from './hull.ts';
import {
  EVENT_HIT,
  EVENT_RULE,
  EVENT_SPAWN,
  R,
  REASON_NAME,
  STATUS_APPLIED,
  STATUS_CLAMPED,
  VERB_DAMAGE_SHIELD,
  VERB_FIRE,
  VERB_SET_ENERGY,
  VERB_SET_SHIELDS,
  VERB_SPAWN,
  createCombat,
  damageShieldPayload,
  firePayload,
  setEnergyPayload,
  setShieldsPayload,
  spawnPayload,
  tickShare,
  type CombatOptions,
} from './combat.ts';
import { rulesDiv } from './rules-div.ts';

function raw(units: number): number {
  return fx(units) as number;
}

function cruiser(overrides: Partial<ShipSetup> = {}): ShipSetup {
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
    ...overrides,
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

interface Issued {
  kind: number;
  payload: Uint8Array;
}

/**
 * The session stamps tick, slot, and seq. `play` only asks the sim to resolve
 * its next tick, the same counter the driver uses. It does not read frame time.
 */
function play(sim: Sim, issues: readonly Issued[] = []): StepResult {
  const session = sessions.get(sim);
  if (!session) throw new Error('session');
  for (const issue of issues) session.issue(issue.kind, issue.payload);
  const next = ((sim.tick as number) + 1) >>> 0;
  return sim.step(session.commandsFor(next));
}

function viewAt(sim: Sim, index: number) {
  return shipView(sim.snapshot().world, index);
}

describe('facing, range, and arcs', () => {
  const facings: readonly (readonly [number, number])[] = [
    [0, 0],
    [5461, 0],
    [5462, 1],
    [16383, 1],
    [16384, 2],
    [27306, 2],
    [27307, 3],
    [32768, 3],
    [38229, 3],
    [38230, 4],
    [49151, 4],
    [49152, 5],
    [60074, 5],
    [60075, 0],
    [65535, 0],
  ];

  it('bins a relative bearing into six facings', () => {
    for (const [rel, facing] of facings) {
      expect(facingForRelative(rel)).toBe(facing);
    }
  });

  it('matches the span table, including boundaries', () => {
    const cases: readonly (readonly [string, number, boolean])[] = [
      ['TEST-FA', 0, true],
      ['TEST-FA', 5462, false],
      ['TEST-FA', 60075, true],
      ['TEST-STBD', 0, true],
      ['TEST-STBD', 32768, false],
      ['TEST-ALL', 32768, true],
      ['FH', 0, true],
      ['FH', 5462, false],
      ['ALL', 1, true],
      ['RS', 16384, true],
      ['LS', 16384, false],
    ];
    for (const [code, rel, inside] of cases) {
      const arc = arcDef(arcId(code));
      expect(arc, code).toBeDefined();
      expect(bearingInArc(rel, arc!)).toBe(inside);
    }
  });

  it('uses exact squares for range and exact cross/dot for the bow', () => {
    const ten = raw(10);
    const unit = raw(1);
    expect(distSq(ten, 0)).toEqual({ hi: 100, lo: 0 });
    expect(distSq(raw(25), 0)).toEqual({ hi: 625, lo: 0 });
    expect(cross(unit, 0, 0, ten)).toEqual({ hi: 10, lo: 0 });
    expect(dot(unit, 0, ten, 0)).toEqual({ hi: 10, lo: 0 });
    expect(dot(unit, 0, 0, ten)).toEqual({ hi: 0, lo: 0 });
    expect(withinRange(ten, 0, 10)).toBe(true);
    expect(withinRange(ten + 1, 0, 10)).toBe(false);
    expect(withinRange(raw(20), 0, 20)).toBe(true);
    expect(withinRange(raw(21), 0, 20)).toBe(false);
    expect(withinRange(raw(25), 0, 20)).toBe(false);
  });

  it('agrees the geometric wedge with the span on the four axes', () => {
    const offsets: readonly (readonly [number, number])[] = [
      [raw(10), 0],
      [0, raw(10)],
      [raw(-10), 0],
      [0, raw(-10)],
    ];
    const codes = ['TEST-FA', 'TEST-STBD', 'TEST-PORT', 'TEST-ALL', 'FH', 'RH', 'FA', 'RS', 'LS', 'ALL'];
    for (const code of codes) {
      const id = arcId(code);
      const arc = arcDef(id)!;
      for (const [dx, dy] of offsets) {
        const rel = relativeBearing(0, dx, dy);
        expect(shotInArc(0, dx, dy, id, 0), `${code} ${rel}`).toBe(bearingInArc(rel, arc));
      }
    }
  });

  it('locks weapon and arc codes to the rules JSON', () => {
    const table = JSON.parse(readFileSync('docs/rules/data/weapon-arcs.json', 'utf8')) as {
      ship: { weapons: object; arcs: object };
      fighter: { weapons: object };
    };
    const constants = JSON.parse(readFileSync('docs/rules/data/constants.json', 'utf8')) as {
      lifeSupportCost: number;
      fireControlCost: number;
      reinforcePerEnergy: number;
      reinforceCapPerTurn: number;
      rulesTurnSeconds: number;
      tickHz: number;
    };
    expect(WEAPON_CODES).toEqual([
      ...Object.keys(table.ship.weapons),
      ...Object.keys(table.fighter.weapons),
    ]);
    expect(ARC_CODES).toEqual(Object.keys(table.ship.arcs));
    expect(DEFAULT_LIFE_SUPPORT).toBe(constants.lifeSupportCost);
    expect(DEFAULT_FIRE_CONTROL).toBe(constants.fireControlCost);
    expect(DEFAULT_REINFORCE_PER_ENERGY).toBe(constants.reinforcePerEnergy);
    expect(DEFAULT_REINFORCE_CAP).toBe(constants.reinforceCapPerTurn);
    expect(DEFAULT_RULES_TURN_TICKS).toBe(constants.rulesTurnSeconds * constants.tickHz);
    expect(REASON_NAME).toHaveLength(23);
    expect(REASON_NAME[R.outOfArc]).toBe('outOfArc');
    expect(parseHundredths('0.75')).toBe(75);
    expect(parseHundredths('0.4')).toBe(40);
    expect(parseHundredths('1')).toBe(100);
    expect(tickShare(5, 0, 4)).toBe(1);
    expect(tickShare(5, 1, 4)).toBe(1);
    expect(tickShare(5, 2, 4)).toBe(1);
    expect(tickShare(5, 3, 4)).toBe(2);
    expect(() => rulesDiv(4, 0)).toThrow(/rules divisor/);
    expect(() => createCombat([], { rulesTurnTicks: 0 })).toThrow(/rules turn ticks/);
  });
});

describe('shiplist binding', () => {
  const text = [
    'Race\tHull Type\tClass\tTurn Mode\tMove Cost\tShield 1\tShield 2\tShield 3\tShield 4\tWarp Side\tWarp Center\tImpulse\tAPR\tBattery\tCrew\tMin Crew\tAcceleration\tNum\tHeavy Weapon 1\tArc\tGeometry\tUI',
    'Federation\tCA\tTEST-CA-01\tH\t0.75\t10\t8\t6\t4\t5\t3\t1\t0\t4\t6\t1\t4\t1\tTEST-PH\tTEST-FA\tassets/models/test_ca01/test_ca01.mod\tTCA',
    'Federation\tFTR\tTEST-FTR-01\tH\t0\t1\t1\t1\t1\t0\t0\t0\t0\t0\t1\t1\t\t\t\t\tassets/models/test_ftr/test_ftr.mod\tTF',
  ].join('\n');

  it('fans shields out by two and doubles the side warp', () => {
    const parsed = parseShiplist(text, { file: 'Assets/Specs/shiplist.txt' });
    const ship = bindShiplistRow(parsed.data.rows[0]!, parsed.data.columns);
    expect(ship.shieldsMax).toEqual([20, 16, 12, 8, 12, 16]);
    expect(ship.shields).toEqual(ship.shieldsMax);
    expect(ship.warp).toBe(13);
    expect(ship.impulse).toBe(1);
    expect(ship.apr).toBe(0);
    expect(ship.battery).toBe(4);
    expect(ship.batteryCapacity).toBe(4);
    expect(ship.moveCost100).toBe(75);
    expect(ship.crew).toBe(6);
    expect(ship.minCrew).toBe(1);
    expect(ship.acceleration).toBe(4);
    expect(ship.turnMode).toBe(TURN_H);
    expect(ship.classCode).toBe(CLASS_SHIP);
    expect(ship.mounts).toEqual([
      {
        slotIndex: 0,
        weapon: 'TEST-PH',
        arc: 'TEST-FA',
        chargePoints: 0,
        boxes: 1,
        mode: MODE_NORMAL,
        ticksCharging: 0,
      },
    ]);
    const fighter = bindShiplistRow(parsed.data.rows[1]!, parsed.data.columns);
    expect(fighter.classCode).toBe(CLASS_FIGHTER);
    expect(fighter.acceleration).toBe(-1);
    expect(fighter.mounts).toEqual([]);
  });

  it('fans the observed CE side headers into the four side facings', () => {
    const ce = [
      'Race\tHull Type\tClass\tTurn Mode\tMove Cost\tShield 1\tShield 2 _ 6\tShield 3 _ 5\tShield 4\tR_L_Warp\tC_Warp\tRegular Crew\tAcceleration',
      'Federation\tCA\tTEST-CE-CA\tC\t1\t40\t30\t20\t40\t5\t3\t12\t4',
    ].join('\n');
    const parsed = parseShiplist(ce, { file: 'Assets/Specs/shiplist.txt' });
    const ship = bindShiplistRow(parsed.data.rows[0]!, parsed.data.columns);
    // File cells 40, 30, 20, 40. Sides are the paired columns, then ×2.
    expect(ship.shieldsMax).toEqual([80, 60, 40, 80, 40, 60]);
    expect(ship.shields).toEqual(ship.shieldsMax);
    expect(ship.warp).toBe(13);
    expect(ship.crew).toBe(12);
    expect(ship.turnMode).toBe(TURN_UNVERIFIED);
  });
});

describe('energy, shields, and fire', () => {
  function spawnBoth(sim: Sim, attacker: number, target: number): { attacker: number; target: number } {
    const result = play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(attacker, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(target, 10, 0, 32768) }
]);
    const spawned = result.events.filter((event) => event.kind === EVENT_SPAWN);
    return { attacker: spawned[0]!.entity, target: spawned[1]!.entity };
  }

  it('does not divide when move cost is not positive', () => {
    const sim = boot([cruiser({ moveCost100: 0, warp: 1 })], { rulesTurnTicks: 1 });
    play(sim, [{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }]);
    const result = play(sim, [{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, { speed: 4 }) }]);
    expect(result.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.ok);
    expect(viewAt(sim, 0).speed).toBe(4);
    expect(viewAt(sim, 0).lastApplied).toBe(0);
  });

  it('pays the worked 10-point plan and drips shields the same tick', () => {
    const sim = boot([cruiser(), cruiser({ mounts: [] })], { rulesTurnTicks: 1 });
    const ids = spawnBoth(sim, 0, 1);
    const result = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(ids.attacker, {
        speed: 4,
        lifeSupport: true,
        fireControl: true,
        general: 2,
        weapons: [{ slot: 0, request: 2, mode: MODE_NORMAL }],
      }) }
]);
    const rule = result.events.find((event) => event.kind === EVENT_RULE)!;
    expect(rule.a).toBe(R.ok);
    expect(rule.b).toBe(10 * ENERGY_SCALE);
    const ship = viewAt(sim, 0);
    expect(ship.speed).toBe(4);
    expect(ship.fcPaid).toBe(1);
    expect(ship.lastStatus).toBe(STATUS_APPLIED);
    expect(ship.shields).toEqual([1, 1, 0, 0, 0, 0]);
    expect(ship.mounts[0]!.charge100).toBe(2 * ENERGY_SCALE);
    expect(ship.battery100).toBe(0);
  });

  it('starves speed before life support when generation is short', () => {
    const sim = boot([cruiser()], { rulesTurnTicks: 1 });
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const result = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, {
        speed: 20,
        lifeSupport: true,
        fireControl: true,
      }) }
]);
    expect(result.events.find((event) => event.kind === EVENT_RULE)).toMatchObject({
      a: R.overDraw,
      b: 10 * ENERGY_SCALE,
    });
    expect(viewAt(sim, 0).speed).toBe(8);
    expect(viewAt(sim, 0).lastStatus).toBe(STATUS_CLAMPED);
  });

  it('clamps speed to acceleration and refuses an immobile hull', () => {
    const slow = boot([cruiser({ acceleration: 1 })], { rulesTurnTicks: 1 });
    play(slow, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const clamped = play(slow, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, { speed: 4 }) }
]);
    expect(clamped.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.speedClamped);
    expect(viewAt(slow, 0).speed).toBe(1);
    expect(viewAt(slow, 0).lastApplied).toBe(ENERGY_SCALE);

    const fixed = boot([cruiser({ turnMode: TURN_H, acceleration: 0 })], { rulesTurnTicks: 1 });
    play(fixed, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const held = play(fixed, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, { speed: 4, lifeSupport: true }) }
]);
    expect(held.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.immobile);
    expect(viewAt(fixed, 0).speed).toBe(0);
    expect(viewAt(fixed, 0).lastApplied).toBe(ENERGY_SCALE);
  });

  it('caps a photon request at its arm cost and a shield plan at the reinforce cap', () => {
    const photon = boot(
      [
        cruiser({
          warp: 20,
          mounts: [
            {
              slotIndex: 0,
              weapon: 'TEST-PHOT',
              arc: 'TEST-FA',
              chargePoints: 0,
              boxes: 1,
              mode: MODE_NORMAL,
              ticksCharging: 0,
            },
          ],
        }),
      ],
      { rulesTurnTicks: 1 },
    );
    play(photon, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const armed = play(photon, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, {
        weapons: [{ slot: 0, request: 6, mode: MODE_NORMAL }],
      }) }
]);
    expect(armed.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.chargeCapped);
    expect(viewAt(photon, 0).lastApplied).toBe(4 * ENERGY_SCALE);
    expect(viewAt(photon, 0).mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(viewAt(photon, 0).mounts[0]!.ticksCharging).toBe(1);

    const shields = boot(
      [cruiser({ warp: 8, shieldsMax: [30, 30, 30, 30, 30, 30] })],
      { rulesTurnTicks: 1, reinforceCapPerTurn: 2 },
    );
    play(shields, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const capped = play(shields, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, {
        general: 8,
        specific: [3, 0, 0, 0, 0, 0],
      }) }
]);
    expect(capped.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.reinforceCapped);
    expect(viewAt(shields, 0).lastApplied).toBe(8 * ENERGY_SCALE);
    expect(viewAt(shields, 0).shields).toEqual([2, 2, 1, 1, 1, 1]);
  });

  it('splits eight general and three specific into the documented facings', () => {
    const sim = boot([cruiser({ warp: 11 })], { rulesTurnTicks: 1 });
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const result = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, {
        general: 8,
        specific: [3, 0, 0, 0, 0, 0],
      }) }
]);
    expect(result.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.ok);
    expect(viewAt(sim, 0).shields).toEqual([5, 2, 1, 1, 1, 1]);
    expect(viewAt(sim, 0).lastApplied).toBe(11 * ENERGY_SCALE);
  });

  it('stores phaser overflow in the capacitor, on a heavy slot', () => {
    const sim = boot([cruiser({ warp: 6 })], { rulesTurnTicks: 1 });
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const result = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, {
        weapons: [{ slot: 0, request: 6, mode: MODE_NORMAL }],
      }) }
]);
    expect(result.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.ok);
    const ship = viewAt(sim, 0);
    expect(ship.mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(ship.capacitor100).toBe(2 * ENERGY_SCALE);
    expect(ship.lastApplied).toBe(6 * ENERGY_SCALE);
  });

  it('drops crew when life support is demanded and unpaid', () => {
    const sim = boot([cruiser({ warp: 0, crew: 1, minCrew: 1 })], { rulesTurnTicks: 1 });
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const starved = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, { lifeSupport: true }) }
]);
    expect(starved.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.overDraw);
    expect(viewAt(sim, 0).crew).toBe(0);
    expect(viewAt(sim, 0).disabled).toBe(1);
    const fired = play(sim, [
{ kind: VERB_FIRE, payload: firePayload(65536, 0, 65536) }
]);
    expect(fired.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.crewDisabled);
    expect(fired.events.find((event) => event.kind === EVENT_RULE)?.b).toBe(-1);
  });

  it('damages each facing on its own and stops at zero', () => {
    const sim = boot([
      cruiser({
        shields: [10, 10, 10, 10, 10, 10],
        shieldsMax: [10, 10, 10, 10, 10, 10],
      }),
    ]);
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const id = 65536;
    play(sim, [
{ kind: VERB_DAMAGE_SHIELD, payload: damageShieldPayload(id, 0, 3) },
{ kind: VERB_DAMAGE_SHIELD, payload: damageShieldPayload(id, 3, 1) },
{ kind: VERB_DAMAGE_SHIELD, payload: damageShieldPayload(id, 5, 5) },
{ kind: VERB_DAMAGE_SHIELD, payload: damageShieldPayload(id, 1, 0) }
]);
    expect(viewAt(sim, 0).shields).toEqual([7, 10, 10, 9, 10, 5]);
    const depleted = play(sim, [
{ kind: VERB_DAMAGE_SHIELD, payload: damageShieldPayload(id, 2, 20) }
]);
    expect(depleted.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.shieldDepleted);
    expect(depleted.events.find((event) => event.kind === EVENT_RULE)?.b).toBe(10);
    expect(viewAt(sim, 0).shields[2]).toBe(0);
    const high = play(sim, [
{ kind: VERB_SET_SHIELDS, payload: setShieldsPayload(id, 2, 40) }
]);
    expect(high.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.shieldAboveMax);
    expect(viewAt(sim, 0).shields[2]).toBe(10);
  });

  it('rejects a negative shield write without touching the facings', () => {
    const sim = boot([cruiser({ shields: [4, 4, 4, 4, 4, 4], shieldsMax: [10, 10, 10, 10, 10, 10] })]);
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const idle = boot([cruiser({ shields: [4, 4, 4, 4, 4, 4], shieldsMax: [10, 10, 10, 10, 10, 10] })]);
    play(idle, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const rejected = play(sim, [
{ kind: VERB_SET_SHIELDS, payload: setShieldsPayload(65536, 0, -1) }
]);
    const quiet = play(idle);
    expect(rejected.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.negativeValue);
    expect(rejected.hash).toBe(quiet.hash);
    expect(viewAt(sim, 0).shields).toEqual([4, 4, 4, 4, 4, 4]);
  });

  it('moves an unverified turn letter, warns once, and keeps the speed', () => {
    const sim = boot([cruiser({ turnMode: TURN_UNVERIFIED })], { rulesTurnTicks: 2 });
    const spawned = play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const warnings = spawned.events.filter((event) => event.kind === EVENT_RULE && event.a === R.turnModeUnverified);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.b).toBe(FALLBACK_YAW_PER_TICK);
    expect(turnModeId('C')).toBe(TURN_UNVERIFIED);
    expect(turnModeId('Z')).toBe(TURN_UNVERIFIED);
    const moved = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, { speed: 4 }) }
]);
    expect(moved.events.some((event) => event.a === R.turnModeUnverified)).toBe(false);
    expect(moved.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.ok);
    expect(viewAt(sim, 0).speed).toBe(4);
    const again = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, { speed: 4 }) }
]);
    expect(again.events.some((event) => event.a === R.turnModeUnverified)).toBe(false);
    for (let i = 0; i < 4; i++) {
      const quiet = play(sim, []);
      expect(quiet.events.some((event) => event.a === R.turnModeUnverified)).toBe(false);
    }
    expect(viewAt(sim, 0).speed).toBe(4);
    const unknown = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, { unknownDraw: true, lifeSupport: true }) }
]);
    expect(unknown.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.unknownDraw);
    expect(viewAt(sim, 0).fcPaid).toBe(0);
  });

  it('rejects fire outside the arc or past the last range band and does not spend charge', () => {
    const ready = cruiser({
      fcPaid: 1,
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
        {
          slotIndex: 1,
          weapon: 'TEST-PH',
          arc: 'TEST-ALL',
          chargePoints: 4,
          boxes: 1,
          mode: MODE_NORMAL,
          ticksCharging: 0,
        },
      ],
    });
    const ahead = cruiser({
      shields: [10, 10, 10, 10, 10, 10],
      shieldsMax: [10, 10, 10, 10, 10, 10],
      mounts: [],
    });
    const abeam = { ...ahead };
    const far = { ...ahead };
    const sim = boot([ready, ahead, abeam, far]);
    const spawned = play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) },
{ kind: VERB_SPAWN, payload: spawnPayload(2, 0, 10, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(3, 25, 0, 0) }
]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    const idle = boot([ready, ahead, abeam, far]);
    play(idle, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) },
{ kind: VERB_SPAWN, payload: spawnPayload(2, 0, 10, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(3, 25, 0, 0) }
]);
    const arc = play(sim, [
{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[2]!) }
]);
    const quietArc = play(idle);
    expect(arc.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.outOfArc);
    expect(arc.hash).toBe(quietArc.hash);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);

    const range = play(sim, [
{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 1, ids[3]!) }
]);
    const quietRange = play(idle);
    expect(range.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.outOfRange);
    expect(range.hash).toBe(quietRange.hash);
    expect(viewAt(sim, 0).mounts[1]!.charge100).toBe(4 * ENERGY_SCALE);
  });

  it('routes a bow shot onto facing 0 and leaves the other five shields', () => {
    const ready = cruiser({
      fcPaid: 1,
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
    });
    const target = cruiser({
      shields: [1, 5, 6, 7, 8, 9],
      shieldsMax: [10, 10, 10, 10, 10, 10],
      mounts: [],
    });
    const sim = boot([ready, target]);
    const spawned = play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) }
]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    const hit = play(sim, [
{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }
]);
    const rule = hit.events.find((event) => event.kind === EVENT_RULE)!;
    const impact = hit.events.find((event) => event.kind === EVENT_HIT)!;
    expect(rule).toMatchObject({ a: R.ok, b: 3 });
    expect(impact).toMatchObject({ entity: ids[1], a: 0, b: 1 });
    expect(viewAt(sim, 1).shields).toEqual([0, 5, 6, 7, 8, 9]);
    expect(viewAt(sim, 1).lastHit).toEqual({ facing: 0, damage: 3, absorbed: 1, penetrating: 2 });
    expect(viewAt(sim, 1).destroyed).toBe(1);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(0);
    expect(viewAt(sim, 0).lastStatus).toBe(STATUS_APPLIED);
  });

  it('spends a charged phaser into one facing and lets the rest stop in armor', () => {
    const ready = cruiser({
      fcPaid: 1,
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
    });
    const target = cruiser({
      shields: [1, 9, 9, 9, 9, 9],
      shieldsMax: [10, 10, 10, 10, 10, 10],
      systems: { armor: 2 },
      mounts: [],
    });
    const sim = boot([ready, target]);
    const spawned = play(sim, [
      { kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) },
    ]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    const before = sim.snapshot().rng[1];
    const hit = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }]);
    expect(hit.events.find((event) => event.kind === EVENT_RULE)).toMatchObject({ a: R.ok, b: 3 });
    expect(hit.events.find((event) => event.kind === EVENT_HIT)).toMatchObject({ entity: ids[1], a: 0, b: 1 });
    const victim = viewAt(sim, 1);
    expect(victim.shields).toEqual([0, 9, 9, 9, 9, 9]);
    expect(victim.systems.armor).toBe(0);
    expect(victim.systems.bridge).toBe(0);
    expect(victim.destroyed).toBe(0);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(0);
    expect(sim.snapshot().rng[1]).toEqual(before);
  });

  it('charges a phaser across four ticks and then fires down the bow', () => {
    const attacker = cruiser({ warp: 5, crew: 4, minCrew: 1 });
    const target = cruiser({
      warp: 0,
      shields: [10, 10, 10, 10, 10, 10],
      shieldsMax: [10, 10, 10, 10, 10, 10],
      mounts: [],
    });
    const sim = boot([attacker, target], { rulesTurnTicks: 4 });
    const spawned = play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) }
]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    const planned = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(ids[0]!, {
        fireControl: true,
        weapons: [{ slot: 0, request: 4, mode: MODE_NORMAL }],
      }) }
]);
    expect(planned.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.ok);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(ENERGY_SCALE);
    play(sim);
    play(sim);
    play(sim);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(viewAt(sim, 0).fcPaid).toBe(1);
    const hit = play(sim, [
{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }
]);
    expect(hit.events.find((event) => event.kind === EVENT_RULE)).toMatchObject({ a: R.ok, b: 3 });
    expect(hit.events.find((event) => event.kind === EVENT_HIT)).toMatchObject({ a: 0, b: 3 });
    expect(viewAt(sim, 1).shields).toEqual([7, 10, 10, 10, 10, 10]);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(0);
  });

  it('refuses fire with no fire control and keeps the state hash', () => {
    const ready = cruiser({
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
    });
    const target = cruiser({ mounts: [] });
    const sim = boot([ready, target]);
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) }
]);
    const idle = boot([ready, target]);
    play(idle, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) }
]);
    const rejected = play(sim, [
{ kind: VERB_FIRE, payload: firePayload(65536, 0, 65537) }
]);
    const quiet = play(idle);
    expect(rejected.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.noFireControl);
    expect(rejected.hash).toBe(quiet.hash);
  });

  it('rejects a fighter and a bad facing', () => {
    const sim = boot([
      cruiser({ classCode: CLASS_FIGHTER }),
      cruiser(),
    ]);
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 1, 0, 0) }
]);
    const fighter = play(sim, [
{ kind: VERB_SET_SHIELDS, payload: setShieldsPayload(65536, 0, 1) }
]);
    expect(fighter.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.notAShip);
    const facing = play(sim, [
{ kind: VERB_DAMAGE_SHIELD, payload: damageShieldPayload(65537, 6, 1) }
]);
    expect(facing.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.badFacing);
    expect(viewAt(sim, 1).shields).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('refuses overload on a phaser and an unknown mount', () => {
    const sim = boot([cruiser({ warp: 20 })]);
    play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) }
]);
    const mode = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, {
        weapons: [{ slot: 0, request: 1, mode: MODE_OVERLOAD }],
      }) }
]);
    expect(mode.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.notInDuelSlice);
    expect(viewAt(sim, 0).speed).toBe(0);
    const slot = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(65536, {
        weapons: [{ slot: 3, request: 1, mode: MODE_NORMAL }],
      }) }
]);
    expect(slot.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.unknownWeaponSlot);
  });

  it('arms a photon, flies it, and damages the bow shield', () => {
    const attacker = cruiser({
      warp: 5,
      mounts: [
        {
          slotIndex: 0,
          weapon: 'TEST-PHOT',
          arc: 'TEST-ALL',
          chargePoints: 0,
          boxes: 1,
          mode: MODE_NORMAL,
          ticksCharging: 0,
        },
      ],
    });
    const target = cruiser({
      warp: 0,
      shields: [20, 20, 20, 20, 20, 20],
      shieldsMax: [20, 20, 20, 20, 20, 20],
      mounts: [],
    });
    const sim = boot([attacker, target], { rulesTurnTicks: 4 });
    const spawned = play(sim, [
      { kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(1, 6, 0, 32768) },
    ]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    const planned = play(sim, [
      {
        kind: VERB_SET_ENERGY,
        payload: setEnergyPayload(ids[0]!, {
          fireControl: true,
          weapons: [{ slot: 0, request: 4, mode: MODE_NORMAL }],
        }),
      },
    ]);
    expect(planned.events.find((event) => event.kind === EVENT_RULE)).toMatchObject({
      a: R.ok,
      b: 5 * ENERGY_SCALE,
    });
    play(sim);
    play(sim);
    play(sim);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(viewAt(sim, 0).mounts[0]!.ticksCharging).toBe(4);
    const launched = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }]);
    expect(launched.events.find((event) => event.kind === EVENT_RULE)).toMatchObject({ a: R.ok, b: 8 });
    expect(launched.events.find((event) => event.kind === EVENT_HIT)).toBeUndefined();
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(0);
    expect(viewAt(sim, 1).shields).toEqual([20, 20, 20, 20, 20, 20]);
    expect(liveShots(sim.snapshot().world)).toEqual([
      expect.objectContaining({ remaining: raw(4), damage: 8, target: ids[1], mode: MODE_NORMAL }),
    ]);
    play(sim);
    expect(liveShots(sim.snapshot().world)[0]!.remaining).toBe(raw(2));
    expect(viewAt(sim, 1).shields[0]).toBe(20);
    const impact = play(sim);
    expect(impact.events.find((event) => event.kind === EVENT_HIT)).toMatchObject({
      entity: ids[1],
      a: 0,
      b: 8,
    });
    expect(impact.events.find((event) => event.kind === EVENT_RULE)).toBeUndefined();
    expect(viewAt(sim, 1).shields).toEqual([12, 20, 20, 20, 20, 20]);
    expect(viewAt(sim, 1).lastHit).toEqual({ facing: 0, damage: 8, absorbed: 8, penetrating: 0 });
    expect(liveShots(sim.snapshot().world)).toEqual([]);
  });

  it('rejects a photon outside the arc or past max range without launching', () => {
    const ready = cruiser({
      fcPaid: 1,
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
        {
          slotIndex: 1,
          weapon: 'TEST-PHOT',
          arc: 'TEST-ALL',
          chargePoints: 4,
          boxes: 1,
          mode: MODE_NORMAL,
          ticksCharging: 4,
        },
      ],
    });
    const abeam = cruiser({
      shields: [10, 10, 10, 10, 10, 10],
      shieldsMax: [10, 10, 10, 10, 10, 10],
      mounts: [],
    });
    const far = cruiser({
      shields: [10, 10, 10, 10, 10, 10],
      shieldsMax: [10, 10, 10, 10, 10, 10],
      mounts: [],
    });
    const sim = boot([ready, abeam, far]);
    const spawned = play(sim, [
      { kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(1, 0, 10, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(2, 31, 0, 0) },
    ]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    const idle = boot([ready, abeam, far]);
    play(idle, [
      { kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(1, 0, 10, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(2, 31, 0, 0) },
    ]);
    const arc = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }]);
    const quietArc = play(idle);
    expect(arc.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.outOfArc);
    expect(arc.hash).toBe(quietArc.hash);
    expect(viewAt(sim, 0).mounts[0]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(viewAt(sim, 1).shields).toEqual([10, 10, 10, 10, 10, 10]);
    expect(liveShots(sim.snapshot().world)).toEqual([]);
    const range = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 1, ids[2]!) }]);
    const quietRange = play(idle);
    expect(range.events.find((event) => event.kind === EVENT_RULE)?.a).toBe(R.outOfRange);
    expect(range.hash).toBe(quietRange.hash);
    expect(viewAt(sim, 0).mounts[1]!.charge100).toBe(4 * ENERGY_SCALE);
    expect(liveShots(sim.snapshot().world)).toEqual([]);
  });

  it('puts photon damage on the aft shield when that facing is presented', () => {
    const attacker = cruiser({
      fcPaid: 1,
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
    const target = cruiser({
      shields: [20, 20, 20, 20, 20, 20],
      shieldsMax: [20, 20, 20, 20, 20, 20],
      mounts: [],
    });
    const sim = boot([attacker, target]);
    const spawned = play(sim, [
      { kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(1, 6, 0, 0) },
    ]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    const launched = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }]);
    expect(launched.events.find((event) => event.kind === EVENT_RULE)).toMatchObject({ a: R.ok, b: 8 });
    expect(launched.events.find((event) => event.kind === EVENT_HIT)).toBeUndefined();
    play(sim);
    const impact = play(sim);
    expect(impact.events.find((event) => event.kind === EVENT_HIT)).toMatchObject({ a: 3, b: 8 });
    expect(viewAt(sim, 1).shields).toEqual([20, 20, 20, 12, 20, 20]);
    expect(viewAt(sim, 1).destroyed).toBe(0);
  });

  it('detonates a proximity photon when the remaining range reaches the fuse', () => {
    const attacker = cruiser({
      warp: 5,
      mounts: [
        {
          slotIndex: 0,
          weapon: 'TEST-PHOT',
          arc: 'TEST-ALL',
          chargePoints: 0,
          boxes: 1,
          mode: MODE_NORMAL,
          ticksCharging: 0,
        },
      ],
    });
    const target = cruiser({
      warp: 0,
      shields: [20, 20, 20, 20, 20, 20],
      shieldsMax: [20, 20, 20, 20, 20, 20],
      mounts: [],
    });
    const sim = boot([attacker, target], { rulesTurnTicks: 4 });
    const spawned = play(sim, [
      { kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawnPayload(1, 6, 0, 32768) },
    ]);
    const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
    play(sim, [
      {
        kind: VERB_SET_ENERGY,
        payload: setEnergyPayload(ids[0]!, {
          fireControl: true,
          weapons: [{ slot: 0, request: 4, mode: MODE_PROXIMITY }],
        }),
      },
    ]);
    play(sim);
    play(sim);
    play(sim);
    const launched = play(sim, [{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }]);
    expect(launched.events.find((event) => event.kind === EVENT_RULE)).toMatchObject({ a: R.ok, b: 4 });
    expect(liveShots(sim.snapshot().world)[0]!.remaining).toBe(raw(4));
    expect(viewAt(sim, 1).shields[0]).toBe(20);
    const impact = play(sim);
    expect(impact.events.find((event) => event.kind === EVENT_HIT)).toMatchObject({ a: 0, b: 4 });
    expect(viewAt(sim, 1).shields).toEqual([16, 20, 20, 20, 20, 20]);
    expect(viewAt(sim, 1).lastHit.damage).toBe(4);
    expect(liveShots(sim.snapshot().world)).toEqual([]);
  });

  it('repeats a duel and restores it to the same hash', () => {
    const run = () => {
      const parsed = parseShiplist(
        [
          'Race\tHull Type\tClass\tTurn Mode\tMove Cost\tShield 1\tShield 2\tShield 3\tShield 4\tWarp Side\tWarp Center\tImpulse\tAPR\tBattery\tCrew\tMin Crew\tAcceleration\tNum\tHeavy Weapon 1\tArc\tGeometry\tUI',
          'Federation\tCA\tTEST-CA-01\tTEST-C\t1\t0\t0\t0\t0\t5\t0\t0\t0\t0\t6\t1\t100\t1\tTEST-PH\tTEST-FA\tassets/models/test_ca01/test_ca01.mod\tTCA',
          'Klingon\tCA\tTEST-CA-02\tTEST-C\t1\t5\t5\t5\t5\t0\t0\t0\t0\t0\t2\t1\t1\t\t\t\tassets/models/test_ca02/test_ca02.mod\tTCB',
        ].join('\n'),
        { file: 'Assets/Specs/shiplist.txt' },
      );
      const attacker = bindShiplistRow(parsed.data.rows[0]!, parsed.data.columns);
      const target = bindShiplistRow(parsed.data.rows[1]!, parsed.data.columns);
      const sim = boot([attacker, target], { rulesTurnTicks: 1 });
      const hashes: number[] = [];
      const eventHashes: number[] = [];
      const spawned = play(sim, [
{ kind: VERB_SPAWN, payload: spawnPayload(0, 0, 0, 0) },
{ kind: VERB_SPAWN, payload: spawnPayload(1, 10, 0, 32768) }
]);
      hashes.push(spawned.hash);
      eventHashes.push(spawned.eventHash);
      const ids = spawned.events.filter((event) => event.kind === EVENT_SPAWN).map((event) => event.entity);
      const paid = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(ids[0]!, {
          speed: 4,
          lifeSupport: true,
          fireControl: true,
          general: 2,
          weapons: [{ slot: 0, request: 2, mode: MODE_NORMAL }],
        }) }
]);
      hashes.push(paid.hash);
      eventHashes.push(paid.eventHash);
      const topped = play(sim, [
{ kind: VERB_SET_ENERGY, payload: setEnergyPayload(ids[0]!, {
          fireControl: true,
          weapons: [{ slot: 0, request: 2, mode: MODE_NORMAL }],
        }) }
]);
      hashes.push(topped.hash);
      const fired = play(sim, [
{ kind: VERB_FIRE, payload: firePayload(ids[0]!, 0, ids[1]!) }
]);
      hashes.push(fired.hash);
      eventHashes.push(fired.eventHash);
      expect(viewAt(sim, 0).warp100).toBe(10 * ENERGY_SCALE);
      expect(viewAt(sim, 0).moveCost100).toBe(ENERGY_SCALE);
      expect(viewAt(sim, 1).shields).toEqual([7, 10, 10, 10, 10, 10]);
      expect(fired.events.find((event) => event.kind === EVENT_HIT)?.a).toBe(0);
      return { hashes, eventHashes, sim };
    };
    const left = run();
    const right = run();
    expect(left.hashes).toEqual(right.hashes);
    expect(left.eventHashes).toEqual(right.eventHashes);
    const snap = left.sim.snapshot();
    const restored = boot(
      [cruiser(), cruiser()],
      { rulesTurnTicks: 1 },
    );
    restored.restore(snap);
    expect(restored.stateHash()).toBe(left.sim.stateHash());
    expect(play(restored).hash).toBe(play(left.sim).hash);
    expect(left.hashes).toEqual(GOLDEN_HASHES);
    expect(left.eventHashes).toEqual(GOLDEN_EVENTS);
  });
});

const GOLDEN_HASHES = [2950761822, 1332927196, 1523297669, 2082387381];
const GOLDEN_EVENTS = [304015889, 2931359003, 4167057522];
