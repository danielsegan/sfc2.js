/**
 * Click to heading. The sim receives one uint16. The conversion uses the
 * same integer atan2 as the sim, on deltas scaled to Q16.16.
 * Heading 0 is world +x (right on a north-up map). Positive heading is +y.
 */
import { atan2_16 } from '../../engine/core/angle.ts';

const SCALE = 65536;

export function headingToward(fromX: number, fromY: number, toX: number, toY: number): number | null {
  if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(toX) || !Number.isFinite(toY)) {
    return null;
  }
  const dx = Math.round((toX - fromX) * SCALE);
  const dy = Math.round((toY - fromY) * SCALE);
  if (dx === 0 && dy === 0) return null;
  return atan2_16(dy, dx) as number;
}

