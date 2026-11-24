/** HUD scale steps from hud-layout.md §6: 1.0–4.0 in quarters. */

export function uiScaleQuarters(): readonly number[] {
  const out: number[] = [];
  for (let q = 4; q <= 16; q++) out.push(q);
  return out;
}

export function formatUiScale(quarter: number): string {
  const whole = Math.floor(quarter / 4);
  const rem = quarter % 4;
  if (rem === 0) return String(whole);
  if (rem === 1) return `${String(whole)}.25`;
  if (rem === 2) return `${String(whole)}.5`;
  return `${String(whole)}.75`;
}

/** Largest step whose 1024×768 canvas fits. Quarters are exact in binary. */
export function fitUiScale(width: number, height: number): number {
  let best = 4;
  for (const quarter of uiScaleQuarters()) {
    if (1024 * quarter <= width * 4 && 768 * quarter <= height * 4) best = quarter;
  }
  return best;
}

/** Bitmap plates sample the nearest larger authored plate. Vector plates ignore this. */
export function bitmapPlateTier(quarter: number): 2 | 4 {
  return quarter <= 8 ? 2 : 4;
}
