import { describe, expect, it } from 'vitest';
import {
  arcPieSvgPath,
  classifyArcZone,
  facingTowardPoint,
  hardpointPositions,
  scanGatedTargetStatus,
  SYSTEM_BUTTONS,
} from './schematic.ts';

describe('docked interface bar schematic helpers', () => {
  it('defines the six system switcher buttons', () => {
    expect(SYSTEM_BUTTONS.map((item) => item.id)).toEqual([
      'shields',
      'ew',
      'transporters',
      'tractors',
      'shuttles',
      'conversion',
    ]);
  });

  it('places weapon hardpoints around the schematic by firing arc without stacking', () => {
    const layout = hardpointPositions([
      { slotIndex: 0, arcFull: false, arcFrom16: 57344, arcTo16: 8192 },
      { slotIndex: 1, arcFull: false, arcFrom16: 57344, arcTo16: 8192 },
      { slotIndex: 2, arcFull: false, arcFrom16: 8192, arcTo16: 24576 },
      { slotIndex: 3, arcFull: false, arcFrom16: 24576, arcTo16: 40960 },
      { slotIndex: 4, arcFull: true, arcFrom16: 0, arcTo16: 0 },
    ]);
    expect(layout[0]?.zone).toBe('bow');
    expect(layout[1]?.zone).toBe('bow');
    expect(layout[0]?.xPct).not.toBe(layout[1]?.xPct);
    expect(layout[2]?.zone).toBe('fwdStbd');
    expect(layout[3]?.zone).toBe('aft');
    expect(layout[4]?.zone).toBe('center');
  });

  it('classifies port arcs separately from starboard arcs', () => {
    expect(classifyArcZone({ arcFull: false, arcFrom16: 40960, arcTo16: 57344 })).toBe('fwdPort');
    expect(arcPieSvgPath(0, 0, true)).toContain('a7 7');
    expect(arcPieSvgPath(57344, 8192, false)).toContain('A7 7');
  });

  it('computes the facing oriented toward a target point using BAM angles', () => {
    expect(facingTowardPoint(0, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(facingTowardPoint(0, { x: 0, y: 0 }, { x: 0, y: 10 })).toBe(2);
    expect(facingTowardPoint(0, { x: 0, y: 0 }, { x: -10, y: 0 })).toBe(3);
    expect(facingTowardPoint(16384, { x: 0, y: 0 }, { x: 0, y: 10 })).toBe(0);
  });

  it('gates target shield and weapon status by detection and cloak', () => {
    expect(scanGatedTargetStatus(null)).toMatchObject({ lock: 'none', shieldVisible: false });
    expect(scanGatedTargetStatus({ detected: false, cloaked: false, rangeFromSelf: 12 })).toMatchObject({
      lock: 'undetected',
      shieldVisible: false,
    });
    expect(scanGatedTargetStatus({ detected: true, cloaked: true, rangeFromSelf: 8 })).toMatchObject({
      lock: 'cloaked',
      shieldVisible: false,
    });
    const tracked = scanGatedTargetStatus({ detected: true, cloaked: false, rangeFromSelf: 14.2 });
    expect(tracked.lock).toBe('track');
    expect(tracked.shieldVisible).toBe(true);
    expect(tracked.scanLabel).toContain('14.2');
    expect(tracked.weaponStatusLabel).toContain('#145');
  });
});
