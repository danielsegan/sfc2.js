import { describe, expect, it } from 'vitest';
import { resolveShiplistAssignments, isDefaultDuelSetup, type SlotSnapshot, type ShiplistOption } from './skirmish-ui.ts';

const options: ShiplistOption[] = [
  { index: 0, empire: 'Federation', label: 'F-CA (CA)' },
  { index: 1, empire: 'Klingon', label: 'K-D7 (D7)' },
  { index: 2, empire: 'Romulan', label: 'R-KR (KR)' },
  { index: 3, empire: 'Gorn', label: 'G-BCH (BCH)' },
  { index: 4, empire: 'Lyran', label: 'L-CA (CA)' },
  { index: 5, empire: 'Hydran', label: 'H-DG (DG)' },
];

const empty = (side: string): SlotSnapshot => ({ control: 'empty', side, empire: '', ship: '' });

const defaultSynthetic: SlotSnapshot[] = [
  { control: 'you', side: '0', empire: 'federation', ship: 'cruiser' },
  { control: 'ai', side: '1', empire: 'klingon', ship: 'cruiser' },
  empty('0'),
  empty('1'),
  empty('0'),
  empty('1'),
];

describe('skirmish setup bind', () => {
  it('treats the stock synthetic duel as the default board', () => {
    expect(isDefaultDuelSetup('synthetic', defaultSynthetic)).toBe(true);
    const six = defaultSynthetic.map((slot, index) =>
      index === 2 ? { control: 'ai', side: '0', empire: 'romulan', ship: 'cruiser' } : slot,
    );
    expect(isDefaultDuelSetup('synthetic', six)).toBe(false);
  });

  it('keeps a custom synthetic fleet when a catalog arrives without reset', () => {
    const previous: SlotSnapshot[] = [
      { control: 'you', side: '0', empire: 'klingon', ship: 'cruiser' },
      { control: 'ai', side: '1', empire: 'federation', ship: 'cruiser' },
      { control: 'ai', side: '1', empire: 'romulan', ship: 'cruiser' },
      { control: 'ai', side: '1', empire: 'gorn', ship: 'cruiser' },
      { control: 'ai', side: '1', empire: 'lyran', ship: 'frigate' },
      { control: 'ai', side: '1', empire: 'hydran', ship: 'cruiser' },
    ];
    const resolved = resolveShiplistAssignments(previous, 'synthetic', options, 0, 1, false);
    expect(resolved.catalogOnly).toBe(true);
    expect(resolved.mode).toBe('synthetic');
    expect(resolved.slots.filter((slot) => slot.control !== 'empty')).toHaveLength(6);
  });

  it('preserves occupied shiplist slots 2–6 across a catalog refresh', () => {
    const previous: SlotSnapshot[] = [
      { control: 'you', side: '0', empire: 'Klingon', ship: '1' },
      { control: 'ai', side: '1', empire: 'Federation', ship: '0' },
      { control: 'ai', side: '1', empire: 'Romulan', ship: '2' },
      { control: 'ai', side: '1', empire: 'Gorn', ship: '3' },
      { control: 'ai', side: '1', empire: 'Lyran', ship: '4' },
      { control: 'ai', side: '1', empire: 'Hydran', ship: '5' },
    ];
    const resolved = resolveShiplistAssignments(previous, 'shiplist', options, 0, 1, false);
    expect(resolved.catalogOnly).toBe(false);
    expect(resolved.mode).toBe('shiplist');
    expect(resolved.slots.map((slot) => slot.ship)).toEqual(['1', '0', '2', '3', '4', '5']);
    expect(resolved.slots[0]?.control).toBe('you');
  });

  it('resets to the default player and opponent pair when asked', () => {
    const previous: SlotSnapshot[] = [
      { control: 'you', side: '0', empire: 'Klingon', ship: '1' },
      { control: 'ai', side: '1', empire: 'Romulan', ship: '2' },
      { control: 'ai', side: '1', empire: 'Hydran', ship: '5' },
      empty('1'),
      empty('0'),
      empty('1'),
    ];
    const resolved = resolveShiplistAssignments(previous, 'shiplist', options, 0, 1, true);
    expect(resolved.slots[0]).toMatchObject({ control: 'you', ship: '0' });
    expect(resolved.slots[1]).toMatchObject({ control: 'ai', ship: '1' });
    expect(resolved.slots.slice(2).every((slot) => slot.control === 'empty')).toBe(true);
  });
});
