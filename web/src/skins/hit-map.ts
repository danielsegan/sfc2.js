import type { EmpireSkinId } from './catalog.ts';

/**
 * Panels are fixed for every skin: the test compares every `section.plate`
 * box and their reading order (aria-label, document order) across skins.
 */
export const PANEL_SELECTOR = 'section.plate';

/**
 * Button ids measured per skin. A skin may place buttons inside its own
 * panels from its own table (hud-layout.md §4.2, per CE capture, 2026-11-24);
 * the test checks each skin against the skins that share its table.
 */
export const HIT_TARGET_IDS = [
  'pause',
  'ui-scale',
  'player-ship',
  'opponent-ship',
  'keys-open',
  'load',
  'helm-n',
  'helm-camera',
  'helm-go',
  'ordered-speed',
  'shields',
  'mfd-btn-shields',
  'schematic-weapons-btn',
  'space',
  'energy',
  'cloak',
] as const;

export const LOCKED_COLOUR_TOKENS = [
  '--text',
  '--text-dim',
  '--focus',
  '--panel-edge',
  '--state-normal',
  '--state-charging',
  '--state-warning',
  '--state-damage',
  '--state-disabled',
  '--state-friendly',
  '--state-hostile',
] as const;

export type ButtonTable = readonly (typeof HIT_TARGET_IDS)[number][];

/** The one button table in use today. */
export const SHARED_BUTTON_TABLE: ButtonTable = HIT_TARGET_IDS;

/** Per-skin button tables. Today every skin uses the shared table. */
export const SKIN_BUTTON_TABLES: Readonly<Record<EmpireSkinId, ButtonTable>> = {
  fed: SHARED_BUTTON_TABLE,
  kli: SHARED_BUTTON_TABLE,
  rom: SHARED_BUTTON_TABLE,
  lyr: SHARED_BUTTON_TABLE,
  hyd: SHARED_BUTTON_TABLE,
  gor: SHARED_BUTTON_TABLE,
  isc: SHARED_BUTTON_TABLE,
  mir: SHARED_BUTTON_TABLE,
  ori: SHARED_BUTTON_TABLE,
  neutral: SHARED_BUTTON_TABLE,
};
