import { describe, expect, it } from 'vitest';
import {
  classifyLogChannel,
  isOfficerPage,
  mapEmpireColor,
  mapRingDistances,
  mapZoomIndex,
  MAP_ZOOM_LEVELS,
  nearestMapZoom,
  OFFICER_PAGES,
  stepMapZoom,
} from './officer-mfd.ts';

describe('officer MFD helpers', () => {
  it('lists the ten officer pages in strip order', () => {
    expect(OFFICER_PAGES.map((page) => page.id)).toEqual([
      'helm',
      'repair',
      'science',
      'marines',
      'shuttles',
      'comms',
      'map',
      'fleet',
      'energy',
      'options',
    ]);
    expect(isOfficerPage('map')).toBe(true);
    expect(isOfficerPage('weapons')).toBe(false);
  });

  it('steps three map zoom tiers at about 2× each and clamps at the ends', () => {
    expect([...MAP_ZOOM_LEVELS]).toEqual([8, 16, 32]);
    expect(MAP_ZOOM_LEVELS[1] / MAP_ZOOM_LEVELS[0]).toBe(2);
    expect(MAP_ZOOM_LEVELS[2] / MAP_ZOOM_LEVELS[1]).toBe(2);
    expect(nearestMapZoom(8)).toBe(8);
    expect(nearestMapZoom(20)).toBe(16);
    expect(stepMapZoom(8, 1)).toBe(16);
    expect(stepMapZoom(16, 1)).toBe(32);
    expect(stepMapZoom(32, 1)).toBe(32);
    expect(stepMapZoom(8, -1)).toBe(8);
    expect(stepMapZoom(32, -1)).toBe(16);
    expect(mapZoomIndex(16)).toBe(1);
  });

  it('picks tighter range rings as the map zooms in', () => {
    const wide = mapRingDistances(8, 80);
    const close = mapRingDistances(32, 80);
    expect(wide[wide.length - 1]!).toBeGreaterThan(close[close.length - 1]!);
  });

  it('sorts message-log events into the four Communication filters', () => {
    expect(classifyLogChannel({ kind: 'hit' })).toBe('engineering');
    expect(classifyLogChannel({ kind: 'alert', id: 'headingOrdered' })).toBe('engineering');
    expect(classifyLogChannel({ kind: 'sim', id: 'ok' })).toBe('mission');
    expect(classifyLogChannel({ kind: 'alert', id: 'probeLaunched' })).toBe('science');
    expect(classifyLogChannel('Fighter launched')).toBe('fleet');
  });

  it('uses our own empire colours for map glyphs', () => {
    expect(mapEmpireColor('fed')).toBe('#4f8fd6');
    expect(mapEmpireColor('kli')).toBe('#b23a3a');
    expect(mapEmpireColor('unknown')).toBe('#8a9aab');
  });
});
