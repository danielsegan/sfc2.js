/**
 * Ship viewer controls. Bindings use KeyboardEvent.code (Modern profile,
 * docs/ui/modern-ux.md §4), not KeyboardEvent.key.
 */

import type { RenderTier } from './ship-texture.ts';

export const SHIP_VIEWER_KEYS = [
  { action: 'viewer.yawLeft', code: 'ArrowLeft', label: 'Yaw left' },
  { action: 'viewer.yawRight', code: 'ArrowRight', label: 'Yaw right' },
  { action: 'viewer.pitchUp', code: 'ArrowUp', label: 'Pitch up' },
  { action: 'viewer.pitchDown', code: 'ArrowDown', label: 'Pitch down' },
  { action: 'viewer.previousShip', code: 'BracketLeft', label: 'Previous ship' },
  { action: 'viewer.nextShip', code: 'BracketRight', label: 'Next ship' },
  { action: 'viewer.toggleSpin', code: 'KeyP', label: 'Pause or resume spin' },
  { action: 'viewer.resetView', code: 'Home', label: 'Reset view' },
  { action: 'viewer.tierPeriod', code: 'Digit1', label: 'Period look' },
  { action: 'viewer.tierHd', code: 'Digit2', label: 'HD look' },
  { action: 'viewer.cycleLod', code: 'KeyL', label: 'Next detail level' },
] as const;

const YAW_STEP = 0.18;
const PITCH_STEP = 0.12;
const PITCH_LIMIT = 1.2;
const SPIN_RATE = Math.PI / 4;
const MAX_STEP = 0.1;

export interface TurntableState {
  index: number;
  yaw: number;
  pitch: number;
  spinning: boolean;
}

export interface ViewerKeyResult {
  state: TurntableState;
  handled: boolean;
  indexChanged: boolean;
  tier?: RenderTier;
  lodStep?: number;
}

export function createTurntable(reducedMotion: boolean): TurntableState {
  return { index: 0, yaw: 0.4, pitch: 0.3, spinning: !reducedMotion };
}

export function applyViewerCode(
  state: TurntableState,
  code: string,
  count: number,
  reducedMotion: boolean,
): ViewerKeyResult {
  const binding = SHIP_VIEWER_KEYS.find((item) => item.code === code);
  if (binding === undefined) return { state, handled: false, indexChanged: false };
  switch (binding.action) {
    case 'viewer.yawLeft':
      return { state: { ...state, yaw: state.yaw - YAW_STEP }, handled: true, indexChanged: false };
    case 'viewer.yawRight':
      return { state: { ...state, yaw: state.yaw + YAW_STEP }, handled: true, indexChanged: false };
    case 'viewer.pitchUp':
      return { state: { ...state, pitch: clampPitch(state.pitch + PITCH_STEP) }, handled: true, indexChanged: false };
    case 'viewer.pitchDown':
      return { state: { ...state, pitch: clampPitch(state.pitch - PITCH_STEP) }, handled: true, indexChanged: false };
    case 'viewer.previousShip':
      return stepIndex(state, -1, count);
    case 'viewer.nextShip':
      return stepIndex(state, 1, count);
    case 'viewer.toggleSpin':
      if (reducedMotion) return { state: { ...state, spinning: false }, handled: true, indexChanged: false };
      return { state: { ...state, spinning: !state.spinning }, handled: true, indexChanged: false };
    case 'viewer.resetView':
      return { state: { ...state, yaw: 0, pitch: 0.3 }, handled: true, indexChanged: false };
    case 'viewer.tierPeriod':
      return { state, handled: true, indexChanged: false, tier: 'period' };
    case 'viewer.tierHd':
      return { state, handled: true, indexChanged: false, tier: 'hd' };
    case 'viewer.cycleLod':
      return { state, handled: true, indexChanged: false, lodStep: 1 };
    default:
      return { state, handled: false, indexChanged: false };
  }
}

export function advanceSpin(state: TurntableState, dtSeconds: number, reducedMotion: boolean): TurntableState {
  if (!state.spinning || reducedMotion) return state;
  const step = Math.min(Math.max(dtSeconds, 0), MAX_STEP);
  return { ...state, yaw: state.yaw + SPIN_RATE * step };
}

export function dragTurntable(state: TurntableState, dx: number, dy: number): TurntableState {
  return {
    ...state,
    yaw: state.yaw + dx * 0.01,
    pitch: clampPitch(state.pitch + dy * 0.01),
  };
}

function stepIndex(state: TurntableState, delta: number, count: number): ViewerKeyResult {
  if (count <= 1) return { state, handled: true, indexChanged: false };
  const index = ((state.index + delta) % count + count) % count;
  return { state: { ...state, index }, handled: true, indexChanged: index !== state.index };
}

function clampPitch(pitch: number): number {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch));
}
