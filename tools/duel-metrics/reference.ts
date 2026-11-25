/**
 * Observed duel numbers the metrics table scores against.
 * These are gameplay readings recorded in our own words in
 * docs/rules/observed-reference.md. They are not a copied table.
 */

export type Confidence = 'H' | 'M' | 'L' | 'H/M' | 'L-M';
export type Verdict = 'pass' | 'fail' | 'n/a';

export interface Scored {
  readonly text: string;
  readonly confidence: string;
  readonly result: Verdict;
}

function pointText(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

/** Relative error at most 10%. A zero reference passes only at zero. */
export function scorePoint(ours: number | null, value: number, confidence: Confidence): Scored {
  if (ours === null || !Number.isFinite(ours)) {
    return { text: pointText(value), confidence, result: 'fail' };
  }
  const span = value < 0 ? -value : value;
  const diff = ours > value ? ours - value : value - ours;
  const ok = span === 0 ? ours === 0 : diff <= span * 0.1 + 1e-9;
  return { text: pointText(value), confidence, result: ok ? 'pass' : 'fail' };
}

/** Pass when our value lies inside the observed interval. */
export function scoreRange(ours: number | null, lo: number, hi: number, confidence: Confidence): Scored {
  const text = `${pointText(lo)}–${pointText(hi)}`;
  if (ours === null || !Number.isFinite(ours)) return { text, confidence, result: 'fail' };
  const ok = ours >= lo - 1e-9 && ours <= hi + 1e-9;
  return { text, confidence, result: ok ? 'pass' : 'fail' };
}

/** A seeded roll passes when the sample is inside the observed min and max. */
export function scoreRoll(
  ours: number | null,
  min: number,
  max: number,
  expected: number,
  confidence: Confidence,
): Scored {
  const text = `${min}–${max} (expected ${pointText(expected)})`;
  if (ours === null || !Number.isFinite(ours)) return { text, confidence, result: 'fail' };
  const ok = ours >= min && ours <= max;
  return { text, confidence, result: ok ? 'pass' : 'fail' };
}

export function scoreNone(ours: number | null, confidence: Confidence): Scored {
  return { text: 'none', confidence, result: ours === null ? 'pass' : 'fail' };
}

export function scoreNa(): Scored {
  return { text: '—', confidence: '—', result: 'n/a' };
}
