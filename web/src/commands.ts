/**
 * Turn a keymap action into a session order or a note. Systems that
 * are not in this duel stay on the console and do not touch the sim.
 */
import type { DuelPlan } from '../../engine/duel/match.ts';
import type { DuelMatch } from '../../engine/duel/match.ts';
import { MODE_NORMAL, MODE_OVERLOAD, MODE_PROXIMITY } from '../../engine/sim/rules-tables.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import type { DuelScene } from './scene.ts';

export interface CommandHost {
  match: DuelMatch;
  scene: DuelScene;
  note(text: string): void;
  togglePause(): void;
  getSlot(): number;
  setSlot(slot: number): void;
  groups: number[][];
  group: number;
  setGroup(group: number): void;
  setMapZoom(zoom: number): void;
  mapZoom: number;
  headingUp: boolean;
  setHeadingUp(on: boolean): void;
  mapFull: boolean;
  setMapFull(on: boolean): void;
  view(): ViewModel | null;
}

const LATER: Record<string, string> = {
  'helm.reverse': 'Reverse is not in this duel.',
  'helm.erratic': 'Erratic maneuvers are not in this duel.',
  'ops.tractor': 'Tractor is not in this duel.',
  'ops.repel': 'Tractor is not in this duel.',
  'ops.board': 'Boarding is not in this duel.',
  'ops.hitAndRun': 'Hit and run is not in this duel.',
  'ops.cloak': 'Cloak is not in this duel.',
  'craft.launch': 'Fighters are not in this duel.',
  'craft.recall': 'Fighters are not in this duel.',
  'craft.drone': 'Drones are not in this duel.',
  'craft.mine': 'Mines are not in this duel.',
  'ew.shiftEcm': 'EW is not in this duel.',
  'ew.shiftEccm': 'EW is not in this duel.',
  'ew.totalDown': 'EW is not in this duel.',
  'ew.totalUp': 'EW is not in this duel.',
};

const PRESETS: Record<string, Partial<DuelPlan>> = {
  'power.attack': { lifeSupport: true, fireControl: true, speed: 8, general: 0, weaponRequest: null, specific: [0, 0, 0, 0, 0, 0] },
  'power.balanced': { lifeSupport: true, fireControl: true, speed: 4, general: 2, weaponRequest: null, specific: [0, 0, 0, 0, 0, 0] },
  'power.run': { lifeSupport: true, fireControl: true, speed: 16, general: 0, weaponRequest: 0, specific: [0, 0, 0, 0, 0, 0] },
  'power.defense': { lifeSupport: true, fireControl: true, speed: 2, general: 6, weaponRequest: null, specific: [0, 0, 0, 0, 0, 0] },
};

export function runAction(host: CommandHost, id: string): void {
  const later = LATER[id];
  if (later) {
    host.note(later);
    return;
  }
  const preset = PRESETS[id];
  if (preset) {
    host.match.setAllocation(preset);
    return;
  }
  if (id === 'helm.speedUp') host.match.bumpSpeed(1);
  else if (id === 'helm.speedDown') host.match.bumpSpeed(-1);
  else if (id === 'helm.stop') host.match.setSpeed(0);
  else if (id === 'weapons.fire') fireGroup(host);
  else if (id === 'weapons.overload') toggleMode(host, MODE_OVERLOAD);
  else if (id === 'weapons.proximity') toggleMode(host, MODE_PROXIMITY);
  else if (id.startsWith('weapons.assign')) assignGroup(host, Number(id.slice('weapons.assign'.length)) - 1);
  else if (id.startsWith('weapons.group')) selectGroup(host, Number(id.slice('weapons.group'.length)) - 1);
  else if (id.startsWith('shields.clear')) host.match.setFacing(Number(id.slice('shields.clear'.length)), 0);
  else if (id.startsWith('shields.facing')) reinforce(host, Number(id.slice('shields.facing'.length)));
  else if (id === 'shields.general') {
    host.match.setGeneral(host.match.plan.general > 0 ? 0 : 2);
  } else if (id === 'target.next') cycleTarget(host, 1, 'hostile');
  else if (id === 'target.prev') cycleTarget(host, -1, 'hostile');
  else if (id === 'target.nearest') nearestHostile(host);
  else if (id === 'target.friendly') cycleTarget(host, 1, 'friendly');
  else if (id === 'view.camera') host.scene.cycleCamera();
  else if (id === 'view.map') host.setMapFull(!host.mapFull);
  else if (id === 'view.mapOrientation') host.setHeadingUp(!host.headingUp);
  else if (id === 'view.reset') host.scene.resetView();
  else if (id === 'view.pause') host.togglePause();
}

function fireGroup(host: CommandHost): void {
  const slots = host.groups[host.group] ?? [];
  const list = slots.length > 0 ? slots : [host.getSlot()];
  for (const slot of list) host.match.orderFire(slot);
}

function selectGroup(host: CommandHost, group: number): void {
  if (group < 0 || group > 5) return;
  host.setGroup(group);
  const first = host.groups[group]?.[0];
  host.setSlot(first ?? group);
}

function assignGroup(host: CommandHost, group: number): void {
  if (group < 0 || group > 5) return;
  const slot = host.getSlot();
  for (const list of host.groups) {
    const at = list.indexOf(slot);
    if (at >= 0) list.splice(at, 1);
  }
  host.groups[group]?.push(slot);
  host.setGroup(group);
}

function reinforce(host: CommandHost, facing: number): void {
  const current = host.match.plan.specific[facing] ?? 0;
  host.match.setFacing(facing, current + 1);
}

function toggleMode(host: CommandHost, mode: number): void {
  const slot = host.getSlot();
  const weapon = host.view()?.self?.weapons.find((item) => item.slotIndex === slot);
  if (weapon && weapon.family !== 'photon') {
    host.note('Only a photon mount can change mode in this duel.');
    return;
  }
  const current = host.match.plan.modes[slot] ?? MODE_NORMAL;
  host.match.setWeaponMode(slot, current === mode ? MODE_NORMAL : mode);
}

function cycleTarget(host: CommandHost, step: number, kind: 'hostile' | 'friendly'): void {
  const vm = host.view();
  if (!vm) return;
  const list = vm.contacts.filter((contact) => contact.kind === 'ship' && (kind === 'hostile' ? contact.hostility === 'hostile' : contact.hostility !== 'hostile' && contact.hostility !== 'self'));
  if (list.length === 0) {
    host.note(kind === 'hostile' ? 'No hostile contact.' : 'No friendly contact.');
    return;
  }
  const current = host.match.targetId;
  let index = list.findIndex((contact) => contact.id === current);
  index = index < 0 ? 0 : (index + step + list.length) % list.length;
  const next = list[index];
  if (next) host.match.setTarget(next.id);
}

function nearestHostile(host: CommandHost): void {
  const vm = host.view();
  if (!vm) return;
  let best: { id: number; range: number } | null = null;
  for (const contact of vm.contacts) {
    if (contact.kind !== 'ship' || contact.hostility !== 'hostile') continue;
    if (!best || contact.rangeFromSelf < best.range) best = { id: contact.id, range: contact.rangeFromSelf };
  }
  if (!best) {
    host.note('No hostile contact.');
    return;
  }
  host.match.setTarget(best.id);
}
