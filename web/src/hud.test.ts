import { describe, expect, it } from 'vitest';
import { formatHetDelay, hudLogLine, TICKS_PER_SECOND } from './hud.ts';

describe('HET helm panel', () => {
  it('shows hetDelayTicks as seconds at 30 Hz', () => {
    expect(TICKS_PER_SECOND).toBe(30);
    expect(formatHetDelay({ mode: 'none', hetDelayTicks: 170 })).toBe('—');
    expect(formatHetDelay({ mode: 'heading', hetDelayTicks: 0 })).toBe('—');
    expect(formatHetDelay({ mode: 'het', hetDelayTicks: 0 })).toBe('0.0 s');
    expect(formatHetDelay({ mode: 'het', hetDelayTicks: 30 })).toBe('1.0 s');
    expect(formatHetDelay({ mode: 'het', hetDelayTicks: 170 })).toBe('5.7 s');
    expect(formatHetDelay(null)).toBe('—');
  });

  it('writes hetActive and hetInvalidDir rejections to the log', () => {
    expect(hudLogLine(12, { kind: 'alert', tick: 12, id: 'hetActive', severity: 'warn', ship: 1, amount: 4000 })).toBe(
      't12  hetActive',
    );
    expect(hudLogLine(13, { kind: 'alert', tick: 13, id: 'hetInvalidDir', severity: 'warn', ship: 1, amount: 0 })).toBe(
      't13  hetInvalidDir',
    );
  });
});
