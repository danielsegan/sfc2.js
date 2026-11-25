/**
 * three.js stage for one ship. Period lighting is one sun plus ambient.
 * HD adds a fill and ACES tone mapping. The turntable owns the spin.
 */

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import type { LoadedShip } from './ship-catalog.ts';
import type { RenderTier } from './ship-texture.ts';

/** A mesh this thin on two axes does not paint a surface that can spin. */
export const PAINTABLE_EXTENT = 1e-4;
/** Triangle area at or below this is a point or a set of collinear edges. */
const AREA_EPSILON = 1e-8;
/** Area divided by the box's face areas. Below this, the surface is a speck in a huge box. */
const SPECK_RATIO = 1e-4;
/** Radius spread for "these vertices lie on a sphere". */
const RADIAL_CV = 0.05;
const RADIAL_MIN_SAMPLES = 8;

export interface ShipFrame {
  radius: number;
  /**
   * Nothing to spin: empty, a point, a line, zero area (collinear faces,
   * including a 3-axis cross), no visible triangles, or a speck inside a
   * much larger box. The every-ship check skips the row.
   */
  degenerate: boolean;
  /** Every visible material is invisible, fully transparent, or blended. */
  unpaintable: boolean;
  /** Vertices sit on a ball, so a flat color does not show a turn. */
  radial: boolean;
}

export function frameDistance(radius: number): number {
  const safe = radius > 0 && Number.isFinite(radius) ? radius : 1;
  return safe * 3;
}

/** Camera distance, near, and far for a bounding-sphere radius. Near stays in front of the hull. */
export function frameCameraFit(radius: number): { distance: number; near: number; far: number } {
  const distance = frameDistance(radius);
  const near = Math.min(Math.max(distance / 100, 1e-6), distance * 0.5);
  const far = Math.max(distance * 40, 400);
  return { distance, near, far };
}

/**
 * World bounds of the visible meshes under `root`. The center is in the
 * same space as `root` when `root` has an identity world matrix.
 */
export function measureShipFrame(root: Object3D): { frame: ShipFrame; center: Vector3 } {
  const measured = walkSurfaces(root);
  const empty: ShipFrame = { radius: 0, degenerate: true, unpaintable: false, radial: false };
  if (measured.box.isEmpty()) return { frame: empty, center: new Vector3() };
  const size = measured.box.getSize(new Vector3());
  const center = measured.box.getCenter(new Vector3());
  if (![size.x, size.y, size.z, center.x, center.y, center.z].every((value) => Number.isFinite(value))) {
    return { frame: empty, center: new Vector3() };
  }
  const dims = [size.x, size.y, size.z].sort((left, right) => left - right);
  const faceArea = size.x * size.y + size.y * size.z + size.z * size.x;
  const speck = faceArea > 0 && measured.area / faceArea < SPECK_RATIO;
  const degenerate =
    (dims[1] ?? 0) < PAINTABLE_EXTENT || measured.triangles === 0 || measured.area <= AREA_EPSILON || speck;
  const radius = 0.5 * Math.hypot(size.x, size.y, size.z);
  const longest = dims[2] ?? 0;
  const ball = longest > PAINTABLE_EXTENT && (dims[0] ?? 0) > longest * 0.5;
  return {
    frame: {
      radius: degenerate || !Number.isFinite(radius) ? 0 : radius,
      degenerate,
      unpaintable: measured.meshes > 0 && measured.paintable === 0,
      radial: !degenerate && ball && radialSpread(measured.samples, center),
    },
    center,
  };
}

export function applyShipPose(root: Object3D, yaw: number, pitch: number): void {
  root.rotation.order = 'YXZ';
  root.rotation.y = yaw;
  root.rotation.x = pitch;
}

export interface ShipStageOptions {
  /** Keep the drawing buffer addressable after render. The interactive viewer leaves this off. */
  preserveDrawingBuffer?: boolean;
}

/** One framebuffer sample. Callers compare it and drop it. It is not a screenshot export. */
export interface FrameSample {
  width: number;
  height: number;
  pixels: Uint8Array;
  /** 0, or the last WebGL error drained after the read. */
  glError: number;
}

export interface ShipStage {
  show(ship: LoadedShip | null): ShipFrame;
  setPose(yaw: number, pitch: number): void;
  setTier(tier: RenderTier): void;
  resize(): void;
  render(): void;
  /** Read the drawing buffer. Valid in the same turn as `render`. */
  readFrame(): FrameSample;
  dispose(): void;
}

export function createShipStage(
  canvas: HTMLCanvasElement,
  tier: RenderTier = 'period',
  options?: ShipStageOptions,
): ShipStage {
  const scene = new Scene();
  scene.background = new Color(0x0b1118);
  const camera = new PerspectiveCamera(40, 1, 0.01, 400);
  const pivot = new Group();
  pivot.name = 'turntable';
  scene.add(pivot);

  const ambient = new AmbientLight(0xffffff, 0.28);
  const sun = new DirectionalLight(0xfff4e0, 1.15);
  sun.position.set(3, 5, 4);
  const fill = new HemisphereLight(0x8aa4c8, 0x1a120c, 0.35);
  scene.add(ambient, sun, fill);

  const stars = makeStars();
  scene.add(stars);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: options?.preserveDrawingBuffer === true,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x0b1118, 1);
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  applyTier(renderer, fill, tier);
  frameCamera(camera, 1);

  return {
    show(ship) {
      pivot.clear();
      if (ship === null) {
        frameCamera(camera, 1);
        return { radius: 1, degenerate: false, unpaintable: false, radial: false };
      }
      const root = ship.mesh.root;
      root.removeFromParent();
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      root.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);
      const measured = measureShipFrame(root);
      if (!measured.frame.degenerate) {
        root.position.set(-measured.center.x, -measured.center.y, -measured.center.z);
      }
      pivot.add(root);
      frameCamera(camera, measured.frame.degenerate ? 1 : measured.frame.radius);
      return measured.frame;
    },
    setPose(yaw, pitch) {
      applyShipPose(pivot, yaw, pitch);
    },
    setTier(next) {
      applyTier(renderer, fill, next);
    },
    resize() {
      const width = canvas.clientWidth || canvas.width || 1;
      const height = canvas.clientHeight || canvas.height || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    },
    render() {
      renderer.render(scene, camera);
    },
    readFrame() {
      const gl = renderer.getContext();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      if (width > 0 && height > 0) gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let glError = 0;
      for (let i = 0; i < 8; i++) {
        const error = gl.getError();
        if (error === gl.NO_ERROR) break;
        glError = error;
      }
      return { width, height, pixels, glError };
    },
    dispose() {
      pivot.clear();
      stars.geometry.dispose();
      const material = stars.material;
      if (!Array.isArray(material)) material.dispose();
      renderer.dispose();
    },
  };
}

function applyTier(renderer: WebGLRenderer, fill: HemisphereLight, tier: RenderTier): void {
  fill.visible = tier === 'hd';
  renderer.toneMapping = tier === 'hd' ? ACESFilmicToneMapping : NoToneMapping;
  renderer.toneMappingExposure = 1;
}

function frameCamera(camera: PerspectiveCamera, radius: number): void {
  const fit = frameCameraFit(radius);
  camera.fov = 40;
  camera.position.set(0, fit.distance * 0.18, fit.distance);
  camera.near = fit.near;
  camera.far = fit.far;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

interface SurfaceTally {
  box: Box3;
  area: number;
  triangles: number;
  meshes: number;
  paintable: number;
  samples: Vector3[];
}

function walkSurfaces(root: Object3D): SurfaceTally {
  const tally: SurfaceTally = {
    box: new Box3(),
    area: 0,
    triangles: 0,
    meshes: 0,
    paintable: 0,
    samples: [],
  };
  const corner = new Vector3();
  walkMesh(root, tally, corner);
  return tally;
}

function walkMesh(obj: Object3D, tally: SurfaceTally, corner: Vector3): void {
  if (!obj.visible) return;
  if (obj instanceof Mesh) {
    tally.meshes += 1;
    if (materialsOf(obj).some(drawsSurface)) tally.paintable += 1;
    const position = obj.geometry.getAttribute('position');
    const index = obj.geometry.getIndex();
    if (position !== undefined && position.count >= 3) {
      const triCount = Math.floor((index === null ? position.count : index.count) / 3);
      for (let tri = 0; tri < triCount; tri += 1) {
        const ids = [0, 1, 2].map((offset) => (index === null ? tri * 3 + offset : index.getX(tri * 3 + offset)));
        const points = ids.map((id) => {
          corner.set(position.getX(id), position.getY(id), position.getZ(id));
          return obj.localToWorld(corner).clone();
        });
        const [a, b, c] = points;
        if (a === undefined || b === undefined || c === undefined) continue;
        tally.area += triangleArea(a, b, c);
        tally.triangles += 1;
        tally.box.expandByPoint(a);
        tally.box.expandByPoint(b);
        tally.box.expandByPoint(c);
        if (tally.samples.length < 3000) tally.samples.push(a, b, c);
      }
    }
  }
  for (const child of obj.children) walkMesh(child, tally, corner);
}

function triangleArea(a: Vector3, b: Vector3, c: Vector3): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return 0.5 * Math.hypot(cx, cy, cz);
}

function radialSpread(samples: readonly Vector3[], center: Vector3): boolean {
  if (samples.length < RADIAL_MIN_SAMPLES) return false;
  let mean = 0;
  const radii: number[] = [];
  for (const sample of samples) {
    const radius = sample.distanceTo(center);
    radii.push(radius);
    mean += radius;
  }
  mean /= radii.length;
  if (!(mean > PAINTABLE_EXTENT)) return false;
  let variance = 0;
  for (const radius of radii) {
    const delta = radius - mean;
    variance += delta * delta;
  }
  return Math.sqrt(variance / radii.length) / mean < RADIAL_CV;
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** Invisible, fully transparent, or a blended (additive / alpha) effect. */
function drawsSurface(material: Material): boolean {
  if (!material.visible || material.opacity <= 0.001) return false;
  return material.blending !== AdditiveBlending;
}

function makeStars(): Points {
  const count = 240;
  const positions = new Float32Array(count * 3);
  let seed = 17;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const radius = 80;
  for (let i = 0; i < count; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new Points(geometry, new PointsMaterial({ color: 0xd8e2ec, size: 1.4, sizeAttenuation: false }));
}
