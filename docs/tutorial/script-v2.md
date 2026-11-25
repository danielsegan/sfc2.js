# SFC2.js tutorial, version 2

Concept narration for the 1080p capture of the production web build. Vite preview serves it on port 1701. The page boots the synthetic skirmish and the banner names `engine/duel/fixture.ts`. No install is mounted and no game files are read. Claims in the narration are the fixture's own integers and the pay order in the sim.

Voice: Kokoro-82M v1.0, voice af_heart (Apache-2.0). Speed or length scale 1. Kokoro speed is 1.0 at a natural pace; a value below 1 is slower. Piper remains available with `--tts piper`. There is no music. Captions are burned in, and the key line names the control for that segment.

The capture selects UI scale 1× before the first paint so the field and the console both fit in 1920×1080. Escape pauses the picture during the explanations. Presets, arming, arcs, and the normal turn run at 4×. The high-energy turn runs at 1× so the delay can be read.

Timestamps are the burned-in captions from this recording.

| Start | End | Action | Keys on screen | Narration |
| --- | --- | --- | --- | --- |
| 0:00.0 | 0:00.7 | Opening hold after the fixture is ready. | SFC2.js | Synthetic fixture. No game install. |
| 0:00.7 | 0:16.0 | Press Escape so the fixture duel holds still. | ESC pause | This is SFC2.js, on the placeholder fixture. No game install is mounted. You have one cruiser. A captain has the other. Escape pauses the match, and the picture holds, so the power budget can be read before it is spent. |
| 0:16.0 | 0:42.0 | Leave the match paused and show the energy plate. | Energy plate | The energy plate is the whole budget. The warp figure is generation. On this cruiser that figure is twenty. Life support and fire control are paid first, one point each when they are on. Movement is next. Then shield reinforcement. Weapons are last. On this fixture one point of ordered speed costs one point of power, so speed and shooting come out of the same pool. The battery can cover a shortfall, and anything left over refills it. |
| 0:42.0 | 1:16.4 | Press F1, F3, F4, then F2, and check ordered speed and general reinforcement. | F1 Attack   F3 Run   F4 Defense   F2 Balanced | F1 is attack. Speed goes to eight, general reinforcement to zero, and the mounts stay on automatic. F3 is run. Speed goes to sixteen and the weapon request is forced to zero, so the mounts are cut off. That is the trade. F4 is defense. Speed drops to two and general reinforcement is set to six, and shields are paid before weapons. If every facing is already full, those points are capped and the strength does not rise. F2 puts back a balanced plan: speed four, two points of general reinforcement, weapons automatic. |
| 1:16.4 | 1:41.5 | Run at 4× on the balanced plan until the phaser bar is ready. | TEST-PH 4   TEST-PHOT 4 and 4 ticks | Arming is stored power, not a separate button. The fixture phaser is ready when its charge reaches four, and it does not also wait out a tick count. The fixture photon needs four energy and four ticks of charging before it will fire. The bars under TEST-PH and TEST-PHOT are that charge. A mount that is not ready is refused. Speed is held at all stop while those bars fill, so the range does not collapse before it can be read. |
| 1:41.5 | 2:08.2 | Fire group 1. If the target range is still past 20, expect outOfRange. Fire the photon if it is ready. | 1   SPACE    phaser bands 10 and 20    photon 30 | Range is checked only after the mount is armed and the target is inside the arc. The target plate is the live range. The fixture phaser has two bands: three damage out to ten, and one damage out to twenty. Past twenty the fire is out of range. The fixture photon reaches thirty, and that thirty is a stand-in, not a measured figure. I will fire the phaser. If we are still past twenty, the log says out of range. Inside thirty, the photon can still be launched. |
| 2:08.2 | 2:30.1 | Press O on the phaser, then 2 and O on the photon. | O on phaser refused    2    O overload | Overload is a mode, not a bigger key. Only the photon accepts it. O on the phaser is refused. O on the photon raises the arming cost from four to eight, and the armed damage from eight to twelve. Those integers are the fixture's own. The photon has to arm again at the higher cost. Proximity is a third mode, and it has no default key. |
| 2:30.1 | 2:54.4 | Show the shield table. No new order yet. | Bow 12   shoulders 10   other faces 8 | Six facings, bow first, then clockwise. On this cruiser the bow is twelve, each forward shoulder is ten, and the other three faces are eight. Incoming damage lands on the facing it arrives on. The strong face is the bow, and nothing here turns that bow toward the enemy for you. You order the heading. Reinforcement spends power on a facing that still has room. It does not raise a facing past its maximum. |
| 2:54.4 | 3:25.6 | Press the six numpad facings, Shift+Numpad8, Numpad5, then click the bow arc. | Numpad 8 9 3 2 1 7   Shift+8   Numpad 5   click | Numpad 8, 9, 3, 2, 1, and 7 add one specific point, in order: bow, forward starboard, aft starboard, stern, aft port, forward port. The order column is the request. Shift plus that key clears it. Numpad 5 toggles general reinforcement. General points are split across the six faces, and a remainder starts at the bow. Two points cannot cover every face. Six points is one each, before any specific order. A click on an arc sends the same specific request. |
| 3:25.6 | 3:46.1 | Hold D to yaw the bow off the target, then fire group 1. | D hold    1    SPACE    out of arc | Both mounts use the arc called TEST-FA. It is the bow wedge only, the same sector as the forward shield. The wedge on the field is that arc, drawn out to the mount's range. A target outside the wedge is not a legal shot, even when the range would allow it. I will turn the bow off the other ship and fire. The log should say out of arc. |
| 3:46.1 | 4:11.4 | Hold A, tap W, press X, then click the speed bar. | A hold    W    X    speed bar | A heading order holds until you replace it. Hold A or D and the ship yaws at this fixture's cap, two thousand angle units a tick. That cap does not shrink when you go faster. The speed-keyed turn curve is for a hull loaded from a list. This placeholder is not on it. Speed still matters, because the power it spends is denied to the mounts and the shields. The speed bar is the same order as W and S. X is all stop. |
| 4:11.4 | 4:46.3 | Set time scale to 1, click the port high-energy-turn arrow, then press A during the delay. | Helm port    A refused    no energy bill | A high-energy turn is how you put the bow, and the arcs on that bow, onto a new heading faster than the normal cap. There is no key for it. Only the port and starboard arrows on the helm pad are live. The other arrows and Go are disabled. This fixture uses the default table: a delay, then a quarter turn. The table's energy cost is zero, and that zero is marked unverified, so this build does not bill the power budget. What it does cost is the helm. While the delay or the swing is running, a normal turn is refused. I will press A during the delay. |
| 4:46.3 | 5:05.7 | Press R, E, and J, then V, M, and H. | R   E   J    V   M   H | That is the model this build actually runs. R, E, and J only report that reverse, erratic maneuvers, and drones are not in this duel. Electronic warfare, tractors, cloaks, and small craft have keys too, and this lesson does not open them. V changes the camera. M and H change the sensor map. |

## Said plainly because it is not in this duel

| Topic | Why the recording treats it this way |
| --- | --- |
| Speed-keyed normal turn on this cruiser | The placeholder has no turn-hull row, so the letter cap is used unchanged. The speed-keyed curve is for a hull loaded from a list. The narration says that, and does not show a slower turn at high speed. |
| An energy bill for a high-energy turn | The default table stores energy cost 0 and marks it unverified. The sim does not deduct power. The visible cost is the delay, and a normal turn is refused while it runs. |
| High-energy turns other than port and starboard, and Go | Those helm buttons are disabled. Only port and starboard call orderHet. |
| Reverse, erratic maneuvers, and drones | The keys are bound and only report that the order is not in this duel. The capture presses them. |
| Proximity mode | The action exists with no default key. The narration says so and does not pretend to toggle it. |

## Live keys not walked through in this cut

The default keymap has more working bindings than a four-minute lesson can show. They are real. This recording does not press them:

- Bracket keys shift electronic warfare and, with Ctrl, change its power.
- G and Shift+G are tractor and repel. B and Shift+B are boarding and hit-and-run.
- C is cloak. L and Shift+L launch and recall. K lays a mine.
- Ctrl+1 through Ctrl+6 assign the selected mount to a group.

## Where the controls live

| Control | Source | What it does |
| --- | --- | --- |
| Pay order | `engine/sim/combat.ts:817-835` | Life support, fire control, movement, shields, then weapons. The pool is generation plus battery. |
| Speed cost on this fixture | `engine/duel/catalog.ts:107 and engine/sim/rules-tables.ts:13 and engine/sim/combat.ts:819-821` | moveCost100 is one energy unit, so each point of speed asks for one point of power. |
| Life support and fire control | `engine/sim/rules-tables.ts:79-80` | Each costs 1 when the plan leaves it on. |
| Generation | `engine/duel/catalog.ts:49` | The fixture cruiser generates warp 20. Impulse and APR are 0. Battery capacity is 8, with 4 stored. |
| Presets | `web/src/commands.ts:36-41` | F1 speed 8 and weapons automatic. F3 speed 16 and weapon request 0. F4 speed 2 and general 6. F2 speed 4 and general 2. |
| Phaser arming | `docs/rules/data/weapon-arcs.json:6-13 and engine/sim/combat.ts:918-921` | TEST-PH charge cost 4, hold cost 0. Ready when charge reaches the cost. No tick minimum. |
| Phaser bands | `docs/rules/data/weapon-arcs.json:10-13` | Damage 3 out to 10, damage 1 out to 20. No further band. |
| Photon arming and overload | `docs/rules/data/weapon-arcs.json:16-28 and engine/sim/combat.ts:923-941` | Arm cost 4 and 4 ticks. Overload cost 8 and 4 ticks. Damage 8, overload damage 12, max range 30. |
| Only a photon overloads | `web/src/commands.ts:149-157` | O on any other family reports that only a photon mount can change mode. |
| Arc before range | `engine/sim/combat.ts:1012-1019` | outOfArc is refused before outOfRange. A shot outside the last band is outOfRange. |
| Bow wedge | `docs/rules/data/weapon-arcs.json:68-70` | TEST-FA is the forward wedge equal to shield facing 0. Both fixture mounts use it. |
| Shield strengths | `engine/duel/catalog.ts:50 and web/src/hud.ts:16` | Bow 12, forward shoulders 10, the other three faces 8. Names run bow-first, clockwise. |
| Reinforcement split and cap | `engine/sim/combat.ts:472-478 and engine/sim/combat.ts:800-812` | General points split with the remainder from the bow. A facing cannot be reinforced past the room under its maximum. |
| Shield keys and click | `web/src/input/actions.ts:55-67 and web/src/main.ts:278-287` | Numpad 8, 9, 3, 2, 1, 7 and Shift to clear. Numpad 5 toggles general. A click on an arc adds one. |
| Turn cap, not speed-keyed here | `docs/rules/data/turn-modes.json:8 and engine/sim/turn-curve.ts:188-192 and engine/sim/combat.ts:588` | TEST-C is 2000 per tick. With no turn-hull row the letter cap is returned unchanged. |
| High-energy turn | `docs/rules/data/het.json:19-20 and web/index.html:172-198 and web/src/commands.ts:57-58` | Energy cost 0, marked unverified. Port and starboard buttons call orderHet. The other arrows and Go are disabled. No keymap entry. |
| Helm refused during a high-energy turn | `engine/sim/helm.ts:94` | Manual yaw is rejected with hetActive while a high-energy turn is running. |
| Opening distance | `engine/duel/catalog.ts:134-141` | The two ships are placed 24 units apart, facing each other. |
