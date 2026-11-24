import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERB_FIRE, firePayload } from '../sim/combat.ts';
import { FALLBACK_YAW_PER_TICK, TURN_H, TURN_TEST_A, TURN_TEST_C, TURN_UNVERIFIED } from '../sim/rules-tables.ts';
import { syntheticSetups, SYNTHETIC_SPAWNS } from './fixture.ts';
import { turnYawCap } from './helm.ts';
import { createDuelMatch, createSyntheticDuel } from './match.ts';

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
      fallbackMaxYawPerTick: number;
    };
    expect(turnYawCap(TURN_TEST_A)).toBe(table.modes['TEST-A']?.maxYawPerTick);
    expect(turnYawCap(TURN_TEST_C)).toBe(table.modes['TEST-C']?.maxYawPerTick);
    expect(turnYawCap(TURN_H)).toBe(table.modes.H?.maxYawPerTick);
    expect(turnYawCap(TURN_UNVERIFIED)).toBe(table.fallbackMaxYawPerTick);
    expect(FALLBACK_YAW_PER_TICK).toBe(table.fallbackMaxYawPerTick);
    expect(turnYawCap(99)).toBe(FALLBACK_YAW_PER_TICK);
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

  it('keeps an unverified turn mode moving and warns once', () => {
    const player = syntheticSetups()[0]!;
    const opponent = syntheticSetups()[1]!;
    const match = createDuelMatch({
      seed: 1,
      setups: [{ ...player, turnMode: TURN_UNVERIFIED }, opponent],
      spawns: SYNTHETIC_SPAWNS,
      rulesTurnTicks: 2,
      renew: true,
      timeScale: 1,
      plan: { speed: 4, lifeSupport: true, fireControl: false, general: 0, weaponRequest: 0 },
    });
    let warnings = 0;
    for (let i = 0; i < 8; i++) {
      match.frame(TICK);
      const vm = match.view();
      warnings += vm.events.filter((event) => event.kind === 'alert' && event.id === 'turnModeUnverified').length;
    }
    expect(warnings).toBe(1);
    expect(match.view().self?.speed).toBe(4);
    match.orderYaw(9000);
    match.frame(TICK);
    const turned = match.view();
    expect(turned.self?.heading16).toBe(FALLBACK_YAW_PER_TICK);
    expect(turned.events.some((event) => event.kind === 'alert' && event.id === 'turnModeUnverified')).toBe(false);
    expect(turned.events.some((event) => event.kind === 'alert' && event.id === 'yawClamped')).toBe(true);
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

  it('launches a fighter from the synthetic bay', () => {
    const match = boot({ plan: { speed: 0, lifeSupport: false, fireControl: false, general: 0, weaponRequest: 0 } });
    match.frame(TICK);
    expect(match.view().self?.craft.fighterReady).toBe(4);
    match.launchFighter();
    match.frame(TICK);
    const vm = match.view();
    expect(vm.self?.craft.fighterReady).toBe(3);
    expect(vm.contacts.some((contact) => contact.kind === 'fighter' && contact.hostility === 'friendly')).toBe(true);
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

  it('keeps facing reinforcement on the plan until the next step', () => {
    const match = boot();
    match.frame(TICK);
    match.view();
    const before = match.stateHash();
    match.setFacing(0, 3);
    expect(match.plan.specific).toEqual([3, 0, 0, 0, 0, 0]);
    expect(match.stateHash()).toBe(before);
  });

  it('sends EW, overload, tractor, and cloak through the duel commands', () => {
    const match = boot({
      plan: { speed: 0, lifeSupport: false, fireControl: true, general: 0, weaponRequest: null },
    });
    match.frame(TICK);
    match.setEw(2, 1);
    match.frame(TICK);
    expect(match.view().self?.ecm).toBe(2);
    expect(match.view().self?.eccm).toBe(1);
    expect(match.view().self?.netShift).toBe(1);
    match.toggleOverload(1);
    match.frame(TICK);
    const photon = match.view().self?.weapons.find((weapon) => weapon.slotIndex === 1);
    expect(photon?.mode).toBe(1);
    expect(photon?.status).toBe('overload arming');
    match.setTractor(1, 2);
    match.frame(TICK);
    const tractored = match.view();
    expect(tractored.self?.tractorLink).toBe(false);
    expect(tractored.events.some((event) => event.kind === 'alert' && event.id === 'outOfRange')).toBe(true);
    match.setCloak(true);
    match.frame(TICK);
    expect(match.view().self?.cloakState).toBe(1);
    expect(match.view().self?.cloakFitted).toBe(true);
  });
});
