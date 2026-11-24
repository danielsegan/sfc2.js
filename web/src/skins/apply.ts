/**
 * Apply a skin. Only custom properties change: art, accent, header
 * weight, case and tracking. Positions and state colours stay put.
 */
import { loadInterfaceBitmap, type InterfaceBitmap } from '@sfc2js/render';
import type { Vfs } from '@sfc2js/platform';
import { skinForRace, type EmpireSkin } from './catalog.ts';
import { resolvePlate, resolveReticle } from './resolve.ts';

let generation = 0;

export function skinVars(skin: EmpireSkin, plateUrl: string): Readonly<Record<string, string>> {
  const headerCase = skin.type.headerCase === 'smallcaps';
  return {
    '--accent': skin.accent.primary,
    '--accent-secondary': skin.accent.secondary,
    '--panel-bg': skin.panelBg.color,
    '--panel-alpha': `${String(Math.round(skin.panelBg.opacity * 100))}%`,
    '--plate-image': `url("${plateUrl}")`,
    '--header-weight': String(skin.type.headerWeight),
    '--header-tracking': `${String(skin.type.tracking)}em`,
    '--header-transform': headerCase ? 'none' : 'uppercase',
    '--header-variant': headerCase ? 'small-caps' : 'normal',
  };
}

export async function applyEmpireSkin(empireName: string, vfs: Vfs | null): Promise<string> {
  const token = ++generation;
  const skin = skinForRace(empireName);
  const indexed = vfs ? vfs.list().map((entry) => entry.path) : [];
  const plate = resolvePlate(skin.id, indexed);
  const plateUrl = plate.source === 'install' ? '' : `./${plate.path}`;
  const root = document.documentElement;
  const vars = skinVars(skin, plateUrl);
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  document.body.dataset.empire = skin.id;
  const mark = document.getElementById('empire-mark');
  if (mark instanceof HTMLImageElement) mark.src = `./art/skins/${skin.id}/mark.svg`;
  const code = document.getElementById('empire-code');
  if (code) code.textContent = skin.glyphs.code;
  root.style.removeProperty('--reticle-image');
  const reticle = resolveReticle(skin.id, indexed);
  if (!vfs || !reticle) return note(skin.id, plate.source, null);
  const loaded = await loadInterfaceBitmap(vfs, reticle.path);
  if (token !== generation) return note(skin.id, plate.source, null);
  const url = loaded.data ? bitmapUrl(loaded.data) : null;
  if (url) root.style.setProperty('--reticle-image', `url("${url}")`);
  return note(skin.id, plate.source, url ? loaded.data?.path ?? null : null);
}

function note(id: string, plate: string, reticle: string | null): string {
  const face = reticle ? ` Reticle ${reticle}.` : '';
  return `Skin ${id}. Plate ${plate}.${face}`;
}

function bitmapUrl(bitmap: InterfaceBitmap): string | null {
  if (bitmap.width < 1 || bitmap.height < 1) return null;
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(bitmap.rgba), bitmap.width, bitmap.height), 0, 0);
  return canvas.toDataURL('image/png');
}
