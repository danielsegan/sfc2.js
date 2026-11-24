/**
 * Map a display frame onto cue ids. This reads the view. It does not
 * write the sim. Cue names are ours. Matching against the player's
 * sound index lives in board.ts.
 */
import type { HudEvent } from '../view/view-model.ts';

export const CUE_IDS = [
  'weapon.fire.phaser',
  'weapon.fire.photon',
  'weapon.fire.projectile',
  'impact.shield',
  'impact.hull',
  'shield.down',
  'shield.raise',
  'alert.red',
  'alert.yellow',
  'ui.click',
] as const;

export type CueId = (typeof CUE_IDS)[number];

export type CueCategory = 'effects' | 'alerts' | 'ui';

export const CUE_CATEGORY: Record<CueId, CueCategory> = {
  'weapon.fire.phaser': 'effects',
  'weapon.fire.photon': 'effects',
  'weapon.fire.projectile': 'effects',
  'impact.shield': 'effects',
  'impact.hull': 'effects',
  'shield.down': 'alerts',
  'shield.raise': 'effects',
  'alert.red': 'alerts',
  'alert.yellow': 'alerts',
  'ui.click': 'ui',
};

export interface CueWeapon {
  readonly slotIndex: number;
  readonly family: string;
  readonly ready: boolean;
}

export interface CueShield {
  readonly current: number;
}

export interface AudioFrame {
  readonly events: readonly HudEvent[];
  readonly weapons: readonly CueWeapon[];
  readonly shields: readonly CueShield[];
  readonly shotIds: readonly number[];
  /** When set, a hit on this ship uses `shields` to choose hull versus shield. */
  readonly selfId?: number;
}

export interface AudioMemory {
  readonly ready: readonly number[];
  readonly shotIds: readonly number[];
}

export function emptyAudioMemory(): AudioMemory {
  return { ready: [], shotIds: [] };
}

export function cuesForFrame(frame: AudioFrame, memory: AudioMemory): { cues: CueId[]; memory: AudioMemory } {
  const cues: CueId[] = [];
  const readyNow = frame.weapons.filter((weapon) => weapon.ready).map((weapon) => weapon.slotIndex);
  const wasReady = new Set(memory.ready);
  const transitioned = frame.weapons.filter((weapon) => wasReady.has(weapon.slotIndex) && !weapon.ready);
  const seenShots = new Set(memory.shotIds);
  const newShots = frame.shotIds.filter((id) => !seenShots.has(id));
  const hit = frame.events.some((event) => event.kind === 'hit');

  if (newShots.length > 0) {
    cues.push(transitioned.some((weapon) => weapon.family === 'photon') ? 'weapon.fire.photon' : 'weapon.fire.projectile');
  } else if (hit && transitioned.some((weapon) => weapon.family === 'phaser')) {
    cues.push('weapon.fire.phaser');
  } else if (hit && transitioned.length > 0) {
    cues.push('weapon.fire.projectile');
  }

  let shieldDown = false;
  let red = false;
  let yellow = false;
  for (const event of frame.events) {
    if (event.kind === 'hit') {
      const own = frame.selfId !== undefined && event.ship === frame.selfId;
      const facing = own ? frame.shields[event.facing] : undefined;
      const down = own && facing !== undefined && facing.current <= 0;
      cues.push(down ? 'impact.hull' : 'impact.shield');
      if (down) shieldDown = true;
    } else if (event.kind === 'alert' && event.id === 'shieldDepleted') {
      shieldDown = true;
    } else if (event.kind === 'alert' && event.severity === 'crit') {
      red = true;
    } else if (event.kind === 'alert' && event.id === 'overDraw') {
      yellow = true;
    }
  }
  if (shieldDown) cues.push('shield.down');
  if (red) cues.push('alert.red');
  if (yellow) cues.push('alert.yellow');

  return {
    cues,
    memory: { ready: readyNow, shotIds: frame.shotIds.slice() },
  };
}
