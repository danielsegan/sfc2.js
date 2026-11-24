import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import type { ContactView, HelmView, ViewModel } from '../../engine/view/view-model.ts';
import { helmWedge } from './heading-wedge.ts';
import { sectorOutline, sectorPositions, wedgesFor, type ArcWeapon, type WedgePattern } from './tactical/arcs.ts';
import { reportedBeams, reportedFlashes } from './tactical/beams.ts';
import { defaultOverheadDistance, gridLevel, gridSegments, visibleWorldWidth } from './tactical/grid.ts';
import { markerHeading } from './tactical/tags.ts';
import {
  FIELD_FOV,
  FIELD_GRID,
  GRID_MAJOR_ALPHA,
  GRID_MAJOR_FACTOR,
  GRID_MINOR_ALPHA,
  GRID_MINOR_UNIT,
  MAJOR_CELLS_ACROSS,
  OVERHEAD_PITCH,
  shieldFlashColor,
} from './tactical/tokens.ts';
import { photonMarks, rememberPhotonSample, type PhotonSample } from './photon-visual.ts';

const FULL = 65536;
const BEAM_MS = 180;
const FLASH_MS = 180;
const HEADING_STEPS = 48;
interface Ndc {
  readonly x: number;
  readonly y: number;
  readonly inFront: boolean;
}

export class DuelScene {
  readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly hulls: Group[] = [];
  private mode: 'chase' | 'overhead' = 'overhead';
  private orbitYaw = 0;
  private orbitPitch = 0.42;
  private overheadDistance: number;
  private chaseDistance = 16;
  private fitted = true;
  private readonly beams: { line: LineSegments; until: number }[] = [];
  private readonly flashes: { mesh: Mesh; until: number }[] = [];
  private readonly wedgePool: { fill: Mesh; edge: LineSegments; hatch: LineSegments }[] = [];
  private readonly gridMinor: LineSegments;
  private readonly gridMajor: LineSegments;
  private readonly minorMaterial: LineBasicMaterial;
  private readonly majorMaterial: LineBasicMaterial;
  private readonly stars: Points;
  private readonly compass: Group;
  private readonly compassTick: LineSegments;
  private readonly photonGlow: CanvasTexture;
  private readonly photonSlots: { sprite: Sprite; material: SpriteMaterial }[] = [];
  private readonly photonHistory = new Map<number, PhotonSample[]>();
  private readonly reduced: boolean;
  private readonly ndc = new Vector3();
  private readonly camSpace = new Vector3();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly headingPositions = new Float32Array(HEADING_STEPS * 9);
  private readonly headingWedge: Mesh;
  /** Full-opacity outline (nose radius, bearing radius, outer arc) so the dark-red band stays visible on black. */
  private readonly headingEdge: LineSegments;
  private readonly headingEdgePositions = new Float32Array((HEADING_STEPS + 2) * 6);

  constructor(canvas: HTMLCanvasElement, options?: { preserveDrawingBuffer?: boolean }) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: options?.preserveDrawingBuffer === true,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.camera = new PerspectiveCamera(FIELD_FOV, 1, 0.05, 800);
    this.overheadDistance = defaultOverheadDistance(16 / 9, FIELD_FOV, GRID_MINOR_UNIT * GRID_MAJOR_FACTOR, MAJOR_CELLS_ACROSS);
    this.scene.add(new AmbientLight(0xc5d0dc, 0.55));
    const sun = new DirectionalLight(0xf4f7fb, 1.05);
    sun.position.set(12, 18, 8);
    this.scene.add(sun);
    this.stars = starDisk(220);
    this.scene.add(this.stars);
    this.minorMaterial = new LineBasicMaterial({ color: FIELD_GRID, transparent: true, opacity: GRID_MINOR_ALPHA });
    this.majorMaterial = new LineBasicMaterial({ color: FIELD_GRID, transparent: true, opacity: GRID_MAJOR_ALPHA });
    this.gridMinor = new LineSegments(new BufferGeometry(), this.minorMaterial);
    this.gridMajor = new LineSegments(new BufferGeometry(), this.majorMaterial);
    this.gridMinor.frustumCulled = false;
    this.gridMajor.frustumCulled = false;
    this.gridMinor.renderOrder = 1;
    this.gridMajor.renderOrder = 1;
    this.scene.add(this.gridMinor, this.gridMajor);
    this.compass = new Group();
    this.compass.add(circleLine(2.15, 40));
    this.compassTick = new LineSegments(
      new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(6), 3)),
      new LineBasicMaterial({ color: 0xffffff }),
    );
    this.compass.add(this.compassTick);
    this.compass.renderOrder = 4;
    this.scene.add(this.compass);
    this.photonGlow = photonGlowTexture();
    const headingGeo = new BufferGeometry();
    headingGeo.setAttribute('position', new BufferAttribute(this.headingPositions, 3));
    headingGeo.setDrawRange(0, 0);
    this.headingWedge = new Mesh(
      headingGeo,
      new MeshBasicMaterial({
        color: 0xe08a2e,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.headingWedge.frustumCulled = false;
    this.headingWedge.visible = false;
    this.headingWedge.renderOrder = 2;
    this.scene.add(this.headingWedge);
    const edgeGeo = new BufferGeometry();
    edgeGeo.setAttribute('position', new BufferAttribute(this.headingEdgePositions, 3));
    edgeGeo.setDrawRange(0, 0);
    this.headingEdge = new LineSegments(edgeGeo, new LineBasicMaterial({ color: 0xe08a2e }));
    this.headingEdge.frustumCulled = false;
    this.headingEdge.visible = false;
    this.headingEdge.renderOrder = 2;
    this.scene.add(this.headingEdge);
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  get cameraMode(): 'chase' | 'overhead' {
    return this.mode;
  }

  /** CSS pixels across one display range unit at the current zoom. */
  pixelsPerRange(viewportWidth: number): number {
    const world = visibleWorldWidth(this.activeDistance, this.camera.fov, this.camera.aspect);
    return viewportWidth / Math.max(world, 0.001);
  }

  projectNdc(x: number, y: number): Ndc {
    this.ndc.set(x, 0, -y);
    this.camSpace.copy(this.ndc).applyMatrix4(this.camera.matrixWorldInverse);
    const inFront = this.camSpace.z < 0;
    this.ndc.project(this.camera);
    return { x: this.ndc.x, y: this.ndc.y, inFront };
  }

  setHulls(groups: readonly Group[]): void {
    for (const hull of this.hulls) this.scene.remove(hull);
    this.hulls.length = 0;
    for (const group of groups) {
      forceDoubleSide(group);
      group.renderOrder = 3;
      this.scene.add(group);
      this.hulls.push(group);
    }
  }

  cycleCamera(): void {
    this.mode = this.mode === 'chase' ? 'overhead' : 'chase';
  }

  /** Show this heading at once. The next confirmed order replaces it. */
  /**
   * World point on the tactical plane under the cursor.
   * three.js Y is up. Sim +y is three.js -z.
   */
  groundPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const origin = this.raycaster.ray.origin;
    const dir = this.raycaster.ray.direction;
    if (Math.abs(dir.y) < 1e-8) return null;
    const t = -origin.y / dir.y;
    if (!Number.isFinite(t) || t < 0) return null;
    const wx = origin.x + dir.x * t;
    const wz = origin.z + dir.z * t;
    if (!Number.isFinite(wx) || !Number.isFinite(wz)) return null;
    if (Math.abs(wx) > 400 || Math.abs(wz) > 400) return null;
    return { x: wx, y: -wz };
  }

  /** Orbit uses a modifier or keys. It never binds the steer or target button by itself. */
  orbitBy(dx: number, dy: number): void {
    if (this.mode === 'overhead') this.mode = 'chase';
    this.orbitYaw += dx * 0.005;
    const next = this.orbitPitch + dy * 0.005;
    this.orbitPitch = next < 0.12 ? 0.12 : next > 1.2 ? 1.2 : next;
  }

  dolly(delta: number): void {
    this.fitted = false;
    const step = Math.max(0.6, this.activeDistance * 0.08) * Math.sign(delta);
    this.setActiveDistance(this.activeDistance + (step === 0 ? delta : step));
  }

  resetView(): void {
    this.mode = 'overhead';
    this.orbitYaw = 0;
    this.orbitPitch = 0.42;
    this.chaseDistance = 16;
    this.fitted = true;
    this.overheadDistance = defaultOverheadDistance(
      this.camera.aspect || 16 / 9,
      FIELD_FOV,
      GRID_MINOR_UNIT * GRID_MAJOR_FACTOR,
      MAJOR_CELLS_ACROSS,
    );
  }

  resize(width: number, height: number, ratio: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    if (this.fitted && this.mode === 'overhead') {
      this.overheadDistance = defaultOverheadDistance(
        this.camera.aspect,
        FIELD_FOV,
        GRID_MINOR_UNIT * GRID_MAJOR_FACTOR,
        MAJOR_CELLS_ACROSS,
      );
    }
  }

  render(vm: ViewModel, now: number, selection: readonly number[] = []): void {
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
      if (!hull) {
        if (contact.detected) {
          const lift = contact.kind === 'mine' ? 0.15 : 0.55;
          const size = contact.kind === 'mine' ? 0.28 : 0.42;
          marks.push({ x: contact.x, y: lift, z: -contact.y, size, opacity: 0.85 });
        }
        continue;
      }
      hull.visible = !contact.destroyed && contact.detected;
      hull.position.set(contact.x, 0, -contact.y);
      hull.rotation.y = (contact.heading16 / FULL) * Math.PI * 2;
    }
    for (const id of [...this.photonHistory.keys()]) {
      if (!seen.has(id)) this.photonHistory.delete(id);
    }
    this.placePhotons(marks);
    const self = vm.contacts.find((contact) => contact.kind === 'ship' && contact.hostility === 'self');
    if (self) {
      this.place(self);
      this.updateGrid(self);
      this.stars.position.set(self.x, 0, -self.y);
      this.updateWedges(vm, self, selection);
      this.updateCompass(vm, self);
      this.drawHeadingWedge(self, vm.self?.helm);
    } else {
      this.headingWedge.visible = false;
      this.headingEdge.visible = false;
    }
    this.noteReported(vm, now);
    this.expire(now);
    this.renderer.render(this.scene, this.camera);
  }

  private drawHeadingWedge(self: ContactView, helm: HelmView | null | undefined): void {
    const drawn = helmWedge(helm);
    const material = this.headingWedge.material;
    if (!drawn || !(material instanceof MeshBasicMaterial)) {
      this.headingWedge.visible = false;
      this.headingEdge.visible = false;
      return;
    }
    const arc = drawn.arc16;
    const mag = arc < 0 ? -arc : arc;
    const steps = Math.max(2, Math.min(HEADING_STEPS, Math.ceil(mag / 1400)));
    const radius = 7;
    const y = 0.08;
    let write = 0;
    for (let i = 0; i < steps; i++) {
      const a0 = self.heading16 + (arc * i) / steps;
      const a1 = self.heading16 + (arc * (i + 1)) / steps;
      const t0 = (a0 / FULL) * Math.PI * 2;
      const t1 = (a1 / FULL) * Math.PI * 2;
      this.headingPositions[write++] = self.x;
      this.headingPositions[write++] = y;
      this.headingPositions[write++] = -self.y;
      this.headingPositions[write++] = self.x + Math.cos(t0) * radius;
      this.headingPositions[write++] = y;
      this.headingPositions[write++] = -self.y - Math.sin(t0) * radius;
      this.headingPositions[write++] = self.x + Math.cos(t1) * radius;
      this.headingPositions[write++] = y;
      this.headingPositions[write++] = -self.y - Math.sin(t1) * radius;
    }
    const attr = this.headingWedge.geometry.getAttribute('position');
    attr.needsUpdate = true;
    this.headingWedge.geometry.setDrawRange(0, steps * 3);
    const color = drawn.color;
    material.color.setHex(color);
    this.headingWedge.visible = true;
    this.drawHeadingEdge(self, arc, steps, radius, y, color);
  }

  private drawHeadingEdge(self: ContactView, arc: number, steps: number, radius: number, y: number, color: number): void {
    const out = this.headingEdgePositions;
    let write = 0;
    const point = (a16: number): [number, number] => {
      const t = (a16 / FULL) * Math.PI * 2;
      return [self.x + Math.cos(t) * radius, -self.y - Math.sin(t) * radius];
    };
    const push = (ax: number, az: number, bx: number, bz: number) => {
      out[write++] = ax;
      out[write++] = y;
      out[write++] = az;
      out[write++] = bx;
      out[write++] = y;
      out[write++] = bz;
    };
    const nose = point(self.heading16);
    const aim = point(self.heading16 + arc);
    push(self.x, -self.y, nose[0], nose[1]);
    push(self.x, -self.y, aim[0], aim[1]);
    for (let i = 0; i < steps; i++) {
      const a = point(self.heading16 + (arc * i) / steps);
      const b = point(self.heading16 + (arc * (i + 1)) / steps);
      push(a[0], a[1], b[0], b[1]);
    }
    const attr = this.headingEdge.geometry.getAttribute('position');
    attr.needsUpdate = true;
    this.headingEdge.geometry.setDrawRange(0, write / 3);
    const material = this.headingEdge.material;
    if (material instanceof LineBasicMaterial) material.color.setHex(color);
    this.headingEdge.visible = true;
  }

  private get activeDistance(): number {
    return this.mode === 'overhead' ? this.overheadDistance : this.chaseDistance;
  }

  private setActiveDistance(next: number): void {
    const clamped = next < 8 ? 8 : next > 220 ? 220 : next;
    if (this.mode === 'overhead') this.overheadDistance = clamped;
    else this.chaseDistance = clamped;
  }

  private updateGrid(self: ContactView): void {
    const world = visibleWorldWidth(this.activeDistance, this.camera.fov, this.camera.aspect);
    const px = this.pixelsPerRange(Math.max(this.renderer.domElement.clientWidth, 1));
    const level = gridLevel(px);
    const halfW = world * 0.72;
    const halfD = (world / Math.max(this.camera.aspect, 0.3)) * 0.72;
    const minor = level.minorAlpha > 0.001
      ? gridSegments(self.x, -self.y, halfW, halfD, level.minorStep, -0.02)
      : new Float32Array();
    const major = gridSegments(self.x, -self.y, halfW, halfD, level.majorStep, -0.02);
    setSegments(this.gridMinor, minor);
    setSegments(this.gridMajor, major);
    this.minorMaterial.opacity = level.minorAlpha;
    this.majorMaterial.opacity = level.majorAlpha;
  }

  private updateWedges(vm: ViewModel, self: ContactView, selection: readonly number[]): void {
    const weapons = (vm.self?.weapons ?? []) as readonly ArcWeapon[];
    const wedges = wedgesFor(weapons, selection);
    while (this.wedgePool.length < wedges.length) {
      const slot = makeWedgeSlot();
      this.scene.add(slot.fill, slot.edge, slot.hatch);
      this.wedgePool.push(slot);
    }
    for (let i = 0; i < this.wedgePool.length; i++) {
      const slot = this.wedgePool[i]!;
      const wedge = wedges[i];
      if (!wedge) {
        slot.fill.visible = false;
        slot.edge.visible = false;
        slot.hatch.visible = false;
        continue;
      }
      const steps = wedge.full ? 48 : 14;
      const positions = sectorPositions(self.heading16, wedge.from16, wedge.to16, wedge.full, 0.2, wedge.rangeMax, steps, 0.03);
      setMeshPositions(slot.fill, positions);
      const chunks = [sectorOutline(self.heading16, wedge.from16, wedge.to16, wedge.full, 0.2, wedge.rangeMax, steps, 0.04)];
      for (const band of wedge.bands) {
        chunks.push(sectorOutline(self.heading16, wedge.from16, wedge.to16, wedge.full, band, band, steps, 0.045));
      }
      setSegments(slot.edge, concatFloats(chunks));
      slot.fill.visible = wedge.style.fill > 0;
      slot.edge.visible = true;
      slot.fill.position.set(self.x, 0, -self.y);
      slot.edge.position.set(self.x, 0, -self.y);
      const fillMat = slot.fill.material as MeshBasicMaterial;
      fillMat.color.setHex(wedge.style.color);
      fillMat.opacity = wedge.style.fill;
      paintEdge(slot.edge, wedge.style.color, wedge.style.pattern);
      const hatch = wedge.style.pattern === 'dashdot'
        ? sectorOutline(self.heading16, wedge.from16, wedge.to16, wedge.full, wedge.rangeMax * 0.45, wedge.rangeMax * 0.55, steps, 0.05)
        : new Float32Array();
      setSegments(slot.hatch, hatch);
      slot.hatch.position.set(self.x, 0, -self.y);
      if (hatch.length >= 6) paintEdge(slot.hatch, wedge.style.color, 'dashed');
    }
  }

  private updateCompass(vm: ViewModel, self: ContactView): void {
    const heading = vm.self ? markerHeading(vm.self) : self.heading16;
    const angle = (heading / FULL) * Math.PI * 2;
    const inner = 1.35;
    const outer = 2.55;
    const data = new Float32Array([
      Math.cos(angle) * inner, 0.12, -Math.sin(angle) * inner,
      Math.cos(angle) * outer, 0.12, -Math.sin(angle) * outer,
    ]);
    setSegments(this.compassTick, data);
    this.compass.position.set(self.x, 0, -self.y);
    this.compass.visible = !self.destroyed;
  }

  private noteReported(vm: ViewModel, now: number): void {
    for (const beam of reportedBeams(vm.events)) {
      const from = vm.contacts.find((contact) => contact.id === beam.shooter);
      const to = vm.contacts.find((contact) => contact.id === beam.target);
      if (!from || !to) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array([from.x, 0.28, -from.y, to.x, 0.28, -to.y]), 3),
      );
      const line = new LineSegments(geometry, new LineBasicMaterial({ color: beam.color, transparent: true, opacity: 0.95 }));
      line.renderOrder = 2;
      this.scene.add(line);
      this.beams.push({ line, until: now + BEAM_MS });
    }
    for (const flash of reportedFlashes(vm.events)) {
      const ship = vm.contacts.find((contact) => contact.id === flash.ship && contact.kind !== 'shot');
      if (!ship) continue;
      const facing = ship.shields[flash.facing];
      const ratio = facing && facing.max > 0 ? facing.current / facing.max : 0;
      const span = sectorPositions(ship.heading16, flash.facing * (FULL / 6) - FULL / 12, flash.facing * (FULL / 6) + FULL / 12, false, 1.05, 2.5, 6, 0.16);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(span, 3));
      const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({
          color: shieldFlashColor(ratio),
          transparent: true,
          opacity: this.reduced ? 0.85 : 0.55,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      mesh.position.set(ship.x, 0, -ship.y);
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      this.flashes.push({ mesh, until: now + FLASH_MS });
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
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i];
      if (!flash || flash.until > now) continue;
      this.scene.remove(flash.mesh);
      flash.mesh.geometry.dispose();
      (flash.mesh.material as Material).dispose();
      this.flashes.splice(i, 1);
    }
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
      sprite.renderOrder = 3;
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
      const dist = this.overheadDistance;
      const height = Math.sin(OVERHEAD_PITCH) * dist;
      const back = Math.cos(OVERHEAD_PITCH) * dist;
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(self.x, height, -self.y + back);
    } else {
      const heading = (self.heading16 / FULL) * Math.PI * 2 + this.orbitYaw;
      const pitch = this.orbitPitch;
      const dist = this.chaseDistance;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(
        self.x - Math.cos(heading) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        -self.y - Math.sin(heading) * Math.cos(pitch) * dist,
      );
    }
    this.camera.lookAt(self.x, 0, -self.y);
  }
}

function makeWedgeSlot(): { fill: Mesh; edge: LineSegments; hatch: LineSegments } {
  const fill = new Mesh(
    new BufferGeometry(),
    new MeshBasicMaterial({ transparent: true, opacity: 0.15, depthWrite: false, side: DoubleSide }),
  );
  const edge = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xffffff }));
  const hatch = new LineSegments(new BufferGeometry(), new LineDashedMaterial({ color: 0xffffff, dashSize: 0.35, gapSize: 0.2 }));
  fill.frustumCulled = false;
  edge.frustumCulled = false;
  hatch.frustumCulled = false;
  fill.renderOrder = 2;
  edge.renderOrder = 2;
  hatch.renderOrder = 2;
  fill.visible = false;
  edge.visible = false;
  hatch.visible = false;
  return { fill, edge, hatch };
}

function paintEdge(line: LineSegments, color: number, pattern: WedgePattern): void {
  const previous = line.material as Material;
  if (pattern === 'solid') {
    if (!(previous instanceof LineBasicMaterial)) {
      previous.dispose();
      line.material = new LineBasicMaterial({ color });
    } else {
      previous.color.setHex(color);
    }
    return;
  }
  const dash = pattern === 'dotted' ? 0.12 : pattern === 'dashdot' ? 0.45 : 0.55;
  const gap = pattern === 'dotted' ? 0.22 : pattern === 'dashdot' ? 0.18 : 0.32;
  if (!(previous instanceof LineDashedMaterial)) {
    previous.dispose();
    line.material = new LineDashedMaterial({ color, dashSize: dash, gapSize: gap });
  } else {
    previous.color.setHex(color);
    previous.dashSize = dash;
    previous.gapSize = gap;
  }
  line.computeLineDistances();
}

function concatFloats(parts: readonly Float32Array[]): Float32Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Float32Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function writePositions(geometry: BufferGeometry, data: Float32Array): void {
  const current = geometry.getAttribute('position');
  if (current instanceof BufferAttribute && current.array.length === data.length) {
    (current.array as Float32Array).set(data);
    current.needsUpdate = true;
  } else {
    geometry.setAttribute('position', new BufferAttribute(data, 3));
  }
  geometry.computeBoundingSphere();
}

function setMeshPositions(mesh: Mesh, data: Float32Array): void {
  writePositions(mesh.geometry, data);
}

function setSegments(line: LineSegments, data: Float32Array): void {
  writePositions(line.geometry, data);
  line.visible = data.length >= 6;
  const material = line.material;
  if (material instanceof LineDashedMaterial) line.computeLineDistances();
}

function circleLine(radius: number, segments: number): LineLoop {
  const data = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    data[i * 3] = Math.cos(angle) * radius;
    data[i * 3 + 1] = 0.12;
    data[i * 3 + 2] = -Math.sin(angle) * radius;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data, 3));
  const line = new LineLoop(geometry, new LineBasicMaterial({ color: 0xffffff }));
  line.frustumCulled = false;
  return line;
}

function forceDoubleSide(group: Group): void {
  group.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) (material as Material & { side: number }).side = DoubleSide;
  });
}

function starDisk(count: number): Points {
  const positions = new Float32Array(count * 3);
  let seed = 0x5fc2;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const radius = 130;
  for (let i = 0; i < count; i++) {
    const theta = next() * Math.PI * 2;
    const reach = Math.sqrt(next()) * radius;
    positions[i * 3] = Math.cos(theta) * reach;
    positions[i * 3 + 1] = -28;
    positions[i * 3 + 2] = Math.sin(theta) * reach;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const points = new Points(
    geometry,
    new PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.42, depthWrite: false }),
  );
  points.frustumCulled = false;
  points.renderOrder = 0;
  return points;
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
