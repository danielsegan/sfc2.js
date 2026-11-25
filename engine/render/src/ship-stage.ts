/**
 * three.js stage for one ship. Period lighting is one sun plus ambient.
 * HD adds a fill and ACES tone mapping. The turntable owns the spin.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  NoToneMapping,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
} from 'three';
import type { LoadedShip } from './ship-catalog.ts';
import type { RenderTier } from './ship-texture.ts';

export function frameDistance(radius: number): number {
  const safe = radius > 0 && Number.isFinite(radius) ? radius : 1;
  return safe * 3;
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
  show(ship: LoadedShip | null): void;
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
        return;
      }
      pivot.add(ship.mesh.root);
      const declared = ship.mesh.root.userData.radius;
      const radius = typeof declared === 'number' && declared > 0 ? declared : 1;
      frameCamera(camera, radius);
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
  const distance = frameDistance(radius);
  camera.fov = 40;
  camera.position.set(0, distance * 0.18, distance);
  camera.near = Math.max(distance / 200, 0.01);
  camera.far = Math.max(distance * 40, 400);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
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
