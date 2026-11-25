/**
 * Turn a parsed `.mod` into a three.js group the ship viewer can spin.
 *
 * Textures go through `loadShipTexture` (docs/formats/bmp.md). Positions
 * stay in file units. Triangle corners are written 2, 1, 0, matching the
 * public sfc2gl converter. Named points become attachment nodes; this
 * does not decide which of them are weapon hardpoints.
 */

import {
  diagnostic,
  installRelativeFile,
  normalizeInstallPath,
  pairSelfIllumination,
  type Diagnostic,
  type ModFace,
  type ModMaterial,
  type ModModel,
  type ParseResult,
} from '@sfc2js/formats';
import type { Vfs } from '@sfc2js/platform';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  type Material,
} from 'three';
import { classifyTextureMiss, resolveShipTexture, type TextureMissClass } from './texture-resolve.ts';
import { loadShipTexture, type LoadShipTextureOptions, type RenderTier } from './ship-texture.ts';

/** Neutral stand-in used when a named texture is not in the install. */
const PLACEHOLDER_COLOR = 0x9aa3ad;

export interface BuildShipMeshOptions extends LoadShipTextureOptions {
  vfs: Vfs;
  /** Install-relative path of this `.mod`. Texture names resolve beside it. */
  modelPath: string;
  /** Parsed LOD to show. Default 0, the first `MOD0`. */
  lod?: number;
}

export interface BuiltShipMesh {
  /** Group the viewer adds to the scene. */
  root: Group;
  lods: Group[];
  /** Named points, parented to `root`, in file order. */
  attachments: Object3D[];
  materials: Material[];
}

interface Shadeable {
  color: Color;
  wireframe: boolean;
  flatShading: boolean;
  blending: number;
  transparent: boolean;
}

/** Untextured stand-in for a hull that ships with no model. Coordinates are invented. */
export function placeholderShipMesh(): BuiltShipMesh {
  const positions = new Float32Array([
    0, 0.15, 1.4, 0.45, 0, -0.8, -0.45, 0, -0.8,
    0, 0.15, 1.4, 0, 0.45, -0.2, 0.45, 0, -0.8,
    0, 0.15, 1.4, -0.45, 0, -0.8, 0, 0.45, -0.2,
    0.45, 0, -0.8, 0, 0.45, -0.2, -0.45, 0, -0.8,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const material = new MeshLambertMaterial({ color: 0x8d97a6 });
  const mesh = new Mesh(geometry, material);
  const lod = new Group();
  lod.add(mesh);
  const root = new Group();
  root.add(lod);
  return { root, lods: [lod], attachments: [], materials: [material] };
}

export async function buildShipMesh(
  model: ModModel,
  options: BuildShipMeshOptions,
): Promise<ParseResult<BuiltShipMesh>> {
  const diagnostics: Diagnostic[] = [];
  const tier = options.tier ?? 'period';
  const requested = options.lod ?? 0;
  const selected = requested >= 0 && requested < model.lods.length ? requested : -1;
  if (selected < 0) {
    diagnostics.push(
      diagnostic('lodOutOfRange', 'mod', 'warning', {
        details: { requested, lods: model.lods.length },
        location: { file: safeFile(options.modelPath) },
      }),
    );
  }

  const modelPath = safeFile(options.modelPath);
  if (modelPath === undefined) {
    diagnostics.push(diagnostic('modelPathRejected', 'mod', 'warning', { details: { reason: 'not-install-relative' } }));
  }

  const root = new Group();
  root.name = 'ship';
  root.userData = {
    sfc2Role: 'ship',
    ...(modelPath === undefined ? {} : { modelPath }),
    radius: Number.isFinite(model.radius) ? model.radius : 0,
    lodCount: model.lods.length,
    declaredLodCount: model.lodCount,
    selectedLod: Math.max(selected, 0),
  };

  const materialCache = new Map<number, Promise<Material>>();
  const materials: Material[] = [];
  const lods: Group[] = [];

  for (const lod of model.lods) {
    const group = new Group();
    group.name = `lod-${lod.index}`;
    group.visible = lod.index === selected;
    group.userData = { sfc2Role: 'ship-lod', lod: lod.index };
    const byMaterial = new Map<number, ModFace[]>();
    for (const face of lod.faces) {
      if (face.vertices.length !== 3) continue;
      const list = byMaterial.get(face.materialIndex) ?? [];
      list.push(face);
      byMaterial.set(face.materialIndex, list);
    }
    for (const [materialIndex, faces] of byMaterial) {
      const geometry = geometryFor(faces, lod.vertices);
      if (geometry === null) continue;
      const material = await materialFor(materialCache, materials, model, materialIndex, {
        vfs: options.vfs,
        modelPath,
        tier,
        colorKey: options.colorKey,
        diagnostics,
      });
      const mesh = new Mesh(geometry, material);
      mesh.name = `lod-${lod.index}-mat-${materialIndex}`;
      group.add(mesh);
    }
    root.add(group);
    lods.push(group);
  }

  const attachments: Object3D[] = [];
  for (const point of model.namedPoints) {
    const node = new Object3D();
    if (isSafeToken(point.name)) node.name = point.name;
    node.position.set(finite(point.x), finite(point.y), finite(point.z));
    node.userData = { sfc2Role: 'attachment' };
    root.add(node);
    attachments.push(node);
  }

  return { data: { root, lods, attachments, materials }, diagnostics };
}

/** Show one built LOD and hide the others. Returns false when `index` is outside the built list. */
export function showShipLod(built: BuiltShipMesh, index: number): boolean {
  if (index < 0 || index >= built.lods.length) return false;
  for (let i = 0; i < built.lods.length; i++) {
    const group = built.lods[i];
    if (group !== undefined) group.visible = i === index;
  }
  built.root.userData.selectedLod = index;
  return true;
}

interface MaterialContext {
  vfs: Vfs;
  modelPath: string | undefined;
  tier: RenderTier;
  colorKey: LoadShipTextureOptions['colorKey'];
  diagnostics: Diagnostic[];
}

async function materialFor(
  cache: Map<number, Promise<Material>>,
  materials: Material[],
  model: ModModel,
  materialIndex: number,
  ctx: MaterialContext,
): Promise<Material> {
  const cached = cache.get(materialIndex);
  if (cached !== undefined) return cached;
  const pending = createMaterial(model.materials[materialIndex], ctx);
  cache.set(materialIndex, pending);
  const material = await pending;
  materials.push(material);
  return material;
}

async function createMaterial(modMaterial: ModMaterial | undefined, ctx: MaterialContext): Promise<Material> {
  if (modMaterial === undefined || ctx.modelPath === undefined) {
    const plain = plainMaterial(ctx.tier, modMaterial?.color ?? { r: 255, g: 255, b: 255 });
    if (modMaterial !== undefined) applyFlags(plain, modMaterial);
    return plain;
  }

  const glow = namedGlow(modMaterial, ctx);
  if (!modMaterial.textured) {
    const plain = plainMaterial(ctx.tier, modMaterial.color);
    applyFlags(plain, modMaterial);
    return plain;
  }

  const diffuse = resolveShipTexture(ctx.vfs, ctx.modelPath, modMaterial.diffuseTexture.name);
  if ('reason' in diffuse) {
    if (diffuse.reason === 'texture-name') {
      rejectTextureName(ctx);
      const plain = plainMaterial(ctx.tier, modMaterial.color);
      applyFlags(plain, modMaterial);
      return plain;
    }
    if (diffuse.reason === 'absent') notePlaceholder(ctx, 'diffuse', classifyTextureMiss(ctx.vfs, modMaterial.diffuseTexture.name));
    if (glow.named && !glow.rejected && glow.path === undefined && modMaterial.luminanceTexture !== null) {
      notePlaceholder(ctx, 'luminance', classifyTextureMiss(ctx.vfs, modMaterial.luminanceTexture.name));
    }
    const standIn = placeholderMaterial(ctx.tier);
    applyFlags(standIn, modMaterial, { keepColor: true });
    return standIn;
  }

  let glowPath = glow.path;
  if (glowPath === undefined && !glow.rejected) {
    const beside = glowBeside(ctx.vfs, diffuse.path);
    if (beside !== undefined) glowPath = beside;
    else if (glow.named && modMaterial.luminanceTexture !== null) {
      notePlaceholder(ctx, 'luminance', classifyTextureMiss(ctx.vfs, modMaterial.luminanceTexture.name));
    }
  }

  const loaded = await loadShipTexture(
    ctx.vfs,
    { basePath: diffuse.path, ...(glowPath === undefined ? {} : { selfIllumPath: glowPath }) },
    { tier: ctx.tier, colorKey: ctx.colorKey },
  );
  const baseFailed = loaded.data.material === null;
  const glowFailed = glowPath !== undefined && loaded.data.selfIllumTexture === null;
  if (baseFailed) notePlaceholder(ctx, 'diffuse', 'decodeFailed');
  else if (glowFailed) notePlaceholder(ctx, 'luminance', 'decodeFailed');
  for (const item of loaded.diagnostics) {
    if (item.severity === 'error' && item.source === 'bmp' && (baseFailed || glowFailed)) continue;
    ctx.diagnostics.push(item);
  }
  if (!baseFailed && loaded.data.material !== null) {
    applyFlags(loaded.data.material, modMaterial);
    return loaded.data.material;
  }

  const standIn = placeholderMaterial(ctx.tier);
  applyFlags(standIn, modMaterial, { keepColor: true });
  return standIn;
}

function namedGlow(
  modMaterial: ModMaterial,
  ctx: MaterialContext,
): { path?: string; named: boolean; rejected: boolean } {
  if (!modMaterial.luminance || modMaterial.luminanceTexture === null || ctx.modelPath === undefined) {
    return { named: false, rejected: false };
  }
  const name = modMaterial.luminanceTexture.name;
  if (name.trim().length === 0) return { named: false, rejected: false };
  const resolved = resolveShipTexture(ctx.vfs, ctx.modelPath, name);
  if ('reason' in resolved) {
    if (resolved.reason === 'texture-name') {
      rejectTextureName(ctx);
      return { named: true, rejected: true };
    }
    return { named: true, rejected: false };
  }
  return { path: resolved.path, named: true, rejected: false };
}

function geometryFor(faces: readonly ModFace[], vertices: Float32Array): BufferGeometry | null {
  const triangles = faces.filter((face) =>
    face.vertices.length === 3 &&
    face.vertices.every((corner) => corner.vertexIndex >= 0 && corner.vertexIndex * 3 + 2 < vertices.length),
  );
  if (triangles.length === 0) return null;
  const positions = new Float32Array(triangles.length * 9);
  const normals = new Float32Array(triangles.length * 9);
  const uvs = new Float32Array(triangles.length * 6);
  let position = 0;
  let normal = 0;
  let uv = 0;
  for (const face of triangles) {
    for (const cornerIndex of [2, 1, 0]) {
      const corner = face.vertices[cornerIndex];
      if (corner === undefined) continue;
      const base = corner.vertexIndex * 3;
      positions[position++] = finite(vertices[base]);
      positions[position++] = finite(vertices[base + 1]);
      positions[position++] = finite(vertices[base + 2]);
      normals[normal++] = finite(corner.normal[0]);
      normals[normal++] = finite(corner.normal[1]);
      normals[normal++] = finite(corner.normal[2]);
      uvs[uv++] = finite(corner.u);
      uvs[uv++] = finite(corner.v);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}

function placeholderMaterial(tier: RenderTier): Material {
  const material =
    tier === 'hd'
      ? new MeshStandardMaterial({ color: PLACEHOLDER_COLOR, roughness: 0.6, metalness: 0 })
      : new MeshLambertMaterial({ color: PLACEHOLDER_COLOR });
  material.userData = {
    sfc2Role: 'ship-surface',
    tier,
    selfIllumBloomThreshold: 0,
    texturePlaceholder: true,
  };
  return material;
}

function plainMaterial(tier: RenderTier, color: { r: number; g: number; b: number }): Material {
  const tint = new Color(color.r / 255, color.g / 255, color.b / 255);
  const material =
    tier === 'hd'
      ? new MeshStandardMaterial({ color: tint, roughness: 0.6, metalness: 0 })
      : new MeshLambertMaterial({ color: tint });
  material.userData = {
    sfc2Role: 'ship-surface',
    tier,
    selfIllumBloomThreshold: 0,
  };
  return material;
}

function applyFlags(material: Material, modMaterial: ModMaterial, options?: { keepColor?: boolean }): void {
  const shaded = material as Material & Shadeable & { visible: boolean; opacity: number; depthWrite: boolean };
  if (options?.keepColor !== true) {
    shaded.color.setRGB(modMaterial.color.r / 255, modMaterial.color.g / 255, modMaterial.color.b / 255);
  }
  if (modMaterial.wire) shaded.wireframe = true;
  if (modMaterial.flat && !modMaterial.gouraud) shaded.flatShading = true;
  const notes = (material.userData ?? {}) as Record<string, unknown>;
  material.userData = notes;
  if (modMaterial.additive) {
    shaded.blending = AdditiveBlending;
    shaded.transparent = true;
    notes.effectBlend = 'additive';
  } else if (isInvisibleMarker(modMaterial)) {
    shaded.visible = false;
    notes.effectBlend = 'invisible';
  } else if (isClearedAlpha(modMaterial)) {
    shaded.transparent = true;
    shaded.opacity = 0;
    shaded.depthWrite = false;
    notes.effectBlend = 'alpha';
  }
}

/** No flags and no color: the material has nothing to draw. */
function isInvisibleMarker(material: ModMaterial): boolean {
  return material.flags === 0 && material.color.r === 0 && material.color.g === 0 && material.color.b === 0;
}

/**
 * Flat-shaded, untextured, and black, with no blend mode. Treated as a
 * fully transparent effect rather than a hull surface.
 */
function isClearedAlpha(material: ModMaterial): boolean {
  return (
    material.flat &&
    !material.gouraud &&
    !material.textured &&
    !material.wire &&
    !material.additive &&
    material.color.r === 0 &&
    material.color.g === 0 &&
    material.color.b === 0
  );
}

function glowBeside(vfs: Vfs, basePath: string): string | undefined {
  const slash = basePath.lastIndexOf('/');
  const dir = slash >= 0 ? basePath.slice(0, slash) : '';
  const prefix = dir.length > 0 ? `${dir}/` : '';
  const local = vfs
    .list()
    .map((entry) => entry.path)
    .filter((path) => {
      if (!path.toLowerCase().endsWith('.bmp')) return false;
      if (dir.length === 0) return !path.includes('/');
      if (!path.toLowerCase().startsWith(prefix.toLowerCase())) return false;
      return !path.slice(prefix.length).includes('/');
    });
  const pair = pairSelfIllumination(local).pairs.find((item) => item.basePath.toLowerCase() === basePath.toLowerCase());
  return pair?.selfIllumPath;
}

function rejectTextureName(ctx: MaterialContext): void {
  ctx.diagnostics.push(
    diagnostic('textureNameRejected', 'mod', 'warning', {
      details: { reason: 'texture-name' },
      ...(ctx.modelPath === undefined ? {} : { location: { file: ctx.modelPath } }),
    }),
  );
}

function notePlaceholder(ctx: MaterialContext, which: 'diffuse' | 'luminance', miss: TextureMissClass): void {
  ctx.diagnostics.push(
    diagnostic('texturePlaceholder', 'bmp', 'warning', {
      details: { which, miss },
      ...(ctx.modelPath === undefined ? {} : { location: { file: ctx.modelPath } }),
    }),
  );
}

function safeFile(path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  return installRelativeFile(normalizeInstallPath(path));
}

function isSafeToken(name: string): boolean {
  return name.length > 0 && name.length <= 64 && !name.includes('/') && !name.includes('\\') && !name.includes(':') && !name.includes('..');
}

function finite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}
