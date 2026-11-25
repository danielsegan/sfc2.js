import { describe, expect, it } from 'vitest';
import { degPerSec, failedRows, renderJson, renderMarkdown, tableRows } from './report.ts';
import { collectMetrics } from './run.ts';

const report = collectMetrics();

describe('duel metrics', () => {
  it('repeats on the synthetic hulls', () => {
    expect(renderJson(collectMetrics())).toBe(renderJson(report));
  }, 30_000);

  it('scores every observed row and does not fail one', () => {
    const rows = tableRows(report);
    const failed = failedRows(report);
    expect(failed, failed.map((row) => `${row.ship} ${row.metric} ${row.case}: ${row.ours} vs ${row.reference}`).join('\n')).toEqual([]);
    expect(rows.some((row) => row.result === 'pass')).toBe(true);
    expect(rows.some((row) => row.metric === 'HET rate')).toBe(true);
    expect(rows.some((row) => row.metric === 'time to speed')).toBe(true);
    expect(rows.some((row) => row.metric === 'deceleration')).toBe(true);
  });

  it('prints our value, the reference, its confidence, and the result', () => {
    const text = renderMarkdown(report);
    expect(text).toContain('| Ours | Reference | Confidence | Result |');
    expect(text).toContain('F-CA-like');
    expect(text).toContain('K-D7-like');
    expect(text).toContain('HET');
    const sample = tableRows(report).find((row) => row.metric === 'turn rate' && row.ship === 'F-CA-like' && row.case === 'speed 10.00');
    expect(sample?.result).toBe('pass');
    expect(sample?.reference).toBe('7.3–7.9');
    expect(sample?.confidence).toBe('H');
    expect(degPerSec(47)).toBe('7.7454');
  });
});
