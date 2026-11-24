import { describe, expect, it } from 'vitest';
import type { DuelMatch } from '../../engine/duel/match.ts';
import { runAction, type CommandHost } from './commands.ts';

function hostRecordingHet(): { host: CommandHost; dirs: Array<-1 | 1> } {
  const dirs: Array<-1 | 1> = [];
  const match = {
    orderHet(dir: -1 | 1) {
      dirs.push(dir);
    },
  } as unknown as DuelMatch;
  const host: CommandHost = {
    match,
    scene: {} as CommandHost['scene'],
    note() {},
    togglePause() {},
    getSlot: () => 0,
    setSlot() {},
    groups: [],
    group: 0,
    setGroup() {},
    setMapZoom() {},
    mapZoom: 8,
    headingUp: false,
    setHeadingUp() {},
    mapFull: false,
    setMapFull() {},
    view: () => null,
  };
  return { host, dirs };
}

describe('HET command path', () => {
  it('sends orderHet port and starboard through the match, never a raw dir other than -1 or +1', () => {
    const { host, dirs } = hostRecordingHet();
    runAction(host, 'helm.hetPort');
    runAction(host, 'helm.hetStarboard');
    expect(dirs).toEqual([-1, 1]);
  });

  it('ignores unknown helm actions rather than inventing a HET dir', () => {
    const { host, dirs } = hostRecordingHet();
    runAction(host, 'helm.het');
    runAction(host, 'helm.hetForward');
    expect(dirs).toEqual([]);
  });
});
