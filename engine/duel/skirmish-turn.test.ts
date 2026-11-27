/**
 * The playable skirmish names a measured turn curve. A known class uses
 * that row. An unknown class uses `default`, not the letter cap.
 */
import { describe, expect, it } from 'vitest';
import { parseShiplist } from '../../tools/formats/shiplist.ts';
import { command } from '../core/codec.ts';
import { bindShiplistRow, type ShipSetup } from '../sim/bind-shiplist.ts';
import { VERB_SPAWN, createCombat, spawnPayload } from '../sim/combat.ts';
import { createSim } from '../sim/sim.ts';
import { FALLBACK_YAW_PER_TICK, TURN_TEST_C, turnYawCap } from '../sim/rules-tables.ts';
import {
  NORMAL_CURVE,
  TC,
  TURN_CURVE,
  TURN_CURVE_TABLE,
  curveId,
  curvePoint,
} from '../sim/turn-curve.ts';
import { syntheticSetup } from './catalog.ts';
import { syntheticSetups } from './fixture.ts';
import { createFleetMatch, type DuelMatch } from './match.ts';

const TICK = 1000 / 30;
const SPEED = 15;

function row(className: string, turnMode: string): ShipSetup {
  const text = [
    'Race\tHull Type\tClass\tTurn Mode\tMove Cost\tShield 1\tShield 2\tShield 3\tShield 4\tAcceleration',
    `Federation\tCA\t${className}\t${turnMode}\t1\t10\t8\t6\t4\t4`,
  ].join('\n');
  const parsed = parseShiplist(text, { file: 'Assets/Specs/shiplist.txt' });
  const ship = bindShiplistRow(parsed.data.rows[0]!, parsed.data.columns);
  return { ...ship, speed: SPEED };
}

function atSpeed(setup: ShipSetup): ShipSetup {
  return { ...setup, speed: SPEED };
}

function skirmish(setup: ShipSetup): DuelMatch {
  return createFleetMatch({
    seed: 1,
    setups: [atSpeed(setup)],
    fleet: [{ setupIndex: 0, x: 0, y: 0, heading: 0, side: 0, control: 'manual' }],
    opening: false,
    renew: false,
    timeScale: 1,
    rulesTurnTicks: 30,
    plan: { speed: SPEED, lifeSupport: false, fireControl: false, general: 0, weaponRequest: 0 },
  });
}

function curveFields(setup: ShipSetup): number[] {
  const combat = createCombat([atSpeed(setup)], { rulesTurnTicks: 30 });
  const sim = createSim({
    seed: 1,
    tables: [...combat.tables, TURN_CURVE_TABLE],
    systems: combat.systems,
    handlers: combat.handlers,
  });
  sim.step([command(1, 0, 0, VERB_SPAWN, spawnPayload(0, 0, 0, 0))]);
  const table = sim.snapshot().world.tables.find((item) => item.id === TURN_CURVE);
  if (!table) throw new Error('curve table');
  return [table.data[0] ?? 0, table.data[1] ?? 0, table.data[2] ?? 0, table.data[3] ?? 0];
}

/** Frames after the heading is queued until the bow first moves. Includes the order frame. */
function framesUntilTurn(setup: ShipSetup): { frames: number; step: number } {
  const match = skirmish(setup);
  match.frame(TICK);
  match.orderHeading(30000);
  for (let frames = 1; frames <= 80; frames++) {
    match.frame(TICK);
    const heading = match.view().self?.heading16 ?? 0;
    if (heading !== 0) return { frames, step: heading };
  }
  return { frames: -1, step: 0 };
}

function helmStep(setup: ShipSetup): number {
  const match = skirmish(setup);
  match.frame(TICK);
  expect(match.view().self?.turnRateLimit16PerTick).toBe(
    curvePoint(NORMAL_CURVE, curveId(NORMAL_CURVE, setup.turnHull ?? 'default'), SPEED * 100).rate,
  );
  match.orderYaw(8000);
  match.frame(TICK);
  return match.view().self?.heading16 ?? -1;
}

describe('skirmish turn curves', () => {
  it('points the no-files cruiser and D7 at F-CA and K-D7', () => {
    expect(syntheticSetup('cruiser').turnHull).toBe('F-CA');
    expect(syntheticSetup('frigate').turnHull).toBe('K-D7');
    expect(syntheticSetups()[0]?.turnHull).toBe('F-CA');
    expect(syntheticSetups()[1]?.turnHull).toBe('K-D7');
    expect(syntheticSetups()[2]?.turnHull).toBeUndefined();
    expect(turnYawCap(TURN_TEST_C)).toBe(2000);
    expect(FALLBACK_YAW_PER_TICK).toBe(curvePoint(NORMAL_CURVE, NORMAL_CURVE.defaultId, SPEED * 100).rate);
  });

  it('turns a known hull at the measured speed-15 rate', () => {
    const fca = curvePoint(NORMAL_CURVE, curveId(NORMAL_CURVE, 'F-CA'), SPEED * 100);
    const d7 = curvePoint(NORMAL_CURVE, curveId(NORMAL_CURVE, 'K-D7'), SPEED * 100);
    expect(fca.rate).toBe(46);
    expect(d7.rate).toBe(51);

    const cruiser = syntheticSetup('cruiser');
    const cruiserRow = curveFields(cruiser);
    expect(cruiserRow[TC.enabled]).toBe(1);
    expect(cruiserRow[TC.normal]).toBe(curveId(NORMAL_CURVE, 'F-CA'));
    expect(helmStep(cruiser)).toBe(fca.rate);

    const installed = row('F-CA', 'C');
    expect(installed.turnHull).toBe('F-CA');
    const installedRow = curveFields(installed);
    expect(installedRow[TC.enabled]).toBe(1);
    expect(installedRow[TC.normal]).toBe(curveId(NORMAL_CURVE, 'F-CA'));
    const turned = framesUntilTurn(installed);
    expect(turned.frames).toBe(fca.delay + 1);
    expect(turned.step).toBe(fca.rate);

    const folded = row('f-ca', 'C');
    expect(folded.turnHull).toBe('F-CA');
    expect(curveFields(folded)[TC.normal]).toBe(curveId(NORMAL_CURVE, 'F-CA'));

    const klingon = syntheticSetup('frigate');
    expect(curveFields(klingon)[TC.normal]).toBe(curveId(NORMAL_CURVE, 'K-D7'));
    expect(helmStep(klingon)).toBe(d7.rate);
    expect(d7.rate).not.toBe(FALLBACK_YAW_PER_TICK);
  });

  it('gives an unknown hull the default curve', () => {
    const ship = row('NO-SUCH', 'C');
    expect(ship.turnHull).toBe('default');
    const fields = curveFields(ship);
    expect(fields[TC.enabled]).toBe(1);
    expect(fields[TC.normal]).toBe(NORMAL_CURVE.defaultId);
    const point = curvePoint(NORMAL_CURVE, NORMAL_CURVE.defaultId, SPEED * 100);
    const turned = framesUntilTurn(ship);
    expect(turned.frames).toBe(point.delay + 1);
    expect(turned.step).toBe(point.rate);
    const known = curvePoint(NORMAL_CURVE, curveId(NORMAL_CURVE, 'F-CA'), SPEED * 100);
    expect(point.delay).not.toBe(known.delay);
  });
});
