/**
 * Off-screen contact tags. Placement is screen geometry only.
 * Range text is the view model's display range (already converted).
 */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type TagEdge = 'left' | 'right' | 'top' | 'bottom';

export interface TagPlace {
  readonly x: number;
  readonly y: number;
  readonly edge: TagEdge;
}

export function formatRangeTag(range: number): string {
  const shown = Math.round(range * 100) / 100;
  return `${shown.toFixed(2)}k`;
}

export function markerHeading(self: { readonly heading16: number; readonly headingOrdered16?: number }): number {
  const ordered = self.headingOrdered16;
  if (typeof ordered === 'number' && Number.isFinite(ordered)) return ordered;
  return self.heading16;
}

/**
 * Edge point for a contact outside the view. On-screen contacts return null.
 * `ndc` is −1..1, y up. Behind-camera points are flipped so the tag sits
 * on the opposite border.
 */
export function offscreenPoint(
  ndcX: number,
  ndcY: number,
  inFront: boolean,
  view: Rect,
  margin: number,
): TagPlace | null {
  let x = ndcX;
  let y = ndcY;
  if (!inFront) {
    x = -x;
    y = -y;
  }
  const inside = inFront && x >= -1 && x <= 1 && y >= -1 && y <= 1;
  if (inside) return null;
  if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) {
    return clampToView(view.left + (view.right - view.left) / 2, view.bottom - margin, view, margin, 'bottom');
  }
  const scale = Math.max(Math.abs(x), Math.abs(y));
  const cx = x / scale;
  const cy = y / scale;
  const width = view.right - view.left;
  const height = view.bottom - view.top;
  const px = view.left + (cx * 0.5 + 0.5) * width;
  const py = view.top + (1 - (cy * 0.5 + 0.5)) * height;
  const edge: TagEdge = Math.abs(cx) > Math.abs(cy) ? (cx > 0 ? 'right' : 'left') : cy > 0 ? 'top' : 'bottom';
  return clampToView(px, py, view, margin, edge);
}

function clampToView(x: number, y: number, view: Rect, margin: number, edge: TagEdge): TagPlace {
  const left = view.left + margin;
  const right = view.right - margin;
  const top = view.top + margin;
  const bottom = view.bottom - margin;
  return {
    x: Math.min(right, Math.max(left, x)),
    y: Math.min(bottom, Math.max(top, y)),
    edge,
  };
}

function covers(place: TagPlace, block: Rect): boolean {
  return place.x >= block.left && place.x <= block.right && place.y >= block.top && place.y <= block.bottom;
}

/** Push a point out of any obstacle rect, keeping it inside the view. */
export function avoidObstacles(place: TagPlace, view: Rect, obstacles: readonly Rect[], margin: number): TagPlace {
  let next = place;
  for (const block of obstacles) {
    if (!covers(next, block)) continue;
    const options: TagPlace[] = [
      clampToView(block.left - margin, next.y, view, margin, 'left'),
      clampToView(block.right + margin, next.y, view, margin, 'right'),
      clampToView(next.x, block.top - margin, view, margin, 'top'),
      clampToView(next.x, block.bottom + margin, view, margin, 'bottom'),
    ];
    let best: TagPlace | null = null;
    let bestDist = Infinity;
    for (const option of options) {
      if (obstacles.some((item) => covers(option, item))) continue;
      const dist = Math.hypot(option.x - next.x, option.y - next.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = option;
      }
    }
    if (best) next = best;
  }
  return next;
}

export interface StackedTag {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly edge: TagEdge;
}

/** Separate tags that land on the same edge. Gap is in CSS pixels. */
export function stackTags(tags: readonly StackedTag[], gap: number, view: Rect, margin: number): StackedTag[] {
  const buckets: Record<TagEdge, StackedTag[]> = { left: [], right: [], top: [], bottom: [] };
  for (const tag of tags) buckets[tag.edge].push({ ...tag });
  const out: StackedTag[] = [];
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const along = edge === 'left' || edge === 'right' ? 'y' : 'x';
    const list = buckets[edge].sort((a, b) => a[along] - b[along]);
    let cursor = edge === 'top' || edge === 'left' ? (along === 'y' ? view.top : view.left) + margin : -Infinity;
    for (const tag of list) {
      const min = edge === 'top' || edge === 'bottom' ? view.left + margin : view.top + margin;
      const max = edge === 'top' || edge === 'bottom' ? view.right - margin : view.bottom - margin;
      let value = tag[along];
      if (value < cursor) value = cursor;
      value = Math.min(max, Math.max(min, value));
      cursor = value + gap;
      if (along === 'y') out.push({ ...tag, y: value });
      else out.push({ ...tag, x: value });
    }
  }
  return out;
}

export function pickContact(
  points: readonly { id: number; x: number; y: number; kind: string }[],
  px: number,
  py: number,
  radius: number,
): number | null {
  let best: number | null = null;
  let bestDist = radius;
  for (const point of points) {
    if (point.kind === 'shot') continue;
    const dist = Math.hypot(point.x - px, point.y - py);
    if (dist <= bestDist) {
      bestDist = dist;
      best = point.id;
    }
  }
  return best;
}
