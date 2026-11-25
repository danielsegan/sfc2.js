import { describe, expect, it } from 'vitest';
import type { DuelMatch } from '../../engine/duel/match.ts';
import { MODE_NORMAL, MODE_PROXIMITY } from '../../engine/sim/rules-tables.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import { runAction, type CommandHost } from './commands.ts';

interface Recording {
  host: CommandHost;
  dirs: Array<-1 | 1>;
  fired: number[];
  modes: Array<{ slot: number; mode: number }>;
  notes: string[];
  slots: number[];
  groups: number[][];
  group: number;
  plan: { modes: number[] };
}

function hostRecording(opts?: { weapons?: Array<{ slotIndex: number; family: string }> }): Recording {
  const dirs: Array<-1 | 1> = [];
  const fired: number[] = [];
  const modes: Array<{ slot: number; mode: number }> = [];
  const notes: string[] = [];
  const slots = [0];
  const groups: number[][] = [[0], [1], [], [], [], []];
  const plan = { modes: [] as number[] };
  const weapons = opts?.weapons ?? [];
  const match = {
    plan,
    orderHet(dir: -1 | 1) {
      dirs.push(dir);
    },
    orderFire(slot: number) {
      fired.push(slot);
    },
    setWeaponMode(slot: number, mode: number) {
      plan.modes[slot] = mode;
      modes.push({ slot, mode });
    },
  } as unknown as DuelMatch;
  const host: CommandHost = {
    match,
    scene: {} as CommandHost['scene'],
    note(text) {
      notes.push(text);
    },
    togglePause() {},
    getSlot: () => slots[0] ?? 0,
    setSlot(slot) {
      slots.splice(0, slots.length, slot);
    },
    getSlots: () => slots,
    setSlots(next) {
      slots.splice(0, slots.length, ...next);
    },
    groups,
    group: 0,
    setGroup(group) {
      host.group = group;
    },
    setMapZoom() {},
    mapZoom: 8,
    headingUp: false,
    setHeadingUp() {},
    mapFull: false,
    setMapFull() {},
    interfaceCollapsed: false,
    setInterfaceCollapsed(on) {
      host.interfaceCollapsed = on;
    },
    view: () =>
      weapons.length === 0
        ? null
        : ({ self: { weapons } } as unknown as ViewModel),
  };
  return { host, dirs, fired, modes, notes, slots, groups, group: 0, plan };
}

describe('HET command path', () => {
  it('sends orderHet port and starboard through the match, never a raw dir other than -1 or +1', () => {
    const { host, dirs } = hostRecording();
    runAction(host, 'helm.hetPort');
    runAction(host, 'helm.hetStarboard');
    expect(dirs).toEqual([-1, 1]);
  });

  it('ignores unknown helm actions rather than inventing a HET dir', () => {
    const { host, dirs } = hostRecording();
    runAction(host, 'helm.het');
    runAction(host, 'helm.hetForward');
    expect(dirs).toEqual([]);
  });
});

describe('weapon selection and firing', () => {
  const photons = [
    { slotIndex: 0, family: 'photon' },
    { slotIndex: 1, family: 'phaser' },
    { slotIndex: 2, family: 'photon' },
  ];

  it('selects every mount with selectAll and fires that selection with alphaStrike via orderFire', () => {
    const rec = hostRecording({ weapons: photons });
    rec.host.setSlots([0]);
    runAction(rec.host, 'weapons.selectAll');
    expect(rec.slots).toEqual([0, 1, 2]);
    runAction(rec.host, 'weapons.alphaStrike');
    expect(rec.fired).toEqual([0, 1, 2]);
  });

  it('assigns the whole selection to a group, not only the primary slot', () => {
    const rec = hostRecording({ weapons: photons });
    rec.host.setSlots([0, 2]);
    runAction(rec.host, 'weapons.assign3');
    expect(rec.groups[2]).toEqual([0, 2]);
    expect(rec.groups[0]).toEqual([]);
    expect(rec.host.group).toBe(2);
  });

  it('toggles proximity only on selected photon mounts', () => {
    const rec = hostRecording({ weapons: photons });
    rec.host.setSlots([0, 1, 2]);
    runAction(rec.host, 'weapons.proximity');
    expect(rec.modes).toEqual([
      { slot: 0, mode: MODE_PROXIMITY },
      { slot: 2, mode: MODE_PROXIMITY },
    ]);
    runAction(rec.host, 'weapons.proximity');
    expect(rec.modes.slice(2)).toEqual([
      { slot: 0, mode: MODE_NORMAL },
      { slot: 2, mode: MODE_NORMAL },
    ]);
  });

  it('refuses proximity when no selected mount is a photon', () => {
    const rec = hostRecording({ weapons: photons });
    rec.host.setSlots([1]);
    runAction(rec.host, 'weapons.proximity');
    expect(rec.modes).toEqual([]);
    expect(rec.notes).toEqual(['Only a photon mount can change mode in this duel.']);
  });

  it('notes when selectAll has no mounts', () => {
    const rec = hostRecording({ weapons: [] });
    rec.host.view = () => ({ self: { weapons: [] } } as unknown as ViewModel);
    runAction(rec.host, 'weapons.selectAll');
    expect(rec.notes).toEqual(['No mounts.']);
    expect(rec.slots).toEqual([0]);
  });
});

describe('interface bar toggle', () => {
  it('flips interfaceCollapsed through the command path and does not invent a sim verb', () => {
    const rec = hostRecording();
    expect(rec.host.interfaceCollapsed).toBe(false);
    runAction(rec.host, 'hud.toggleInterfaceBar');
    expect(rec.host.interfaceCollapsed).toBe(true);
    runAction(rec.host, 'hud.toggleInterfaceBar');
    expect(rec.host.interfaceCollapsed).toBe(false);
  });
});
