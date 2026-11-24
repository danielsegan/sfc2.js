import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import { applyShipPose, frameDistance } from './ship-stage.ts';
import { advanceSpin, applyViewerCode, createTurntable, dragTurntable } from './ship-turntable.ts';

describe('ship viewer turntable', () => {
  it('uses KeyboardEvent.code and ignores the character value', () => {
    const state = createTurntable(false);
    const right = applyViewerCode(state, 'ArrowRight', 3, false);
    expect(right.handled).toBe(true);
    expect(right.state.yaw).toBeGreaterThan(state.yaw);
    expect(applyViewerCode(state, 'Right', 3, false).handled).toBe(false);

    const pause = applyViewerCode(state, 'KeyP', 3, false);
    expect(pause.state.spinning).toBe(false);
    expect(applyViewerCode(state, 'p', 3, false).handled).toBe(false);
    expect(applyViewerCode(state, '1', 3, false).handled).toBe(false);
    expect(applyViewerCode(state, 'Digit2', 3, false).tier).toBe('hd');
    expect(applyViewerCode(state, 'Digit1', 3, false).tier).toBe('period');
  });

  it('spins unless reduced motion is on, and a hitch does not whip the model', () => {
    const state = createTurntable(false);
    expect(state.spinning).toBe(true);
    const spun = advanceSpin(state, 1, false);
    expect(spun.yaw).toBeGreaterThan(state.yaw);
    expect(spun.yaw - state.yaw).toBeLessThan(1);
    expect(advanceSpin(state, 10, true).yaw).toBe(state.yaw);
    expect(createTurntable(true).spinning).toBe(false);
    expect(applyViewerCode(createTurntable(true), 'KeyP', 2, true).state.spinning).toBe(false);
  });

  it('wraps the ship list and drag matches the right arrow', () => {
    const state = createTurntable(false);
    expect(applyViewerCode(state, 'BracketRight', 3, false).state.index).toBe(1);
    expect(applyViewerCode(state, 'BracketLeft', 3, false).state.index).toBe(2);
    expect(applyViewerCode(state, 'BracketRight', 1, false).indexChanged).toBe(false);
    const dragged = dragTurntable(state, 20, 0);
    expect(dragged.yaw).toBeGreaterThan(state.yaw);
    const home = applyViewerCode(dragged, 'Home', 3, false);
    expect(home.state.yaw).toBe(0);
    expect(home.state.pitch).toBeCloseTo(0.3);
  });

  it('frames a radius and poses the turntable yaw then pitch', () => {
    expect(frameDistance(0)).toBe(3);
    expect(frameDistance(2)).toBe(6);
    const root = new Group();
    applyShipPose(root, 0.5, 0.25);
    expect(root.rotation.order).toBe('YXZ');
    expect(root.rotation.y).toBeCloseTo(0.5);
    expect(root.rotation.x).toBeCloseTo(0.25);
  });
});
