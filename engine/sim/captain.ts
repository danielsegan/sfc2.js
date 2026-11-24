/**
 * Deterministic captains for a skirmish of up to six ships.
 *
 * Each captain reads the world in the AI phase and queues the same verbs
 * the player uses. The session is not involved. Commands apply on the next
 * tick, from slots 8–15, one slot per entity index. They are not written
 * into the player log.
 *
 * Tie-breaks draw from the `ai` stream only. No other stream is touched.
 * The numbers below are placeholders so the fixture can move. They are not
 * a claim about Community Edition captains.
 */
import { angle16, atan2_16, cos16, shortestArc, sin16 } from '../core/angle.ts';
import { asEntityId, type EntityId } from '../core/brands.ts';
import { writeU32 } from '../core/bytes.ts';
import { delta, distSq, dot, FX_ONE, isqrt64, type I64 } from '../core/fx.ts';
import type { SimSystem, TickContext } from './sim.ts';
import type { World } from './world.ts';
import { H, readHull, readMounts, type MountMem } from './hull.ts';
import { rulesDiv } from './rules-div.ts';
import { shotInArc, withinRange } from './arcs.ts';
import {
  A,
  ALLEGIANCE,
  CONTROL_AI,
  MODE_ENGAGE,
  MODE_RETREAT,
} from './allegiance.ts';
import {
  ENERGY_SCALE,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  MODE_KEEP,
  MODE_NORMAL,
  MODE_OVERLOAD,
  MODE_PROXIMITY,
  TRACTOR_RANGE,
  turnYawCap,
  weaponDef,
  type WeaponDef,
} from './rules-tables.ts';
import {
  CLOAK_OFF,
  TRACTOR_HOLD,
  VERB_SET_CLOAK,
  VERB_SET_EW,
  VERB_SET_TRACTOR,
  VERB_SET_WEAPON_MODE,
  setCloakPayload,
  setEwPayload,
  setTractorPayload,
  setWeaponModePayload,
  targetHidden,
} from './phase3.ts';
import {
  B,
  BAY,
  BAY_COUNT,
  BAY_FIGHTER,
  BAY_PF,
  BAY_STRIDE,
  C,
  CRAFT,
  ENDURANCE_TICKS,
  ROLE_FIGHTER,
  ROLE_PF,
  STATE_OUT,
  STATE_RETURN,
  TRANSPORTER_RANGE,
  VERB_LAUNCH_FIGHTER,
  VERB_LAUNCH_PF,
  VERB_LAY_MINE,
  VERB_RAID,
  VERB_RECALL,
  launchFighterPayload,
  launchPfPayload,
  layMinePayload,
  raidPayload,
  recallPayload,
} from './smallcraft.ts';
import {
  VERB_FIRE,
  VERB_SET_ENERGY,
  firePayload,
  setEnergyPayload,
  type EnergyAsk,
} from './combat.ts';

const FULL = 65536;
const HALF = 32768;
const VERB_HELM = 6;
const RETARGET_TICKS = 30;
const CLOSE_RANGE = 16;
const FIGHT_RANGE = 10;
const FLEE_SPEED = 6;
const CLOSE_SPEED = 4;
const CREEP_SPEED = 2;
const SHIELD_POINTS = 4;
/** A fighter is recalled after this many attack ticks, before endurance runs out. */
const RECALL_AFTER = 8;
/** Retreat drops one mine when a hostile is still inside this range. */
const PURSUE_RANGE = 24;
const TRACTOR_BID = 1;

export function createCaptain(): SimSystem {
  return {
    id: 'ai-captain',
    phase: 'aiMission',
    priority: 20,
    step(world, ctx) {
      const tick = ctx.tick as number;
      const rng = ctx.rng.stream('ai');
      for (const id of world.liveIds()) captain(world, ctx, id, tick, (n) => rng.int(n));
    },
  };
}

function captain(
  world: World,
  ctx: TickContext,
  id: EntityId,
  tick: number,
  tieBreak: (count: number) => number,
): void {
  const hull = readHull(world, id);
  if (hull[H.classCode] === 0 || hull[H.destroyed] === 1 || hull[H.disabled] === 1) return;
  const row = world.getFields(id, ALLEGIANCE);
  if (row[A.control] !== CONTROL_AI) return;
  if (row[A.side] !== 1 && row[A.side] !== 2) return;
  const index = (id as number) & 0xffff;
  const slot = 8 + index;
  if (slot > 15) return;

  const side = row[A.side]! - 1;
  const target = chooseTarget(world, id, side, row[A.target]!, row[A.think]!, tick, tieBreak);
  const think = target.picked ? tick : row[A.think]!;
  const retreat = target.id !== 0 && shouldRetreat(hull);
  const mode = retreat ? MODE_RETREAT : MODE_ENGAGE;
  if (mode !== row[A.mode] || target.id !== row[A.target] || think !== row[A.think]) {
    world.setFields(id, ALLEGIANCE, [row[A.side]!, row[A.control]!, mode, target.id, think]);
  }

  const mounts = readMounts(world, id);
  let bearing = 0;
  let dx = 0;
  let dy = 0;
  let range = 0;
  if (target.id !== 0 && world.isLive(asEntityId(target.id))) {
    const from = world.position(id);
    const to = world.position(asEntityId(target.id));
    dx = delta(to.x, from.x);
    dy = delta(to.y, from.y);
    bearing = dx === 0 && dy === 0 ? 0 : (atan2_16(dy, dx) as number);
    range = rangeUnits(dx, dy);
  }
  const facing = target.id === 0 ? 0 : chooseFacing(hull, mounts, bearing, dx, dy, retreat, tieBreak);

  const sendEnergy = hull[H.planTicksLeft] === 0 || mode !== row[A.mode];
  const overload = !retreat && target.id !== 0 && range > 0 && range <= FIGHT_RANGE;
  if (sendEnergy) {
    if (overload) queueOverload(ctx, slot, id as number, mounts);
    ctx.queue({
      slot,
      kind: VERB_SET_ENERGY,
      payload: setEnergyPayload(id as number, energyOrder(hull, mounts, range, facing, retreat, overload)),
    });
    queueEw(ctx, slot, id as number, hull, retreat);
    queueCloak(ctx, slot, id as number, hull, retreat);
  }
  queueTractor(ctx, slot, id as number, hull, target.id, range, retreat);
  queueCraft(world, ctx, slot, id, retreat, range, target.id, sendEnergy);

  const cap = turnYawCap(hull[H.turnMode]!);
  if (target.id !== 0 && cap > 0) {
    const desired = headingFor(bearing, facing);
    const yaw = clampYaw(shortestArc(world.heading(id), angle16(desired)), cap);
    if (yaw !== 0) ctx.queue({ slot, kind: VERB_HELM, payload: helmWords(id as number, yaw) });
  }

  if (target.id === 0 || hull[H.fcPaid] !== 1) return;
  const targetHull = world.isLive(asEntityId(target.id)) ? readHull(world, asEntityId(target.id)) : null;
  for (let mountSlot = 0; mountSlot < mounts.length; mountSlot++) {
    const mount = mounts[mountSlot]!;
    if (!readyToFire(mount, dx, dy, world.heading(id) as number, retreat)) continue;
    if (targetHull && targetHidden(world, id, asEntityId(target.id), hull, targetHull)) continue;
    ctx.queue({
      slot,
      kind: VERB_FIRE,
      payload: firePayload(id as number, mountSlot, target.id),
    });
  }
}

function chooseTarget(
  world: World,
  self: EntityId,
  side: number,
  current: number,
  think: number,
  tick: number,
  tieBreak: (count: number) => number,
): { id: number; picked: boolean } {
  if (current !== 0 && think !== 0 && tick - think < RETARGET_TICKS && hostile(world, self, side, asEntityId(current))) {
    return { id: current, picked: false };
  }
  const ties = [0, 0, 0, 0, 0, 0];
  let count = 0;
  let best = distSq(0, 0);
  let have = false;
  for (const other of world.liveIds()) {
    if (!hostile(world, self, side, other)) continue;
    const from = world.position(self);
    const to = world.position(other);
    const d2 = distSq(delta(to.x, from.x), delta(to.y, from.y));
    if (!have || cmpDist(d2, best) < 0) {
      have = true;
      best = d2;
      ties[0] = other as number;
      count = 1;
    } else if (cmpDist(d2, best) === 0 && count < ties.length) {
      ties[count] = other as number;
      count += 1;
    }
  }
  if (count === 0) return { id: 0, picked: true };
  const pick = count === 1 ? 0 : tieBreak(count);
  return { id: ties[pick]!, picked: true };
}

function hostile(world: World, self: EntityId, side: number, other: EntityId): boolean {
  if ((other as number) === (self as number) || !world.isLive(other)) return false;
  const hull = readHull(world, other);
  if (hull[H.classCode] === 0 || hull[H.destroyed] === 1) return false;
  const row = world.getFields(other, ALLEGIANCE);
  const otherSide = row[A.side] === 1 ? 0 : row[A.side] === 2 ? 1 : -1;
  return otherSide >= 0 && otherSide !== side;
}

function shouldRetreat(hull: readonly number[]): boolean {
  let current = 0;
  let max = 0;
  for (let i = 0; i < 6; i++) {
    current += hull[H.shield0 + i]!;
    max += hull[H.shieldMax0 + i]!;
  }
  return max > 0 && current * 4 < max;
}

function chooseFacing(
  hull: readonly number[],
  mounts: readonly MountMem[],
  bearing: number,
  dx: number,
  dy: number,
  retreat: boolean,
  tieBreak: (count: number) => number,
): number {
  const shields = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) shields[i] = hull[H.shield0 + i]!;
  if (retreat) {
    const away = (bearing + HALF) & 0xffff;
    const fleeing = [0, 0, 0, 0, 0, 0];
    let n = 0;
    for (let facing = 0; facing < 6; facing++) {
      if (!bowAlong(headingFor(bearing, facing), away)) continue;
      fleeing[n] = facing;
      n += 1;
    }
    if (n === 0) return 3;
    return strongest(shields, fleeing, n, tieBreak);
  }
  const towardArc = [0, 0, 0, 0, 0, 0];
  const arcOnly = [0, 0, 0, 0, 0, 0];
  const toward = [0, 0, 0, 0, 0, 0];
  let nTowardArc = 0;
  let nArc = 0;
  let nToward = 0;
  for (let facing = 0; facing < 6; facing++) {
    const heading = headingFor(bearing, facing);
    const bears = weaponBears(mounts, heading, dx, dy);
    const closing = bowAlong(heading, bearing);
    if (bears) {
      arcOnly[nArc] = facing;
      nArc += 1;
    }
    if (closing) {
      toward[nToward] = facing;
      nToward += 1;
    }
    if (bears && closing) {
      towardArc[nTowardArc] = facing;
      nTowardArc += 1;
    }
  }
  if (nTowardArc > 0) return strongest(shields, towardArc, nTowardArc, tieBreak);
  if (nArc > 0) return strongest(shields, arcOnly, nArc, tieBreak);
  if (nToward > 0) return strongest(shields, toward, nToward, tieBreak);
  return strongest(shields, [0, 1, 2, 3, 4, 5], 6, tieBreak);
}

function strongest(
  shields: readonly number[],
  pool: readonly number[],
  count: number,
  tieBreak: (count: number) => number,
): number {
  let best = pool[0]!;
  let bestVal = shields[best]!;
  const ties = [best, 0, 0, 0, 0, 0];
  let n = 1;
  for (let i = 1; i < count; i++) {
    const facing = pool[i]!;
    const value = shields[facing]!;
    if (value > bestVal) {
      best = facing;
      bestVal = value;
      ties[0] = facing;
      n = 1;
    } else if (value === bestVal && n < ties.length) {
      ties[n] = facing;
      n += 1;
    }
  }
  if (n === 1) return ties[0]!;
  return ties[tieBreak(n)]!;
}

function sensorBoxes(hull: readonly number[]): number {
  const sum = hull[H.sensors]! + hull[H.scanners]! + hull[H.specialSensors]!;
  return sum > 0 ? sum : 0;
}

/** One battery point of ECCM while fighting, or ECM while running. Retasking the same total is free. */
function queueEw(ctx: TickContext, slot: number, entity: number, hull: readonly number[], retreat: boolean): void {
  if (sensorBoxes(hull) <= 0) return;
  const wantEcm = retreat ? 1 : 0;
  const wantEccm = retreat ? 0 : 1;
  if (hull[H.ecmPaid] === wantEcm && hull[H.eccmPaid] === wantEccm) return;
  const extra = wantEcm + wantEccm - (hull[H.ecmPaid]! + hull[H.eccmPaid]!);
  if (extra > 0 && hull[H.battery100]! < extra * ENERGY_SCALE) return;
  ctx.queue({
    slot,
    kind: VERB_SET_EW,
    payload: setEwPayload(entity, wantEcm, wantEccm),
  });
}

/** Photons inside the fight band arm as overloads. The energy plan pays that cost. */
function queueOverload(ctx: TickContext, slot: number, entity: number, mounts: readonly MountMem[]): void {
  for (let index = 0; index < mounts.length; index++) {
    const mount = mounts[index]!;
    const def = weaponDef(mount.weaponId);
    if (!def || def.internal !== INTERNAL_PHOTON || def.overloadArmCost <= 0) continue;
    if (mount.mode === MODE_OVERLOAD) continue;
    ctx.queue({
      slot,
      kind: VERB_SET_WEAPON_MODE,
      payload: setWeaponModePayload(entity, index, MODE_OVERLOAD),
    });
  }
}

/** Hold the target when a tractor is fitted and the range is inside the beam. */
function queueTractor(
  ctx: TickContext,
  slot: number,
  entity: number,
  hull: readonly number[],
  targetId: number,
  range: number,
  retreat: boolean,
): void {
  if (retreat || targetId === 0 || hull[H.tractors]! <= 0) return;
  if (range <= 0 || range > TRACTOR_RANGE) return;
  const bid = TRACTOR_BID < hull[H.tractors]! ? TRACTOR_BID : hull[H.tractors]!;
  if (hull[H.tractorMode] === TRACTOR_HOLD && hull[H.tractorTarget] === targetId && hull[H.tractorPaid]! >= bid) return;
  const extra = bid - hull[H.tractorPaid]!;
  if (extra > 0 && hull[H.battery100]! < extra * ENERGY_SCALE) return;
  ctx.queue({
    slot,
    kind: VERB_SET_TRACTOR,
    payload: setTractorPayload(entity, targetId, TRACTOR_HOLD, bid),
  });
}

function craftTables(world: World): boolean {
  return world.hasTable(CRAFT) && world.hasTable(BAY);
}

/** Launch what the bays hold, recall it on a timer or a retreat, mine when pursued, raid in transporter range. */
function queueCraft(
  world: World,
  ctx: TickContext,
  slot: number,
  id: EntityId,
  retreat: boolean,
  range: number,
  targetId: number,
  sendEnergy: boolean,
): void {
  if (!craftTables(world)) return;
  const self = id as number;
  const craft = world.getFields(id, CRAFT);
  if (retreat && sendEnergy && targetId !== 0 && range > 0 && range <= PURSUE_RANGE && craft[C.mines]! > 0) {
    ctx.queue({ slot, kind: VERB_LAY_MINE, payload: layMinePayload(self) });
  }
  if (!retreat && sendEnergy && targetId !== 0 && range <= TRANSPORTER_RANGE && craft[C.boarding]! >= 1) {
    const parties = craft[C.boarding]!;
    const mode = parties >= 2 ? 1 : 0;
    const commit = mode === 1 ? 1 : 0;
    ctx.queue({ slot, kind: VERB_RAID, payload: raidPayload(self, targetId, mode, commit) });
  }
  let fighterOut = false;
  let pfOut = false;
  for (const other of world.liveIds()) {
    const row = world.getFields(other, CRAFT);
    if (row[C.owner] !== self) continue;
    if (row[C.role] !== ROLE_FIGHTER && row[C.role] !== ROLE_PF) continue;
    const state = row[C.state]!;
    if (state !== STATE_OUT && state !== STATE_RETURN) continue;
    if (row[C.role] === ROLE_FIGHTER) fighterOut = true;
    if (row[C.role] === ROLE_PF) pfOut = true;
    if (state === STATE_OUT && recallDue(row, retreat, range, targetId)) {
      ctx.queue({ slot, kind: VERB_RECALL, payload: recallPayload(other as number) });
    }
  }
  if (retreat) return;
  const bays = world.getFields(id, BAY);
  for (let bay = 0; bay < BAY_COUNT; bay++) {
    const base = bay * BAY_STRIDE;
    const kind = bays[base + B.kind]!;
    const ready = bays[base + B.ready]!;
    if (ready <= 0) continue;
    if (kind === BAY_FIGHTER && !fighterOut) {
      ctx.queue({ slot, kind: VERB_LAUNCH_FIGHTER, payload: launchFighterPayload(self, bay) });
      fighterOut = true;
    } else if (kind === BAY_PF && !pfOut) {
      ctx.queue({ slot, kind: VERB_LAUNCH_PF, payload: launchPfPayload(self, bay) });
      pfOut = true;
    }
  }
}

function recallDue(row: readonly number[], retreat: boolean, range: number, targetId: number): boolean {
  if (retreat) return true;
  if (row[C.role] === ROLE_PF && targetId !== 0 && range <= TRANSPORTER_RANGE) return true;
  if (row[C.role] === ROLE_FIGHTER && row[C.timer]! <= ENDURANCE_TICKS - RECALL_AFTER) return true;
  return false;
}

/** A fitted cloak goes up on retreat and down when the ship turns back to fight. */
function queueCloak(ctx: TickContext, slot: number, entity: number, hull: readonly number[], retreat: boolean): void {
  const cost = hull[H.cloakCost]!;
  if (cost <= 0) return;
  const state = hull[H.cloakState]!;
  if (retreat) {
    if (state !== CLOAK_OFF) return;
    if (hull[H.battery100]! < cost * ENERGY_SCALE) return;
    ctx.queue({ slot, kind: VERB_SET_CLOAK, payload: setCloakPayload(entity, 1) });
    return;
  }
  if (state === CLOAK_OFF) return;
  ctx.queue({ slot, kind: VERB_SET_CLOAK, payload: setCloakPayload(entity, 0) });
}

function energyOrder(
  hull: readonly number[],
  mounts: readonly MountMem[],
  range: number,
  facing: number,
  retreat: boolean,
  overload: boolean,
): { lifeSupport: boolean; fireControl: boolean; speed: number; general: number; specific: number[]; weapons: EnergyAsk[] } {
  const gen = hull[H.warp100]! + hull[H.impulse100]! + hull[H.apr100]!;
  let left = gen > 0 ? gen : 0;
  const lifeCost = ENERGY_SCALE;
  const fcCost = ENERGY_SCALE;
  let life = false;
  let fireControl = false;
  if (left >= lifeCost) {
    life = true;
    left -= lifeCost;
  }
  if (left >= fcCost) {
    fireControl = true;
    left -= fcCost;
  }
  let speed = 0;
  if (retreat) speed = FLEE_SPEED;
  else if (range > CLOSE_RANGE) speed = CLOSE_SPEED;
  else if (range > TRANSPORTER_RANGE) speed = CREEP_SPEED;
  const unit = hull[H.moveCost100]!;
  if (unit > 0) {
    let affordable = 0;
    while (affordable < speed && left >= unit) {
      affordable += 1;
      left -= unit;
    }
    speed = affordable;
  }
  const weapons: EnergyAsk[] = [];
  if (!retreat) {
    for (let slot = 0; slot < mounts.length; slot++) {
      const mount = mounts[slot]!;
      const def = weaponDef(mount.weaponId);
      if (!def || mount.boxes <= 0) continue;
      const heavy = overload && def.internal === INTERNAL_PHOTON && def.overloadArmCost > 0;
      const cost = heavy ? def.overloadArmCost : weaponCost(def);
      if (cost <= 0) continue;
      const need = cost * ENERGY_SCALE;
      if (need > left) continue;
      left -= need;
      const mode = heavy ? MODE_OVERLOAD : def.internal === INTERNAL_PHOTON ? MODE_NORMAL : MODE_KEEP;
      weapons.push({ slot, request: cost, mode });
    }
  }
  const specific = [0, 0, 0, 0, 0, 0];
  const room = hull[H.shieldMax0 + facing]! - hull[H.shield0 + facing]!;
  const points = rulesDiv(left, ENERGY_SCALE);
  if (room > 0 && points > 0) {
    let give = points < SHIELD_POINTS ? points : SHIELD_POINTS;
    if (give > room) give = room;
    specific[facing] = give;
  }
  return { lifeSupport: life, fireControl, speed, general: 0, specific, weapons };
}

function readyToFire(mount: MountMem, dx: number, dy: number, heading: number, retreat: boolean): boolean {
  if (mount.boxes <= 0) return false;
  const def = weaponDef(mount.weaponId);
  if (!def) return false;
  if (def.internal !== INTERNAL_PHASER && def.internal !== INTERNAL_PHOTON) return false;
  if (def.internal === INTERNAL_PHOTON && mount.mode !== MODE_NORMAL && mount.mode !== MODE_PROXIMITY && mount.mode !== MODE_OVERLOAD) {
    return false;
  }
  const arm = photonArm(def, mount.mode);
  if (retreat && def.internal === INTERNAL_PHOTON && mount.charge100 < arm.cost * ENERGY_SCALE) return false;
  if (!charged(mount, def)) return false;
  const reach = outerRange(def);
  if (reach <= 0 || !withinRange(dx, dy, reach)) return false;
  return shotInArc(heading, dx, dy, mount.arcId, def.omni);
}

function photonArm(def: WeaponDef, mode: number): { cost: number; ticks: number } {
  if (mode === MODE_OVERLOAD) return { cost: def.overloadArmCost, ticks: def.overloadArmTicks };
  return { cost: def.armCost, ticks: def.armTicks };
}

function charged(mount: MountMem, def: WeaponDef): boolean {
  if (def.internal === INTERNAL_PHASER) {
    if (def.chargeCost <= 0) return false;
    return mount.charge100 >= def.chargeCost * ENERGY_SCALE;
  }
  if (def.internal === INTERNAL_PHOTON) {
    const arm = photonArm(def, mount.mode);
    if (arm.cost <= 0) return false;
    return mount.charge100 >= arm.cost * ENERGY_SCALE && mount.ticksCharging >= arm.ticks;
  }
  return false;
}

function weaponBears(mounts: readonly MountMem[], heading: number, dx: number, dy: number): boolean {
  for (const mount of mounts) {
    if (mount.boxes <= 0) continue;
    const def = weaponDef(mount.weaponId);
    if (!def) continue;
    if (def.internal !== INTERNAL_PHASER && def.internal !== INTERNAL_PHOTON) continue;
    const reach = outerRange(def);
    if (reach <= 0) continue;
    if (shotInArc(heading, dx, dy, mount.arcId, def.omni)) return true;
  }
  return false;
}

function weaponCost(def: WeaponDef): number {
  if (def.internal === INTERNAL_PHASER) return def.chargeCost;
  if (def.internal === INTERNAL_PHOTON) return def.armCost;
  return 0;
}

function outerRange(def: WeaponDef): number {
  if (def.internal === INTERNAL_PHOTON) return def.maxRange;
  let max = 0;
  for (const band of def.bands) {
    if (band[0]! > max) max = band[0]!;
  }
  return max;
}

function headingFor(bearing: number, facing: number): number {
  return (bearing - rulesDiv(facing * FULL, 6)) & 0xffff;
}

function bowAlong(heading: number, direction: number): boolean {
  const hx = cos16(angle16(heading)) as number;
  const hy = sin16(angle16(heading)) as number;
  const dx = cos16(angle16(direction)) as number;
  const dy = sin16(angle16(direction)) as number;
  return positive(dot(hx, hy, dx, dy));
}

function positive(value: I64): boolean {
  return value.hi > 0 || (value.hi === 0 && value.lo > 0);
}

function rangeUnits(dx: number, dy: number): number {
  return rulesDiv(isqrt64(distSq(dx, dy)), FX_ONE);
}

function cmpDist(a: I64, b: I64): number {
  if (a.hi < b.hi) return -1;
  if (a.hi > b.hi) return 1;
  if (a.lo < b.lo) return -1;
  if (a.lo > b.lo) return 1;
  return 0;
}

function clampYaw(arc: number, cap: number): number {
  if (arc > cap) return cap;
  if (arc < -cap) return -cap;
  return arc;
}

function helmWords(entity: number, yaw: number): Uint8Array {
  const out = new Uint8Array(8);
  writeU32(out, 0, entity | 0);
  writeU32(out, 4, yaw | 0);
  return out;
}
