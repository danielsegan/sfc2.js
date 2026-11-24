/**
 * Weapon wedges on the movement plane. Spans and ranges come from the
 * view model. Reload-counted racks draw nothing (hud-layout.md §7.3).
 */
import { showsWedge, STATE_CHARGING, STATE_DISABLED, STATE_NORMAL, STATE_WARNING, WEDGE_FILL_ALPHA } from './tokens.ts';

export interface ArcWeapon {
  readonly slotIndex: number;
  readonly code: string;
  readonly arcFrom16: number;
  readonly arcTo16: number;
  readonly arcFull: boolean;
  readonly rangeMax: number;
  readonly rangeBands: readonly number[];
  readonly ready: boolean;
  readonly status: string;
  readonly mode: number;
}

export type WedgePattern = 'solid' | 'dashed' | 'dashdot' | 'dotted';

export interface WedgeStyle {
  readonly token: 'normal' | 'charging' | 'warning' | 'disabled';
  readonly color: number;
  readonly fill: number;
  readonly pattern: WedgePattern;
}

export interface WedgeSpec {
  readonly from16: number;
  readonly to16: number;
  readonly full: boolean;
  readonly rangeMax: number;
  readonly bands: readonly number[];
  readonly style: WedgeStyle;
}

const FULL = 65536;

function wrap16(value: number): number {
  const wrapped = value % FULL;
  return wrapped < 0 ? wrapped + FULL : wrapped;
}

export function wedgeStyle(weapon: Pick<ArcWeapon, 'ready' | 'status'>): WedgeStyle {
  if (weapon.status === 'overload' || weapon.status === 'overload arming') {
    return { token: 'warning', color: STATE_WARNING, fill: WEDGE_FILL_ALPHA, pattern: 'dashdot' };
  }
  if (weapon.status === 'destroyed' || weapon.status === 'unknown' || weapon.status === 'outside this duel' || weapon.status === 'no cost yet') {
    return { token: 'disabled', color: STATE_DISABLED, fill: 0, pattern: 'dotted' };
  }
  if (weapon.ready) return { token: 'normal', color: STATE_NORMAL, fill: WEDGE_FILL_ALPHA, pattern: 'solid' };
  return { token: 'charging', color: STATE_CHARGING, fill: WEDGE_FILL_ALPHA, pattern: 'dashed' };
}

function sameArc(a: ArcWeapon, b: ArcWeapon): boolean {
  return a.arcFull === b.arcFull && a.arcFrom16 === b.arcFrom16 && a.arcTo16 === b.arcTo16 && a.rangeMax === b.rangeMax;
}

const RANK: Record<WedgeStyle['token'], number> = { disabled: 0, charging: 1, normal: 2, warning: 3 };

/** One wedge per distinct arc among the selected mounts. */
export function wedgesFor(weapons: readonly ArcWeapon[], selected: readonly number[]): WedgeSpec[] {
  const chosen = weapons.filter((weapon) => selected.includes(weapon.slotIndex) && showsWedge(weapon.code) && weapon.rangeMax > 0);
  const groups: ArcWeapon[][] = [];
  for (const weapon of chosen) {
    const group = groups.find((items) => items[0] && sameArc(items[0], weapon));
    if (group) group.push(weapon);
    else groups.push([weapon]);
  }
  const wedges: WedgeSpec[] = [];
  for (const group of groups) {
    let best = group[0];
    if (!best) continue;
    for (const weapon of group) {
      if (RANK[wedgeStyle(weapon).token] > RANK[wedgeStyle(best).token]) best = weapon;
    }
    const style = wedgeStyle(best);
    wedges.push({
      from16: best.arcFrom16,
      to16: best.arcTo16,
      full: best.arcFull,
      rangeMax: best.rangeMax,
      bands: best.rangeBands.filter((band) => band > 0 && band < best.rangeMax),
      style,
    });
  }
  return wedges;
}

export function sectorSweep(from16: number, to16: number, full: boolean): { start16: number; sweep16: number } {
  if (full) return { start16: wrap16(from16), sweep16: FULL };
  let sweep = to16 - from16;
  if (sweep <= 0) sweep += FULL;
  return { start16: wrap16(from16), sweep16: sweep };
}

/**
 * Triangle list for a sector on the play plane.
 * Play +x is world +x, play +y is world −z, matching the ship heading.
 */
export function sectorPositions(
  heading16: number,
  from16: number,
  to16: number,
  full: boolean,
  inner: number,
  outer: number,
  steps: number,
  y: number,
): Float32Array {
  const sweep = sectorSweep(from16, to16, full);
  const count = Math.max(1, steps);
  const positions = new Float32Array(count * 6 * 3);
  let n = 0;
  const at = (index: number, radius: number): [number, number] => {
    const bam = heading16 + sweep.start16 + (sweep.sweep16 * index) / count;
    const angle = (wrap16(bam) / FULL) * Math.PI * 2;
    return [Math.cos(angle) * radius, -Math.sin(angle) * radius];
  };
  for (let i = 0; i < count; i++) {
    const innerA = at(i, inner);
    const outerA = at(i, outer);
    const innerB = at(i + 1, inner);
    const outerB = at(i + 1, outer);
    const tri = [
      innerA, outerA, outerB,
      innerA, outerB, innerB,
    ];
    for (const point of tri) {
      positions[n++] = point[0];
      positions[n++] = y;
      positions[n++] = point[1];
    }
  }
  return positions;
}

/** Outer arc plus the two radii, as line segments. */
export function sectorOutline(
  heading16: number,
  from16: number,
  to16: number,
  full: boolean,
  inner: number,
  outer: number,
  steps: number,
  y: number,
): Float32Array {
  const sweep = sectorSweep(from16, to16, full);
  const count = Math.max(1, steps);
  const at = (index: number, radius: number): [number, number] => {
    const bam = heading16 + sweep.start16 + (sweep.sweep16 * index) / count;
    const angle = (wrap16(bam) / FULL) * Math.PI * 2;
    return [Math.cos(angle) * radius, -Math.sin(angle) * radius];
  };
  const segments: number[] = [];
  const push = (a: [number, number], b: [number, number]) => {
    segments.push(a[0], y, a[1], b[0], y, b[1]);
  };
  for (let i = 0; i < count; i++) push(at(i, outer), at(i + 1, outer));
  if (!full) {
    push(at(0, inner), at(0, outer));
    push(at(count, inner), at(count, outer));
  }
  return new Float32Array(segments);
}

export function facingSector(facing: number): { from16: number; to16: number } {
  const span = FULL / 6;
  const center = facing * span;
  return { from16: wrap16(center - span / 2), to16: wrap16(center + span / 2) };
}
