/**
 * Empire mark and 3-letter code for off-screen tags.
 * Marks are original abstract strokes, not emblems from the shows or the game.
 * Codes match the console skin ids (fed → FED) so a later skin catalog can replace the paths.
 */

export type EmpireId = 'fed' | 'kli' | 'rom' | 'lyr' | 'hyd' | 'gor' | 'isc' | 'mir' | 'ori' | 'neutral';

export interface EmpireBadge {
  readonly id: EmpireId;
  readonly code: string;
  readonly mark: string;
}

const RACE: readonly { readonly token: string; readonly id: EmpireId }[] = [
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
];

const BADGE: Record<EmpireId, EmpireBadge> = {
  fed: { id: 'fed', code: 'FED', mark: 'M2 5 H14 M2 11 H14' },
  kli: { id: 'kli', code: 'KLI', mark: 'M3 4 L13 12' },
  rom: { id: 'rom', code: 'ROM', mark: 'M2 4 H8 V8 H14 V12 H8' },
  lyr: { id: 'lyr', code: 'LYR', mark: 'M4 12 L8 4 M7 12 L11 4 M10 12 L14 4' },
  hyd: { id: 'hyd', code: 'HYD', mark: 'M8 2 L13 5 L13 11 L8 14 L3 11 L3 5 Z' },
  gor: { id: 'gor', code: 'GOR', mark: 'M3 3 H13 V13 H3 Z' },
  isc: { id: 'isc', code: 'ISC', mark: 'M8 3 A5 5 0 1 0 8 13 A3 3 0 1 0 8 3' },
  mir: { id: 'mir', code: 'MIR', mark: 'M3 13 H7 V9 H11 V5 H14' },
  ori: { id: 'ori', code: 'ORI', mark: 'M2 4 H9 V7 H4 V12 H11 M8 8 H14 V14 H9' },
  neutral: { id: 'neutral', code: 'NEU', mark: 'M8 3 A5 5 0 1 1 8 13 A5 5 0 1 1 8 3' },
};

export function empireBadge(race: string): EmpireBadge {
  const lower = race.trim().toLowerCase();
  if (lower in BADGE) return BADGE[lower as EmpireId];
  for (const row of RACE) {
    if (lower === row.token || lower.startsWith(`${row.token} `)) return BADGE[row.id];
  }
  return BADGE.neutral;
}
