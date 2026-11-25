/**
 * three.js stage for one ship. Period lighting is one sun plus ambient.
 * HD adds a fill and ACES tone mapping. The turntable owns the spin.
 */

import {
  ACESFilmicToneMapping,
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
  type Object3D,
} from 'three';
import type { LoadedShip } from './ship-catalog.ts';
import type { RenderTier } from './ship-texture.ts';

/** A mesh this thin on two axes does not paint a surface that can spin. */
export const PAINTABLE_EXTENT = 1e-4;

export interface ShipFrame {
  radius: number;
  /** Empty, a point, or a line. The every-ship check skips the row. */
  degenerate: boolean;
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
  const box = new Box3();
  const corner = new Vector3();
  walkBounds(root, box, corner);
  if (box.isEmpty()) return { frame: { radius: 0, degenerate: true }, center: new Vector3() };
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  if (![size.x, size.y, size.z, center.x, center.y, center.z].every((value) => Number.isFinite(value))) {
    return { frame: { radius: 0, degenerate: true }, center: new Vector3() };
  }
  const dims = [size.x, size.y, size.z].sort((left, right) => left - right);
  const degenerate = (dims[1] ?? 0) < PAINTABLE_EXTENT;
  const radius = 0.5 * Math.hypot(size.x, size.y, size.z);
  return {
    frame: { radius: degenerate || !Number.isFinite(radius) ? 0 : radius, degenerate },
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
        return { radius: 1, degenerate: false };
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

function walkBounds(obj: Object3D, box: Box3, corner: Vector3): void {
  if (!obj.visible) return;
  if (obj instanceof Mesh) {
    const geometry = obj.geometry;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    const local = geometry.boundingBox;
    if (local !== null && !local.isEmpty()) {
      for (const x of [local.min.x, local.max.x]) {
        for (const y of [local.min.y, local.max.y]) {
          for (const z of [local.min.z, local.max.z]) {
            corner.set(x, y, z);
            obj.localToWorld(corner);
            box.expandByPoint(corner);
          }
        }
      }
    }
  }
  for (const child of obj.children) walkBounds(child, box, corner);
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
