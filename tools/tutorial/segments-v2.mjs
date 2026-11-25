/**
 * Concept lesson for the fixture duel. Every number in the narration
 * is a value this build actually uses. Actions are the keys and clicks
 * that make that value show up on the HUD.
 */

export const OPEN_MS = 700;
export const PAD_MS = 320;

async function label(ctx) {
  return ctx.page.locator('#pause').innerText();
}

async function ensurePaused(ctx) {
  if ((await label(ctx)) === 'Pause') await ctx.press('Escape');
}

async function ensureRunning(ctx, scale) {
  await ctx.page.locator('#scale').selectOption(String(scale));
  await ctx.blur();
  if ((await label(ctx)) === 'Resume') await ctx.press('Escape');
}

export const segments = [
  {
    id: 'intro',
    keys: 'ESC pause',
    action: 'Press Escape so the fixture duel holds still.',
    narration:
      'This is SFC2.js, on the placeholder fixture. No game install is mounted. You have one cruiser. A captain has the other. Escape pauses the match, and the picture holds, so the power budget can be read before it is spent.',
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
    id: 'budget',
    keys: 'Energy plate',
    action: 'Leave the match paused and show the energy plate.',
    narration:
      'The energy plate is the whole budget. The warp figure is generation. On this cruiser that figure is twenty. Life support and fire control are paid first, one point each when they are on. Movement is next. Then shield reinforcement. Weapons are last. On this fixture one point of ordered speed costs one point of power, so speed and shooting come out of the same pool. The battery can cover a shortfall, and anything left over refills it.',
    async play(ctx) {
      await ctx.scrollInto('#gen-warp');
    },
  },
  {
    id: 'presets',
    keys: 'F1 Attack   F3 Run   F4 Defense   F2 Balanced',
    action: 'Press F1, F3, F4, then F2, and check ordered speed and general reinforcement.',
    narration:
      'F1 is attack. Speed goes to eight, general reinforcement to zero, and the mounts stay on automatic. F3 is run. Speed goes to sixteen and the weapon request is forced to zero, so the mounts are cut off. That is the trade. F4 is defense. Speed drops to two and general reinforcement is set to six, and shields are paid before weapons. If every facing is already full, those points are capped and the strength does not rise. F2 puts back a balanced plan: speed four, two points of general reinforcement, weapons automatic.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      await ctx.press('F1');
      await ctx.expectText('speed-ordered', '8');
      await ctx.sleep(600);
      await ctx.press('F3');
      await ctx.expectText('speed-ordered', '16');
      await ctx.page.waitForFunction(() => {
        const node = document.getElementById('weapon-energy');
        return node instanceof HTMLInputElement && node.value === '0';
      }, null, { timeout: 2500 });
      await ctx.sleep(700);
      await ctx.press('F4');
      await ctx.expectText('speed-ordered', '2');
      await ctx.page.waitForFunction(() => {
        const node = document.getElementById('general');
        return node instanceof HTMLInputElement && node.value === '6';
      }, null, { timeout: 2500 });
      await ctx.sleep(700);
      await ctx.press('F2');
      await ctx.expectText('speed-ordered', '4');
      await ctx.page.waitForFunction(() => {
        const node = document.getElementById('general');
        return node instanceof HTMLInputElement && node.value === '2';
      }, null, { timeout: 2500 });
      await ensurePaused(ctx);
    },
  },
  {
    id: 'arming',
    keys: 'TEST-PH 4   TEST-PHOT 4 and 4 ticks',
    action: 'Run at 4× on the balanced plan until the phaser bar is ready.',
    narration:
      'Arming is stored power, not a separate button. The fixture phaser is ready when its charge reaches four, and it does not also wait out a tick count. The fixture photon needs four energy and four ticks of charging before it will fire. The bars under TEST-PH and TEST-PHOT are that charge. A mount that is not ready is refused. Speed is held at all stop while those bars fill, so the range does not collapse before it can be read.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      await ctx.press('F2');
      await ctx.press('KeyX');
      await ctx.page.waitForFunction(() => {
        const button = document.querySelector('button[data-slot="0"]');
        return button instanceof HTMLElement && button.classList.contains('ready');
      }, null, { timeout: 25000 });
      await ensurePaused(ctx);
    },
  },
  {
    id: 'range',
    keys: '1   SPACE    phaser bands 10 and 20    photon 30',
    action: 'Fire group 1. If the target range is still past 20, expect outOfRange. Fire the photon if it is ready.',
    narration:
      'Range is checked only after the mount is armed and the target is inside the arc. The target plate is the live range. The fixture phaser has two bands: three damage out to ten, and one damage out to twenty. Past twenty the fire is out of range. The fixture photon reaches thirty, and that thirty is a stand-in, not a measured figure. I will fire the phaser. If we are still past twenty, the log says out of range. Inside thirty, the photon can still be launched.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      const rangeText = await ctx.page.locator('#target-range').innerText();
      const range = Number(rangeText);
      await ctx.press('Digit1');
      await ctx.sleep(200);
      await ctx.press('Space');
      if (Number.isFinite(range) && range > 20) await ctx.expectNotice('outOfRange');
      await ctx.sleep(500);
      const photonReady = await ctx.page.locator('button[data-slot="1"]').evaluate((node) => node.classList.contains('ready'));
      if (photonReady && (!Number.isFinite(range) || range <= 30)) {
        await ctx.press('Digit2');
        await ctx.sleep(200);
        await ctx.press('Space');
      }
      await ensurePaused(ctx);
    },
  },
  {
    id: 'overload',
    keys: 'O on phaser refused    2    O overload',
    action: 'Press O on the phaser, then 2 and O on the photon.',
    narration:
      'Overload is a mode, not a bigger key. Only the photon accepts it. O on the phaser is refused. O on the photon raises the arming cost from four to eight, and the armed damage from eight to twelve. Those integers are the fixture\'s own. The photon has to arm again at the higher cost. Proximity is a third mode, and it has no default key.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      await ctx.press('Digit1');
      await ctx.sleep(200);
      await ctx.press('KeyO');
      await ctx.expectNotice('Only a photon mount can change mode');
      await ctx.sleep(400);
      await ctx.press('Digit2');
      await ctx.sleep(250);
      await ctx.press('KeyO');
      await ctx.page.waitForFunction(() => {
        const text = document.querySelector('button[data-slot="1"]')?.textContent ?? '';
        return text.includes('OVL') || text.toLowerCase().includes('overload');
      }, null, { timeout: 2500 });
      await ensurePaused(ctx);
    },
  },
  {
    id: 'shields',
    keys: 'Bow 12   shoulders 10   other faces 8',
    action: 'Show the shield table. No new order yet.',
    narration:
      'Six facings, bow first, then clockwise. On this cruiser the bow is twelve, each forward shoulder is ten, and the other three faces are eight. Incoming damage lands on the facing it arrives on. The strong face is the bow, and nothing here turns that bow toward the enemy for you. You order the heading. Reinforcement spends power on a facing that still has room. It does not raise a facing past its maximum.',
    async play(ctx) {
      await ctx.scrollInto('#shield-table');
    },
  },
  {
    id: 'reinforce',
    keys: 'Numpad 8 9 3 2 1 7   Shift+8   Numpad 5   click',
    action: 'Press the six numpad facings, Shift+Numpad8, Numpad5, then click the bow arc.',
    narration:
      'Numpad 8, 9, 3, 2, 1, and 7 add one specific point, in order: bow, forward starboard, aft starboard, stern, aft port, forward port. The order column is the request. Shift plus that key clears it. Numpad 5 toggles general reinforcement. General points are split across the six faces, and a remainder starts at the bow. Two points cannot cover every face. Six points is one each, before any specific order. A click on an arc sends the same specific request.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      await ctx.scrollInto('#shield-table');
      for (const code of ['Numpad8', 'Numpad9', 'Numpad3', 'Numpad2', 'Numpad1', 'Numpad7']) {
        await ctx.press(code);
        await ctx.sleep(220);
      }
      await ctx.sleep(300);
      await ctx.pressShift('Numpad8');
      await ctx.sleep(350);
      await ctx.press('Numpad5');
      await ctx.sleep(300);
      await ctx.clickShield(false);
      await ensurePaused(ctx);
    },
  },
  {
    id: 'arcs',
    keys: 'D hold    1    SPACE    out of arc',
    action: 'Hold D to yaw the bow off the target, then fire group 1.',
    narration:
      'Both mounts use the arc called TEST-FA. It is the bow wedge only, the same sector as the forward shield. The wedge on the field is that arc, drawn out to the mount\'s range. A target outside the wedge is not a legal shot, even when the range would allow it. I will turn the bow off the other ship and fire. The log should say out of arc.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      await ctx.hold('KeyD', 700);
      await ctx.sleep(400);
      await ctx.press('Digit1');
      await ctx.page.waitForFunction(() => {
        const button = document.querySelector('button[data-slot="0"]');
        return button instanceof HTMLElement && button.classList.contains('ready');
      }, null, { timeout: 15000 });
      await ctx.press('Space');
      try {
        await ctx.expectNotice('outOfArc');
      } catch (error) {
        const log = await ctx.page.locator('#log').innerText();
        const bearing = await ctx.page.locator('#target-bearing').innerText();
        throw new Error(`Expected outOfArc. Bearing ${bearing}. ${log.split('\n').slice(-6).join(' | ')}`, { cause: error });
      }
      await ensurePaused(ctx);
    },
  },
  {
    id: 'turn',
    keys: 'A hold    W    X    speed bar',
    action: 'Hold A, tap W, press X, then click the speed bar.',
    narration:
      'A heading order holds until you replace it. Hold A or D and the ship yaws at this fixture\'s cap, two thousand angle units a tick. That cap does not shrink when you go faster. The speed-keyed turn curve is for a hull loaded from a list. This placeholder is not on it. Speed still matters, because the power it spends is denied to the mounts and the shields. The speed bar is the same order as W and S. X is all stop.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      await ctx.hold('KeyA', 280);
      await ctx.sleep(200);
      await ctx.press('KeyW');
      await ctx.sleep(250);
      await ctx.press('KeyX');
      await ctx.expectText('speed-ordered', '0');
      await ctx.sleep(250);
      await ctx.clickSpeed(0.35);
      await ensurePaused(ctx);
    },
  },
  {
    id: 'het',
    keys: 'Helm port    A refused    no energy bill',
    action: 'Set time scale to 1, click the port high-energy-turn arrow, then press A during the delay.',
    narration:
      'A high-energy turn is how you put the bow, and the arcs on that bow, onto a new heading faster than the normal cap. There is no key for it. Only the port and starboard arrows on the helm pad are live. The other arrows and Go are disabled. This fixture uses the default table: a delay, then a quarter turn. The table\'s energy cost is zero, and that zero is marked unverified, so this build does not bill the power budget. What it does cost is the helm. While the delay or the swing is running, a normal turn is refused. I will press A during the delay.',
    async play(ctx) {
      await ctx.page.keyboard.up('KeyA').catch(() => {});
      await ctx.page.keyboard.up('KeyD').catch(() => {});
      await ensureRunning(ctx, 1);
      await ctx.scrollInto('#helm-w');
      await ctx.page.locator('#helm-w').click();
      try {
        await ctx.expectTextNot('het-delay', '—');
      } catch (error) {
        const log = await ctx.page.locator('#log').innerText();
        throw new Error(`High-energy turn did not start. ${log.split('\n').slice(-5).join(' | ')}`, { cause: error });
      }
      await ctx.sleep(700);
      await ctx.hold('KeyA', 400);
      await ctx.expectNotice('hetActive');
      await ctx.sleep(2800);
      await ensurePaused(ctx);
    },
  },
  {
    id: 'close',
    keys: 'R   E   J    V   M   H',
    action: 'Press R, E, and J, then V, M, and H.',
    narration:
      'That is the model this build actually runs. R, E, and J only report that reverse, erratic maneuvers, and drones are not in this duel. Electronic warfare, tractors, cloaks, and small craft have keys too, and this lesson does not open them. V changes the camera. M and H change the sensor map.',
    async play(ctx) {
      await ensureRunning(ctx, 4);
      await ctx.press('KeyR');
      await ctx.expectNotice('Reverse is not in this duel');
      await ctx.sleep(350);
      await ctx.press('KeyE');
      await ctx.expectNotice('Erratic maneuvers are not in this duel');
      await ctx.sleep(350);
      await ctx.press('KeyJ');
      await ctx.expectNotice('Drones are not in this duel');
      await ctx.sleep(400);
      await ctx.press('KeyV');
      await ctx.sleep(500);
      await ctx.press('KeyM');
      await ctx.sleep(500);
      await ctx.press('KeyH');
    },
  },
];

export const doc = {
  title: 'SFC2.js tutorial, version 2',
  lede: `Concept narration for the 1080p capture of the production web build. Vite preview serves it on port 1701. The page boots the synthetic skirmish and the banner names \`engine/duel/fixture.ts\`. No install is mounted and no game files are read. Claims in the narration are the fixture's own integers and the pay order in the sim.`,
  voiceNote: 'Kokoro speed is 1.0 at a natural pace; a value below 1 is slower. Piper remains available with `--tts piper`. There is no music. Captions are burned in, and the key line names the control for that segment.',
  notes: `The capture selects UI scale 1× before the first paint so the field and the console both fit in 1920×1080. Escape pauses the picture during the explanations. Presets, arming, arcs, and the normal turn run at 4×. The high-energy turn runs at 1× so the delay can be read.`,
  skipped: [
    {
      item: 'Speed-keyed normal turn on this cruiser',
      why: 'The placeholder has no turn-hull row, so the letter cap is used unchanged. The speed-keyed curve is for a hull loaded from a list. The narration says that, and does not show a slower turn at high speed.',
    },
    {
      item: 'An energy bill for a high-energy turn',
      why: 'The default table stores energy cost 0 and marks it unverified. The sim does not deduct power. The visible cost is the delay, and a normal turn is refused while it runs.',
    },
    {
      item: 'High-energy turns other than port and starboard, and Go',
      why: 'Those helm buttons are disabled. Only port and starboard call orderHet.',
    },
    {
      item: 'Reverse, erratic maneuvers, and drones',
      why: 'The keys are bound and only report that the order is not in this duel. The capture presses them.',
    },
    {
      item: 'Proximity mode',
      why: 'The action exists with no default key. The narration says so and does not pretend to toggle it.',
    },
  ],
  notInCut: [
    'Bracket keys shift electronic warfare and, with Ctrl, change its power.',
    'G and Shift+G are tractor and repel. B and Shift+B are boarding and hit-and-run.',
    'C is cloak. L and Shift+L launch and recall. K lays a mine.',
    'Ctrl+1 through Ctrl+6 assign the selected mount to a group.',
  ],
  sources: [
    ['Pay order', 'engine/sim/combat.ts:817-835', 'Life support, fire control, movement, shields, then weapons. The pool is generation plus battery.'],
    ['Speed cost on this fixture', 'engine/duel/catalog.ts:107 and engine/sim/rules-tables.ts:13 and engine/sim/combat.ts:819-821', 'moveCost100 is one energy unit, so each point of speed asks for one point of power.'],
    ['Life support and fire control', 'engine/sim/rules-tables.ts:79-80', 'Each costs 1 when the plan leaves it on.'],
    ['Generation', 'engine/duel/catalog.ts:49', 'The fixture cruiser generates warp 20. Impulse and APR are 0. Battery capacity is 8, with 4 stored.'],
    ['Presets', 'web/src/commands.ts:36-41', 'F1 speed 8 and weapons automatic. F3 speed 16 and weapon request 0. F4 speed 2 and general 6. F2 speed 4 and general 2.'],
    ['Phaser arming', 'docs/rules/data/weapon-arcs.json:6-13 and engine/sim/combat.ts:918-921', 'TEST-PH charge cost 4, hold cost 0. Ready when charge reaches the cost. No tick minimum.'],
    ['Phaser bands', 'docs/rules/data/weapon-arcs.json:10-13', 'Damage 3 out to 10, damage 1 out to 20. No further band.'],
    ['Photon arming and overload', 'docs/rules/data/weapon-arcs.json:16-28 and engine/sim/combat.ts:923-941', 'Arm cost 4 and 4 ticks. Overload cost 8 and 4 ticks. Damage 8, overload damage 12, max range 30.'],
    ['Only a photon overloads', 'web/src/commands.ts:149-157', 'O on any other family reports that only a photon mount can change mode.'],
    ['Arc before range', 'engine/sim/combat.ts:1012-1019', 'outOfArc is refused before outOfRange. A shot outside the last band is outOfRange.'],
    ['Bow wedge', 'docs/rules/data/weapon-arcs.json:68-70', 'TEST-FA is the forward wedge equal to shield facing 0. Both fixture mounts use it.'],
    ['Shield strengths', 'engine/duel/catalog.ts:50 and web/src/hud.ts:16', 'Bow 12, forward shoulders 10, the other three faces 8. Names run bow-first, clockwise.'],
    ['Reinforcement split and cap', 'engine/sim/combat.ts:472-478 and engine/sim/combat.ts:800-812', 'General points split with the remainder from the bow. A facing cannot be reinforced past the room under its maximum.'],
    ['Shield keys and click', 'web/src/input/actions.ts:55-67 and web/src/main.ts:278-287', 'Numpad 8, 9, 3, 2, 1, 7 and Shift to clear. Numpad 5 toggles general. A click on an arc adds one.'],
    ['Turn cap, not speed-keyed here', 'docs/rules/data/turn-modes.json:8 and engine/sim/turn-curve.ts:188-192 and engine/sim/combat.ts:588', 'TEST-C is 2000 per tick. With no turn-hull row the letter cap is returned unchanged.'],
    ['High-energy turn', 'docs/rules/data/het.json:19-20 and web/index.html:172-198 and web/src/commands.ts:57-58', 'Energy cost 0, marked unverified. Port and starboard buttons call orderHet. The other arrows and Go are disabled. No keymap entry.'],
    ['Helm refused during a high-energy turn', 'engine/sim/helm.ts:94', 'Manual yaw is rejected with hetActive while a high-energy turn is running.'],
    ['Opening distance', 'engine/duel/catalog.ts:134-141', 'The two ships are placed 24 units apart, facing each other.'],
  ],
};
