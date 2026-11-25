/**
 * Narration and input script for the tutorial capture.
 * Every control named here is read from the current sources.
 * Actions that are not implemented are spoken as refusals, not faked.
 */

export const OPEN_MS = 700;
export const PAD_MS = 280;

export const segments = [
  {
    id: 'intro',
    keys: 'Synthetic fixture',
    action: 'Press Escape to pause. No install query, no folder picker.',
    narration:
      'This is SFC2.js. The banner names the placeholder fixture, and no game install is mounted. You fly one fixture cruiser. A built-in captain flies the other. Escape pauses, and the picture holds.',
    async play(ctx) {
      await ctx.press('Escape');
      await ctx.page.waitForFunction(
        () => document.getElementById('pause')?.textContent === 'Resume',
        null,
        { timeout: 2000 },
      );
    },
  },
  {
    id: 'hud',
    keys: 'Target   Hull   Speed   Helm',
    action: 'Read the target plate, the top and bottom bars, and the helm plate. No key.',
    narration:
      'Target shows the name, the range, and the bearing. The top bar is hull, the phaser capacitor, the clock, and the target hull. The bottom bar is speed, turn rate, power, and Fire. Helm reads speed, heading, and turn delay.',
    async play(ctx) {
      await ctx.scrollInto('#target-name');
    },
  },
  {
    id: 'target',
    keys: 'TAB   SHIFT+TAB   T   Y',
    action: 'Press Tab, Shift+Tab, KeyT, then KeyY, while the other cruiser is still there.',
    narration:
      'Tab cycles hostiles. Shift Tab goes back. T picks the nearest. Y reports that there is no friendly contact.',
    async play(ctx) {
      await ctx.blur();
      await ctx.press('Tab');
      await ctx.sleep(400);
      await ctx.press('Shift+Tab');
      await ctx.sleep(400);
      await ctx.press('KeyT');
      await ctx.sleep(400);
      await ctx.press('KeyY');
      await ctx.expectNotice('No friendly contact');
    },
  },
  {
    id: 'het',
    keys: 'Helm ← port    → starboard    (no key)',
    action: 'Set time scale to 1, click the port high-energy-turn arrow, then set time scale back to 4.',
    narration:
      'High-energy turns have no key. Only the port and starboard helm arrows are live. The other arrows and Go are disabled. At time scale one, port counts down on the helm plate, then the ship swings. The scale then returns to four.',
    async play(ctx) {
      await ctx.page.keyboard.up('KeyA').catch(() => {});
      await ctx.page.keyboard.up('KeyD').catch(() => {});
      await ctx.blur();
      const pauseLabel = await ctx.page.locator('#pause').innerText();
      await ctx.page.locator('#scale').selectOption('1');
      await ctx.blur();
      if (pauseLabel === 'Resume') await ctx.press('Escape');
      await ctx.scrollInto('#helm-w');
      await ctx.page.locator('#helm-w').click();
      try {
        await ctx.expectTextNot('het-delay', '—');
      } catch (error) {
        const log = await ctx.page.locator('#log').innerText();
        const tail = log.split('\n').slice(-6).join(' | ');
        throw new Error(`High-energy turn did not start. ${tail}`, { cause: error });
      }
      await ctx.sleep(4500);
      await ctx.page.locator('#scale').selectOption('4');
      await ctx.blur();
    },
  },
  {
    id: 'weapons',
    keys: '1 – 6    SPACE    FIRE',
    action: 'Press Digit1, Space, then click the Fire button.',
    narration:
      'Keys 1 through 6 select a weapon group. Both mounts use the forward test arc, so the wedge stays on the bow. Key 1 is the phaser. Space fires it, and so does the Fire button.',
    async play(ctx) {
      await ctx.blur();
      await ctx.press('Digit1');
      await ctx.sleep(500);
      await ctx.press('Space');
      await ctx.sleep(700);
      await ctx.page.locator('#field-fire').click();
    },
  },
  {
    id: 'overload',
    keys: 'O    2    O',
    action: 'Press KeyO on the phaser, Digit2, then KeyO on the photon.',
    narration:
      'O toggles overload. The phaser refuses it. Key 2 selects the photon, and O toggles overload there.',
    async play(ctx) {
      await ctx.blur();
      await ctx.press('KeyO');
      await ctx.expectNotice('Only a photon mount can change mode');
      await ctx.sleep(400);
      await ctx.press('Digit2');
      await ctx.sleep(350);
      await ctx.press('KeyO');
      await ctx.page.waitForFunction(() => {
        const button = document.querySelector('button[data-slot="1"]');
        const text = button?.textContent ?? '';
        return text.includes('OVL') || text.toLowerCase().includes('overload');
      }, null, { timeout: 2500 });
    },
  },
  {
    id: 'energy',
    keys: 'F1 Attack   F2 Balanced   F3 Run   F4 Defense',
    action: 'Press F1, F2, F3, F4, then F2 again.',
    narration:
      'F1 attack sets speed eight. F2 balanced sets speed four and two general reinforcement. F3 run sets speed sixteen and zero weapon energy. F4 defense sets speed two and six general. F2 restores the balanced plan.',
    async play(ctx) {
      await ctx.blur();
      await ctx.press('F1');
      await ctx.expectText('speed-ordered', '8');
      await ctx.sleep(900);
      await ctx.press('F2');
      await ctx.expectText('speed-ordered', '4');
      await ctx.sleep(900);
      await ctx.press('F3');
      await ctx.expectText('speed-ordered', '16');
      await ctx.sleep(900);
      await ctx.press('F4');
      await ctx.expectText('speed-ordered', '2');
      await ctx.sleep(900);
      await ctx.press('F2');
      await ctx.expectText('speed-ordered', '4');
    },
  },
  {
    id: 'shields',
    keys: 'Numpad 8  9  3  2  1  7    Shift+8    Numpad 5    click',
    action: 'Press Numpad 8, 9, 3, 2, 1, 7, Shift+Numpad8, Numpad5, then click the bow arc.',
    narration:
      'Numpad 8, 9, 3, 2, 1, and 7 order one more point on bow, forward starboard, aft starboard, stern, aft port, and forward port. The order column is the request. Shift plus the key clears that order. Numpad 5 toggles general reinforcement. A click on an arc sends the same order.',
    async play(ctx) {
      await ctx.blur();
      await ctx.scrollInto('#shield-table');
      for (const code of ['Numpad8', 'Numpad9', 'Numpad3', 'Numpad2', 'Numpad1', 'Numpad7']) {
        await ctx.press(code);
        await ctx.sleep(280);
      }
      await ctx.sleep(350);
      await ctx.pressShift('Numpad8');
      await ctx.sleep(450);
      await ctx.press('Numpad5');
      await ctx.sleep(450);
      await ctx.clickShield(false);
    },
  },
  {
    id: 'mouse',
    keys: 'LEFT CLICK',
    action: 'Left-click two points on the 3D view, off the ship, so each one orders a heading.',
    narration:
      'A plain left click orders a heading toward that point, and holds it until the next click. A ship under the cursor is only the bearing.',
    async play(ctx) {
      await ctx.blur();
      await ctx.clickStage(0.62, 0.28, 'left');
      await ctx.sleep(900);
      await ctx.clickStage(0.38, 0.7, 'left');
    },
  },
  {
    id: 'pointer',
    keys: 'RIGHT CLICK   MIDDLE DRAG   ALT+LEFT DRAG   WHEEL   HOME',
    action: 'Short right-click, middle-drag, Alt+left-drag, wheel zoom, then Home.',
    narration:
      'A short right click targets and does not steer. Middle drag, or Alt plus left drag, orbits and never steers. The wheel zooms. Home resets the view.',
    async play(ctx) {
      await ctx.blur();
      await ctx.clickStage(0.58, 0.48, 'right');
      await ctx.expectAttr('data-camera', 'overhead');
      await ctx.sleep(350);
      await ctx.middleDrag(0.5, 0.5);
      await ctx.expectAttr('data-camera', 'chase');
      await ctx.sleep(300);
      await ctx.press('Home');
      await ctx.expectAttr('data-camera', 'overhead');
      await ctx.altDrag(0.48, 0.5);
      await ctx.expectAttr('data-camera', 'chase');
      await ctx.sleep(300);
      await ctx.wheelAt(0.5, 0.62, -280);
      await ctx.sleep(300);
      await ctx.press('Home');
      await ctx.expectAttr('data-camera', 'overhead');
    },
  },
  {
    id: 'keyboard',
    keys: 'A  D  hold    W  S    X    speed bar',
    action: 'Hold KeyA, hold KeyD, tap KeyW and KeyS, press KeyX, then click the speed bar.',
    narration:
      'Hold A or D to turn. Those keys are read every frame. W and S change speed and accept key repeat. X is all stop. The speed bar takes a click as well.',
    async play(ctx) {
      await ctx.blur();
      await ctx.hold('KeyA', 220);
      await ctx.sleep(200);
      await ctx.hold('KeyD', 220);
      await ctx.sleep(200);
      await ctx.press('KeyW');
      await ctx.sleep(180);
      await ctx.press('KeyW');
      await ctx.sleep(180);
      await ctx.press('KeyS');
      await ctx.sleep(250);
      await ctx.press('KeyX');
      await ctx.expectText('speed-ordered', '0');
      await ctx.sleep(300);
      await ctx.clickSpeed(0.45);
    },
  },
  {
    id: 'missing',
    keys: 'R   E   J    unbound: proximity, PF',
    action: 'Press KeyR, KeyE, and KeyJ. Do not press a proximity or PF key, because none is bound.',
    narration:
      'R, E, and J are refusals. Reverse, erratic maneuvers, and drones are not in this duel. Proximity is unbound. The PF button has no key.',
    async play(ctx) {
      await ctx.blur();
      await ctx.press('KeyR');
      await ctx.expectNotice('Reverse is not in this duel');
      await ctx.sleep(500);
      await ctx.press('KeyE');
      await ctx.expectNotice('Erratic maneuvers are not in this duel');
      await ctx.sleep(500);
      await ctx.press('KeyJ');
      await ctx.expectNotice('Drones are not in this duel');
    },
  },
  {
    id: 'close',
    keys: 'V   ESC   M   H   KEYS',
    action: 'Press KeyV, Escape twice, KeyM, KeyH, then open and close the Keys dialog.',
    narration:
      'V cycles the camera. Escape pauses and resumes. M and H change the sensor map. The Keys button opens rebinding. That is the live set.',
    async play(ctx) {
      await ctx.blur();
      await ctx.press('KeyV');
      await ctx.sleep(700);
      await ctx.press('Escape');
      await ctx.sleep(500);
      await ctx.press('Escape');
      await ctx.sleep(400);
      await ctx.press('KeyM');
      await ctx.sleep(700);
      await ctx.press('KeyH');
      await ctx.sleep(500);
      await ctx.page.locator('#keys-open').click();
      await ctx.page.locator('#keymap').waitFor({ state: 'visible', timeout: 2000 });
      await ctx.sleep(1400);
      await ctx.page.locator('#keys-close').click();
    },
  },
];

export const skipped = [
  {
    item: 'Reverse, erratic maneuvers, and drones',
    why: 'The keys are bound, and the duel answers that those orders are not in this duel. The capture presses them and shows that answer.',
  },
  {
    item: 'Proximity weapon mode',
    why: 'weapons.proximity is in the action list with binding null. There is no key to demonstrate.',
  },
  {
    item: 'PF launch key',
    why: 'craft.launchPf is in the action list with binding null. The PF control is a button only.',
  },
  {
    item: 'High-energy turns other than port and starboard, and Go',
    why: 'Those helm buttons are disabled. The capture leaves them disabled. Port and starboard call orderHet.',
  },
  {
    item: 'A keyboard binding for high-energy turns',
    why: 'helm.hetPort and helm.hetStarboard are button actions. They are not in the default keymap.',
  },
];

export const sources = [
  ['Mouse heading', 'web/src/main.ts:316-324 and web/src/main.ts:455-462', 'Plain left click calls steerAt, which stores orderHeading.'],
  ['Click gate', 'web/src/tactical/pointer.ts:9-24', 'Left click steers. Right click under 4 CSS pixels targets. Middle and Alt+left orbit.'],
  ['Held turn', 'web/src/main.ts:649-654', 'KeyA and KeyD call orderYaw while held. A mouse heading wins for that frame.'],
  ['Speed keys', 'web/src/input/actions.ts:33-37 and web/src/commands.ts:54-56', 'KeyW, KeyS, and KeyX. W and S allow key repeat.'],
  ['Speed bar', 'web/src/main.ts:336-344', 'Click or wheel on the lower speed bar sets ordered speed.'],
  ['Energy presets', 'web/src/input/actions.ts:68-71 and web/src/commands.ts:36-52', 'F1 attack, F2 balanced, F3 run, F4 defense.'],
  ['Energy fields', 'web/src/main.ts:173-188 and web/index.html:145-150', 'Life support, fire control, general reinforcement, weapon energy.'],
  ['Six facings', 'web/src/input/actions.ts:55-67 and web/src/hud.ts:16', 'Numpad 8, 9, 3, 2, 1, 7, and Shift to clear. Numpad 5 toggles general.'],
  ['Shield click', 'web/src/main.ts:278-287 and web/src/shield-hit.ts:5-18', 'A click on an arc adds one point. Shift-click clears it.'],
  ['Weapon groups and fire', 'web/src/input/actions.ts:40-47 and web/src/commands.ts:59 and web/src/commands.ts:92-102', 'Digit 1–6 select a group. Space and the Fire button fire it.'],
  ['Weapon arcs', 'engine/duel/fixture.ts:63-80 and web/src/tactical/arcs.ts:62-93', 'Both fixture mounts use arc TEST-FA. The selected group draws that wedge.'],
  ['Overload', 'web/src/commands.ts:149-157', 'O toggles overload, and only a photon mount accepts it.'],
  ['Target keys', 'web/src/input/actions.ts:72-75', 'Tab, Shift+Tab, KeyT, KeyY.'],
  ['High-energy turn', 'web/index.html:172-181 and web/src/commands.ts:57-58', 'Port and starboard buttons call orderHet. There is no keymap entry.'],
  ['Disabled helm', 'web/index.html:173-181 and web/index.html:198', 'The other arrows and Go are disabled.'],
  ['HET readout', 'web/src/hud.ts:11-14 and web/index.html:188', 'The helm plate shows the delay while a high-energy turn is pending.'],
  ['Refusals', 'web/src/commands.ts:30-34', 'KeyR, KeyE, and KeyJ report that the order is not in this duel.'],
  ['Unbound', 'web/src/input/actions.ts:48 and web/src/input/actions.ts:82', 'Proximity and PF launch have binding null.'],
  ['View keys', 'web/src/input/actions.ts:90-98', 'KeyV, Home, KeyM, KeyH, Escape.'],
  ['HUD text', 'web/src/hud.ts:43-102 and web/index.html:82-127', 'Target, energy, shields, weapons, helm, and the field bars.'],
];

/** Live keymap entries this short cut does not walk through. */
export const notInCut = [
  'Ctrl+1 through Ctrl+6 assign the selected mount to a weapon group.',
  'Bracket keys shift electronic warfare and, with Ctrl, change its power.',
  'G and Shift+G are tractor and repel. B and Shift+B are boarding and hit-and-run.',
  'C is cloak. L and Shift+L launch and recall. K lays a mine.',
  'Alt+Left and Alt+Right orbit the camera from the keyboard.',
];
