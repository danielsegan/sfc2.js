import { describe, expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial } from 'three';
import { frameCameraFit, frameDistance, measureShipFrame } from './ship-stage.ts';

describe('ship framing', () => {
  it('frames from the mesh bounds and ignores a far-away header radius', () => {
    const root = triangle([100, 0, 0, 102, 0, 0, 100, 2, 0]);
    root.userData.radius = 10000;
    const measured = measureShipFrame(root);
    expect(measured.frame.degenerate).toBe(false);
    expect(measured.center.x).toBeCloseTo(101);
    expect(measured.center.y).toBeCloseTo(1);
    expect(measured.center.z).toBeCloseTo(0);
    expect(measured.frame.radius).toBeCloseTo(Math.hypot(2, 2) / 2);
    expect(frameDistance(measured.frame.radius)).toBeLessThan(10);
    expect(frameDistance(root.userData.radius)).toBe(30000);
  });

  it('treats a point or a line as an empty dummy and keeps a thin triangle', () => {
    expect(measureShipFrame(triangle([0, 0, 0, 0, 0, 0, 0, 0, 0])).frame.degenerate).toBe(true);
    expect(measureShipFrame(triangle([0, 0, 0, 3, 0, 0, 1, 0, 0])).frame.degenerate).toBe(true);
    const thin = measureShipFrame(triangle([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0]));
    expect(thin.frame.degenerate).toBe(false);
    expect(thin.frame.radius).toBeGreaterThan(0);
  });

  it('keeps the near plane in front of a tiny hull', () => {
    expect(frameDistance(0)).toBe(3);
    const fit = frameCameraFit(0.02);
    expect(fit.near).toBeLessThan(fit.distance * 0.5);
    expect(fit.near).toBeGreaterThan(0);
    expect(fit.far).toBeGreaterThan(fit.distance);
  });
});

function triangle(positions: number[]): Group {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const root = new Group();
  root.add(new Mesh(geometry, new MeshLambertMaterial()));
  return root;
}
