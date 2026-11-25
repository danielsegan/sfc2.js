/**
 * Desired-speed mapping for the lower speed bar.
 *
 * Click and left-button drag set a continuous ordered speed proportional
 * to pointer X in 0..`max`, rounded to the native resolution of
 * `DuelMatch.setSpeed` (tenths of a speed point). The order is sent live
 * while the pointer moves, once the rounded value changes. Wheel and
 * right-click do nothing on the bar. The `<` / `>` end arrows and the
 * speed up/down key actions stay at exactly ±1.0 via `bumpSpeed`.
 */

export type SpeedBarGesture = 'start' | 'move' | 'end' | 'ignore';

/** Native resolution of `DuelMatch.setSpeed`: tenths of a speed point. */
export const SPEED_ORDER_STEP = 0.1;

/** Left-button pointerdown starts a capture-drag; later moves/up apply only while captured. */
export function speedBarGesture(type: string, button: number, captured: boolean): SpeedBarGesture {
  if (type === 'pointerdown' && button === 0) return 'start';
  if (type === 'pointermove' && captured) return 'move';
  if ((type === 'pointerup' || type === 'pointercancel') && captured) return 'end';
  return 'ignore';
}

export function barFractionFromClientX(clientX: number, left: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(width) || !Number.isFinite(clientX) || !Number.isFinite(left)) return 0;
  return (clientX - left) / width;
}

/**
 * Ordered speed for a 0–1 position along the bar, quantized to
 * `SPEED_ORDER_STEP` so the value survives `clampSpeed`.
 */
export function speedFromBarFraction(fraction: number, max: number, step = SPEED_ORDER_STEP): number {
  const cap = Number.isFinite(max) && max > 0 ? max : 0;
  if (cap <= 0) return 0;
  const t = Number.isFinite(fraction) ? fraction : 0;
  const raw = Math.max(0, Math.min(1, t)) * cap;
  const quant = Number.isFinite(step) && step > 0 ? step : SPEED_ORDER_STEP;
  return Math.round(raw / quant) * quant;
}

/** Format current or ordered speed with one decimal place. */
export function formatSpeed(value: number): string {
  if (!Number.isFinite(value)) return '0.0';
  return value.toFixed(1);
}
