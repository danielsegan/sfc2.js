import { describe, expect, it } from 'vitest';
import {
  PHOTON_HEAD_SIZE,
  PHOTON_TRAIL_LENGTH,
  photonMarks,
  rememberPhotonSample,
  trimPhotonTrail,
  type PhotonSample,
} from './photon-visual.ts';

function alongX(n: number, step: number): PhotonSample[] {
  const points: PhotonSample[] = [];
  for (let i = 0; i < n; i++) points.push({ x: i * step, y: 0.6, z: 0 });
  return points;
}

describe('photon marker', () => {
  it('draws a head large enough to read at duel range', () => {
    const marks = photonMarks([{ x: 4, y: 0.6, z: -2 }]);
    expect(marks).toEqual([{ x: 4, y: 0.6, z: -2, size: PHOTON_HEAD_SIZE, opacity: 1 }]);
    expect(PHOTON_HEAD_SIZE).toBeGreaterThan(1.5);
  });

  it('keeps a short trail behind a moving torpedo and drops samples farther back', () => {
    const trail = trimPhotonTrail(alongX(8, 1), PHOTON_TRAIL_LENGTH, 5);
    const head = trail[trail.length - 1]!;
    const tail = trail[0]!;
    expect(head.x).toBe(7);
    expect(head.x - tail.x).toBeCloseTo(PHOTON_TRAIL_LENGTH, 5);
    expect(trail.length).toBeGreaterThan(1);
    expect(trail.length).toBeLessThanOrEqual(5);
    const marks = photonMarks(trail);
    expect(marks[marks.length - 1]?.size).toBe(PHOTON_HEAD_SIZE);
    expect(marks[0]?.size).toBeLessThan(PHOTON_HEAD_SIZE);
    expect(marks[0]?.opacity).toBeLessThan(marks[marks.length - 1]?.opacity ?? 0);
  });

  it('does not grow a trail while the torpedo is still on the bow', () => {
    let history: PhotonSample[] = [];
    history = rememberPhotonSample(history, { x: 1, y: 0.6, z: 0 });
    history = rememberPhotonSample(history, { x: 1, y: 0.6, z: 0 });
    expect(history).toEqual([{ x: 1, y: 0.6, z: 0 }]);
  });
});
