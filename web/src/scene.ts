import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
  type Material,
  type Mesh,
} from 'three';
import type { ContactView, ViewModel } from '../../engine/view/view-model.ts';
import { photonMarks, rememberPhotonSample, type PhotonSample } from './photon-visual.ts';

const FULL = 65536;

export class DuelScene {
  readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly hulls: Group[] = [];
  private mode: 'chase' | 'overhead' = 'chase';
  private orbitYaw = 0;
  private orbitPitch = 0.42;
  private distance = 9;
  private readonly beams: { line: Line; until: number }[] = [];
  private readonly photonGlow: CanvasTexture;
  private readonly photonSlots: { sprite: Sprite; material: SpriteMaterial }[] = [];
  private readonly photonHistory = new Map<number, PhotonSample[]>();
  private readonly reduced: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(0x070b10, 1);
    this.camera = new PerspectiveCamera(48, 1, 0.05, 500);
    this.scene.add(new AmbientLight(0xb7c6d6, 0.7));
    const sun = new DirectionalLight(0xf4f7fb, 1.25);
    sun.position.set(12, 18, 8);
    this.scene.add(sun);
    this.scene.add(starfield(900));
    this.photonGlow = photonGlowTexture();
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setHulls(groups: readonly Group[]): void {
    for (const hull of this.hulls) this.scene.remove(hull);
    this.hulls.length = 0;
    for (const group of groups) {
      forceDoubleSide(group);
      this.scene.add(group);
      this.hulls.push(group);
    }
  }

  cycleCamera(): void {
    this.mode = this.mode === 'chase' ? 'overhead' : 'chase';
  }

  orbitBy(dx: number, dy: number): void {
    this.orbitYaw += dx * 0.005;
    const next = this.orbitPitch + dy * 0.005;
    this.orbitPitch = next < 0.12 ? 0.12 : next > 1.2 ? 1.2 : next;
  }

  dolly(delta: number): void {
    const next = this.distance + delta;
    this.distance = next < 4 ? 4 : next > 40 ? 40 : next;
  }

  resetView(): void {
    this.mode = 'chase';
    this.orbitYaw = 0;
    this.orbitPitch = 0.42;
    this.distance = 9;
  }

  resize(width: number, height: number, ratio: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
  }

  render(vm: ViewModel, now: number): void {
    const seen = new Set<number>();
    const marks: { x: number; y: number; z: number; size: number; opacity: number }[] = [];
    for (const contact of vm.contacts) {
      if (contact.kind === 'shot') {
        seen.add(contact.id);
        const sample = { x: contact.x, y: 0.7, z: -contact.y };
        const history = rememberPhotonSample(this.photonHistory.get(contact.id) ?? [], sample);
        this.photonHistory.set(contact.id, history);
        marks.push(...photonMarks(history));
        continue;
      }
      const hull = this.hulls[contact.index];
      if (!hull) continue;
      hull.visible = !contact.destroyed && contact.detected;
      hull.position.set(contact.x, 0, -contact.y);
      hull.rotation.y = (contact.heading16 / FULL) * Math.PI * 2;
    }
    for (const id of [...this.photonHistory.keys()]) {
      if (!seen.has(id)) this.photonHistory.delete(id);
    }
    this.placePhotons(marks);
    if (!this.reduced) this.noteHits(vm, now);
    this.expire(now);
    const self = vm.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'self');
    if (self) this.place(self);
    this.renderer.render(this.scene, this.camera);
  }

  private placePhotons(marks: readonly { x: number; y: number; z: number; size: number; opacity: number }[]): void {
    while (this.photonSlots.length < marks.length) {
      const material = new SpriteMaterial({
        map: this.photonGlow,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const sprite = new Sprite(material);
      sprite.frustumCulled = false;
      this.scene.add(sprite);
      this.photonSlots.push({ sprite, material });
    }
    for (let i = 0; i < this.photonSlots.length; i++) {
      const slot = this.photonSlots[i]!;
      const mark = marks[i];
      if (!mark) {
        slot.sprite.visible = false;
        continue;
      }
      slot.sprite.visible = true;
      slot.sprite.position.set(mark.x, mark.y, mark.z);
      slot.sprite.scale.set(mark.size, mark.size, 1);
      slot.material.opacity = mark.opacity;
    }
  }

  private place(self: ContactView): void {
    if (this.mode === 'overhead') {
      this.camera.position.set(self.x, 26, -self.y + 0.01);
      this.camera.up.set(0, 0, -1);
    } else {
      const heading = (self.heading16 / FULL) * Math.PI * 2 + this.orbitYaw;
      const pitch = this.orbitPitch;
      const dist = this.distance;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(
        self.x - Math.cos(heading) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        -self.y - Math.sin(heading) * Math.cos(pitch) * dist,
      );
    }
    this.camera.lookAt(self.x, 0, -self.y);
  }

  private noteHits(vm: ViewModel, now: number): void {
    const self = vm.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'self');
    if (!self) return;
    for (const event of vm.events) {
      if (event.kind !== 'hit') continue;
      const other = vm.contacts.find((contact) => contact.id === event.ship) ?? vm.contacts.find((contact) => contact.hostility === 'hostile');
      if (!other) continue;
      const from = event.ship === self.id ? other : self;
      const to = event.ship === self.id ? self : other;
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute([from.x, 0.2, -from.y, to.x, 0.2, -to.y], 3),
      );
      const line = new Line(geometry, new LineBasicMaterial({ color: 0x9fd6ff }));
      this.scene.add(line);
      this.beams.push({ line, until: now + 140 });
    }
  }

  private expire(now: number): void {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      if (!beam || beam.until > now) continue;
      this.scene.remove(beam.line);
      beam.line.geometry.dispose();
      (beam.line.material as Material).dispose();
      this.beams.splice(i, 1);
    }
  }
}

function forceDoubleSide(group: Group): void {
  group.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) (material as Material & { side: number }).side = DoubleSide;
  });
}

/** Original glow. A white core, gold body, and a soft orange falloff. Not a game texture. */
function photonGlowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const paint = canvas.getContext('2d');
  if (!paint) return new CanvasTexture(canvas);
  const glow = paint.createRadialGradient(64, 64, 0, 64, 64, 62);
  glow.addColorStop(0, 'rgba(255, 255, 236, 1)');
  glow.addColorStop(0.16, 'rgba(255, 220, 120, 0.98)');
  glow.addColorStop(0.38, 'rgba(242, 160, 48, 0.72)');
  glow.addColorStop(0.68, 'rgba(242, 120, 32, 0.28)');
  glow.addColorStop(1, 'rgba(242, 120, 32, 0)');
  paint.fillStyle = glow;
  paint.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function starfield(count: number): Points {
  const positions = new Float32Array(count * 3);
  let seed = 0x5fc2;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const theta = next() * Math.PI * 2;
    const phi = Math.acos(next() * 2 - 1);
    const radius = 80 + next() * 40;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new Points(geometry, new PointsMaterial({ color: 0xd5dee8, size: 0.18 }));
}
