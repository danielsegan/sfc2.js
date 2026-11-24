/**
 * EmpireSkin from docs/ui/hud-layout.md §4.2.
 * Accents are the style-guide §4.2 values. Motifs are original.
 * An unknown race uses `neutral`. `interceptor` is an alias of `ori`.
 */
export type EmpireSkinId = 'fed' | 'kli' | 'rom' | 'lyr' | 'hyd' | 'gor' | 'isc' | 'mir' | 'ori' | 'neutral';

export interface EmpireSkin {
  id: EmpireSkinId;
  frame: {
    plate: string;
    nineSlice: [number, number, number, number];
    trim?: string;
  };
  accent: {
    primary: string;
    secondary: string;
    /** Colour-vision overrides. Values wait on the style-guide follow-up (hud-layout §6). */
    cvd?: Partial<Record<'deut' | 'prot' | 'trit', { primary: string; secondary: string }>>;
  };
  panelBg: { color: string; opacity: number; texture?: string };
  type: { headerWeight: 500 | 600 | 700; headerCase: 'smallcaps' | 'upper'; tracking: number };
  glyphs: {
    mark: string;
    code: string;
    iconJoin: 'chamfer' | 'notch' | 'step';
  };
  sounds: { panelOpen: string; panelClose: string; click: string; alertTone: string };
}

const HOOKS = {
  panelOpen: 'ui.click',
  panelClose: 'ui.back',
  click: 'ui.click',
  alertTone: 'hud.alert.hull_critical',
} as const;

function skin(
  id: EmpireSkinId,
  code: string,
  primary: string,
  secondary: string,
  panel: string,
  headerWeight: 500 | 600 | 700,
  headerCase: 'smallcaps' | 'upper',
  tracking: number,
  iconJoin: 'chamfer' | 'notch' | 'step',
): EmpireSkin {
  return {
    id,
    frame: {
      plate: 'skin.frame.plate',
      nineSlice: [8, 8, 8, 8],
      trim: 'skin.frame.trim',
    },
    accent: { primary, secondary },
    panelBg: { color: panel, opacity: 0.85 },
    type: { headerWeight, headerCase, tracking },
    glyphs: { mark: 'skin.glyph.mark', code, iconJoin },
    sounds: HOOKS,
  };
}

export const EMPIRE_SKINS: readonly EmpireSkin[] = [
  skin('fed', 'FED', '#4F8FD6', '#C8D6E5', '#0C1828', 600, 'smallcaps', 0.14, 'chamfer'),
  skin('kli', 'KLI', '#B23A3A', '#4A4A4A', '#1A0E0E', 700, 'upper', 0.16, 'notch'),
  skin('rom', 'ROM', '#3FA36B', '#C9B26A', '#0E1A14', 600, 'upper', 0.12, 'step'),
  skin('lyr', 'LYR', '#D9A441', '#6B4A2A', '#1A1408', 600, 'upper', 0.1, 'notch'),
  skin('hyd', 'HYD', '#3FB5A8', '#7A5FB0', '#0C1A18', 500, 'smallcaps', 0.12, 'chamfer'),
  skin('gor', 'GOR', '#7FA640', '#5A3A2A', '#12180C', 700, 'upper', 0.08, 'step'),
  skin('isc', 'ISC', '#D0D4DA', '#6B7FA0', '#141820', 500, 'smallcaps', 0.18, 'chamfer'),
  skin('mir', 'MIR', '#C46A2E', '#3A3A5A', '#1A100C', 600, 'upper', 0.1, 'step'),
  skin('ori', 'ORI', '#9B6BD1', '#2E2E2E', '#140E1C', 600, 'upper', 0.06, 'notch'),
  skin('neutral', 'NEU', '#3A4A5C', '#8A9AAB', '#0B1118', 600, 'upper', 0.12, 'chamfer'),
];

const RACE_TO_SKIN: readonly { readonly token: string; readonly id: EmpireSkinId }[] = [
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

export function skinById(id: string): EmpireSkin {
  for (const skinRow of EMPIRE_SKINS) {
    if (skinRow.id === id) return skinRow;
  }
  return EMPIRE_SKINS[EMPIRE_SKINS.length - 1]!;
}

/** Shiplist race token to a skin id. Unknown tokens, including Monster, use neutral. */
export function skinForRace(race: string): EmpireSkin {
  const lower = race.trim().toLowerCase();
  for (const row of EMPIRE_SKINS) {
    if (lower === row.id) return row;
  }
  for (const row of RACE_TO_SKIN) {
    if (lower === row.token || lower.startsWith(`${row.token} `)) return skinById(row.id);
  }
  return skinById('neutral');
}
