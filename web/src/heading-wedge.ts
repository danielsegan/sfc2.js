/** About 150 degrees. 65536 * 150 / 360 truncates to 27306. */
export const LARGE_TURN_16 = 27306;

/** Degenerate wedges below this remaining arc are not drawn. */
export const WEDGE_MIN_16 = 8;

const ORANGE = 0xe08a2e;
const DARK_RED = 0x7a1e1e;

/** The helm fields the heading wedge reads. Matches `HelmView` on `SelfView.helm`. */
export interface HelmWedgeView {
  readonly mode: 'none' | 'heading' | 'het';
  readonly remainingTurn16: number;
}

export interface HelmWedgeDraw {
  readonly arc16: number;
  readonly color: number;
}

/** Wedge colour from the angle still left. Time remaining is not an input. */
export function wedgeColor(arc16: number): number {
  const mag = arc16 < 0 ? -arc16 : arc16;
  return mag >= LARGE_TURN_16 ? DARK_RED : ORANGE;
}

/**
 * Pure drawing helper. The remaining arc comes from `HelmView.remainingTurn16`;
 * this does not compute a bearing. Hidden when mode is `none` or the arc is
 * smaller than `WEDGE_MIN_16`.
 */
export function helmWedge(helm: HelmWedgeView | null | undefined): HelmWedgeDraw | null {
  if (!helm || helm.mode === 'none') return null;
  const arc16 = helm.remainingTurn16 | 0;
  const mag = arc16 < 0 ? -arc16 : arc16;
  if (mag < WEDGE_MIN_16) return null;
  return { arc16, color: wedgeColor(arc16) };
}
