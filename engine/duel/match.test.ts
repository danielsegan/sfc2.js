import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERB_FIRE, firePayload } from '../sim/combat.ts';
import { TURN_H, TURN_TEST_A, TURN_TEST_C } from '../sim/rules-tables.ts';
import { turnYawCap } from './helm.ts';
import { createSyntheticDuel } from './match.ts';

const TICK = 1000 / 30;

function boot(overrides: Parameters<typeof createSyntheticDuel>[0] = {}) {
  return createSyntheticDuel({
    rulesTurnTicks: 4,
    renew: false,
    timeScale: 1,
    ...overrides,
  });
}

describe('duel match', () => {
  it('keeps the yaw caps on the synthetic turn-mode table', () => {
    const table = JSON.parse(readFileSync('docs/rules/data/turn-modes.json', 'utf8')) as {
      modes: Record<string, { maxYawPerTick: number }>;
    };
    expect(turnYawCap(TURN_TEST_A)).toBe(table.modes['TEST-A']?.maxYawPerTick);
    expect(turnYawCap(TURN_TEST_C)).toBe(table.modes['TEST-C']?.maxYawPerTick);
    expect(turnYawCap(TURN_H)).toBe(table.modes.H?.maxYawPerTick);
    expect(turnYawCap(4)).toBe(-1);
  });

  it('does not let the view change the sim hash', () => {
    const watched = boot();
    const headless = boot();
    for (let i = 0; i < 6; i++) {
      watched.frame(TICK);
      headless.frame(TICK);
      const before = watched.stateHash();
      watched.view();
      expect(watched.stateHash()).toBe(before);
    }
    expect(watched.stateHash()).toBe(headless.stateHash());
    expect(watched.tick).toBe(headless.tick);
  });

  it('moves on the stored speed and blends only the pose', () => {
    const match = boot({ plan: { speed: 4, lifeSupport: true, fireControl: true, general: 0, weaponRequest: null } });
    match.frame(TICK);
    match.frame(TICK);
    match.frame(TICK / 2);
    const vm = match.view();
    const self = vm.contacts.find((contact) => contact.hostility === 'self');
    expect(self).toBeDefined();
    expect(self?.x).toBeCloseTo(-7.5, 4);
    expect(vm.self?.speed).toBe(4);
    expect(vm.self?.shields[0]?.current).toBe(12);
    expect(vm.self?.energy.fireControl).toBe(true);
    expect(vm.tick).toBe(2);
  });

  it('clamps helm to the turn mode and stamps the tick on the session', () => {
    const match = boot({ plan: { speed: 0, lifeSupport: true, fireControl: false, general: 0, weaponRequest: 0 } });
    match.frame(TICK);
    expect(match.selfId).toBe(65536);
    match.orderYaw(5000);
    const queued = match.session.commandsFor(match.tick + 1);
    const helm = queued.find((cmd) => cmd.kind === 6);
    expect(helm?.tick).toBe(match.tick + 1);
    expect(helm?.payload.length).toBe(8);
    match.frame(TICK);
    const vm = match.view();
    expect(vm.self?.heading16).toBe(2000);
    expect(vm.events.some((event) => event.kind === 'alert' && event.id === 'yawClamped' && event.amount === 2000)).toBe(true);
  });

  it('fires through the combat verb once the mount is charged', () => {
    const match = boot({ plan: { speed: 0, lifeSupport: true, fireControl: true, general: 0, weaponRequest: 4 } });
    match.frame(TICK);
    match.issue(VERB_FIRE, firePayload(match.selfId ?? 0, 0, match.targetId ?? 0));
    const early = match.session.commandsFor(match.tick + 1).find((cmd) => cmd.kind === VERB_FIRE);
    expect(early?.payload.length).toBe(12);
    if (!early) throw new Error('fire was not queued');
    expect(new DataView(early.payload.buffer, early.payload.byteOffset, early.payload.byteLength).getUint32(0, true)).toBe(match.selfId);
    match.frame(TICK);
    expect(match.view().events.some((event) => event.kind === 'alert' && event.id === 'notCharged')).toBe(true);
    for (let i = 0; i < 4; i++) match.frame(TICK);
    expect(match.view().self?.weapons[0]?.ready).toBe(true);
    match.orderFire(0);
    match.frame(TICK);
    const vm = match.view();
    expect(vm.events.some((event) => event.kind === 'hit')).toBe(true);
    const target = vm.contacts.find((contact) => contact.hostility === 'hostile');
    expect(target?.shields[0]?.current).toBe(11);
  });
});
