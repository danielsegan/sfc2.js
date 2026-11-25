import { describe, expect, it } from 'vitest';
import type { DuelMatch } from '../../engine/duel/match.ts';
import { MODE_NORMAL, MODE_PROXIMITY } from '../../engine/sim/rules-tables.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import { runAction, type CommandHost } from './commands.ts';

interface Recording {
  host: CommandHost;
  dirs: Array<-1 | 1>;
  angles: number[];
  emer: number[];
  erratic: boolean[];
  fired: number[];
  modes: Array<{ slot: number; mode: number }>;
  notes: string[];
  slots: number[];
  groups: number[][];
  group: number;
  plan: { modes: number[]; specific: number[]; general: number };
  priorityCalls: Array<{ movement: number; weapons: number; shields: number; tractors: number; ecm: number }>;
  batteryCalls: boolean[];
  repairCalls: Array<readonly string[]>;
  facings: number[];
  amount: number;
}

function hostRecording(opts?: { weapons?: Array<{ slotIndex: number; family: string }> }): Recording {
  const dirs: Array<-1 | 1> = [];
  const angles: number[] = [];
  const erratic: boolean[] = [];
  const emer: number[] = [];
  const fired: number[] = [];
  const modes: Array<{ slot: number; mode: number }> = [];
  const notes: string[] = [];
  const slots = [0];
  const groups: number[][] = [[0], [1], [], [], [], []];
  const plan = { modes: [] as number[], specific: [] as number[], general: 0 };
  const facings: number[] = [];
  let amount = 1;
  const priorityCalls: Array<{ movement: number; weapons: number; shields: number; tractors: number; ecm: number }> = [];
  const batteryCalls: boolean[] = [];
  const repairCalls: Array<readonly string[]> = [];
  let pendingPriorities = { movement: 3, weapons: 3, shields: 3, tractors: 3, ecm: 3 };
  let pendingBattery = true;
  let pendingRepair: readonly string[] = [];
  const weapons = opts?.weapons ?? [];
  const match = {
    plan,
    orderHet(dir: -1 | 1) {
      dirs.push(dir);
    },
    orderHetAngle(delta: number) {
      angles.push(delta);
    },
    orderHet180() {
      angles.push(32768);
    },
    orderEmerDecel() {
      emer.push(1);
    },
    setErratic(on: boolean) {
      erratic.push(on);
    },
    orderFire(slot: number) {
      fired.push(slot);
    },
    setWeaponMode(slot: number, mode: number) {
      plan.modes[slot] = mode;
      modes.push({ slot, mode });
    },
    setFacing(facing: number, points: number) {
      plan.specific[facing] = points;
    },
    setGeneral(points: number) {
      plan.general = points;
    },
    setEnergyPriorities(priorities: { movement: number; weapons: number; shields: number; tractors: number; ecm: number }) {
      priorityCalls.push(priorities);
    },
    setBattery(on: boolean) {
      batteryCalls.push(on);
    },
    setRepairPriority(order: readonly string[]) {
      repairCalls.push(order);
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
    setMapZoom(zoom) {
      host.mapZoom = zoom;
    },
    mapZoom: 8,
    headingUp: false,
    setHeadingUp() {},
    mapFull: false,
    setMapFull() {},
    officerPage: 'helm',
    setOfficerPage(page) {
      host.officerPage = page;
    },
    interfaceCollapsed: false,
    setInterfaceCollapsed(on) {
      host.interfaceCollapsed = on;
    },
    getShieldSelection: () => facings,
    setShieldSelection(next) {
      facings.splice(0, facings.length, ...next);
    },
    getReinforceAmount: () => amount,
    setReinforceAmount(points) {
      amount = points;
    },
    getEnergyPriorities: () => pendingPriorities,
    setEnergyPriorities(next) {
      pendingPriorities = next;
    },
    getBatteryDischarging: () => pendingBattery,
    setBatteryDischarging(on) {
      pendingBattery = on;
    },
    getRepairQueue: () => pendingRepair,
    setRepairQueue(order) {
      pendingRepair = order;
    },
    view: () =>
      weapons.length === 0
        ? null
        : ({ self: { weapons } } as unknown as ViewModel),
  };
  return { host, dirs, angles, emer, erratic, fired, modes, notes, slots, groups, group: 0, plan, facings, amount, priorityCalls, batteryCalls, repairCalls };
}

describe('HET command path', () => {
  it('sends orderHet port and starboard through the match, never a raw dir other than -1 or +1', () => {
    const { host, dirs } = hostRecording();
    runAction(host, 'helm.hetPort');
    runAction(host, 'helm.hetStarboard');
    expect(dirs).toEqual([-1, 1]);
  });

  it('ignores unknown helm actions rather than inventing a HET dir', () => {
    const { host, dirs, angles } = hostRecording();
    runAction(host, 'helm.het');
    runAction(host, 'helm.hetForward');
    expect(dirs).toEqual([]);
    expect(angles).toEqual([]);
  });

  it('sends free-angle sweeps, a 180, an emergency stop, and an erratic toggle', () => {
    const rec = hostRecording();
    runAction(rec.host, 'helm.het.-8192');
    runAction(rec.host, 'helm.het.32768');
    runAction(rec.host, 'helm.het180');
    runAction(rec.host, 'helm.emerDecel');
    runAction(rec.host, 'helm.erratic');
    expect(rec.angles).toEqual([-8192, 32768, 32768]);
    expect(rec.emer).toEqual([1]);
    expect(rec.erratic).toEqual([true]);
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

  it('sets selected mounts back to MODE_NORMAL with weapons.normal', () => {
    const rec = hostRecording({ weapons: photons });
    rec.host.setSlots([0, 1]);
    runAction(rec.host, 'weapons.normal');
    expect(rec.modes).toEqual([
      { slot: 0, mode: MODE_NORMAL },
      { slot: 1, mode: MODE_NORMAL },
    ]);
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

describe('shield selection and reinforcement', () => {
  it('selects a facing without committing points, then Reinforce writes setFacing', () => {
    const rec = hostRecording();
    rec.host.setReinforceAmount(4);
    runAction(rec.host, 'shields.facing0');
    expect(rec.facings).toEqual([0]);
    expect(rec.plan.specific[0]).toBeUndefined();
    runAction(rec.host, 'shields.reinforce');
    expect(rec.plan.specific[0]).toBe(4);
  });

  it('notes when Reinforce has no facing selected', () => {
    const rec = hostRecording();
    rec.host.setReinforceAmount(3);
    runAction(rec.host, 'shields.reinforce');
    expect(rec.notes).toEqual(['Select a shield facing first.']);
    expect(rec.plan.specific).toEqual([]);
  });

  it('commits the pending amount to every selected facing', () => {
    const rec = hostRecording();
    rec.host.setReinforceAmount(6);
    rec.host.setShieldSelection([0, 3]);
    runAction(rec.host, 'shields.reinforce');
    expect(rec.plan.specific[0]).toBe(6);
    expect(rec.plan.specific[3]).toBe(6);
    expect(rec.plan.general).toBe(0);
  });

  it('toggles all facings, then none, with selectAll', () => {
    const rec = hostRecording();
    runAction(rec.host, 'shields.selectAll');
    expect(rec.facings).toEqual([0, 1, 2, 3, 4, 5]);
    runAction(rec.host, 'shields.selectAll');
    expect(rec.facings).toEqual([]);
  });

  it('Reinforce All commits the pending amount through setGeneral', () => {
    const rec = hostRecording();
    rec.host.setReinforceAmount(5);
    rec.host.setShieldSelection([]);
    runAction(rec.host, 'shields.reinforceAll');
    expect(rec.plan.general).toBe(5);
    expect(rec.plan.specific).toEqual([]);
  });

  it('keeps the unbound general toggle as a 0 / 2 setGeneral flip', () => {
    const rec = hostRecording();
    runAction(rec.host, 'shields.general');
    expect(rec.plan.general).toBe(2);
    runAction(rec.host, 'shields.general');
    expect(rec.plan.general).toBe(0);
  });
});

describe('Officer MFD page and map zoom actions', () => {
  it('opens officer pages, with M jumping to the Map page', () => {
    const rec = hostRecording();
    runAction(rec.host, 'mfd.page.comms');
    expect(rec.host.officerPage).toBe('comms');
    runAction(rec.host, 'view.map');
    expect(rec.host.officerPage).toBe('map');
    runAction(rec.host, 'mfd.page.helm');
    expect(rec.host.officerPage).toBe('helm');
  });

  it('steps map zoom through three ~2× tiers and clamps at the ends', () => {
    const rec = hostRecording();
    expect(rec.host.mapZoom).toBe(8);
    runAction(rec.host, 'view.mapZoomOut');
    expect(rec.host.mapZoom).toBe(8);
    runAction(rec.host, 'view.mapZoomIn');
    expect(rec.host.mapZoom).toBe(16);
    runAction(rec.host, 'view.mapZoomIn');
    expect(rec.host.mapZoom).toBe(32);
    runAction(rec.host, 'view.mapZoomIn');
    expect(rec.host.mapZoom).toBe(32);
    runAction(rec.host, 'view.mapZoomOut');
    expect(rec.host.mapZoom).toBe(16);
  });
});

describe('energy priority, battery, and repair commands', () => {
  it('cycles priority 3 -> 2 -> 1 -> 5 -> 4 -> 3 across consecutive paused clicks', () => {
    const { host, priorityCalls } = hostRecording();
    for (let i = 0; i < 5; i++) runAction(host, 'energy.priority.weapons');
    expect(priorityCalls.map((p) => p.weapons)).toEqual([2, 1, 5, 4, 3]);
    expect(priorityCalls[0]?.movement).toBe(3);
  });

  it('toggles battery discharge through setBattery', () => {
    const { host, batteryCalls } = hostRecording();
    runAction(host, 'energy.battery');
    runAction(host, 'energy.battery');
    expect(batteryCalls).toEqual([false, true]);
  });

  it('promotes systems and resets the queue through setRepairPriority', () => {
    const { host, repairCalls } = hostRecording();
    runAction(host, 'repair.prioritize.sensors');
    runAction(host, 'repair.prioritize.armor');
    runAction(host, 'repair.reset');
    expect(repairCalls[0]?.[0]).toBe('sensors');
    expect(repairCalls[1]?.slice(0, 2)).toEqual(['armor', 'sensors']);
    expect(repairCalls[2]).toEqual(['bridge', 'hullForward', 'hullCenter', 'hullAft', 'sensors', 'armor', 'extra']);
  });
});
