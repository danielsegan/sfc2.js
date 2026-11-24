/**
 * Synthetic fighter table for the duel. The text is invented.
 * parseFtrlist reads it; bindFtrlist keeps the integer row the sim launches.
 */
import { parseFtrlist } from '../../tools/formats/ftrlist.ts';
import { bindFtrlist, type FighterType } from '../sim/smallcraft.ts';
import { SYNTHETIC_PF_SETUP } from './fixture.ts';

export const SYNTHETIC_FIGHTER_LIST = [
  'Race\tType\tSpeed\tNum\tWeapon1\tArc\tShots\tDamage',
  'test-empire\ttest-ftr\t30\t1\tPh3\tFH\t2\t3',
].join('\n');

export interface CraftLoadout {
  readonly sides: readonly number[];
  readonly bays: readonly { spawn: number; bay: number; kind: number; type: number; count: number }[];
  readonly stores: readonly { spawn: number; mines: number; boarding: number; security: number }[];
}

export function syntheticFighters(): FighterType[] {
  const parsed = parseFtrlist(SYNTHETIC_FIGHTER_LIST);
  for (const item of parsed.diagnostics) {
    if (item.severity === 'error') throw new Error(item.code);
  }
  const fighters = bindFtrlist(parsed.data);
  if (fighters.length !== 1) throw new Error('synthetic fighter');
  return fighters;
}

/** First generation, spawn order. Index 0 is entity 65536. */
export const SYNTHETIC_LOADOUT: CraftLoadout = {
  sides: [0, 1],
  bays: [
    { spawn: 0, bay: 0, kind: 1, type: 0, count: 4 },
    { spawn: 0, bay: 1, kind: 2, type: SYNTHETIC_PF_SETUP, count: 2 },
  ],
  stores: [
    { spawn: 0, mines: 4, boarding: 3, security: 1 },
    { spawn: 1, mines: 1, boarding: 2, security: 1 },
  ],
};
