/**
 * Play-field tokens. Empire skins may tint bar chrome later.
 * The field itself stays on these neutral values (hud-layout.md §7.8).
 */

export const FIELD_GRID = 0x2a4c7a;
export const FIELD_GRID_CSS = '#2A4C7A';

/** Minor lines every 1 range unit, majors every 5. Proposed in hud-layout.md §7.2. */
export const GRID_MINOR_UNIT = 1;
export const GRID_MAJOR_FACTOR = 5;

export const GRID_MINOR_ALPHA = 0.25;
export const GRID_MAJOR_ALPHA = 0.4;
/** Logical px. Minors fade once they would be closer than this. */
export const GRID_FADE_PX = 16;
/** Fade completes across the next 25% of zoom-out. */
export const GRID_FADE_SPAN = 0.25;
/** Lines closer than this are not drawn. */
export const GRID_MIN_PX = 8;

export const STATE_NORMAL = 0x5fd3a0;
export const STATE_CHARGING = 0x4fa3e0;
export const STATE_WARNING = 0xf2b33d;
export const STATE_DISABLED = 0x55606b;
export const STATE_HOSTILE = 0xff6b5e;
export const STATE_FRIENDLY = 0x5fb7ff;
export const STATE_NEUTRAL = 0xc9c9c9;
export const STATE_DAMAGE = 0xe5484d;
export const SHIELD_GLOW = 0x9fd6ff;

export function shieldFlashColor(ratio: number): number {
  if (ratio <= 0) return STATE_DAMAGE;
  if (ratio < 0.25) return STATE_WARNING;
  return SHIELD_GLOW;
}

/** Family beam colours. Not empire accents. */
export const BEAM_PHASER = 0xb7f0c8;
export const BEAM_DISRUPTOR = 0xf2b33d;
export const BEAM_FUSION = 0xffe7a0;

export const WEDGE_FILL_ALPHA = 0.15;

export const FIELD_FOV = 40;
/** Pitch up from the horizontal. Near π/2 is straight down. */
export const OVERHEAD_PITCH = 1.42;
/** Major grid cells across the view at the default overhead zoom. */
export const MAJOR_CELLS_ACROSS = 5;

export const BAR_TOP_UNITS = 24;
export const BAR_BOTTOM_UNITS = 32;
export const TAG_HIT_UNITS = 24;
export const TAG_STACK_UNITS = 4;

export const RELOAD_COUNTED_CODES: readonly string[] = [
  'DroA',
  'DroB',
  'DroC',
  'DroF',
  'DroG',
  'ADD6',
  'ADD12',
];

export function showsWedge(code: string): boolean {
  return !RELOAD_COUNTED_CODES.includes(code);
}

/** Racks that draw an instant beam rather than a travelling shot. */
export function beamFamilyColor(family: string): number | null {
  if (family === 'phaser') return BEAM_PHASER;
  if (family === 'disruptor') return BEAM_DISRUPTOR;
  if (family === 'fusion') return BEAM_FUSION;
  return null;
}
