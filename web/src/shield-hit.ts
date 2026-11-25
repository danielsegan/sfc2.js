/** Which of the six shield arcs, or the centre ship, a click landed on. Canvas angles, y down. */

const TWO_PI = Math.PI * 2;

export type ShieldHit = { kind: 'facing'; facing: number } | { kind: 'centre' };

export function shieldHitAt(x: number, y: number, width: number, height: number): ShieldHit | null {
  const cx = width / 2;
  const cy = height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const outer = Math.min(width, height) * 0.48;
  const inner = outer * 0.42;
  if (dist > outer) return null;
  if (dist < inner) return { kind: 'centre' };
  const angle = Math.atan2(dy, dx);
  const start = -Math.PI / 2 - Math.PI / 6;
  let rel = angle - start;
  rel = ((rel % TWO_PI) + TWO_PI) % TWO_PI;
  return { kind: 'facing', facing: Math.floor(rel / (Math.PI / 3)) % 6 };
}

export function shieldFacingAt(x: number, y: number, width: number, height: number): number | null {
  const hit = shieldHitAt(x, y, width, height);
  return hit?.kind === 'facing' ? hit.facing : null;
}
