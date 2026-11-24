/** About 150 degrees. 65536 * 150 / 360 truncates to 27306. */
export const LARGE_TURN_16 = 27306;

const ORANGE = 0xe08a2e;
const DARK_RED = 0x7a1e1e;

/** Shortest signed arc, in uint16 units, from the current nose to the ordered heading. */
export function remainingArc16(from: number, to: number): number {
  const start = Math.round(from) | 0;
  const aim = Math.round(to) | 0;
  let delta = ((aim - start) % 65536 + 65536) % 65536;
  if (delta > 32768) delta -= 65536;
  return delta;
}

/** Wedge colour from the angle still left. Time remaining is not an input. */
export function wedgeColor(arc16: number): number {
  const mag = arc16 < 0 ? -arc16 : arc16;
  return mag >= LARGE_TURN_16 ? DARK_RED : ORANGE;
}
