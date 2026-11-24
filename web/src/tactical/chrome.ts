/**
 * Vertical budget so the 3D field stays clear of page chrome
 * (hud-layout.md §2, §7.1). Bars dock to the field; the interface
 * sits between the field and the bottom bar and must not cover it.
 */
import { BAR_BOTTOM_UNITS, BAR_TOP_UNITS } from './tokens.ts';

export interface ChromeBudget {
  readonly headerMax: number;
  readonly skirmishMax: number;
  readonly consoleMax: number;
  readonly topBar: number;
  readonly bottomBar: number;
  readonly fieldMin: number;
}

/**
 * Split a viewport so the play field keeps a usable height at
 * 1.0–4.0× HUD scale. Values are CSS pixels after `--ui-scale` zoom.
 */
export function fieldChromeBudget(viewportHeight: number, hudScale: number): ChromeBudget {
  const scale = hudScale > 0 ? hudScale : 1;
  const topBar = BAR_TOP_UNITS * scale;
  const bottomBar = BAR_BOTTOM_UNITS * scale;
  const height = Math.max(viewportHeight, 1);
  const available = Math.max(0, height - topBar - bottomBar);
  const preferred = Math.max(Math.round(height * 0.42), Math.min(280, available * 0.55));
  const fieldMin = Math.min(Math.max(0, preferred), Math.round(available * 0.7));
  const chrome = Math.max(0, available - fieldMin);
  const headerMax = Math.round(chrome * 0.18);
  const skirmishMax = Math.round(chrome * 0.26);
  const consoleMax = Math.max(0, chrome - headerMax - skirmishMax);
  return { headerMax, skirmishMax, consoleMax, topBar, bottomBar, fieldMin };
}

export function applyChromeBudget(budget: ChromeBudget): void {
  const root = document.documentElement;
  root.style.setProperty('--chrome-header-max', `${String(budget.headerMax)}px`);
  root.style.setProperty('--chrome-skirmish-max', `${String(budget.skirmishMax)}px`);
  root.style.setProperty('--chrome-console-max', `${String(budget.consoleMax)}px`);
}
