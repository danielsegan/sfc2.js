/**
 * Which install files can skin the console.
 * Paths and roles come from docs/ui/empire-skins.md. A role of `unknown`
 * is recorded and never drawn.
 */
import { skinForRace, type EmpireSkinId } from './catalog.ts';

export type SkinRole = 'reticle' | 'unknown';

export interface SkinFile {
  readonly id: string;
  readonly role: SkinRole;
  /** Null when the file is shared or its empire is not documented. */
  readonly empireId: string | null;
  readonly note: string;
  /** Install-relative path. The extracted-tree `textures/` prefix is tried too. */
  readonly path: string;
}

export interface SkinHit {
  readonly id: string;
  readonly role: SkinRole;
  readonly indexedPath: string | null;
}

export interface SkinPlan {
  readonly empireId: EmpireSkinId;
  readonly reticlePath: string | null;
  readonly hits: readonly SkinHit[];
}

/**
 * Bitmap names from the CE 2.670 inventory (extracted tree and the
 * install-relative form without the category prefix). Roles are only
 * assigned when the file name itself states one.
 */
export const SKIN_FILES: readonly SkinFile[] = [
  {
    id: 'ui.offscreen',
    role: 'unknown',
    empireId: null,
    note: 'offScr.BMP. The name does not say which console piece this is.',
    path: 'Assets/bitmaps/ui/offScr.BMP',
  },
  {
    id: 'ui.offscreen-grid',
    role: 'unknown',
    empireId: null,
    note: 'off-scr-icon-grid.bmp. The name does not say which icons sit in the grid.',
    path: 'Assets/bitmaps/ui/off-scr-icon-grid.bmp',
  },
  {
    id: 'reticle.hydran',
    role: 'reticle',
    empireId: 'hyd',
    note: 'HydranRedicleCircle.BMP. The name says a Hydran reticle circle.',
    path: 'Assets/textures/HydranRedicleCircle.BMP',
  },
  {
    id: 'reticle.hydran-noise1',
    role: 'unknown',
    empireId: 'hyd',
    note: 'HydranRedicleCircle-noise1.BMP. The noise suffix is not documented.',
    path: 'Assets/textures/HydranRedicleCircle-noise1.BMP',
  },
  {
    id: 'reticle.hydran-noise2',
    role: 'unknown',
    empireId: 'hyd',
    note: 'HydranRedicleCircle-noise2.BMP. The noise suffix is not documented.',
    path: 'Assets/textures/HydranRedicleCircle-noise2.BMP',
  },
  {
    id: 'reticle.isc',
    role: 'reticle',
    empireId: 'isc',
    note: 'ISCRedicle.BMP. The name says an ISC reticle.',
    path: 'Assets/textures/ISCRedicle.BMP',
  },
  {
    id: 'reticle.mirak',
    role: 'reticle',
    empireId: 'mir',
    note: 'MirakReticles.bmp. The name says Mirak reticles.',
    path: 'Assets/textures/MirakReticles.bmp',
  },
  {
    id: 'reticle.targeting',
    role: 'reticle',
    empireId: null,
    note: 'TargetingRedicles.BMP. Shared. The name says targeting reticles.',
    path: 'Assets/textures/TargetingRedicles.BMP',
  },
  {
    id: 'reticle.targeting-noise1',
    role: 'unknown',
    empireId: null,
    note: 'TargetingRedicles-noise1.BMP. The noise suffix is not documented.',
    path: 'Assets/textures/TargetingRedicles-noise1.BMP',
  },
  {
    id: 'reticle.targeting-noise2',
    role: 'unknown',
    empireId: null,
    note: 'TargetingRedicles-noise2.BMP. The noise suffix is not documented.',
    path: 'Assets/textures/TargetingRedicles-noise2.BMP',
  },
  {
    id: 'klingon.splat',
    role: 'unknown',
    empireId: 'kli',
    note: 'Klingon-splat.BMP. Splat does not name a plate, frame, or button.',
    path: 'Assets/textures/Klingon-splat.BMP',
  },
  {
    id: 'crosshair.l',
    role: 'unknown',
    empireId: null,
    note: 'L-crosshair-bar.BMP. Crosshair is in the name. L- is not a documented empire token.',
    path: 'Assets/textures/L-crosshair-bar.BMP',
  },
  {
    id: 'crosshair.l-noise1',
    role: 'unknown',
    empireId: null,
    note: 'L-crosshair-bar-noise1.BMP. The noise suffix is not documented.',
    path: 'Assets/textures/L-crosshair-bar-noise1.BMP',
  },
  {
    id: 'crosshair.l-noise2',
    role: 'unknown',
    empireId: null,
    note: 'L-crosshair-bar-noise2.BMP. The noise suffix is not documented.',
    path: 'Assets/textures/L-crosshair-bar-noise2.BMP',
  },
];

/** Cursor file names in cursors/Assets/mouse, spelling as inventoried. */
export const CURSOR_FILES: Readonly<Record<string, string>> = {
  fed: 'federation.cur',
  kli: 'klingon.cur',
  rom: 'romulan.cur',
  lyr: 'lyran.cur',
  hyd: 'hydran.cur',
  gor: 'gorn.cur',
  isc: 'ISC.cur',
  mir: 'mirak.cur',
};

/** `.bft` name stems in fonts/Assets/aafonts. Orion, Monster, and Neutral have none. */
export const FONT_STEMS: Readonly<Record<string, string>> = {
  fed: 'Federation',
  kli: 'Klingon',
  rom: 'romulan',
  lyr: 'lyran',
  hyd: 'hydran',
  gor: 'gorn',
  isc: 'isc',
  mir: 'mirak',
};

export function empireSkinId(name: string): EmpireSkinId {
  return skinForRace(name).id;
}

export function pathCandidates(path: string): readonly string[] {
  const lower = path.toLowerCase();
  if (lower.startsWith('textures/')) return [path, path.slice('textures/'.length)];
  return [path, `textures/${path}`];
}

export function cursorCandidates(empireId: string): readonly string[] {
  const file = CURSOR_FILES[empireId];
  if (!file) return [];
  return pathCandidates(`Assets/mouse/${file}`).flatMap((path) => [path, path.replace('Assets/mouse/', 'cursors/Assets/mouse/')]);
}

export function resolveEmpireSkin(indexedPaths: readonly string[], empireName: string): SkinPlan {
  const empireId = empireSkinId(empireName);
  const hits: SkinHit[] = [];
  let ownReticle: string | null = null;
  let sharedReticle: string | null = null;
  for (const file of SKIN_FILES) {
    const indexedPath = findIndexed(indexedPaths, pathCandidates(file.path));
    hits.push({ id: file.id, role: file.role, indexedPath });
    if (file.role !== 'reticle' || indexedPath === null) continue;
    if (file.empireId === empireId) ownReticle = indexedPath;
    if (file.empireId === null && file.id === 'reticle.targeting') sharedReticle = indexedPath;
  }
  return {
    empireId,
    reticlePath: ownReticle ?? sharedReticle,
    hits,
  };
}

function findIndexed(indexedPaths: readonly string[], candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    for (const path of indexedPaths) {
      if (path.toLowerCase() === lower) return path;
    }
  }
  return null;
}
