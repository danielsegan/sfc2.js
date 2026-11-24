import { describe, expect, it } from 'vitest';
import { readU32 } from '../core/bytes.ts';
import { TURN_H, TURN_TEST_C, turnYawCap } from '../sim/rules-tables.ts';
import { syntheticSetups, SYNTHETIC_SPAWNS } from './fixture.ts';
import {
  HEADING_HOLD,
  HEADING_ORDER,
  HEADING_STEER,
  VERB_ORDER_HEADING,
  headingPayload,
} from '../sim/heading.ts';
import { createDuelMatch, createSyntheticDuel } from './match.ts';

const TICK = 1000 / 30;
const CAP = turnYawCap(TURN_TEST_C);

function boot() {
  return createSyntheticDuel({
    rulesTurnTicks: 4,
    renew: false,
    timeScale: 1,
    plan: { speed: 0, lifeSupport: true, fireControl: false, general: 0, weaponRequest: 0 },
  });
}

function step(match: ReturnType<typeof boot>, frames = 1): void {
  for (let i = 0; i < frames; i++) match.frame(TICK);
}

describe('heading order', () => {
  it('stores the heading in the payload and leaves the tick on the session', () => {
    const match = boot();
    step(match);
    match.orderHeading(10000);
    const queued = match.session.commandsFor(match.tick + 1);
    const order = queued.find((cmd) => cmd.kind === VERB_ORDER_HEADING);
    expect(order?.tick).toBe(match.tick + 1);
    expect(order?.payload.length).toBe(8);
    if (!order) throw new Error('heading was not queued');
    expect(readU32(order.payload, 0)).toBe(match.selfId);
    expect(readU32(order.payload, 4)).toBe(10000);
    expect(headingPayload(match.selfId ?? 0, 10000)).toEqual(order.payload);
  });

  it('turns toward the ordered heading at the turn cap, then holds', () => {
    const match = boot();
    step(match);
    const target = CAP * 3 + 500;
    match.orderHeading(target);
    step(match);
    expect(match.view().self?.heading16).toBe(CAP);
    expect(match.view().self?.orderedHeading16).toBe(target);
    step(match);
    expect(match.view().self?.heading16).toBe(CAP * 2);
    step(match);
    expect(match.view().self?.heading16).toBe(CAP * 3);
    step(match);
    expect(match.view().self?.heading16).toBe(target);
    step(match, 2);
    expect(match.view().self?.heading16).toBe(target);
    expect(match.view().self?.orderedHeading16).toBe(target);
  });

  it('takes the short way around, including the half-turn tie', () => {
    const match = boot();
    step(match);
    match.orderHeading(50000);
    step(match);
    expect(match.view().self?.heading16).toBe((65536 - CAP) & 0xffff);
    const half = boot();
    step(half);
    half.orderHeading(32768);
    step(half);
    expect(half.view().self?.heading16).toBe((65536 - CAP) & 0xffff);
  });

  it('lets a yaw key replace the mouse order and then hold', () => {
    const match = boot();
    step(match);
    match.orderHeading(CAP * 4);
    step(match, 2);
    expect(match.view().self?.heading16).toBe(CAP * 2);
    match.orderYaw(CAP);
    step(match);
    const held = match.view().self?.heading16;
    expect(held).toBe(CAP * 3);
    step(match, 3);
    expect(match.view().self?.heading16).toBe(held);
    expect(match.view().self?.orderedHeading16).toBe(held);
  });

  it('refuses an immobile hull without turning it', () => {
    const player = syntheticSetups()[0]!;
    const opponent = syntheticSetups()[1]!;
    const match = createDuelMatch({
      seed: 1,
      setups: [{ ...player, turnMode: TURN_H }, opponent],
      spawns: SYNTHETIC_SPAWNS,
      rulesTurnTicks: 2,
      renew: false,
      timeScale: 1,
      plan: { speed: 0, lifeSupport: true, fireControl: false, general: 0, weaponRequest: 0 },
    });
    step(match);
    match.orderHeading(8000);
    step(match);
    const vm = match.view();
    expect(vm.self?.heading16).toBe(0);
    expect(vm.self?.orderedHeading16).toBeNull();
    expect(vm.events.some((event) => event.kind === 'alert' && event.id === 'immobile')).toBe(true);
  });

  it('uses the steer and hold markers', () => {
    expect(HEADING_STEER).not.toBe(HEADING_HOLD);
    expect(HEADING_ORDER).toBe('headingOrder');
  });

  it('replaces the stored heading and does not follow a ship', () => {
    const match = boot();
    step(match);
    match.orderHeading(6000);
    step(match);
    expect(match.view().self?.orderedHeading16).toBe(6000);
    match.orderHeading(12000);
    step(match);
    expect(match.view().self?.orderedHeading16).toBe(12000);
    expect(match.view().self?.heading16).toBe(CAP * 2);
  });
});
