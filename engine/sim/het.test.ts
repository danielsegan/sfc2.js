import { describe, expect, it } from 'vitest';
import { command, type Command } from '../core/codec.ts';
import hetFixture from '../../docs/rules/tests/het.json' with { type: 'json' };
import type { ShipSetup } from './bind-shiplist.ts';
import { VERB_SPAWN, createCombat, spawnPayload } from './combat.ts';
import { CLASS_SHIP, turnModeId } from './rules-tables.ts';
import { createSim, type Sim, type SimEvent } from './sim.ts';
import {
  EVENT_HEADING,
  HEADING_HET_ACTIVE,
  HEADING_ORDER,
  HEADING_ORDER_TABLE,
  HEADING_HOLD,
  VERB_ORDER_HEADING,
  createHeadingSteer,
  headingHandler,
  headingPayload,
} from './heading.ts';
import { EVENT_HELM, HELM_HET_ACTIVE, VERB_ORDER_HELM, helmHandler, helmPayload, readHelmView } from './helm.ts';
import {
  EVENT_HET,
  HET_ACTIVE,
  HET_DONE,
  HET_IMMOBILE,
  HET_INVALID_DIR,
  HET_NO_SHIP,
  HET_ORDERED,
  createHetTurn,
  hetHandler,
  hetPayload,
} from './het.ts';
import { HET_TABLE, TURN_CURVE_TABLE } from './turn-curve.ts';

const VERB_ORDER_HET = 13;

function setup(turnHull: string | undefined, speed: number, letter = 'TEST-C'): ShipSetup {
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

function build(setups: readonly ShipSetup[], seed = 7): Sim {
  const combat = createCombat(setups, { rulesTurnTicks: 900 });
  return createSim({
    seed,
    tables: [...combat.tables, HEADING_ORDER_TABLE, TURN_CURVE_TABLE, HET_TABLE],
    systems: [...combat.systems, createHetTurn(), createHeadingSteer()],
    handlers: [...combat.handlers, helmHandler, headingHandler, hetHandler],
  });
}

/** Spawn i is entity 65536 + i. */
const SHIP = 65536;

interface Run {
  sim: Sim;
  events: SimEvent[];
  hashes: number[];
}

/** Spawns every setup on tick 1, then steps with `script` (keyed by sim tick). */
function run(setups: readonly ShipSetup[], ticks: number, script: Record<number, [number, Uint8Array][]>): Run {
  const sim = build(setups);
  const events: SimEvent[] = [];
  const hashes: number[] = [];
  for (let t = 1; t <= ticks; t++) {
    const cmds: Command[] = [];
    if (t === 1) setups.forEach((_, i) => cmds.push(command(1, 0, i, VERB_SPAWN, spawnPayload(i, 0, 0, 0))));
    (script[t] ?? []).forEach(([kind, payload], i) => cmds.push(command(t, 1, i, kind, payload)));
    const out = sim.step(cmds);
    for (const event of out.events) events.push(event);
    hashes.push(sim.stateHash());
  }
  return { sim, events, hashes };
}

function heading(sim: Sim, index: number): number {
  const table = sim.snapshot().world.tables.find((t) => t.id === 'heading')!;
  return table.data[index * table.fieldCount]!;
}

function helm(sim: Sim, index: number) {
  return readHelmView(sim.snapshot().world, index);
}

function hetEvents(events: readonly SimEvent[]): SimEvent[] {
  return events.filter((event) => event.kind === EVENT_HET);
}

describe('orderHet (verb 13)', () => {
  it('uses the reserved verb id', () => {
    expect(hetHandler.kind).toBe(VERB_ORDER_HET);
  });

  it('turns an F-CA 90° to starboard after the 171-tick delay at 285 units/tick', () => {
    const { sim, events } = run([setup('F-CA', 20)], 2, { 2: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]] });
    expect(hetEvents(events)).toEqual([{ tick: 2, kind: EVENT_HET, entity: SHIP, a: HET_ORDERED, b: 16384 }].map((e) => expect.objectContaining(e)));
    // Order tick: one delay tick already spent.
    expect(helm(sim, 0)).toEqual({
      mode: 'het',
      remainingTurn16: 16384,
      hetDelayTicks: 170,
      hetSuccessChance: 100,
      hetBreakdown: false,
      emerDecelActive: false,
      emerDecelTicksLeft: 0,
      erraticActive: false,
    });
    expect(heading(sim, 0)).toBe(0);
  });

  it('runs the worked timing from het.md §5 (229 ticks, last step 139)', () => {
    const order = 2;
    const { sim, events } = run([setup('F-CA', 20)], order + 228, { [order]: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]] });
    expect(heading(sim, 0)).toBe(16384);
    expect(helm(sim, 0).mode).toBe('heading');
    expect(helm(sim, 0).remainingTurn16).toBe(0);
    const done = hetEvents(events).find((e) => e.a === HET_DONE);
    expect(done?.tick).toBe(order + 228);
    expect(done?.b).toBe(16384);
    const order2 = run([setup('F-CA', 20)], order + 171, { [order]: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]] });
    expect(heading(order2.sim, 0)).toBe(285);
    expect(helm(order2.sim, 0)).toEqual({
      mode: 'het',
      remainingTurn16: 16384 - 285,
      hetDelayTicks: 0,
      hetSuccessChance: 100,
      hetBreakdown: false,
      emerDecelActive: false,
      emerDecelTicksLeft: 0,
      erraticActive: false,
    });
    const delay = run([setup('F-CA', 20)], order + 170, { [order]: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]] });
    expect(heading(delay.sim, 0)).toBe(0);
    expect(helm(delay.sim, 0)).toEqual({
      mode: 'het',
      remainingTurn16: 16384,
      hetDelayTicks: 0,
      hetSuccessChance: 100,
      hetBreakdown: false,
      emerDecelActive: false,
      emerDecelTicksLeft: 0,
      erraticActive: false,
    });
    const last = run([setup('F-CA', 20)], order + 227, { [order]: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]] });
    expect(helm(last.sim, 0).remainingTurn16).toBe(139);
  });

  it('turns to port with dir -1 and holds the new heading', () => {
    const { sim } = run([setup('F-CA', 31)], 240, { 2: [[VERB_ORDER_HET, hetPayload(SHIP, -1)]] });
    expect(heading(sim, 0)).toBe(65536 - 16384);
    const order = sim.snapshot().world.tables.find((t) => t.id === HEADING_ORDER)!;
    expect(order.data[0]).toBe(HEADING_HOLD);
    expect(order.data[1]).toBe(49152);
  });

  it('uses Tier-2 HET rates for F-CA (5/15/31) and F-CL/F-CC/F-DN/F-DD, leaving F-FF on default', () => {
    const { sim } = run([
      setup('F-CA', 15),
      setup('F-CL', 5),
      setup('F-CC', 5),
      setup('F-DN', 5),
      setup('F-DD', 31),
      setup('F-FF', 10),
    ], 2 + 171, {
      2: [
        [VERB_ORDER_HET, hetPayload(SHIP, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 1, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 2, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 3, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 4, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 5, 1)],
      ],
    });
    expect(heading(sim, 0)).toBe(255);
    expect(heading(sim, 1)).toBe(313);
    expect(heading(sim, 2)).toBe(283);
    expect(heading(sim, 3)).toBe(253);
    expect(heading(sim, 4)).toBe(335);
    expect(heading(sim, 5)).toBe(285);
  });

  it('gives K-D7 the 90° preset baseline sweep and unknown hulls the default row', () => {
    const { sim } = run([setup('K-D7', 31), setup('no-such-hull', 40), setup(undefined, 5), setup('K-D7', 5)], 240, {
      2: [
        [VERB_ORDER_HET, hetPayload(SHIP, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 1, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 2, -1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 3, 1)],
      ],
    });
    expect(heading(sim, 0)).toBe(16384);
    expect(heading(sim, 1)).toBe(16384);
    expect(heading(sim, 2)).toBe(49152);
    expect(heading(sim, 3)).toBe(16384);
  });

  it('uses Tier-2 HET rates and sweeps for non-Fed hulls and keeps unmeasured ones on default', () => {
    const { sim } = run([
      setup('Z-CA', 5),
      setup('H-HN', 15),
      setup('L-CC', 5),
      setup('G-CA', 31),
      setup('I-FF', 5),
      setup('G-DD', 10),
    ], 2 + 171, {
      2: [
        [VERB_ORDER_HET, hetPayload(SHIP, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 1, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 2, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 3, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 4, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 5, 1)],
      ],
    });
    expect(heading(sim, 0)).toBe(318);
    expect(heading(sim, 1)).toBe(363);
    expect(heading(sim, 2)).toBe(267);
    expect(heading(sim, 3)).toBe(307);
    expect(heading(sim, 4)).toBe(370);
    expect(heading(sim, 5)).toBe(285);
  });

  it('rejects any dir other than -1 or +1 with hetInvalidDir', () => {
    for (const dir of [0, 2, -2, 16384, -2147483648]) {
      const { sim, events } = run([setup('F-CA', 10)], 3, { 2: [[VERB_ORDER_HET, hetPayload(SHIP, dir)]] });
      const het = hetEvents(events);
      expect(het).toHaveLength(1);
      expect(het[0]!.a).toBe(HET_INVALID_DIR);
      expect(helm(sim, 0).mode).toBe('none');
      expect(heading(sim, 0)).toBe(0);
    }
  });

  it('rejects a second HET, a heading order, and manual yaw while one is active (hetActive)', () => {
    const { sim, events } = run([setup('F-CA', 10)], 12, {
      2: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]],
      5: [[VERB_ORDER_HET, hetPayload(SHIP, -1)]],
      6: [[VERB_ORDER_HEADING, headingPayload(SHIP, 30000)]],
      7: [[VERB_ORDER_HELM, helmPayload(SHIP, 500)]],
    });
    const het = hetEvents(events);
    expect(het.map((e) => [e.tick, e.a])).toEqual([
      [2, HET_ORDERED],
      [5, HET_ACTIVE],
    ]);
    expect(events.find((e) => e.kind === EVENT_HEADING)?.a).toBe(HEADING_HET_ACTIVE);
    expect(events.find((e) => e.kind === EVENT_HELM)?.a).toBe(HELM_HET_ACTIVE);
    expect(helm(sim, 0)).toEqual({
      mode: 'het',
      remainingTurn16: 16384,
      hetDelayTicks: 171 - 11,
      hetSuccessChance: 100,
      hetBreakdown: false,
      emerDecelActive: false,
      emerDecelTicksLeft: 0,
      erraticActive: false,
    });
    expect(heading(sim, 0)).toBe(0);
  });

  it('accepts a new HET once the last one has finished', () => {
    const { sim, events } = run([setup('F-CA', 10)], 2 + 228 + 229, {
      2: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]],
      231: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]],
    });
    expect(hetEvents(events).filter((e) => e.a === HET_ORDERED)).toHaveLength(2);
    expect(heading(sim, 0)).toBe(32768);
  });

  it('supersedes an active heading order', () => {
    const { sim } = run([setup('F-CA', 10)], 3, {
      2: [[VERB_ORDER_HEADING, headingPayload(SHIP, 30000)]],
      3: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]],
    });
    expect(helm(sim, 0).mode).toBe('het');
    const order = sim.snapshot().world.tables.find((t) => t.id === HEADING_ORDER)!;
    expect(order.data[0]).toBe(0);
  });

  it('refuses an immobile hull and a missing ship', () => {
    const { events } = run([setup('F-CA', 0, 'H')], 3, {
      2: [
        [VERB_ORDER_HET, hetPayload(SHIP, 1)],
        [VERB_ORDER_HET, hetPayload(SHIP + 5, 1)],
      ],
    });
    expect(hetEvents(events).map((e) => e.a).sort()).toEqual([HET_IMMOBILE, HET_NO_SHIP].sort());
  });

  it('is deterministic: same hashes every run, and restore mid-turn replays the same ticks', () => {
    const script = { 2: [[VERB_ORDER_HET, hetPayload(SHIP, 1)]] as [number, Uint8Array][], 3: [[VERB_ORDER_HET, hetPayload(SHIP + 1, -1)]] as [number, Uint8Array][] };
    const ships = [setup('F-CA', 12), setup('K-D7', 25)];
    const a = run(ships, 260, script);
    const b = run(ships, 260, script);
    expect(a.hashes).toEqual(b.hashes);
    const sim = build(ships);
    const mid: number[] = [];
    let snap = null;
    for (let t = 1; t <= 260; t++) {
      const cmds: Command[] = [];
      if (t === 1) ships.forEach((_, i) => cmds.push(command(1, 0, i, VERB_SPAWN, spawnPayload(i, 0, 0, 0))));
      (script[t as 2 | 3] ?? []).forEach(([kind, payload], i) => cmds.push(command(t, 1, i, kind, payload)));
      sim.step(cmds);
      if (t === 200) snap = sim.snapshot();
      if (t > 200) mid.push(sim.stateHash());
    }
    sim.restore(snap!);
    for (let t = 201; t <= 260; t++) {
      sim.step([]);
      expect(sim.stateHash()).toBe(mid[t - 201]);
    }
    expect(a.hashes.slice(200)).toEqual(mid);
  });
});

interface FixtureShip {
  spawnKey: string;
  hetHull: string;
  movement: { turnMode: string; speed: number; heading16: number };
}

interface FixtureCommand {
  entry: string;
  ship: string;
  dir: number;
}

describe('docs/rules/tests/het.json through the engine', () => {
  it('matches the fixture results and end state', () => {
    const ships = hetFixture.ships as readonly FixtureShip[];
    const setups = ships.map((ship) => setup(ship.hetHull, ship.movement.speed, ship.movement.turnMode));
    const index = new Map(ships.map((ship, i) => [ship.spawnKey, i]));
    // Fixture tick t runs on sim tick t + 2 (spawn is tick 1).
    const script: Record<number, [number, Uint8Array][]> = {};
    for (const step of hetFixture.timeline as readonly { tick: number; commands: readonly FixtureCommand[] }[]) {
      script[step.tick + 2] = step.commands.map((c) => [VERB_ORDER_HET, hetPayload(SHIP + index.get(c.ship)!, c.dir)]);
    }
    const { sim, events } = run(setups, hetFixture.endTick + 2, script);
    const answers = hetEvents(events).filter((e) => e.a !== HET_DONE);
    const expected = hetFixture.expect.results;
    expect(answers).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const want = expected[i]!;
      const got = answers[i]!;
      expect(got.tick).toBe(want.tick + 2);
      if (want.status === 'applied') {
        expect(got.a).toBe(HET_ORDERED);
        expect(got.b).toBe(want.appliedValue);
      } else {
        expect(got.a).toBe(want.reason === 'hetActive' ? HET_ACTIVE : HET_INVALID_DIR);
      }
    }
    const state = hetFixture.expect.state as Record<string, { heading16: number; helm: { mode: string; remainingTurn16: number; hetDelayTicksLeft: number } }>;
    for (const [key, want] of Object.entries(state)) {
      const i = index.get(key)!;
      expect(heading(sim, i)).toBe(want.heading16);
      const view = helm(sim, i);
      expect(view.mode === 'heading' ? 'none' : view.mode).toBe(want.helm.mode);
      expect(view.remainingTurn16).toBe(want.helm.remainingTurn16);
      expect(view.hetDelayTicks).toBe(want.helm.hetDelayTicksLeft);
    }
  });
});
