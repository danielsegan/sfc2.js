/**
 * Play-field pointer grammar.
 * Plain left-click is reserved for helm (a heading order). It must not orbit.
 * Alt+left-drag and middle-drag orbit, and a short Alt press must not steer.
 * Right-click under 4 logical px targets. The gate is logical px, so it
 * grows with the HUD scale.
 */

export const CLICK_LOGICAL_PX = 4;

export function orbitOnPress(button: number, alt: boolean): boolean {
  if (button === 1) return true;
  return button === 0 && alt;
}

export type FieldRelease = 'target' | 'steer' | 'none';

export function fieldRelease(button: number, alt: boolean, movedCssPx: number, hudScale: number): FieldRelease {
  const scale = hudScale >= 1 ? hudScale : 1;
  if (movedCssPx > CLICK_LOGICAL_PX * scale) return 'none';
  if (button === 2) return 'target';
  if (button === 0 && alt) return 'none';
  if (button === 0) return 'steer';
  return 'none';
}
