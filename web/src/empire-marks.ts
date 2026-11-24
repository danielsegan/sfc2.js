/**
 * One shared set of empire marks and codes, used by the console skin
 * (`skins/apply.ts`) and the off-screen tags (`field-hud.ts`).
 *
 * Marks are original abstract strokes on a 16 × 16 grid, following the
 * motifs in docs/ui/hud-layout.md §4.5. They are not insignia, logos or
 * emblems from the shows, books or games: no delta or arrowhead, no LCARS.
 * Empires are told apart by mark plus 3-letter code, never colour alone.
 */

export type EmpireId = 'fed' | 'kli' | 'rom' | 'lyr' | 'hyd' | 'gor' | 'isc' | 'mir' | 'ori' | 'neutral';

export interface EmpireMark {
  readonly id: EmpireId;
  /** 3-letter code shown next to the mark. */
  readonly code: string;
  /** SVG path data in a 0 0 16 16 viewBox, drawn as a stroke in currentColor. */
  readonly path: string;
}

export const EMPIRE_MARKS: Readonly<Record<EmpireId, EmpireMark>> = {
  // Twin hairline rails.
  fed: { id: 'fed', code: 'FED', path: 'M2 5 H14 M2 11 H14' },
  // One serrated edge.
  kli: { id: 'kli', code: 'KLI', path: 'M2 12 L5 4 L8 12 L11 4 L14 12' },
  // Two stepped chevron bands.
  rom: { id: 'rom', code: 'ROM', path: 'M2 8 L8 3 L14 8 M2 13 L8 8 L14 13' },
  // Three short parallel slashes.
  lyr: { id: 'lyr', code: 'LYR', path: 'M4 12 L8 4 M7 12 L11 4 M10 12 L14 4' },
  // A single hexagonal cell.
  hyd: { id: 'hyd', code: 'HYD', path: 'M8 2 L13 5 L13 11 L8 14 L3 11 L3 5 Z' },
  // Two heavy offset blocks.
  gor: { id: 'gor', code: 'GOR', path: 'M3 3 H7 V7 H3 Z M9 9 H13 V13 H9 Z' },
  // Concentric arcs over a base line.
  isc: { id: 'isc', code: 'ISC', path: 'M3 11 A5 5 0 0 1 13 11 M5.5 11 A2.5 2.5 0 0 1 10.5 11 M2 13 H14' },
  // Terraced steps.
  mir: { id: 'mir', code: 'MIR', path: 'M3 13 H7 V9 H11 V5 H14' },
  // Mismatched offset panels.
  ori: { id: 'ori', code: 'ORI', path: 'M2 3 H9 V7 H2 Z M7 9 H14 V13 H7 Z' },
  // Plain square: no motif.
  neutral: { id: 'neutral', code: 'NEU', path: 'M3 3 H13 V13 H3 Z' },
};

/** Lower-case shiplist race tokens. `interceptor` is an alias of `ori`. */
const RACE_TOKENS: readonly { readonly token: string; readonly id: EmpireId }[] = [
  { token: 'federation', id: 'fed' },
  { token: 'klingon', id: 'kli' },
  { token: 'romulan', id: 'rom' },
  { token: 'lyran', id: 'lyr' },
  { token: 'hydran', id: 'hyd' },
  { token: 'gorn', id: 'gor' },
  { token: 'isc', id: 'isc' },
  { token: 'mirak', id: 'mir' },
  { token: 'orion', id: 'ori' },
  { token: 'interceptor', id: 'ori' },
  { token: 'neutral', id: 'neutral' },
];

/** Race token or skin id to an empire id. Unknown tokens, including Monster, are `neutral`. */
export function empireIdForRace(race: string): EmpireId {
  const lower = race.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(EMPIRE_MARKS, lower)) return lower as EmpireId;
  for (const row of RACE_TOKENS) {
    if (lower === row.token || lower.startsWith(`${row.token} `)) return row.id;
  }
  return 'neutral';
}

export function empireMarkFor(race: string): EmpireMark {
  return EMPIRE_MARKS[empireIdForRace(race)];
}

/** Inline SVG for a mark. Stroke is currentColor, so the caller's CSS sets the colour. */
export function renderEmpireMark(mark: EmpireMark, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.empire = mark.id;
  const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  stroke.setAttribute('d', mark.path);
  stroke.setAttribute('fill', 'none');
  stroke.setAttribute('stroke', 'currentColor');
  stroke.setAttribute('stroke-width', '1.5');
  stroke.setAttribute('stroke-linejoin', 'miter');
  svg.append(stroke);
  return svg;
}
