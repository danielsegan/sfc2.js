import { describe, expect, it } from 'vitest';
import { formatHetDelay, formatHetReadout, hudLogLine, latestAlert, TICKS_PER_SECOND } from './hud.ts';

describe('HET helm panel', () => {
  it('shows hetDelayTicks as seconds at 30 Hz', () => {
    expect(TICKS_PER_SECOND).toBe(30);
    expect(formatHetDelay({ mode: 'none', hetDelayTicks: 170 })).toBe('—');
    expect(formatHetDelay({ mode: 'heading', hetDelayTicks: 0 })).toBe('—');
    expect(formatHetDelay({ mode: 'het', hetDelayTicks: 0 })).toBe('0.0 s');
    expect(formatHetDelay({ mode: 'het', hetDelayTicks: 30 })).toBe('1.0 s');
    expect(formatHetDelay({ mode: 'het', hetDelayTicks: 170 })).toBe('5.7 s');
    expect(formatHetDelay(null)).toBe('—');
    expect(formatHetReadout({ mode: 'none', hetDelayTicks: 0, hetSuccessChance: 100, hetBreakdown: false })).toBe('100%');
    expect(formatHetReadout({ mode: 'none', hetDelayTicks: 0, hetSuccessChance: 75, hetBreakdown: true })).toBe(
      '75% breakdown',
    );
    expect(formatHetReadout({ mode: 'het', hetDelayTicks: 30, hetSuccessChance: 100, hetBreakdown: false })).toBe(
      '1.0 s · 100%',
    );
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

  it('shows the player\'s own yawClamped and hides other ships\' from the log and banner', () => {
    const own = { kind: 'alert' as const, tick: 8, id: 'yawClamped', severity: 'info' as const, ship: 3, amount: 200 };
    const other = { kind: 'alert' as const, tick: 9, id: 'yawClamped', severity: 'info' as const, ship: 7, amount: 200 };
    expect(hudLogLine(8, own, 3)).toBe('t8  Yaw clamped to 200');
    expect(hudLogLine(9, other, 3)).toBeNull();
    expect(latestAlert([other, own], 3)).toBe('yawClamped');
    expect(latestAlert([other], 3)).toBe('');
  });
