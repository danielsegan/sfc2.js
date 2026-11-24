/**
 * Art for one skin slot. Order is hud-layout.md §4.4:
 * the player's install, then our placeholder, then the neutral plate.
 */
import type { EmpireSkinId } from './catalog.ts';
import { resolveEmpireSkin } from './lookup.ts';

export type ArtSource = 'install' | 'placeholder' | 'neutral';

export interface ResolvedArt {
  readonly source: ArtSource;
  readonly path: string;
}

const PLATE = 'plate.svg';

export function placeholderPlate(id: EmpireSkinId): string {
  return `art/skins/${id}/${PLATE}`;
}

/**
 * Plate slot. No per-empire frame bitmap is identified in the inventory
 * (sprites.q3 has no directory; the two ui/ bitmaps have unknown roles),
 * so step 1 does not claim a plate. See docs/ui/empire-skins.md.
 */
export function resolvePlate(id: EmpireSkinId, indexedPaths: readonly string[]): ResolvedArt {
  const installed = findPlateBitmap(id, indexedPaths);
  if (installed) return { source: 'install', path: installed };
  if (id !== 'neutral') return { source: 'placeholder', path: placeholderPlate(id) };
  return { source: 'neutral', path: placeholderPlate('neutral') };
}

/** Named reticle bitmap. The helm panel does not draw it. */
export function resolveReticle(id: EmpireSkinId, indexedPaths: readonly string[]): ResolvedArt | null {
  const plan = resolveEmpireSkin(indexedPaths, id);
  if (plan.reticlePath) return { source: 'install', path: plan.reticlePath };
  return null;
}

function findPlateBitmap(_id: EmpireSkinId, _indexedPaths: readonly string[]): string | null {
  return null;
}
