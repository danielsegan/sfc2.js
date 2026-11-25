/**
 * Desired-speed mapping for the lower speed bar.
 *
 * Click, drag, and wheel all talk in whole speed points from 0 to `max`
 * (the same integer step `bumpSpeed(±1)` uses). A click or a drag along
 * the bar sets the ordered speed to the rounded position; wheel still
 * steps by one. Whether CE 2.670 snaps drag to those integer points or
 * uses a smoother detent is TO VERIFY against the reference notes.
 */

export type SpeedBarGesture = 'start' | 'move' | 'end' | 'ignore';

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

/** Integer ordered speed for a 0–1 position along the bar. */
export function speedFromBarFraction(fraction: number, max: number): number {
  const cap = Number.isFinite(max) && max > 0 ? max : 0;
  if (cap <= 0) return 0;
  const t = Number.isFinite(fraction) ? fraction : 0;
  return Math.round(Math.max(0, Math.min(1, t)) * cap);
}
