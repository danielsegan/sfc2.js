import { describe, expect, it } from 'vitest';
import { command, type Command } from '../core/codec.ts';
import normalJson from '../../docs/rules/data/turn-normal.json' with { type: 'json' };
import hetJson from '../../docs/rules/data/het.json' with { type: 'json' };
import turningFixture from '../../docs/rules/tests/turning.json' with { type: 'json' };
import { lookupTurnPoint } from '../../tools/turn-curve.mjs';
import { classNameOf, type ShipSetup } from './bind-shiplist.ts';
import { EVENT_RULE, R, VERB_SPAWN, createCombat, spawnPayload } from './combat.ts';
import { CLASS_SHIP, FALLBACK_YAW_PER_TICK, turnModeId, turnYawCap, TURN_TEST_C } from './rules-tables.ts';
import { createSim, type Sim, type SimEvent } from './sim.ts';
import { HEADING_ORDER_TABLE, VERB_ORDER_HEADING, createHeadingSteer, headingHandler, headingPayload } from './heading.ts';
import { EVENT_HELM, HELM_YAW_CLAMPED, VERB_ORDER_HELM, helmHandler, helmPayload } from './helm.ts';
import { createHetTurn, hetHandler } from './het.ts';
import {
  HET_CURVE,
  HET_TABLE,
  NORMAL_CURVE,
  TURN_CURVE_TABLE,
  compileCurveTable,
  curveId,
  curvePoint,
  interpInt,
} from './turn-curve.ts';

const SHIP = 65536;

function setup(turnHull: string | undefined, speed: number, letter = 'C'): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 0,
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: 0,
    turnMode: turnModeId(letter),
    acceleration: 0,
    speed,
    shields: [0, 0, 0, 0, 0, 0],
    shieldsMax: [0, 0, 0, 0, 0, 0],
    crew: 1,
    minCrew: 0,
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    ...(turnHull === undefined ? {} : { turnHull }),
    mounts: [],
  };
}

function build(setups: readonly ShipSetup[], curve = true): Sim {
  const combat = createCombat(setups, { rulesTurnTicks: 900 });
  const extra = curve ? [TURN_CURVE_TABLE, HET_TABLE] : [];
  return createSim({
    seed: 3,
    tables: [...combat.tables, HEADING_ORDER_TABLE, ...extra],
    systems: [...combat.systems, ...(curve ? [createHetTurn()] : []), createHeadingSteer()],
    handlers: [...combat.handlers, helmHandler, headingHandler, ...(curve ? [hetHandler] : [])],
  });
}

function run(sim: Sim, count: number, ticks: number, script: Record<number, [number, Uint8Array][]>) {
  const events: SimEvent[] = [];
  const headings: number[][] = [];
  const hashes: number[] = [];
  for (let t = 1; t <= ticks; t++) {
    const cmds: Command[] = [];
    if (t === 1) for (let i = 0; i < count; i++) cmds.push(command(1, 0, i, VERB_SPAWN, spawnPayload(i, 0, 0, 0)));
    (script[t] ?? []).forEach(([kind, payload], i) => cmds.push(command(t, 1, i, kind, payload)));
    for (const event of sim.step(cmds).events) events.push(event);
    const table = sim.snapshot().world.tables.find((x) => x.id === 'heading')!;
    const row: number[] = [];
    for (let i = 0; i < count; i++) row.push(table.data[i * table.fieldCount]!);
    headings.push(row);
    hashes.push(sim.stateHash());
  }
  return { events, headings, hashes };
}

function q(speed: number): number {
  return speed * 100;
}

describe('turn curve tables', () => {
  it('lists every hull key in hullOrder, with default', () => {
    for (const raw of [normalJson, hetJson]) {
      expect([...raw.hullOrder].sort()).toEqual(Object.keys(raw.hulls).sort());
      expect(raw.hullOrder).toContain('default');
    }
  });

  it('compiles every hull in hullOrder for both turn-normal and het tables', () => {
    for (const key of normalJson.hullOrder) {
      const id = curveId(NORMAL_CURVE, key);
      if (key !== 'default') expect(id).not.toBe(NORMAL_CURVE.defaultId);
      expect(NORMAL_CURVE.rows[id]?.key).toBe(key);
      const pt = curvePoint(NORMAL_CURVE, id, 1000);
      expect(pt.rate).toBeGreaterThan(0);
      expect(pt.delay).toBeGreaterThanOrEqual(0);
    }
    for (const key of hetJson.hullOrder) {
      const id = curveId(HET_CURVE, key);
      if (key !== 'default') expect(id).not.toBe(HET_CURVE.defaultId);
      expect(HET_CURVE.rows[id]?.key).toBe(key);
      const pt = curvePoint(HET_CURVE, id, 1000);
      expect(pt.rate).toBeGreaterThan(0);
      expect(pt.angle).toBeGreaterThan(0);
      expect(pt.delay).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives F-CA its measured rates and delay at the table speeds', () => {
    const fca = curveId(NORMAL_CURVE, 'F-CA');
    const want: [number, number][] = [[400, 24], [500, 29], [700, 39], [800, 42], [1000, 47], [1300, 46], [1400, 46], [2000, 46], [2500, 48], [2950, 49]];
    for (const [speed, rate] of want) {
      expect(curvePoint(NORMAL_CURVE, fca, speed)).toMatchObject({ rate, delay: 44 });
    }
  });

  it('interpolates between points with integer nearest rounding', () => {
    const fca = curveId(NORMAL_CURVE, 'F-CA');
    expect(curvePoint(NORMAL_CURVE, fca, q(9)).rate).toBe(45);
    expect(curvePoint(NORMAL_CURVE, fca, q(6)).rate).toBe(34);
    expect(curvePoint(NORMAL_CURVE, fca, q(22)).rate).toBe(47);
    expect(curvePoint(NORMAL_CURVE, fca, q(29)).rate).toBe(49);
    expect(interpInt(5, 0, 0, 10, 1)).toBe(1);
    expect(interpInt(5, 0, 1, 10, 0)).toBe(0);
    expect(interpInt(4, 0, 10, 10, 0)).toBe(6);
  });

  it('clamps below the first and above the last point', () => {
    const fca = curveId(NORMAL_CURVE, 'F-CA');
    expect(curvePoint(NORMAL_CURVE, fca, 0).rate).toBe(24);
    expect(curvePoint(NORMAL_CURVE, fca, q(3)).rate).toBe(24);
    expect(curvePoint(NORMAL_CURVE, fca, q(40)).rate).toBe(49);
    const d7 = curveId(NORMAL_CURVE, 'K-D7');
    for (const speed of [0, 7, 15, 31, 40]) expect(curvePoint(NORMAL_CURVE, d7, q(speed)).rate).toBe(52);
    const fedWant: [string, number, number, number][] = [
      ['F-FF', 31, 57, 60],
      ['F-DD', 33, 50, 52],
      ['F-CL', 32, 51, 58],
      ['F-CC', 28, 44, 48],
      ['F-DN', 26, 38, 45],
    ];
    for (const [hull, r5, r10, r20] of fedWant) {
      const id = curveId(NORMAL_CURVE, hull);
      expect(curvePoint(NORMAL_CURVE, id, q(0)).rate).toBe(r5);
      expect(curvePoint(NORMAL_CURVE, id, q(5)).rate).toBe(r5);
      expect(curvePoint(NORMAL_CURVE, id, q(10)).rate).toBe(r10);
      expect(curvePoint(NORMAL_CURVE, id, q(20)).rate).toBe(r20);
      expect(curvePoint(NORMAL_CURVE, id, q(31)).rate).toBe(r20);
    }
  });

  it('keys a shiplist row by the class name after the last colon', () => {
    expect(classNameOf('test-empire-a:test-ca-01')).toBe('test-ca-01');
    expect(classNameOf('F-CA')).toBe('F-CA');
  });

  it('sends an unknown hull to the default row', () => {
    expect(curveId(NORMAL_CURVE, 'no-such-hull')).toBe(NORMAL_CURVE.defaultId);
    expect(curvePoint(NORMAL_CURVE, curveId(NORMAL_CURVE, 'X-YZ'), q(8)).rate).toBe(42);
    expect(curveId(HET_CURVE, 'X-YZ')).toBe(HET_CURVE.defaultId);
  });

  it('agrees with tools/turn-curve.mjs for every hull and speed 0–40', () => {
    for (const [raw, table] of [[normalJson, NORMAL_CURVE], [hetJson, HET_CURVE]] as const) {
      for (const key of raw.hullOrder) {
        for (let speed = 0; speed <= 4000; speed += 25) {
          const tool = lookupTurnPoint(raw as never, key, speed);
          const sim = curvePoint(table, curveId(table, key), speed);
          expect(sim.rate).toBe(tool.turnRate16PerTick);
          expect(sim.delay).toBe(tool.delayTicks);
          if (tool.turnAngle16 !== undefined) expect(sim.angle).toBe(tool.turnAngle16);
        }
      }
    }
  });

  it('runs docs/rules/tests/turning.json lookup cases through the engine', () => {
    let count = 0;
    for (const raw of turningFixture.cases) {
      const c = raw as { op: string; hull?: string; speedHundredths?: number; expect: number | { turnRate16PerTick?: number; delayTicks?: number } };
      if (c.op !== 'lookup') continue;
      const point = curvePoint(NORMAL_CURVE, curveId(NORMAL_CURVE, c.hull!), c.speedHundredths!);
      const want = c.expect as { turnRate16PerTick?: number; delayTicks?: number };
      if (want.turnRate16PerTick !== undefined) expect(point.rate).toBe(want.turnRate16PerTick);
      if (want.delayTicks !== undefined) expect(point.delay).toBe(want.delayTicks);
      count++;
    }
    expect(count).toBeGreaterThan(10);
  });

  it('takes a replaced row as data only (Tier-2 style K-D7 swap)', () => {
    const swapped = {
      ...normalJson,
      hulls: {
        ...normalJson.hulls,
        'K-D7': { speedPoints: [
          { speed: 7, speedHundredths: 700, delayTicks: 40, turnRate16PerTick: 46 },
          { speed: 15, speedHundredths: 1500, delayTicks: 40, turnRate16PerTick: 52 },
          { speed: 31, speedHundredths: 3100, delayTicks: 40, turnRate16PerTick: 58 },
        ] },
      },
    };
    const table = compileCurveTable(swapped, false, 'swap');
    const d7 = curveId(table, 'K-D7');
    expect(curvePoint(table, d7, q(11)).rate).toBe(49);
    expect(curvePoint(table, d7, q(31)).rate).toBe(58);
    expect(curvePoint(table, d7, q(31)).delay).toBe(40);
  });

  it('refuses floats, unordered speeds, and a missing default', () => {
    const bad = (hulls: Record<string, unknown>, order = ['default']) => () =>
      compileCurveTable({ hullOrder: order, hulls } as never, false, 'bad');
    expect(bad({ default: { speedPoints: [{ speed: 1, delayTicks: 1, turnRate16PerTick: 4.5 }] } })).toThrow();
    expect(bad({ default: { speedPoints: [{ speed: 5, delayTicks: 1, turnRate16PerTick: 4 }, { speed: 4, delayTicks: 1, turnRate16PerTick: 4 }] } })).toThrow();
    expect(bad({ a: { speedPoints: [{ speed: 1, delayTicks: 1, turnRate16PerTick: 4 }] } }, ['a'])).toThrow();
    expect(bad({ default: { speedPoints: [{ speed: 1, delayTicks: 1, turnRate16PerTick: 4 }] } }, ['default', 'missing'])).toThrow();
  });
});

describe('normal turn in the sim', () => {
  it('waits the start delay, then turns at the curve rate (F-CA at speed 10: 44 ticks, 47/tick)', () => {
    const sim = build([setup('F-CA', 10)]);
    const { headings, events } = run(sim, 1, 2 + 44 + 3, { 2: [[VERB_ORDER_HEADING, headingPayload(SHIP, 1000)]] });
    // Tick 2 is the order tick: delay ticks 2..45, first step on tick 46.
    expect(headings[44]![0]).toBe(0);
    expect(headings[45]![0]).toBe(47);
    expect(headings[46]![0]).toBe(94);
    expect(events.some((e) => e.kind === EVENT_RULE && e.a === R.turnModeUnverified)).toBe(false);
  });

  it('interpolates the rate from the ordered speed (F-CA at speed 9: 45/tick)', () => {
    const sim = build([setup('F-CA', 9)]);
    const { headings } = run(sim, 1, 2 + 44 + 2, { 2: [[VERB_ORDER_HEADING, headingPayload(SHIP, 60000)]] });
    expect(headings[45]![0]).toBe(65536 - 45);
    expect(headings[46]![0]).toBe(65536 - 90);
  });

  it('keeps turning without a new delay when re-ordered mid-turn', () => {
    const sim = build([setup('K-D7', 20)]);
    const { headings } = run(sim, 1, 60, {
      2: [[VERB_ORDER_HEADING, headingPayload(SHIP, 5000)]],
      50: [[VERB_ORDER_HEADING, headingPayload(SHIP, 6000)]],
    });
    expect(headings[45]![0]).toBe(52);
    expect(headings[49]![0]).toBe(52 * 5);
    expect(headings[50]![0]).toBe(52 * 6);
  });

  it('caps manual yaw at the curve rate', () => {
    const sim = build([setup('F-CA', 31)]);
    const { headings, events } = run(sim, 1, 2, { 2: [[VERB_ORDER_HELM, helmPayload(SHIP, 5000)]] });
    expect(headings[1]![0]).toBe(49);
    const helm = events.find((e) => e.kind === EVENT_HELM)!;
    expect([helm.a, helm.b]).toEqual([HELM_YAW_CLAMPED, 49]);
  });

  it('leaves hulls without a turn hull, and sims without the table, on the letter cap', () => {
    const plain = build([setup(undefined, 10)]);
    const a = run(plain, 1, 3, { 2: [[VERB_ORDER_HEADING, headingPayload(SHIP, 30000)]] });
    expect(a.headings[1]![0]).toBe(FALLBACK_YAW_PER_TICK);
    expect(a.events.some((e) => e.kind === EVENT_RULE && e.a === R.turnModeUnverified)).toBe(true);
    const bare = build([setup('F-CA', 10, 'TEST-C')], false);
    const b = run(bare, 1, 3, { 2: [[VERB_ORDER_HEADING, headingPayload(SHIP, 30000)]] });
    expect(b.headings[1]![0]).toBe(turnYawCap(TURN_TEST_C));
  });

  it('is deterministic across runs', () => {
    const ships = [setup('F-CA', 13), setup('K-D7', 7), setup('other', 29)];
    const script: Record<number, [number, Uint8Array][]> = {
      2: [
        [VERB_ORDER_HEADING, headingPayload(SHIP, 20000)],
        [VERB_ORDER_HEADING, headingPayload(SHIP + 1, 50000)],
        [VERB_ORDER_HELM, helmPayload(SHIP + 2, -3000)],
      ],
    };
    const a = run(build(ships), 3, 120, script);
    const b = run(build(ships), 3, 120, script);
    expect(a.headings[119]![0]).not.toBe(0);
    expect(a.headings[119]![1]).not.toBe(0);
    expect(a.hashes).toEqual(b.hashes);
    expect(a.headings).toEqual(b.headings);
  });
});
