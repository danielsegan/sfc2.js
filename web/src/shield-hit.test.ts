import { describe, expect, it } from 'vitest';
import { shieldFacingAt, shieldHitAt } from './shield-hit.ts';

describe('shield facing hit test', () => {
  const size = 180;

  it('maps the six compass clicks onto bow-clockwise facings', () => {
    const mid = size / 2;
    const ring = 70;
    expect(shieldFacingAt(mid, mid - ring, size, size)).toBe(0);
    expect(shieldFacingAt(mid + ring * Math.cos(-Math.PI / 6), mid + ring * Math.sin(-Math.PI / 6), size, size)).toBe(1);
    expect(shieldFacingAt(mid + ring * Math.cos(Math.PI / 6), mid + ring * Math.sin(Math.PI / 6), size, size)).toBe(2);
    expect(shieldFacingAt(mid, mid + ring, size, size)).toBe(3);
    expect(shieldFacingAt(mid + ring * Math.cos((5 * Math.PI) / 6), mid + ring * Math.sin((5 * Math.PI) / 6), size, size)).toBe(4);
    expect(shieldFacingAt(mid + ring * Math.cos(-Math.PI * 5 / 6), mid + ring * Math.sin(-Math.PI * 5 / 6), size, size)).toBe(5);
    expect(shieldFacingAt(mid, mid, size, size)).toBeNull();
  });

  it('treats the centre ship as a hit of its own, not a facing', () => {
    const mid = size / 2;
    expect(shieldHitAt(mid, mid, size, size)).toEqual({ kind: 'centre' });
    expect(shieldHitAt(mid + 4, mid - 4, size, size)).toEqual({ kind: 'centre' });
    expect(shieldHitAt(0, 0, size, size)).toBeNull();
    expect(shieldHitAt(mid, mid - 70, size, size)).toEqual({ kind: 'facing', facing: 0 });
  });
});
