import { describe, expect, it } from 'vitest';
import { createSyntheticDuel } from '../../../engine/duel/match.ts';
import {
  facingSector,
  sectorOutline,
  sectorPositions,
  wedgesFor,
  wedgeStyle,
  type ArcWeapon,
} from './arcs.ts';
import { reportedBeams, reportedFlashes } from './beams.ts';
import {
  alertLamp,
  backingStore,
  barSize,
  capacitorFraction,
  hudFrame,
  hullFraction,
  missionClock,
  powerBars,
  resetHullPeaks,
  soonestCountdown,
  speedScale,
} from './frame.ts';
import { hudScaleFromLocation } from '../field-hud.ts';
import { fieldRelease, orbitOnPress } from './pointer.ts';
import { defaultOverheadDistance, gridLevel, gridSegments, latticeCoords, visibleWorldWidth } from './grid.ts';
import { avoidObstacles, formatRangeTag, markerHeading, offscreenPoint, pickContact, stackTags } from './tags.ts';
import {
  FIELD_FOV,
  FIELD_GRID,
  GRID_MAJOR_ALPHA,
  GRID_MAJOR_FACTOR,
  GRID_MINOR_ALPHA,
  GRID_MINOR_UNIT,
  MAJOR_CELLS_ACROSS,
  showsWedge,
} from './tokens.ts';

const TICK = 1000 / 30;

function weapon(partial: Partial<ArcWeapon> & Pick<ArcWeapon, 'slotIndex' | 'code'>): ArcWeapon {
  return {
    arcFrom16: 0,
    arcTo16: 16384,
    arcFull: false,
    rangeMax: 20,
    rangeBands: [10],
    ready: true,
    status: 'ready',
    mode: 0,
    ...partial,
  };
}

describe('tactical field', () => {
  it('fits five major grid cells across the default overhead view', () => {
    const aspect = 16 / 9;
    const major = GRID_MINOR_UNIT * GRID_MAJOR_FACTOR;
    const distance = defaultOverheadDistance(aspect, FIELD_FOV, major, MAJOR_CELLS_ACROSS);
    const width = visibleWorldWidth(distance, FIELD_FOV, aspect);
    expect(width / major).toBeCloseTo(MAJOR_CELLS_ACROSS, 5);
  });

  it('keeps grid lines on the world lattice and fades minors when they crowd', () => {
    const wide = gridLevel(40);
    expect(wide.minorStep).toBe(1);
    expect(wide.majorStep).toBe(5);
    expect(wide.minorAlpha).toBeCloseTo(GRID_MINOR_ALPHA, 5);
    const fading = gridLevel(14);
    expect(fading.minorStep).toBe(1);
    expect(fading.minorAlpha).toBeLessThan(GRID_MINOR_ALPHA);
    expect(fading.minorAlpha).toBeGreaterThan(0);
    const promoted = gridLevel(10);
    expect(promoted.minorStep).toBe(5);
    expect(promoted.majorStep).toBe(25);
    const parked = gridSegments(0.4, -2, 20, 20, 5, 0);
    const shifted = gridSegments(3.2, -2, 20, 20, 5, 0);
    expect(latticeCoords(parked, 0)).toEqual(latticeCoords(shifted, 0));
    for (const x of latticeCoords(parked, 0)) expect(Math.abs(x % 5)).toBeLessThan(1e-6);
  });

  it('meets the field-grid contrast targets on black (hud-layout.md §7.2, §7.6)', () => {
    const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const onBlack = (alpha: number) => {
      const rgb = [(FIELD_GRID >> 16) & 0xff, (FIELD_GRID >> 8) & 0xff, FIELD_GRID & 0xff].map((v) => channel((v / 255) * alpha));
      const lum = 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
      return (lum + 0.05) / 0.05;
    };
    expect(onBlack(GRID_MAJOR_ALPHA)).toBeGreaterThanOrEqual(1.5);
    expect(onBlack(GRID_MINOR_ALPHA)).toBeLessThan(onBlack(GRID_MAJOR_ALPHA));
  });

  it('draws wedges from the view arc and skips reload-counted racks', () => {
    expect(showsWedge('DroA')).toBe(false);
    expect(showsWedge('ADD12')).toBe(false);
    expect(showsWedge('DroI')).toBe(true);
    expect(showsWedge('DroVI')).toBe(true);
    expect(showsWedge('TEST-PH')).toBe(true);
    const phaser = weapon({ slotIndex: 0, code: 'TEST-PH', status: 'ready', ready: true });
    const drone = weapon({ slotIndex: 1, code: 'DroA', arcFull: true, rangeMax: 10 });
    const fighter = weapon({ slotIndex: 2, code: 'DroI', arcFull: true, rangeMax: 12, status: 'charging', ready: false });
    const wedges = wedgesFor([phaser, drone, fighter], [0, 1, 2]);
    expect(wedges.map((item) => item.rangeMax)).toEqual([20, 12]);
    expect(wedgeStyle(phaser).pattern).toBe('solid');
    expect(wedgeStyle(fighter).pattern).toBe('dashed');
    expect(wedgeStyle({ ready: false, status: 'overload' }).pattern).toBe('dashdot');
    expect(wedgeStyle({ ready: false, status: 'destroyed' }).fill).toBe(0);
    const positions = sectorPositions(0, 0, 16384, false, 0, 4, 4, 0);
    expect(positions[0]).toBeCloseTo(0, 5);
    expect(positions[2]).toBeCloseTo(0, 5);
    expect(positions[3]).toBeCloseTo(4, 5);
    expect(positions[5]).toBeCloseTo(0, 4);
    const outline = sectorOutline(0, 0, 16384, false, 0, 4, 4, 0);
    expect(outline.length).toBeGreaterThan(12);
    const facing = facingSector(0);
    expect(facing.to16 - facing.from16 === 0 ? 65536 : (facing.to16 - facing.from16 + 65536) % 65536).toBeCloseTo(65536 / 6, 4);
  });

  it('draws beams only from events that name shooter, target, and family', () => {
    const hit = { kind: 'hit', ship: 2, facing: 0, amount: 1 };
    expect(reportedBeams([hit])).toEqual([]);
    expect(reportedFlashes([hit])).toEqual([{ ship: 2, facing: 0 }]);
    const beam = reportedBeams([{ kind: 'beam', shooter: 1, target: 2, family: 'phaser' }]);
    expect(beam).toHaveLength(1);
    expect(beam[0]?.family).toBe('phaser');
    expect(reportedBeams([{ kind: 'beam', shooter: 1, target: 2, family: 'photon' }])).toEqual([]);
    expect(reportedBeams([{ kind: 'fire', shooter: 1, target: 2 }])).toEqual([]);
  });

  it('clamps off-screen tags inside the view and outside obstacles', () => {
    const view = { left: 0, top: 0, right: 200, bottom: 120 };
    expect(offscreenPoint(0, 0, true, view, 10)).toBeNull();
    const right = offscreenPoint(3, 0, true, view, 10);
    expect(right?.edge).toBe('right');
    expect(right?.x).toBe(190);
    expect(right?.y).toBeCloseTo(60, 4);
    const blocked = avoidObstacles(
      { x: 100, y: 100, edge: 'bottom' },
      view,
      [{ left: 0, top: 80, right: 200, bottom: 120 }],
      8,
    );
    expect(blocked.y).toBeLessThanOrEqual(80);
    const stacked = stackTags(
      [
        { id: 1, x: 20, y: 40, edge: 'right' },
        { id: 2, x: 20, y: 48, edge: 'right' },
      ],
      16,
      view,
      8,
    );
    const ys = stacked.map((tag) => tag.y).sort((a, b) => a - b);
    expect((ys[1] ?? 0) - (ys[0] ?? 0)).toBeGreaterThanOrEqual(16);
    expect(formatRangeTag(53.165)).toBe('53.17k');
    expect(pickContact([{ id: 4, x: 10, y: 10, kind: 'ship' }, { id: 5, x: 40, y: 10, kind: 'shot' }], 12, 11, 8)).toBe(4);
  });

  it('scales bar heights and the canvas backing store for a fractional UI scale', () => {
    expect(barSize(24, 1.5)).toBe(36);
    expect(barSize(32, 1.5)).toBe(48);
    expect(backingStore(200, 100, 1.5)).toEqual({ width: 300, height: 150 });
    expect(backingStore(200, 100, 2)).toEqual({ width: 400, height: 200 });
    const safe = hudFrame(1600, 900);
    expect(safe.mode).toBe('safe');
    expect(safe.width / 900).toBeCloseTo(4 / 3, 5);
    expect(hudFrame(1024, 768).mode).toBe('classic');
    expect(hudFrame(2560, 1080).mode).toBe('wide');
  });

  it('reads hull boxes, not shield totals, and snaps the HUD scale', () => {
    resetHullPeaks();
    expect(hullFraction(1, { forward: 0, center: 0, aft: 0 })).toBe(0);
    expect(hullFraction(2, { forward: 4, center: 2, aft: 2 })).toBe(1);
    expect(hullFraction(2, { forward: 2, center: 1, aft: 1 })).toBe(0.5);
    expect(hudScaleFromLocation('')).toBe(1);
    expect(hudScaleFromLocation('?hudScale=0.5')).toBe(1);
    expect(hudScaleFromLocation('?hudScale=1.2')).toBe(1.25);
    expect(hudScaleFromLocation('?hudScale=1.5')).toBe(1.5);
    expect(hudScaleFromLocation('?hudScale=4.4')).toBe(4);
    expect(soonestCountdown([])).toBe('');
    expect(soonestCountdown([{ ticks: 90 }, { remaining: 30 }])).toBe('00:01');
    expect(speedScale(null).max).toBe(32);
    expect(speedScale({ speedMax: 16, speedMaxForPower: 8 })).toEqual({ max: 16, powerTick: 8 });
    expect(orbitOnPress(0, false)).toBe(false);
    expect(orbitOnPress(0, true)).toBe(true);
    expect(orbitOnPress(1, false)).toBe(true);
    expect(orbitOnPress(2, false)).toBe(false);
    expect(fieldRelease(2, false, 3, 1)).toBe('target');
    expect(fieldRelease(2, false, 5, 1)).toBe('none');
    expect(fieldRelease(2, false, 6, 1.5)).toBe('target');
    expect(fieldRelease(0, true, 2, 1)).toBe('none');
    expect(fieldRelease(0, false, 2, 1)).toBe('steer');
    expect(fieldRelease(1, false, 2, 1)).toBe('none');
  });

  it('reads gauges and ordered heading from the view model', () => {
    expect(capacitorFraction([{ family: 'phaser', charge: 1, cost: 4 }, { family: 'photon', charge: 4, cost: 4 }])).toBe(0.25);
    expect(missionClock(0)).toBe('00:00');
    expect(missionClock(1800)).toBe('01:00');
    expect(powerBars({ warp: 10, impulse: 0, apr: 0, lastReason: '' }, [{ cost: 4 }]).overdraw).toBe(false);
    expect(powerBars({ warp: 2, impulse: 0, apr: 0, lastReason: 'ok' }, [{ cost: 8 }]).overdraw).toBe(true);
    expect(alertLamp([{ kind: 'hit' }])).toBe('red');
    expect(alertLamp([])).toBe('green');
    expect(markerHeading({ heading16: 10 })).toBe(10);
    expect(markerHeading({ heading16: 10, headingOrdered16: 16384 })).toBe(16384);
  });

  it('copies weapon range onto the view without changing the sim hash', () => {
    const match = createSyntheticDuel({ timeScale: 1, rulesTurnTicks: 4, renew: false });
    match.frame(TICK);
    const before = match.stateHash();
    const vm = match.view();
    expect(match.stateHash()).toBe(before);
    const phaser = vm.self?.weapons.find((item) => item.code === 'TEST-PH');
    const photon = vm.self?.weapons.find((item) => item.code === 'TEST-PHOT');
    expect(vm.self?.hull).toEqual({ forward: 0, center: 0, aft: 0 });
    expect(phaser?.rangeMax).toBe(20);
    expect(phaser?.rangeBands).toEqual([10, 20]);
    expect(photon?.rangeMax).toBe(30);
    expect(vm.self?.heading16).toBeTypeOf('number');
  });
});
