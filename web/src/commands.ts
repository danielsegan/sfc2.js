/**
 * Turn a keymap action into a session order or a note.
 * Reverse and drones stay on the console. Erratic maneuvers and emergency stop are live.
 */
import type { DuelPlan } from '../../engine/duel/match.ts';
import type { DuelMatch } from '../../engine/duel/match.ts';
import { MODE_NORMAL, MODE_OFFLINE, MODE_OVERLOAD, MODE_PROXIMITY } from '../../engine/sim/rules-tables.ts';
import type { ViewModel } from '../../engine/view/view-model.ts';
import type { DuelScene } from './scene.ts';
import { clampReinforceAmount, selectFacing, toggleAllFacings } from './shield-select.ts';
import { assignSlotsToGroup, selectAllSlots, supportsProximity } from './weapon-select.ts';
import {
  DEFAULT_ENERGY_PRIORITIES,
  defaultRepairQueue,
  isEnergyCategory,
  isRepairSystemId,
  nextEnergyPriorities,
  prioritizeRepairSystem,
  type EnergyCategory,
  type EnergyPriorities,
} from './energy-repair.ts';
import { isOfficerPage, stepMapZoom, type OfficerPageId } from './officer-mfd.ts';

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
  officerPage: OfficerPageId;
  setOfficerPage(page: OfficerPageId): void;
  interfaceCollapsed: boolean;
  setInterfaceCollapsed(on: boolean): void;
  getShieldSelection(): readonly number[];
  setShieldSelection(facings: readonly number[]): void;
  getReinforceAmount(): number;
  setReinforceAmount(points: number): void;
  view(): ViewModel | null;
  getEnergyPriorities?(): EnergyPriorities;
  setEnergyPriorities?(priorities: EnergyPriorities): void;
  getBatteryDischarging?(): boolean;
  setBatteryDischarging?(on: boolean): void;
  getRepairQueue?(): readonly string[];
  setRepairQueue?(order: readonly string[]): void;
}

const LATER: Record<string, string> = {
  'helm.reverse': 'Reverse is not in this duel.',
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
  else if (id === 'helm.het180') host.match.orderHet180();
  else if (id === 'helm.hetOrdered') host.match.orderHetAngle(host.view()?.self?.helm.remainingTurn16 ?? 0);
  else if (id.startsWith('helm.het.')) {
    const sweep = Number(id.slice('helm.het.'.length));
    if (Number.isInteger(sweep)) host.match.orderHetAngle(sweep);
  } else if (id === 'helm.emerDecel') host.match.orderEmerDecel();
  else if (id === 'helm.erratic') {
    host.match.setErratic(!(host.view()?.self?.helm.erraticActive ?? false));
  }
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
  else if (id === 'weapons.offline') setOffline(host);
  else if (id === 'shields.down') host.match.setShieldState('down');
  else if (id === 'shields.minimal') host.match.setShieldState('minimal');
  else if (id === 'shields.up') host.match.setShieldState('up');
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
  else if (id === 'view.map' || id === 'mfd.page.map') host.setOfficerPage('map');
  else if (id.startsWith('mfd.page.')) {
    const page = id.slice('mfd.page.'.length);
    if (isOfficerPage(page)) host.setOfficerPage(page);
  }
  else if (id === 'view.mapZoomIn') host.setMapZoom(stepMapZoom(host.mapZoom, 1));
  else if (id === 'view.mapZoomOut') host.setMapZoom(stepMapZoom(host.mapZoom, -1));
  else if (id === 'view.zoomIn') host.scene.dolly(-1.2);
  else if (id === 'view.zoomOut') host.scene.dolly(1.2);
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
  else if (id.startsWith('energy.priority.')) {
    const category = id.slice('energy.priority.'.length);
    if (isEnergyCategory(category)) cyclePriority(host, category);
  } else if (id === 'energy.battery') toggleBattery(host);
  else if (id.startsWith('repair.prioritize.')) {
    const system = id.slice('repair.prioritize.'.length);
    if (isRepairSystemId(system)) prioritizeRepair(host, system);
  } else if (id === 'repair.reset') {
    const next = defaultRepairQueue();
    host.setRepairQueue?.(next);
    host.match.setRepairPriority(next);
  }
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
  if (reinforcementBlocked(host)) {
    host.note('Reinforcement is off while shields are down or minimal.');
    return;
  }
  const facings = host.getShieldSelection();
  if (facings.length === 0) {
    host.note('Select a shield facing first.');
    return;
  }
  const amount = clampReinforceAmount(host.getReinforceAmount());
  for (const facing of facings) host.match.setFacing(facing, amount);
}

function reinforceAll(host: CommandHost): void {
  if (reinforcementBlocked(host)) {
    host.note('Reinforcement is off while shields are down or minimal.');
    return;
  }
  host.match.setGeneral(clampReinforceAmount(host.getReinforceAmount()));
}

function reinforcementBlocked(host: CommandHost): boolean {
  const state = host.view()?.self?.shieldState;
  return state === 'down' || state === 'minimal';
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

function setOffline(host: CommandHost): void {
  for (const slot of selectedSlots(host)) host.match.setWeaponMode(slot, MODE_OFFLINE);
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

function cyclePriority(host: CommandHost, category: EnergyCategory): void {
  const current =
    host.getEnergyPriorities?.()
    ?? host.view()?.self?.energy.priorities
    ?? DEFAULT_ENERGY_PRIORITIES;
  const next = nextEnergyPriorities(current, category);
  host.setEnergyPriorities?.(next);
  host.match.setEnergyPriorities(next);
}

function toggleBattery(host: CommandHost): void {
  const current =
    host.getBatteryDischarging?.()
    ?? host.view()?.self?.energy.batteryDischarging
    ?? true;
  const next = !current;
  host.setBatteryDischarging?.(next);
  host.match.setBattery(next);
}

function prioritizeRepair(host: CommandHost, system: string): void {
  const current =
    host.getRepairQueue?.()
    ?? host.view()?.self?.damage.repairQueue
    ?? [];
  const next = prioritizeRepairSystem(current, system);
  host.setRepairQueue?.(next);
  host.match.setRepairPriority(next);
}
