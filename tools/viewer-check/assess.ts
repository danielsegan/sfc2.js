/**
 * Load-stage verdict for one hull. Shared by the Chromium check and the
 * Node load check. This module does not render and does not import Playwright.
 */

import type { Vfs } from '../../engine/platform/src/vfs.ts';
import type { LoadedShip } from '../../engine/render/src/ship-catalog.ts';
import { pairSelfIllumination } from '../formats/src/self-illum.ts';
import { loadedResult, type DiagnosticSnap, type ShipResult } from './report.ts';

export function assessLoaded(ship: LoadedShip, vfs: Vfs | null): ShipResult {
  return loadedResult({
    spawnKey: ship.spawnKey,
    placeholder: ship.placeholder,
    textured: ship.textured,
    selfIlluminated: ship.selfIlluminated,
    unboundSelfIllum: vfs !== null && unboundSelfIllum(ship, vfs),
    diagnostics: ship.diagnostics.map(snapDiagnostic),
  });
}

function unboundSelfIllum(ship: LoadedShip, vfs: Vfs): boolean {
  if (ship.placeholder || ship.geometry.length === 0) return false;
  const slash = ship.geometry.lastIndexOf('/');
  const dir = slash >= 0 ? ship.geometry.slice(0, slash) : '';
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
  const pairs = pairSelfIllumination(local).pairs;
  for (const material of ship.mesh.materials) {
    const mapped = material as {
      map?: { userData?: { installPath?: unknown } } | null;
      emissiveMap?: { image?: { width?: number } } | null;
    };
    const emissive = mapped.emissiveMap;
    if (emissive && !(typeof emissive.image?.width === 'number' && emissive.image.width > 0)) return true;
    const basePath = mapped.map?.userData?.installPath;
    if (typeof basePath !== 'string') continue;
    const pair = pairs.find((item) => item.basePath.toLowerCase() === basePath.toLowerCase());
    if (pair?.selfIllumPath !== undefined && !emissive) return true;
  }
  return false;
}

function snapDiagnostic(item: { source: string; code: string; severity: string; details?: Record<string, unknown> }): DiagnosticSnap {
  const which = item.details?.which;
  return {
    source: item.source,
    code: item.code,
    severity: item.severity,
    ...(which === 'diffuse' || which === 'luminance' ? { which } : {}),
  };
}
