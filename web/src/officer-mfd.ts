/**
 * Officer MFD pages, 3-tier tactical-map zoom, and message-log
 * channels. Pure UI helpers: the HUD still only reads ViewModel and
 * dispatches existing DuelMatch / view commands.
 */

export const OFFICER_PAGES = [
  { id: 'helm', label: 'Helm', action: 'mfd.page.helm', title: 'Helm officer page' },
  { id: 'repair', label: 'Repair', action: 'mfd.page.repair', title: 'Damage Control / Repair officer page' },
  { id: 'science', label: 'Science', action: 'mfd.page.science', title: 'Science officer page' },
  { id: 'marines', label: 'Marines', action: 'mfd.page.marines', title: 'Security / Marines officer page' },
  { id: 'shuttles', label: 'Shuttles', action: 'mfd.page.shuttles', title: 'Shuttles / Mines officer page' },
  { id: 'comms', label: 'Comms', action: 'mfd.page.comms', title: 'Communication / Message log officer page' },
  { id: 'map', label: 'Map', action: 'mfd.page.map', title: 'Tactical Map officer page' },
  { id: 'fleet', label: 'Fleet', action: 'mfd.page.fleet', title: 'Fleet roster officer page' },
  { id: 'energy', label: 'Energy', action: 'mfd.page.energy', title: 'Energy Management officer page' },
  { id: 'options', label: 'Options', action: 'mfd.page.options', title: 'Options / Camera officer page' },
] as const;

export type OfficerPageId = (typeof OFFICER_PAGES)[number]['id'];

export const DEFAULT_OFFICER_PAGE: OfficerPageId = 'helm';

/** Mid, then ~2×, then ~2× again (CE Map tab has three discrete zoom tiers). */
export const MAP_ZOOM_LEVELS = [8, 16, 32] as const;

export type MapZoomLevel = (typeof MAP_ZOOM_LEVELS)[number];

export const LOG_CHANNELS = ['engineering', 'mission', 'science', 'fleet'] as const;

export type LogChannel = (typeof LOG_CHANNELS)[number];

export const LOG_CHANNEL_LABELS: Readonly<Record<LogChannel, string>> = {
  engineering: 'Engineering',
  mission: 'Mission',
  science: 'Science',
  fleet: 'Fleet',
};

export function isOfficerPage(value: string): value is OfficerPageId {
  return OFFICER_PAGES.some((page) => page.id === value);
}

export function nearestMapZoom(value: number): MapZoomLevel {
  if (!Number.isFinite(value)) return MAP_ZOOM_LEVELS[0];
  let best: MapZoomLevel = MAP_ZOOM_LEVELS[0];
  let bestDist = Math.abs(value - best);
  for (const level of MAP_ZOOM_LEVELS) {
    const dist = Math.abs(value - level);
    if (dist < bestDist) {
      best = level;
      bestDist = dist;
    }
  }
  return best;
}

/** +1 zooms in (higher scale), −1 zooms out. Clamps to the three CE tiers. */
export function stepMapZoom(current: number, direction: 1 | -1): MapZoomLevel {
  const levels: readonly MapZoomLevel[] = MAP_ZOOM_LEVELS;
  const index = levels.indexOf(nearestMapZoom(current));
  const next = Math.max(0, Math.min(levels.length - 1, index + direction));
  return levels[next]!;
}

export function mapZoomIndex(current: number): number {
  return MAP_ZOOM_LEVELS.indexOf(nearestMapZoom(current));
}

/** Range-ring world distances so about four cells stay visible at each tier. */
export function mapRingDistances(scale: number, radiusPx: number): number[] {
  const world = radiusPx > 0 && scale > 0 ? radiusPx / scale : 10;
  const outer = world * 0.9;
  const inner = outer / 2;
  const rounded = [snapRing(inner), snapRing(outer)].filter((value, index, list) => {
    return value > 0 && list.indexOf(value) === index;
  });
  return rounded.length > 0 ? rounded : [5];
}

function snapRing(value: number): number {
  if (value >= 8) return Math.round(value / 5) * 5;
  if (value >= 2) return Math.round(value);
  return Math.round(value * 2) / 2;
}

export function classifyLogChannel(event: { kind: string; id?: string } | string): LogChannel {
  if (typeof event === 'string') return classifyLogText(event);
  if (event.kind === 'hit') return 'engineering';
  if (event.kind === 'sim') return 'mission';
  if (event.kind === 'alert') return classifyLogText(event.id ?? '');
  return classifyLogText('');
}

function classifyLogText(text: string): LogChannel {
  const line = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  if (
    /hit|yaw|speed|overdraw|energy|het|helm|turn mode|order applied|heading ordered/.test(line)
  ) {
    return 'engineering';
  }
  if (/scan|probe|science|sensor/.test(line)) return 'science';
  if (/fleet|friendly|ally|ai |boarding|fighter|shuttle|craft/.test(line)) return 'fleet';
  return 'mission';
}

/** Our own empire accents for map glyphs (not trade-dress palettes). */
export const MAP_EMPIRE_COLORS: Readonly<Record<string, string>> = {
  fed: '#4f8fd6',
  kli: '#b23a3a',
  rom: '#3fa36b',
  lyr: '#d9a441',
  hyd: '#3fb5a8',
  gor: '#7fa640',
  isc: '#d0d4da',
  mir: '#c46a2e',
  ori: '#9b6bd1',
  neutral: '#8a9aab',
};

export function mapEmpireColor(empireId: string): string {
  return MAP_EMPIRE_COLORS[empireId] ?? MAP_EMPIRE_COLORS.neutral;
}
