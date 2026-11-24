/**
 * World-fixed tactical grid. Spacing is in display range units.
 * Zoom fade follows hud-layout.md §7.2.
 */
import {
  GRID_FADE_PX,
  GRID_FADE_SPAN,
  GRID_MAJOR_ALPHA,
  GRID_MAJOR_FACTOR,
  GRID_MIN_PX,
  GRID_MINOR_ALPHA,
  GRID_MINOR_UNIT,
} from './tokens.ts';

export interface GridLevel {
  readonly minorStep: number;
  readonly majorStep: number;
  readonly minorAlpha: number;
  readonly majorAlpha: number;
}

export function visibleWorldWidth(distance: number, fovDeg: number, aspect: number): number {
  const half = Math.tan((fovDeg * Math.PI) / 360) * distance;
  return half * 2 * Math.max(aspect, 0.0001);
}

export function defaultOverheadDistance(aspect: number, fovDeg: number, majorUnit: number, cellsAcross: number): number {
  const safeAspect = aspect > 0.2 ? aspect : 16 / 9;
  const width = majorUnit * cellsAcross;
  const half = width / (2 * safeAspect);
  return half / Math.tan((fovDeg * Math.PI) / 360);
}

/**
 * Pick the minor/major steps for the current pixels-per-range-unit.
 * Minors fade out over a 25% zoom-out past 16 px, then the old majors
 * become the new minors at the next ×5 step.
 */
export function gridLevel(pxPerUnit: number): GridLevel {
  let minor = GRID_MINOR_UNIT;
  const fadeEnd = GRID_FADE_PX * (1 - GRID_FADE_SPAN);
  for (let step = 0; step < 8; step++) {
    const spacing = pxPerUnit * minor;
    if (spacing < GRID_MIN_PX && step < 7) {
      minor *= GRID_MAJOR_FACTOR;
      continue;
    }
    if (spacing >= GRID_FADE_PX) {
      return { minorStep: minor, majorStep: minor * GRID_MAJOR_FACTOR, minorAlpha: GRID_MINOR_ALPHA, majorAlpha: GRID_MAJOR_ALPHA };
    }
    if (spacing <= fadeEnd) {
      minor *= GRID_MAJOR_FACTOR;
      continue;
    }
    const fade = (GRID_FADE_PX - spacing) / (GRID_FADE_PX - fadeEnd);
    const alpha = GRID_MINOR_ALPHA * (1 - fade);
    return {
      minorStep: minor,
      majorStep: minor * GRID_MAJOR_FACTOR,
      minorAlpha: alpha < 0.001 ? 0 : alpha,
      majorAlpha: GRID_MAJOR_ALPHA,
    };
  }
  return { minorStep: minor, majorStep: minor * GRID_MAJOR_FACTOR, minorAlpha: 0, majorAlpha: GRID_MAJOR_ALPHA };
}

/** Axis-aligned segments on the world lattice. `y` is the plane height. */
export function gridSegments(
  originX: number,
  originZ: number,
  halfWidth: number,
  halfDepth: number,
  step: number,
  y: number,
): Float32Array {
  if (!(step > 0) || !(halfWidth > 0) || !(halfDepth > 0)) return new Float32Array();
  const x0 = Math.floor((originX - halfWidth) / step) * step;
  const x1 = Math.ceil((originX + halfWidth) / step) * step;
  const z0 = Math.floor((originZ - halfDepth) / step) * step;
  const z1 = Math.ceil((originZ + halfDepth) / step) * step;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let x = x0; x <= x1 + step * 0.001; x += step) xs.push(x);
  for (let z = z0; z <= z1 + step * 0.001; z += step) zs.push(z);
  const data = new Float32Array((xs.length + zs.length) * 6);
  let n = 0;
  for (const x of xs) {
    data[n++] = x;
    data[n++] = y;
    data[n++] = z0;
    data[n++] = x;
    data[n++] = y;
    data[n++] = z1;
  }
  for (const z of zs) {
    data[n++] = x0;
    data[n++] = y;
    data[n++] = z;
    data[n++] = x1;
    data[n++] = y;
    data[n++] = z;
  }
  return data;
}

export function latticeCoords(data: Float32Array, axis: 0 | 2): number[] {
  const found = new Set<number>();
  for (let i = 0; i < data.length; i += 6) {
    const a = data[i + axis] ?? 0;
    const b = data[i + 3 + axis] ?? 0;
    if (Math.abs(a - b) < 1e-6) found.add(Math.round(a * 1000) / 1000);
  }
  return [...found].sort((p, q) => p - q);
}
