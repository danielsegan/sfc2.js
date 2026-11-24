import { describe, expect, it } from 'vitest';
import { parseFtrlist } from '../../tools/formats/ftrlist.ts';
import { LocalSession } from '../net/session.ts';
import { createCruise, CRUISE_TABLE } from './cruise.ts';
import { fx } from '../core/fx.ts';
import type { ShipSetup } from './bind-shiplist.ts';
import { EVENT_SPAWN, VERB_SET_SHIELDS, VERB_SPAWN, createCombat, setShieldsPayload } from './combat.ts';
import { shipView } from './hull.ts';
import { CLASS_FIGHTER, CLASS_PF, CLASS_SHIP, MODE_NORMAL, TURN_TEST_A, weaponId } from './rules-tables.ts';
import { createSim, type Sim, type StepResult } from './sim.ts';
import {
  CR,
  ENDURANCE_TICKS,
  EVENT_CRAFT,
  EVENT_CRAFT_NOTE,
  MINE_ARM_TICKS,
  MINE_DAMAGE,
  NOTE_ARMED,
  NOTE_DETECTED,
  NOTE_DETONATED,
  NOTE_DOCKED,
  NOTE_REARMED,
  NOTE_STRIKE,
  REARM_TICKS,
  STRIKE_DAMAGE,
  VERB_LAUNCH_FIGHTER,
  VERB_LAUNCH_PF,
  VERB_LAY_MINE,
  VERB_RAID,
  VERB_RECALL,
  VERB_SET_BAY,
  VERB_SET_SIDE,
  VERB_SET_STORES,
  bindFtrlist,
  craftReadout,
  launchFighterPayload,
  launchPfPayload,
  layMinePayload,
  raidPayload,
  recallPayload,
  setBayPayload,
  setSidePayload,
  setStoresPayload,
  createSmallcraft,
} from './smallcraft.ts';

const FIGHTER_LIST = [
  'Race\tType\tSpeed\tNum\tWeapon1\tArc\tShots\tDamage',
  'test-empire\ttest-ftr\t4\t1\tPh3\tFH\t2\t3',
  'test-empire\ttest-ftr\t9\t1\tPh3\tFH\t1\t1',
].join('\n');

function fighters() {
  return bindFtrlist(parseFtrlist(FIGHTER_LIST).data);
}

function ship(partial: Partial<ShipSetup> = {}): ShipSetup {
  return {
    classCode: CLASS_SHIP,
    warp: 10,
    impulse: 0,
    apr: 0,
    battery: 0,
    batteryCapacity: 0,
    moveCost100: 100,
    turnMode: TURN_TEST_A,
    acceleration: 4,
    speed: 0,
    shields: [10, 10, 10, 10, 10, 10],
    shieldsMax: [10, 10, 10, 10, 10, 10],
    crew: 4,
    minCrew: 1,
    fcPaid: 1,
    destroyed: 0,
    disabled: 0,
    systems: { sensors: 2, bridge: 1, extraDamage: 1 },
    mounts: [],
    ...partial,
  };
}

function pf(): ShipSetup {
  return ship({
    classCode: CLASS_PF,
    shields: [6, 4, 4, 4, 4, 4],
    shieldsMax: [6, 4, 4, 4, 4, 4],
    crew: 1,
    minCrew: 0,
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
  });
}

const sessions = new Map<Sim, LocalSession>();

function boot(setups: readonly ShipSetup[], period = 1): Sim {
  const combat = createCombat(setups, { rulesTurnTicks: period });
  const craft = createSmallcraft({ fighters: fighters(), setups });
  const sim = createSim({
    seed: 1,
    tables: [...combat.tables, CRUISE_TABLE, ...craft.tables],
    systems: [...combat.systems, createCruise(period), ...craft.systems],
    handlers: [...combat.handlers, ...craft.handlers],
  });
  sessions.set(sim, new LocalSession({ inputDelay: 0, currentTick: () => sim.tick as number }));
  return sim;
}

interface Issued {
  kind: number;
  payload: Uint8Array;
}

function play(sim: Sim, issues: readonly Issued[] = []): StepResult {
  const session = sessions.get(sim);
  if (!session) throw new Error('session');
  for (const issue of issues) session.issue(issue.kind, issue.payload);
  const next = ((sim.tick as number) + 1) >>> 0;
  return sim.step(session.commandsFor(next));
}

function steps(sim: Sim, count: number): void {
  for (let i = 0; i < count; i++) play(sim);
}

const CARRIER = 65536;
const ENEMY = 65537;

describe('ftrlist launch catalog', () => {
  it('keeps the first parsed row and its weapon', () => {
    const parsed = parseFtrlist(FIGHTER_LIST);
    expect(parsed.diagnostics.some((item) => item.code === 'duplicateFighterType')).toBe(true);
    const rows = bindFtrlist(parsed.data);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe('test-empire:test-ftr');
    expect(rows[0]?.speed).toBe(4);
    expect(rows[0]?.damage).toBe(3);
    expect(rows[0]?.weapon).toBe('Ph3');
    expect(rows[0]?.arc).toBe('FH');
    expect(rows[0]?.load).toBe(2);
  });
});

describe('fighters and rearm', () => {
  function ready(): Sim {
    const sim = boot([ship(), ship()]);
    play(sim, [
      { kind: VERB_SPAWN, payload: spawn(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawn(1, 6, 0, 32768) },
      { kind: VERB_SET_SIDE, payload: setSidePayload(CARRIER, 0) },
      { kind: VERB_SET_SIDE, payload: setSidePayload(ENEMY, 1) },
      { kind: VERB_SET_BAY, payload: setBayPayload(CARRIER, 0, 1, 0, 4) },
    ]);
    return sim;
  }

  it('launches, closes, and chips the facing shield', () => {
    const sim = ready();
    const launched = play(sim, [{ kind: VERB_LAUNCH_FIGHTER, payload: launchFighterPayload(CARRIER, 0) }]);
    expect(launched.events.some((event) => event.kind === EVENT_CRAFT_NOTE && event.a === 1)).toBe(true);
    expect(craftReadout(sim.snapshot().world, 0).fighterReady).toBe(3);
    const fighter = shipView(sim.snapshot().world, 2);
    expect(fighter.classCode).toBe(CLASS_FIGHTER);
    expect(fighter.mounts[0]?.weaponId).toBe(weaponId('Ph3'));
    expect(position(sim, 2).x).toBe(fx(4) as number);
    expect(shipView(sim.snapshot().world, 1).shields[0]).toBe(10 - STRIKE_DAMAGE);
    expect(launched.events.some((event) => event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_STRIKE)).toBe(true);
    play(sim);
    expect(shipView(sim.snapshot().world, 1).shields[0]).toBe(10 - STRIKE_DAMAGE);
    play(sim);
    expect(shipView(sim.snapshot().world, 1).shields[0]).toBe(10 - STRIKE_DAMAGE * 2);
  });

  it('rejects an empty bay and a fighter carrier', () => {
    const sim = ready();
    const empty = play(sim, [{ kind: VERB_LAUNCH_FIGHTER, payload: launchFighterPayload(CARRIER, 1) }]);
    expect(empty.events.find((event) => event.kind === EVENT_CRAFT)?.a).toBe(CR.bayEmpty);
    const launched = play(sim, [{ kind: VERB_LAUNCH_FIGHTER, payload: launchFighterPayload(CARRIER, 0) }]);
    const fighterId = launched.events.find((event) => event.kind === EVENT_SPAWN && event.b === 1)?.entity;
    expect(fighterId).toBeTypeOf('number');
    const refused = play(sim, [{ kind: VERB_LAUNCH_FIGHTER, payload: launchFighterPayload(fighterId ?? 0, 0) }]);
    expect(refused.events.find((event) => event.kind === EVENT_CRAFT)?.a).toBe(CR.notAShip);
  });

  it('docks on recall and rearms after the documented timer', () => {
    const sim = ready();
    const fighterId = 65538;
    const docked = play(sim, [
      { kind: VERB_LAUNCH_FIGHTER, payload: launchFighterPayload(CARRIER, 0) },
      { kind: VERB_RECALL, payload: recallPayload(fighterId) },
    ]);
    expect(docked.events.some((event) => event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_DOCKED)).toBe(true);
    expect(sim.snapshot().world.live[fighterId & 0xffff]).not.toBe(1);
    expect(craftReadout(sim.snapshot().world, 0).rearming).toBe(1);
    expect(craftReadout(sim.snapshot().world, 0).fighterReady).toBe(3);
    steps(sim, REARM_TICKS - 1);
    expect(craftReadout(sim.snapshot().world, 0).fighterReady).toBe(3);
    const done = play(sim);
    expect(done.events.some((event) => event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_REARMED)).toBe(true);
    expect(craftReadout(sim.snapshot().world, 0).fighterReady).toBe(4);
    expect(craftReadout(sim.snapshot().world, 0).rearming).toBe(0);
    expect(ENDURANCE_TICKS).toBeGreaterThan(REARM_TICKS);
  });
});

describe('PFs', () => {
  it('launches a pf the shield command accepts, then recovers it', () => {
    const sim = boot([ship(), pf()]);
    play(sim, [
      { kind: VERB_SPAWN, payload: spawn(0, 0, 0, 0) },
      { kind: VERB_SET_SIDE, payload: setSidePayload(CARRIER, 0) },
      { kind: VERB_SET_BAY, payload: setBayPayload(CARRIER, 0, 2, 1, 1) },
    ]);
    const launched = play(sim, [{ kind: VERB_LAUNCH_PF, payload: launchPfPayload(CARRIER, 0) }]);
    const pfId = launched.events.find((event) => event.kind === EVENT_SPAWN && event.b === 2)?.entity ?? 0;
    expect(shipView(sim.snapshot().world, pfId & 0xffff).classCode).toBe(CLASS_PF);
    const shields = play(sim, [{ kind: VERB_SET_SHIELDS, payload: setShieldsPayload(pfId, 0, 3) }]);
    expect(shields.events.some((event) => event.kind === 2 && event.a === 0)).toBe(true);
    expect(shipView(sim.snapshot().world, pfId & 0xffff).shields[0]).toBe(3);
    const recalled = play(sim, [{ kind: VERB_RECALL, payload: recallPayload(pfId) }]);
    expect(recalled.events.some((event) => event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_DOCKED)).toBe(true);
    expect(sim.snapshot().world.live[pfId & 0xffff]).not.toBe(1);
    expect(craftReadout(sim.snapshot().world, 0).pfReady).toBe(0);
    expect(craftReadout(sim.snapshot().world, 0).rearming).toBe(1);
  });
});

describe('mines', () => {
  function lay(atEnemy: boolean): Sim {
    const sim = boot([ship(), ship()]);
    const enemyX = atEnemy ? 0 : 3;
    play(sim, [
      { kind: VERB_SPAWN, payload: spawn(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawn(1, enemyX, 0, 0) },
      { kind: VERB_SET_SIDE, payload: setSidePayload(CARRIER, 0) },
      { kind: VERB_SET_SIDE, payload: setSidePayload(ENEMY, 1) },
      { kind: VERB_SET_STORES, payload: setStoresPayload(CARRIER, 2, 0, 0) },
      { kind: VERB_LAY_MINE, payload: layMinePayload(CARRIER) },
    ]);
    return sim;
  }

  it('arms on the fourth tick and does not hurt the layer', () => {
    const sim = lay(true);
    expect(shipView(sim.snapshot().world, 1).shields[0]).toBe(10);
    steps(sim, MINE_ARM_TICKS - 2);
    expect(shipView(sim.snapshot().world, 1).shields[0]).toBe(10);
    expect(sim.snapshot().world.live.some((flag, index) => index > 1 && flag === 1)).toBe(true);
    const boom = play(sim);
    expect(boom.events.some((event) => event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_ARMED)).toBe(true);
    expect(boom.events.some((event) => event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_DETONATED && event.b === MINE_DAMAGE)).toBe(true);
    expect(shipView(sim.snapshot().world, 1).shields[0]).toBe(10 - MINE_DAMAGE);
    expect(shipView(sim.snapshot().world, 0).shields[0]).toBe(10);
    expect(craftReadout(sim.snapshot().world, 0).mines).toBe(1);
  });

  it('detects inside the detect range and outside the blast', () => {
    const sim = lay(false);
    let last: StepResult | null = null;
    for (let i = 0; i < MINE_ARM_TICKS - 1; i++) last = play(sim);
    const notes = (last?.events ?? []).filter((event) => event.kind === EVENT_CRAFT_NOTE);
    expect(notes.some((event) => event.a === NOTE_DETECTED)).toBe(true);
    expect(notes.some((event) => event.a === NOTE_DETONATED)).toBe(false);
    expect(shipView(sim.snapshot().world, 1).shields[0]).toBe(10);
    expect(sim.snapshot().world.live.some((flag, index) => index > 1 && flag === 1)).toBe(true);
  });

  it('rejects a ship with no mines', () => {
    const sim = boot([ship()]);
    play(sim, [
      { kind: VERB_SPAWN, payload: spawn(0, 0, 0, 0) },
      { kind: VERB_SET_STORES, payload: setStoresPayload(CARRIER, 0, 0, 0) },
    ]);
    const refused = play(sim, [{ kind: VERB_LAY_MINE, payload: layMinePayload(CARRIER) }]);
    expect(refused.events.find((event) => event.kind === EVENT_CRAFT)?.a).toBe(CR.noMines);
  });
});

describe('boarding and hit-and-run', () => {
  function pair(gap: number): Sim {
    const sim = boot([ship({ systems: { sensors: 2, bridge: 1, extraDamage: 1 } }), ship()]);
    play(sim, [
      { kind: VERB_SPAWN, payload: spawn(0, 0, 0, 0) },
      { kind: VERB_SPAWN, payload: spawn(1, gap, 0, 0) },
      { kind: VERB_SET_SIDE, payload: setSidePayload(CARRIER, 0) },
      { kind: VERB_SET_SIDE, payload: setSidePayload(ENEMY, 1) },
      { kind: VERB_SET_STORES, payload: setStoresPayload(CARRIER, 0, 2, 0) },
      { kind: VERB_SET_STORES, payload: setStoresPayload(ENEMY, 0, 2, 0) },
    ]);
    return sim;
  }

  it('does not draw when the target is out of range', () => {
    const quiet = pair(3);
    const loud = pair(3);
    const before = quiet.snapshot().rng;
    play(loud, [{ kind: VERB_RAID, payload: raidPayload(CARRIER, ENEMY, 0, 1) }]);
    play(quiet);
    expect(loud.snapshot().rng).toEqual(before);
    expect(quiet.snapshot().rng).toEqual(before);
    expect(craftReadout(loud.snapshot().world, 0).boarding).toBe(2);
    expect(play(loud, [{ kind: VERB_RAID, payload: raidPayload(CARRIER, ENEMY, 0, 1) }]).events.find((event) => event.kind === EVENT_CRAFT)?.a).toBe(CR.outOfRange);
  });

  it('spends boarding parties either way and repeats on the same seed', () => {
    const run = () => {
      const sim = pair(0);
      const raid = play(sim, [{ kind: VERB_RAID, payload: raidPayload(CARRIER, ENEMY, 1, 1) }]);
      return {
        hash: sim.stateHash(),
        reason: raid.events.find((event) => event.kind === EVENT_CRAFT)?.a,
        parties: craftReadout(sim.snapshot().world, 0).boarding,
        sensors: shipView(sim.snapshot().world, 1).systems.sensors,
      };
    };
    const first = run();
    const second = run();
    expect(second).toEqual(first);
    expect(first.parties).toBe(1);
    expect(first.reason === CR.ok || first.reason === CR.boardingRepulsed).toBe(true);
  });

  it('keeps hit-and-run parties aboard', () => {
    const run = () => {
      const sim = pair(0);
      const raid = play(sim, [{ kind: VERB_RAID, payload: raidPayload(CARRIER, ENEMY, 0, 1) }]);
      return {
        hash: sim.stateHash(),
        reason: raid.events.find((event) => event.kind === EVENT_CRAFT)?.a,
        parties: craftReadout(sim.snapshot().world, 0).boarding,
      };
    };
    const first = run();
    expect(run()).toEqual(first);
    expect(first.parties).toBe(2);
    expect(first.reason === CR.ok || first.reason === CR.raidRepulsed).toBe(true);
  });

  it('rejects a raid with no parties before any die', () => {
    const sim = pair(0);
    play(sim, [{ kind: VERB_SET_STORES, payload: setStoresPayload(CARRIER, 0, 0, 0) }]);
    const rng = sim.snapshot().rng;
    const refused = play(sim, [{ kind: VERB_RAID, payload: raidPayload(CARRIER, ENEMY, 1, 1) }]);
    expect(refused.events.find((event) => event.kind === EVENT_CRAFT)?.a).toBe(CR.noParties);
    expect(sim.snapshot().rng).toEqual(rng);
  });
});

describe('small-craft determinism', () => {
  it('hashes the same script twice', () => {
    const run = () => {
      const sim = boot([ship(), ship(), pf()]);
      const hashes: number[] = [];
      const script: Issued[][] = [
        [
          { kind: VERB_SPAWN, payload: spawn(0, 0, 0, 0) },
          { kind: VERB_SPAWN, payload: spawn(1, 6, 0, 32768) },
          { kind: VERB_SET_SIDE, payload: setSidePayload(CARRIER, 0) },
          { kind: VERB_SET_SIDE, payload: setSidePayload(ENEMY, 1) },
          { kind: VERB_SET_BAY, payload: setBayPayload(CARRIER, 0, 1, 0, 2) },
          { kind: VERB_SET_BAY, payload: setBayPayload(CARRIER, 1, 2, 2, 1) },
          { kind: VERB_SET_STORES, payload: setStoresPayload(CARRIER, 1, 2, 0) },
          { kind: VERB_SET_STORES, payload: setStoresPayload(ENEMY, 0, 1, 1) },
        ],
        [
          { kind: VERB_LAUNCH_FIGHTER, payload: launchFighterPayload(CARRIER, 0) },
          { kind: VERB_LAY_MINE, payload: layMinePayload(CARRIER) },
        ],
        [],
        [{ kind: VERB_LAUNCH_PF, payload: launchPfPayload(CARRIER, 1) }],
        [],
        [{ kind: VERB_RAID, payload: raidPayload(CARRIER, ENEMY, 0, 1) }],
      ];
      for (const beat of script) hashes.push(play(sim, beat).hash);
      steps(sim, 6);
      hashes.push(sim.stateHash());
      return hashes;
    };
    expect(run()).toEqual(run());
  });
});

function spawn(setup: number, x: number, y: number, heading: number): Uint8Array {
  const out = new Uint8Array(16);
  const words = [setup, x, y, heading];
  for (let i = 0; i < words.length; i++) {
    const value = words[i]! >>> 0;
    out[i * 4] = value & 0xff;
    out[i * 4 + 1] = (value >>> 8) & 0xff;
    out[i * 4 + 2] = (value >>> 16) & 0xff;
    out[i * 4 + 3] = (value >>> 24) & 0xff;
  }
  return out;
}

function position(sim: Sim, index: number): { x: number; y: number } {
  const snap = sim.snapshot().world;
  for (const table of snap.tables) {
    if (table.id !== 'position') continue;
    return { x: table.data[index * 2] ?? 0, y: table.data[index * 2 + 1] ?? 0 };
  }
  return { x: 0, y: 0 };
}
