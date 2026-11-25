import { describe, expect, it } from 'vitest';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial } from 'three';
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

  it('treats collinear faces, an empty selected surface, and a speck as degenerate', () => {
    const axes = new Group();
    axes.add(meshOf([0, 0, 0, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 5, 0, 0, 3, 0, 0, 0, 0, 0, 0, 6, 0, 0, 1]));
    expect(measureShipFrame(axes).frame).toMatchObject({ degenerate: true, radial: false });

    const speck = new Group();
    speck.add(meshOf([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 20000, 0, 0, 40000, 0, 0]));
    const speckFrame = measureShipFrame(speck).frame;
    expect(speckFrame.degenerate).toBe(true);
    expect(speckFrame.radius).toBe(0);

    expect(measureShipFrame(new Group()).frame.degenerate).toBe(true);
  });

  it('marks invisible, fully transparent, and blended materials as unpaintable', () => {
    const hidden = new MeshLambertMaterial();
    hidden.visible = false;
    expect(measureShipFrame(wrap(hidden)).frame).toMatchObject({ degenerate: false, unpaintable: true });

    const clear = new MeshLambertMaterial({ transparent: true, opacity: 0 });
    expect(measureShipFrame(wrap(clear)).frame.unpaintable).toBe(true);

    const blended = new MeshLambertMaterial({ blending: AdditiveBlending, transparent: true });
    expect(measureShipFrame(wrap(blended)).frame).toMatchObject({ degenerate: false, unpaintable: true });

    expect(measureShipFrame(wrap(new MeshLambertMaterial({ color: 0x6688aa }))).frame.unpaintable).toBe(false);
  });

  it('notices vertices that sit on a ball', () => {
    const radius = 2;
    const positions = [
      0, radius, 0, radius, 0, 0, 0, 0, radius,
      0, radius, 0, 0, 0, radius, -radius, 0, 0,
      0, radius, 0, -radius, 0, 0, 0, 0, -radius,
      0, radius, 0, 0, 0, -radius, radius, 0, 0,
      0, -radius, 0, 0, 0, radius, radius, 0, 0,
      0, -radius, 0, -radius, 0, 0, 0, 0, radius,
      0, -radius, 0, 0, 0, -radius, -radius, 0, 0,
      0, -radius, 0, radius, 0, 0, 0, 0, -radius,
    ];
    const frame = measureShipFrame(triangle(positions)).frame;
    expect(frame.degenerate).toBe(false);
    expect(frame.radial).toBe(true);
    expect(frame.unpaintable).toBe(false);
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
  return wrap(new MeshLambertMaterial(), positions);
}

function meshOf(positions: number[]): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new Mesh(geometry, new MeshLambertMaterial());
}

function wrap(material: MeshLambertMaterial, positions: number[] = [0, 0, 0, 2, 0, 0, 0, 2, 0]): Group {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const root = new Group();
  root.add(new Mesh(geometry, material));
  return root;
}
