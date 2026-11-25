/**
 * HUD frame for the thin bars. Fractional scale is a real CSS size,
 * not a bitmap blown up after the fact.
 */
import type { HullReadout } from '../../../engine/view/view-model.ts';
export type FrameMode = 'classic' | 'safe' | 'wide';

export interface HudFrame {
  readonly mode: FrameMode;
  readonly left: number;
  readonly width: number;
  readonly safeLeft: number;
  readonly safeWidth: number;
}

export function barSize(units: number, scale: number): number {
  const safe = scale > 0 ? scale : 1;
  return units * safe;
}

/** Backing store in device pixels. The canvas is never CSS-scaled up. */
export function backingStore(cssWidth: number, cssHeight: number, devicePixelRatio: number): { width: number; height: number } {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}

/**
 * Classic fills a 4:3 stage. Safe-area centres a 4:3 box on wider stages.
 * Wide (21:9 and up) keeps that box for content clusters while the bar
 * itself spans the stage.
 */
export function hudFrame(width: number, height: number): HudFrame {
  const safeHeight = Math.max(height, 1);
  const safeWidth = Math.min(width, (safeHeight * 4) / 3);
  const safeLeft = Math.max(0, (width - safeWidth) / 2);
  const aspect = width / safeHeight;
  if (aspect <= 4 / 3 + 0.02) {
    return { mode: 'classic', left: 0, width, safeLeft: 0, safeWidth: width };
  }
  if (aspect >= 21 / 9) {
    return { mode: 'wide', left: 0, width, safeLeft, safeWidth };
  }
  return { mode: 'safe', left: safeLeft, width: safeWidth, safeLeft, safeWidth };
}

/** Remaining hull boxes over the most seen for this contact. Shields are not hull. */
const hullPeak = new Map<number, number>();

export function hullBoxes(hull: HullReadout): number {
  return hull.forward + hull.center + hull.aft;
}

export function hullFraction(id: number, hull: HullReadout): number {
  const current = hullBoxes(hull);
  const seen = hullPeak.get(id) ?? 0;
  const max = current > seen ? current : seen;
  hullPeak.set(id, max);
  if (max <= 0) return 0;
  return current / max;
}

export function resetHullPeaks(): void {
  hullPeak.clear();
}

export function capacitorFraction(weapons: readonly { family: string; charge: number; cost: number }[]): number {
  let charge = 0;
  let cost = 0;
  for (const weapon of weapons) {
    if (weapon.family !== 'phaser' || weapon.cost <= 0) continue;
    charge += Math.max(0, Math.min(weapon.charge, weapon.cost));
    cost += weapon.cost;
  }
  if (cost <= 0) return 0;
  return Math.max(0, Math.min(1, charge / cost));
}

/** Soonest mission timer, as mm:ss. Empty when no timer carries a tick count. */
export function soonestCountdown(timers: readonly unknown[], hz = 30): string {
  let best: number | null = null;
  for (const timer of timers) {
    if (typeof timer !== 'object' || timer === null) continue;
    const record = timer as { ticks?: unknown; remaining?: unknown };
    const ticks = typeof record.ticks === 'number' ? record.ticks : typeof record.remaining === 'number' ? record.remaining : null;
    if (ticks === null || ticks < 0) continue;
    if (best === null || ticks < best) best = ticks;
  }
  if (best === null) return '';
  return missionClock(best, hz);
}

/** Ordered-speed scale. 32 until the view model reports speedMax. */
export function speedScale(self: object | null): { max: number; powerTick: number | null } {
  const record = (self ?? {}) as { speedMax?: unknown; speedMaxForPower?: unknown };
  const max = typeof record.speedMax === 'number' && record.speedMax > 0 ? record.speedMax : 32;
  const powerTick = typeof record.speedMaxForPower === 'number' ? record.speedMaxForPower : null;
  return { max, powerTick };
}

export function missionClock(tick: number, hz = 30): string {
  const seconds = Math.max(0, Math.floor(tick / hz));
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

export interface PowerBars {
  readonly power: number;
  readonly systems: number;
  readonly overdraw: boolean;
}

/**
 * Optional EnergyView demand fields. `SelfView.energy` does not publish
 * these yet; once Engine does, `powerBars` will use them automatically.
 * See https://github.com/danielsegan/sfc2.js/issues/145 (plan item 8).
 */
export interface EnergyViewDemand {
  readonly warp: number;
  readonly impulse: number;
  readonly apr: number;
  readonly lastReason: string;
  /** Total energy demanded by systems this period. */
  readonly demand?: number;
  /** Generation minus demand. Negative means overdraw. */
  readonly surplus?: number;
}

/**
 * Lower-display Power / Systems bars. Prefers a published EnergyView
 * `demand` (and `surplus` when present). Otherwise falls back to
 * {@link weaponCostDemandStandIn}.
 */
export function powerBars(
  energy: EnergyViewDemand,
  weapons: readonly { cost: number }[],
): PowerBars {
  const power = Math.max(0, energy.warp + energy.impulse + energy.apr);
  if (hasPublishedDemand(energy)) return liveEnergyDemand(power, energy);
  return weaponCostDemandStandIn(power, energy.lastReason, weapons);
}

export function hasPublishedDemand(energy: EnergyViewDemand): boolean {
  return typeof energy.demand === 'number' && Number.isFinite(energy.demand);
}

function liveEnergyDemand(power: number, energy: EnergyViewDemand): PowerBars {
  const systems = Math.max(0, energy.demand ?? 0);
  const overdraw =
    energy.lastReason === 'overDraw'
    || (typeof energy.surplus === 'number' ? energy.surplus < 0 : systems > power);
  return { power, systems, overdraw };
}

/**
 * Stand-in Systems total used until EnergyView.demand is published
 * (https://github.com/danielsegan/sfc2.js/issues/145). Sums weapon
 * arming costs only; it is not the ship's true draw.
 */
export function weaponCostDemandStandIn(
  power: number,
  lastReason: string,
  weapons: readonly { cost: number }[],
): PowerBars {
  let systems = 0;
  for (const weapon of weapons) systems += Math.max(0, weapon.cost);
  return { power, systems, overdraw: lastReason === 'overDraw' || systems > power };
}

export type AlertLamp = 'green' | 'yellow' | 'red';

/**
 * Provisional. The lamps follow hit and alert events. The original buttons
 * set the alert; there is no alert command in this duel yet.
 */
export function alertLamp(events: readonly { kind: string; severity?: string; id?: string }[]): AlertLamp {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;
    if (event.kind === 'hit') return 'red';
    if (event.kind === 'alert' && event.severity === 'crit') return 'red';
    if (event.kind === 'alert' && event.severity === 'warn' && event.id !== 'ok' && event.id !== 'helm') return 'yellow';
  }
  return 'green';
}

export function turnFraction(self: object | null): number | null {
  if (!self) return null;
  const record = self as { turnRateNow16PerTick?: number; turnRateLimit16PerTick?: number };
  const limit = record.turnRateLimit16PerTick;
  const now = record.turnRateNow16PerTick;
  if (typeof limit !== 'number' || typeof now !== 'number' || !(limit > 0)) return null;
  return Math.max(0, Math.min(1, Math.abs(now) / limit));
}
