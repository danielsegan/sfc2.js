import { describe, expect, it } from 'vitest';
import { VERB_FIRE } from '../sim/combat.ts';
import { syntheticSetups } from './fixture.ts';
import { linePosition } from './catalog.ts';
import { createFleetMatch, FLEET_MAX, type FleetSlot } from './match.ts';

const TICK = 1000 / 30;

function slot(index: number, side: 0 | 1, control: 'manual' | 'ai', setupIndex = 0): FleetSlot {
  const count = side === 0 ? 2 : 1;
  const onSide = side === 0 ? (index === 0 ? 0 : 1) : 0;
  const at = linePosition(onSide, count, side);
  return { setupIndex, side, control, ...at };
}

describe('fleet match', () => {
  it('lays a side out on integer stations', () => {
    expect(linePosition(0, 3, 0)).toEqual({ x: -12, y: -6, heading: 0 });
    expect(linePosition(1, 3, 0)).toEqual({ x: -12, y: 0, heading: 0 });
    expect(linePosition(2, 3, 1)).toEqual({ x: 12, y: 6, heading: 32768 });
    expect(FLEET_MAX).toBe(6);
  });

  it('refuses a seventh ship', () => {
    const fleet: FleetSlot[] = [];
    for (let i = 0; i < 7; i++) {
      fleet.push({ setupIndex: 0, x: i, y: 0, heading: 0, side: i < 4 ? 0 : 1, control: 'ai' });
    }
    expect(() => createFleetMatch({ setups: syntheticSetups(), fleet })).toThrow(/fleet size/);
  });

  it('keeps allies off the fire button and cycles hostile targets', () => {
    const setups = syntheticSetups();
    const match = createFleetMatch({
      seed: 3,
      setups,
      rulesTurnTicks: 4,
      renew: false,
      timeScale: 1,
      plan: { speed: 0, lifeSupport: true, fireControl: true, general: 0, weaponRequest: 0 },
      fleet: [
        slot(0, 0, 'manual', 0),
        { ...slot(1, 0, 'ai', 1), y: 8 },
        { setupIndex: 1, x: 12, y: -8, heading: 32768, side: 1, control: 'ai' },
        { setupIndex: 0, x: 12, y: 8, heading: 32768, side: 1, control: 'ai' },
      ],
    });
    match.frame(TICK);
    const vm = match.view();
    const friend = vm.contacts.find((contact) => contact.hostility === 'friendly');
    const hostiles = vm.contacts.filter((contact) => contact.hostility === 'hostile' && contact.kind === 'ship');
    expect(friend?.side).toBe(0);
    expect(friend?.control).toBe('ai');
    expect(hostiles).toHaveLength(2);
    expect(vm.targetId).toBe(hostiles[0]?.id ?? null);
    const allyId = friend?.id ?? 0;
    match.setTarget(allyId);
    match.orderFire(0);
    expect(match.session.commandsFor(match.tick + 1).some((cmd) => cmd.kind === VERB_FIRE)).toBe(false);
    match.cycleTarget(1);
    expect(match.targetId).not.toBe(allyId);
    const first = match.targetId;
    match.cycleTarget(1);
    const second = match.targetId;
    match.cycleTarget(1);
    expect(match.targetId).toBe(first);
    expect(second).not.toBe(first);
    match.cycleTarget(-1);
    expect(match.targetId).toBe(second);
  });

  it('matches another seeded fleet and lets the captain move', () => {
    const fleet: FleetSlot[] = [
      { setupIndex: 0, x: -16, y: 0, heading: 0, side: 0, control: 'manual' },
      { setupIndex: 1, x: 16, y: 0, heading: 32768, side: 1, control: 'ai' },
    ];
    const left = createFleetMatch({
      seed: 11,
      setups: syntheticSetups(),
      fleet,
      rulesTurnTicks: 4,
      timeScale: 1,
      plan: { speed: 0, lifeSupport: true, fireControl: false, general: 0, weaponRequest: 0 },
    });
    const right = createFleetMatch({
      seed: 11,
      setups: syntheticSetups(),
      fleet,
      rulesTurnTicks: 4,
      timeScale: 1,
      plan: { speed: 0, lifeSupport: true, fireControl: false, general: 0, weaponRequest: 0 },
    });
    for (let i = 0; i < 4; i++) {
      left.frame(TICK);
      right.frame(TICK);
      const before = left.stateHash();
      left.view();
      expect(left.stateHash()).toBe(before);
      expect(left.stateHash()).toBe(right.stateHash());
    }
    const hostile = left.view().contacts.find((contact) => contact.hostility === 'hostile');
    expect(hostile?.speed).toBeGreaterThan(0);
    expect(hostile?.control).toBe('ai');
  });
});
