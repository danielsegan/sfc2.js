/**
 * Turn a keymap action into a session order or a note.
 * Reverse, erratic maneuvers, and drones stay on the console.
 */
import type { DuelPlan } from '../../engine/duel/match.ts';
import type { DuelMatch } from '../../engine/duel/match.ts';
import { MODE_NORMAL, MODE_OVERLOAD, MODE_PROXIMITY } from '../../engine/sim/rules-tables.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import type { DuelScene } from './scene.ts';
import { clampReinforceAmount, selectFacing, toggleAllFacings } from './shield-select.ts';
import { assignSlotsToGroup, selectAllSlots, supportsProximity } from './weapon-select.ts';

export interface CommandHost {
  match: DuelMatch;
  scene: DuelScene;
  note(text: string): void;
  togglePause(): void;
  getSlot(): number;
  setSlot(slot: number): void;
  getSlots(): readonly number[];
  setSlots(slots: readonly number[]): void;
  groups: number[][];
  group: number;
  setGroup(group: number): void;
  setMapZoom(zoom: number): void;
  mapZoom: number;
  headingUp: boolean;
  setHeadingUp(on: boolean): void;
  mapFull: boolean;
  setMapFull(on: boolean): void;
  interfaceCollapsed: boolean;
  setInterfaceCollapsed(on: boolean): void;
  getShieldSelection(): readonly number[];
  setShieldSelection(facings: readonly number[]): void;
  getReinforceAmount(): number;
  setReinforceAmount(points: number): void;
  view(): ViewModel | null;
}

const LATER: Record<string, string> = {
  'helm.reverse': 'Reverse is not in this duel.',
  'helm.erratic': 'Erratic maneuvers are not in this duel.',
  'craft.drone': 'Drones are not in this duel.',
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
  else if (id === 'helm.hetPort') host.match.orderHet(-1);
  else if (id === 'helm.hetStarboard') host.match.orderHet(1);
  else if (id === 'weapons.fire') fireGroup(host);
  else if (id === 'weapons.selectAll') selectAll(host);
  else if (id === 'weapons.alphaStrike') fireSelected(host);
  else if (id === 'weapons.overload') toggleMode(host, MODE_OVERLOAD);
  else if (id === 'ops.tractor') host.match.setTractor(1, host.match.plan.tractorEnergy);
  else if (id === 'ops.repel') repelOrRelease(host);
  else if (id === 'ops.cloak') toggleCloak(host);
  else if (id === 'ew.shiftEcm') shiftEw(host, 1);
  else if (id === 'ew.shiftEccm') shiftEw(host, -1);
  else if (id === 'ew.totalDown') changeEw(host, -1, 0);
  else if (id === 'ew.totalUp') changeEw(host, 0, 1);
  else if (id === 'weapons.normal') setNormalMode(host);
  else if (id === 'weapons.proximity') toggleMode(host, MODE_PROXIMITY);
  else if (id.startsWith('weapons.assign')) assignGroup(host, Number(id.slice('weapons.assign'.length)) - 1);
  else if (id.startsWith('weapons.group')) selectGroup(host, Number(id.slice('weapons.group'.length)) - 1);
  else if (id.startsWith('shields.clear')) host.match.setFacing(Number(id.slice('shields.clear'.length)), 0);
  else if (id.startsWith('shields.facing')) selectShieldFacing(host, Number(id.slice('shields.facing'.length)));
  else if (id === 'shields.selectAll') host.setShieldSelection(toggleAllFacings(host.getShieldSelection()));
  else if (id === 'shields.reinforce') reinforceSelected(host);
  else if (id === 'shields.reinforceAll') reinforceAll(host);
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
  else if (id === 'hud.toggleInterfaceBar') host.setInterfaceCollapsed(!host.interfaceCollapsed);
  else if (id === 'craft.launch') host.match.launchFighter();
  else if (id === 'craft.launchPf') host.match.launchPf();
  else if (id === 'craft.recall') host.match.recallCraft();
  else if (id === 'craft.mine') host.match.layMine();
  else if (id === 'ops.board') host.match.orderRaid(1, 1);
  else if (id === 'ops.hitAndRun') host.match.orderRaid(0);
}

function fireGroup(host: CommandHost): void {
  const slots = host.groups[host.group] ?? [];
  const list = slots.length > 0 ? slots : [host.getSlot()];
  for (const slot of list) host.match.orderFire(slot);
}

function selectGroup(host: CommandHost, group: number): void {
  if (group < 0 || group > 5) return;
  host.setGroup(group);
  const members = host.groups[group] ?? [];
  if (members.length > 0) host.setSlots(members);
  else host.setSlot(group);
}

function assignGroup(host: CommandHost, group: number): void {
  if (group < 0 || group > 5) return;
  const slots = selectedSlots(host);
  assignSlotsToGroup(host.groups, group, slots);
  host.setGroup(group);
}

function selectAll(host: CommandHost): void {
  const slots = selectAllSlots(host.view()?.self?.weapons ?? []);
  if (slots.length === 0) {
    host.note('No mounts.');
    return;
  }
  host.setSlots(slots);
}

function fireSelected(host: CommandHost): void {
  for (const slot of selectedSlots(host)) host.match.orderFire(slot);
}

function selectedSlots(host: CommandHost): number[] {
  const slots = host.getSlots();
  return slots.length > 0 ? [...slots] : [host.getSlot()];
}

function selectShieldFacing(host: CommandHost, facing: number): void {
  host.setShieldSelection(selectFacing(host.getShieldSelection(), facing, false));
}

function reinforceSelected(host: CommandHost): void {
  const facings = host.getShieldSelection();
  if (facings.length === 0) {
    host.note('Select a shield facing first.');
    return;
  }
  const amount = clampReinforceAmount(host.getReinforceAmount());
  for (const facing of facings) host.match.setFacing(facing, amount);
}

function reinforceAll(host: CommandHost): void {
  host.match.setGeneral(clampReinforceAmount(host.getReinforceAmount()));
}

function clampEw(points: number): number {
  if (!Number.isInteger(points) || points < 0) return 0;
  return points > 12 ? 12 : points;
}

function changeEw(host: CommandHost, ecmDelta: number, eccmDelta: number): void {
  host.match.setEw(clampEw(host.match.plan.ecm + ecmDelta), clampEw(host.match.plan.eccm + eccmDelta));
}

function shiftEw(host: CommandHost, towardEcm: number): void {
  if (towardEcm > 0 && host.match.plan.eccm > 0) changeEw(host, 1, -1);
  else if (towardEcm < 0 && host.match.plan.ecm > 0) changeEw(host, -1, 1);
}

function repelOrRelease(host: CommandHost): void {
  if (host.view()?.self?.tractorLink) host.match.setTractor(0, 0);
  else host.match.setTractor(2, host.match.plan.tractorEnergy);
}

function toggleCloak(host: CommandHost): void {
  const self = host.view()?.self;
  if (!self?.cloakFitted) {
    host.note('This hull has no cloak.');
    return;
  }
  host.match.setCloak(self.cloakState === 0);
}

function setNormalMode(host: CommandHost): void {
  for (const slot of selectedSlots(host)) host.match.setWeaponMode(slot, MODE_NORMAL);
}

function toggleMode(host: CommandHost, mode: number): void {
  const slots = selectedSlots(host);
  const weapons = host.view()?.self?.weapons ?? [];
  const known = weapons.length > 0;
  const supported = known ? slots.filter((slot) => supportsProximity(weapons.find((item) => item.slotIndex === slot))) : slots;
  if (known && supported.length === 0) {
    host.note('Only a photon mount can change mode in this duel.');
    return;
  }
  const allOn = supported.every((slot) => (host.match.plan.modes[slot] ?? MODE_NORMAL) === mode);
  const next = allOn ? MODE_NORMAL : mode;
  for (const slot of supported) host.match.setWeaponMode(slot, next);
}

function cycleTarget(host: CommandHost, step: number, kind: 'hostile' | 'friendly'): void {
  const vm = host.view();
  if (!vm) return;
  const list = vm.contacts.filter((contact) => {
    if (contact.kind !== 'ship' || !contact.detected) return false;
    if (kind === 'hostile') return contact.hostility === 'hostile';
    return contact.hostility !== 'hostile' && contact.hostility !== 'self';
  });
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
    if (contact.kind !== 'ship' || contact.hostility !== 'hostile' || !contact.detected) continue;
    if (!best || contact.rangeFromSelf < best.range) best = { id: contact.id, range: contact.rangeFromSelf };
  }
  if (!best) {
    host.note('No hostile contact.');
    return;
  }
  host.match.setTarget(best.id);
}
