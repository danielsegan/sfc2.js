import type { Diagnostic } from './diagnostics.ts';
import { MAP_LIMIT } from './fx.ts';

export interface MapBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

const AXIS_FIELDS = ['minX', 'maxX', 'minY', 'maxY'] as const;

function isWholeRangeUnit(value: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= -MAP_LIMIT && value <= MAP_LIMIT;
}

function badAxis(field: string, value: number, file: string | undefined): Diagnostic {
  const location = file === undefined ? { field } : { file, field };
  return {
    code: 'badMapBounds',
    source: 'mission',
    severity: 'error',
    location,
    details: { value },
  };
}

/** One diagnostic per axis that is not a whole range unit inside ±8,192. */
export function validateMapBounds(bounds: MapBounds, file?: string): Diagnostic[] {
  const values = [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY];
  const out: Diagnostic[] = [];
  for (let i = 0; i < AXIS_FIELDS.length; i++) {
    const value = values[i]!;
    if (!isWholeRangeUnit(value)) out.push(badAxis(AXIS_FIELDS[i]!, value, file));
  }
  return out;
}

/** Authored positions use the same ±8,192 whole-unit rule as map bounds. */
export function validateAuthoredPosition(
  x: number,
  y: number,
  fieldX: string,
  fieldY: string,
  file?: string,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (!isWholeRangeUnit(x)) out.push(badAxis(fieldX, x, file));
  if (!isWholeRangeUnit(y)) out.push(badAxis(fieldY, y, file));
  return out;
}
