/** Which of the six shield arcs a click landed on. Canvas angles, y down. */

const TWO_PI = Math.PI * 2;

export function shieldFacingAt(x: number, y: number, width: number, height: number): number | null {
  const cx = width / 2;
  const cy = height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const outer = Math.min(width, height) * 0.48;
  const inner = outer * 0.42;
  if (dist < inner || dist > outer) return null;
  const angle = Math.atan2(dy, dx);
  const start = -Math.PI / 2 - Math.PI / 6;
  let rel = angle - start;
  rel = ((rel % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.floor(rel / (Math.PI / 3)) % 6;
}
