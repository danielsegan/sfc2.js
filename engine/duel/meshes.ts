/**
 * Loads a hull through parseMod and buildShipMesh. The synthetic
 * fixture is generated in memory. A player install supplies its own bytes.
 */
import { parseMod } from '@sfc2js/formats';
import { createVfs, type Vfs } from '@sfc2js/platform';
import { buildShipMesh } from '@sfc2js/render';
import { DoubleSide, Group, Mesh, type Material } from 'three';
import {
  FIXTURE_MODEL_DIR,
  placeholderGlow,
  placeholderHullMod,
  placeholderTexture,
  type HullTint,
} from './placeholder-mod.ts';
import { SYNTHETIC_ROSTER } from './fixture.ts';

const TINTS: readonly HullTint[] = [
  { r: 79, g: 143, b: 214 },
  { r: 178, g: 58, b: 58 },
];

export async function loadSyntheticHulls(): Promise<Group[]> {
  const base = placeholderTexture();
  const glow = placeholderGlow();
  const vfs = createVfs([
    { path: `${FIXTURE_MODEL_DIR}/Wedge1.bmp`, size: base.length, read: async () => base },
    { path: `${FIXTURE_MODEL_DIR}/Wedge1i.bmp`, size: glow.length, read: async () => glow },
  ]);
  const groups: Group[] = [];
  for (let i = 0; i < SYNTHETIC_ROSTER.length; i++) {
    const file = SYNTHETIC_ROSTER[i]?.modelFile ?? 'wedge.mod';
    const modelPath = `${FIXTURE_MODEL_DIR}/${file}`;
    const tint = TINTS[i] ?? TINTS[0]!;
    const group = await groupFromMod(placeholderHullMod(tint), modelPath, vfs);
    groups.push(group ?? new Group());
  }
  return groups;
}

export async function groupFromMod(bytes: Uint8Array, modelPath: string, vfs: Vfs): Promise<Group | null> {
  const parsed = parseMod(bytes, { file: modelPath });
  if (parsed.diagnostics.some((item) => item.severity === 'error' && parsed.data.lods.length === 0)) return null;
  const built = await buildShipMesh(parsed.data, { vfs, modelPath, tier: 'period' });
  const root = built.data.root;
  dress(root);
  return root;
}

function dress(root: Group): void {
  const radius = Number(root.userData.radius);
  const span = radius > 0 ? 1.2 / radius : 1;
  root.scale.setScalar(span);
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      (material as Material & { side: number }).side = DoubleSide;
    }
  });
}
