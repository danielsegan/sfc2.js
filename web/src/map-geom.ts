/** Sensor-map projection. North-up keeps world +x to the right. Heading-up points the bow at the top of the map. */

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface MapSelf {
  readonly x: number;
  readonly y: number;
  readonly heading16: number;
}

export function mapOffset(contact: MapPoint, self: MapSelf | undefined, headingUp: boolean): MapPoint {
  const dx = self ? contact.x - self.x : contact.x;
  const dy = self ? contact.y - self.y : contact.y;
  if (!headingUp || !self) return { x: dx, y: dy };
  const angle = Math.PI / 2 - (self.heading16 / 65536) * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** Inverse of the map projection. localX/localY are pixels from the map centre. */
export function mapWorldAt(
  self: MapSelf,
  headingUp: boolean,
  scale: number,
  localX: number,
  localY: number,
): MapPoint {
  const ox = localX / scale;
  const oy = -localY / scale;
  if (!headingUp) return { x: self.x + ox, y: self.y + oy };
  const angle = Math.PI / 2 - (self.heading16 / 65536) * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = ox * cos + oy * sin;
  const dy = -ox * sin + oy * cos;
  return { x: self.x + dx, y: self.y + dy };
}

export function nearestContact(
  contacts: readonly { id: number; x: number; y: number; kind: string }[],
  self: MapSelf | undefined,
  headingUp: boolean,
  scale: number,
  localX: number,
  localY: number,
): number | null {
  let best: number | null = null;
  let bestDist = 18;
  for (const contact of contacts) {
    if (contact.kind === 'shot') continue;
    const offset = mapOffset(contact, self, headingUp);
    const dx = offset.x * scale - localX;
    const dy = -offset.y * scale - localY;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = contact.id;
    }
  }
  return best;
}
