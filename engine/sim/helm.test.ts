import { describe, expect, it } from 'vitest';
import { angle16, shortestArc } from '../core/angle.ts';
import { HELM_MODES, readHelmView, type HelmMode } from './helm.ts';
import { HEADING_FIELDS, HEADING_HOLD, HEADING_OFF, HEADING_STEER } from './heading.ts';
import type { WorldSnap } from './world.ts';

function snap(mode: number, aim: number, heading: number, live = 1): WorldSnap {
  return {
    slotCount: 1,
    generations: [1],
    live: [live],
    retired: [0],
    pendingDespawn: [],
    tables: [
      { id: 'heading', fieldCount: 1, data: [heading] },
      { id: 'headingOrder', fieldCount: HEADING_FIELDS, data: [mode, aim, 0, 0] },
    ],
  };
}

function arc(from: number, to: number): number {
  return shortestArc(angle16(from), angle16(to));
}

describe('helm view', () => {
  it('keeps het in the mode list and does not return it without the het table', () => {
    const modes: readonly HelmMode[] = HELM_MODES;
    expect(modes).toEqual(['none', 'heading', 'het']);
    expect(readHelmView(snap(HEADING_OFF, 50000, 0), 0).mode).toBe('none');
    expect(readHelmView(snap(HEADING_STEER, 50000, 0), 0).mode).toBe('heading');
    expect(readHelmView(snap(HEADING_HOLD, 0, 0), 0).mode).toBe('heading');
  });

  it('reports the signed short-way arc, including the half-turn tie', () => {
    expect(readHelmView(snap(HEADING_STEER, 50000, 0), 0)).toEqual({
      mode: 'heading',
      remainingTurn16: -15536,
      hetDelayTicks: 0,
    });
    expect(readHelmView(snap(HEADING_STEER, 50000, 0), 0).remainingTurn16).toBe(arc(0, 50000));
    expect(readHelmView(snap(HEADING_STEER, 6000, 0), 0).remainingTurn16).toBe(6000);
    expect(readHelmView(snap(HEADING_STEER, 32768, 0), 0).remainingTurn16).toBe(-32768);
    expect(readHelmView(snap(HEADING_HOLD, 100, 100), 0)).toEqual({
      mode: 'heading',
      remainingTurn16: 0,
      hetDelayTicks: 0,
    });
    expect(readHelmView(snap(HEADING_STEER, 0, 50000), 0).remainingTurn16).toBe(15536);
  });

  it('is idle with no order, a dead ship, or no heading table', () => {
    expect(readHelmView(snap(HEADING_OFF, 50000, 0), 0)).toEqual({
      mode: 'none',
      remainingTurn16: 0,
      hetDelayTicks: 0,
    });
    expect(readHelmView(snap(HEADING_STEER, 50000, 0, 0), 0).mode).toBe('none');
    expect(readHelmView(snap(HEADING_STEER, 50000, 0), 1).mode).toBe('none');
    const bare: WorldSnap = {
      slotCount: 1,
      generations: [1],
      live: [1],
      retired: [0],
      pendingDespawn: [],
      tables: [{ id: 'heading', fieldCount: 1, data: [0] }],
    };
    expect(readHelmView(bare, 0)).toEqual({ mode: 'none', remainingTurn16: 0, hetDelayTicks: 0 });
  });
});
