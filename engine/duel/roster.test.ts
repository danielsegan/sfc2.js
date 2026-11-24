import { describe, expect, it } from 'vitest';
import { parseShiplist } from '../../tools/formats/shiplist.ts';
import { candidatesFromShiplist, candidateLabel, chooseDefaultPair } from './roster.ts';

const HEADER = [
  'Race',
  'Hull Type',
  'Class',
  'Turn Mode',
  'Num',
  'Heavy Weapon 1',
  'Arc',
].join('\t');

function row(cells: readonly string[]): string {
  return cells.join('\t');
}

function choose(lines: readonly string[]) {
  const parsed = parseShiplist([HEADER, ...lines].join('\n'), { file: 'Assets/Specs/shiplist.txt' });
  const candidates = candidatesFromShiplist(parsed.data.rows, parsed.data.columns);
  return { candidates, choice: chooseDefaultPair(candidates) };
}

describe('duel roster', () => {
  it('picks a Federation CA and a Klingon D7 by race and hull, not by file order', () => {
    const { candidates, choice } = choose([
      row(['Neutral', 'CA', 'TEST-ADD', 'C', '1', 'ADD12', '1']),
      row(['Federation', 'DD', 'TEST-DD', 'C', '1', 'Ph1', 'FA']),
      row(['Federation', 'CA', 'TEST-OTHER-CA', 'C', '1', 'Ph1', 'FA']),
      row(['Klingon', 'CL', 'K-CL', 'C', '1', 'Ph1', 'FA']),
      row(['federation', 'ca', 'f-ca', 'C', '2', 'Ph1', 'FA']),
      row(['Romulan', 'CA', 'R-CA', 'C', '1', 'Phot', 'FA']),
      row(['klingon', 'CA', 'k-d7', 'C', '1', 'Phot', 'FA']),
    ]);
    expect(choice).not.toBeNull();
    if (!choice) return;
    expect(choice.source).toBe('reference');
    expect(choice.player.spawnKey).toBe('federation:f-ca');
    expect(choice.player.className).toBe('f-ca');
    expect(choice.opponent.spawnKey).toBe('klingon:k-d7');
    expect(choice.note).toContain('federation:f-ca');
    expect(choice.note).toContain('klingon:k-d7');
    expect(choice.note).toContain(`line ${String(choice.player.line)}`);
    const add = candidates.find((ship) => ship.className === 'TEST-ADD');
    expect(add?.supported).toBe(false);
    expect(candidateLabel(choice.player)).toContain('phaser or photon');
    expect(candidateLabel(add!)).toContain('no phaser or photon');
  });

  it('uses the closest Klingon cruiser when K-D7 is absent', () => {
    const { choice } = choose([
      row(['Federation', 'CA', 'F-CA', 'C', '1', 'Ph1', 'FA']),
      row(['Klingon', 'CL', 'K-CL', 'C', '1', 'Ph1', 'FA']),
      row(['Klingon', 'DN', 'K-DN', 'C', '1', 'Phot', 'FA']),
      row(['Klingon', 'CA', 'K-CA', 'C', '1', 'Ph1', 'FA']),
    ]);
    expect(choice?.source).toBe('reference');
    expect(choice?.player.className).toBe('F-CA');
    expect(choice?.opponent.className).toBe('K-CA');
  });

  it('falls back to two supported ships from different empires and names them', () => {
    const { choice } = choose([
      row(['Neutral', 'CA', 'TEST-ADD', 'C', '1', 'ADD12', '1']),
      row(['Federation', 'DD', 'TEST-DD', 'C', '1', 'Ph1', 'FA']),
      row(['Romulan', 'CA', 'R-CA', 'C', '1', 'Phot', 'FA']),
      row(['Federation', 'CL', 'TEST-CL', 'C', '1', 'Ph1', 'FA']),
    ]);
    expect(choice?.source).toBe('fallback');
    expect(choice?.player.spawnKey).toBe('Federation:TEST-DD');
    expect(choice?.opponent.spawnKey).toBe('Romulan:R-CA');
    expect(choice?.note).toContain('Fallback');
    expect(choice?.note).toContain('Federation:TEST-DD');
    expect(choice?.note).toContain('Romulan:R-CA');
  });

  it('returns nothing when two supported empires are not in the table', () => {
    const { choice } = choose([
      row(['Federation', 'CA', 'F-CA', 'C', '1', 'ADD12', '1']),
      row(['Federation', 'DD', 'TEST-DD', 'C', '1', 'Ph1', 'FA']),
    ]);
    expect(choice).toBeNull();
  });
});
