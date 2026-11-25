# SFC2.js tutorial, version 3

Concepts, then the control walkthrough, captured from the production web build. Vite preview serves it on port 1701. The page boots the synthetic skirmish and the banner names `engine/duel/fixture.ts`. No install is mounted and no game files are read. Gameplay numbers are the fixture's. The tabletop history is marked unsourced from this code.

Voice: Kokoro-82M v1.0, voice af_heart (Apache-2.0). Speed or length scale 1. Kokoro-82M voice af_heart. A speed below 1 is slower. Piper remains available with `--tts piper`. There is no music. Captions are burned in. The key line names the control, and one caption is the trademark credit.

The capture selects UI scale 1× so the field and the console both fit in 1920×1080. The opening pauses and orbits the fixture, then the walkthrough uses 4× except the high-energy turn, which runs at 1×.

Timestamps are the burned-in captions from this recording.

| Start | End | Action | Keys on screen | Narration |
| --- | --- | --- | --- | --- |
| 0:00.0 | 0:00.7 | Opening hold after the fixture is ready. | SFC2.js | Synthetic fixture. No game install. |
| 0:00.7 | 0:25.6 | Pause, orbit the fixture duel, then reset the camera. | Campaigns and Conquest: not in this build | SFC2.js is a fan engine for tactical duels. On this screen you command one ship. The board above the view can hold up to six, and one slot is you. The match in front of you is the placeholder fixture: your cruiser against one other, and no install is mounted. The wider game also has empire campaigns and a Conquest map. Those are not in this build. The caption says so. What you can play here is the skirmish. |
| 0:25.6 | 0:52.1 | Show the energy plate, then the shield diagram. The bow wedge stays on the field. | Power, then arcs and range, weak face away | The core loop is short. You divide a limited power pool across movement, weapons, and shields. Then you turn. The other ship has to sit inside your weapon arc and inside range, or the shot is refused. At the same time you keep a weak face off the line of fire. On this cruiser the bow is the strong face, twelve against eight on the aft faces. The wedge is the arc. The shield diagram is the six faces. Nothing in this build turns the strong face for you. |
| 0:52.1 | 1:17.4 | Leave the match paused on the energy plate and the ordered speed. | Warp 20    1 power per point of speed | Speed against firepower is the central trade. This cruiser generates twenty points of warp power. On this fixture each point of ordered speed costs one point of that power. Life support and fire control take one each before movement is paid. What speed spends, the weapons do not get. A run at sixteen leaves almost nothing to arm. A slow ship can still reinforce and shoot. The walkthrough shows those plans on the keys. |
| 1:17.4 | 1:48.9 | Hold the fixture view. The caption is the trademark credit. No rulebook is opened. | Star Fleet Battles is a trademark of Amarillo Design Bureau; this fan project is unaffiliated. | The game this engine is for adapts Star Fleet Battles, a tabletop wargame from Amarillo Design Bureau. It is a wargame, not a role-playing game. The decisions are a budget and the shape of the ship, not a character sheet. This build runs three of those ideas in its own numbers. You allocate one power pool. You have six shield faces. Weapons arm by storing energy, and the heavy mount can overload. The line on screen is the trademark credit. This project is not affiliated with that publisher. |
| 1:48.9 | 2:14.9 | Leave the match paused and show the energy plate. | Energy plate | The energy plate is the whole budget. The warp figure is generation. On this cruiser that figure is twenty. Life support and fire control are paid first, one point each when they are on. Movement is next. Then shield reinforcement. Weapons are last. On this fixture one point of ordered speed costs one point of power, so speed and shooting come out of the same pool. The battery can cover a shortfall, and anything left over refills it. |
| 2:14.9 | 2:49.4 | Press F1, F3, F4, then F2, and check ordered speed and general reinforcement. | F1 Attack   F3 Run   F4 Defense   F2 Balanced | F1 is attack. Speed goes to eight, general reinforcement to zero, and the mounts stay on automatic. F3 is run. Speed goes to sixteen and the weapon request is forced to zero, so the mounts are cut off. That is the trade. F4 is defense. Speed drops to two and general reinforcement is set to six, and shields are paid before weapons. If every facing is already full, those points are capped and the strength does not rise. F2 puts back a balanced plan: speed four, two points of general reinforcement, weapons automatic. |
| 2:49.4 | 3:14.5 | Run at 4× on the balanced plan until the phaser bar is ready. | TEST-PH 4   TEST-PHOT 4 and 4 ticks | Arming is stored power, not a separate button. The fixture phaser is ready when its charge reaches four, and it does not also wait out a tick count. The fixture photon needs four energy and four ticks of charging before it will fire. The bars under TEST-PH and TEST-PHOT are that charge. A mount that is not ready is refused. Speed is held at all stop while those bars fill, so the range does not collapse before it can be read. |
| 3:14.5 | 3:41.1 | Fire group 1. If the target range is still past 20, expect outOfRange. Fire the photon if it is ready. | 1   SPACE    phaser bands 10 and 20    photon 30 | Range is checked only after the mount is armed and the target is inside the arc. The target plate is the live range. The fixture phaser has two bands: three damage out to ten, and one damage out to twenty. Past twenty the fire is out of range. The fixture photon reaches thirty, and that thirty is a stand-in, not a measured figure. I will fire the phaser. If we are still past twenty, the log says out of range. Inside thirty, the photon can still be launched. |
| 3:41.1 | 4:03.0 | Press O on the phaser, then 2 and O on the photon. | O on phaser refused    2    O overload | Overload is a mode, not a bigger key. Only the photon accepts it. O on the phaser is refused. O on the photon raises the arming cost from four to eight, and the armed damage from eight to twelve. Those integers are the fixture's own. The photon has to arm again at the higher cost. Proximity is a third mode, and it has no default key. |
| 4:03.0 | 4:27.3 | Show the shield table. No new order yet. | Bow 12   shoulders 10   other faces 8 | Six facings, bow first, then clockwise. On this cruiser the bow is twelve, each forward shoulder is ten, and the other three faces are eight. Incoming damage lands on the facing it arrives on. The strong face is the bow, and nothing here turns that bow toward the enemy for you. You order the heading. Reinforcement spends power on a facing that still has room. It does not raise a facing past its maximum. |
| 4:27.3 | 4:58.6 | Press the six numpad facings, Shift+Numpad8, Numpad5, then click the bow arc. | Numpad 8 9 3 2 1 7   Shift+8   Numpad 5   click | Numpad 8, 9, 3, 2, 1, and 7 add one specific point, in order: bow, forward starboard, aft starboard, stern, aft port, forward port. The order column is the request. Shift plus that key clears it. Numpad 5 toggles general reinforcement. General points are split across the six faces, and a remainder starts at the bow. Two points cannot cover every face. Six points is one each, before any specific order. A click on an arc sends the same specific request. |
| 4:58.6 | 5:19.0 | Hold D to yaw the bow off the target, then fire group 1. | D hold    1    SPACE    out of arc | Both mounts use the arc called TEST-FA. It is the bow wedge only, the same sector as the forward shield. The wedge on the field is that arc, drawn out to the mount's range. A target outside the wedge is not a legal shot, even when the range would allow it. I will turn the bow off the other ship and fire. The log should say out of arc. |
| 5:19.0 | 5:44.3 | Hold A, tap W, press X, then click the speed bar. | A hold    W    X    speed bar | A heading order holds until you replace it. Hold A or D and the ship yaws at this fixture's cap, two thousand angle units a tick. That cap does not shrink when you go faster. The speed-keyed turn curve is for a hull loaded from a list. This placeholder is not on it. Speed still matters, because the power it spends is denied to the mounts and the shields. The speed bar is the same order as W and S. X is all stop. |
| 5:44.3 | 6:19.3 | Set time scale to 1, click the port high-energy-turn arrow, then press A during the delay. | Helm port    A refused    no energy bill | A high-energy turn is how you put the bow, and the arcs on that bow, onto a new heading faster than the normal cap. There is no key for it. Only the port and starboard arrows on the helm pad are live. The other arrows and Go are disabled. This fixture uses the default table: a delay, then a quarter turn. The table's energy cost is zero, and that zero is marked unverified, so this build does not bill the power budget. What it does cost is the helm. While the delay or the swing is running, a normal turn is refused. I will press A during the delay. |
| 6:19.3 | 6:38.7 | Press R, E, and J, then V, M, and H. | R   E   J    V   M   H | That is the model this build actually runs. R, E, and J only report that reverse, erratic maneuvers, and drones are not in this duel. Electronic warfare, tractors, cloaks, and small craft have keys too, and this lesson does not open them. V changes the camera. M and H change the sensor map. |

## Said plainly because it is not in this duel

| Topic | Why the recording treats it this way |
| --- | --- |
| Speed-keyed normal turn on this cruiser | The placeholder has no turn-hull row, so the letter cap is used unchanged. The speed-keyed curve is for a hull loaded from a list. The narration says that, and does not show a slower turn at high speed. |
| An energy bill for a high-energy turn | The default table stores energy cost 0 and marks it unverified. The sim does not deduct power. The visible cost is the delay, and a normal turn is refused while it runs. |
| High-energy turns other than port and starboard, and Go | Those helm buttons are disabled. Only port and starboard call orderHet. |
| Reverse, erratic maneuvers, and drones | The keys are bound and only report that the order is not in this duel. The capture presses them. |
| Proximity mode | The action exists with no default key. The narration says so and does not pretend to toggle it. |
| Campaigns and the Conquest map | The roadmap lists them as later phases. This build's page is the skirmish. The opening says they are not in this build, on the caption and in the narration. |
| Star Fleet Battles rule text and art | No rulebook was opened. The ideas are described only as this engine implements them. The on-screen line is a trademark credit, not a quotation. |

## Live keys not walked through in this cut

The default keymap has more working bindings than a four-minute lesson can show. They are real. This recording does not press them:

- Bracket keys shift electronic warfare and, with Ctrl, change its power.
- G and Shift+G are tractor and repel. B and Shift+B are boarding and hit-and-run.
- C is cloak. L and Shift+L launch and recall. K lays a mine.
- Ctrl+1 through Ctrl+6 assign the selected mount to a group.


## Unsourced from this code

These lines are general knowledge about the games. They are not a claim that a file in this repository states them, and they are not a quotation from a rulebook.

| Topic | Mark |
| --- | --- |
| Star Fleet Battles and Amarillo Design Bureau | Unsourced from this code. General knowledge that the commercial game adapts that tabletop wargame. Not a paraphrase of its rules. |
| Wargame, not a role-playing game | Unsourced from this code. A description of the kind of decisions the engine implements, not a citation of a publisher. |


## Where the controls live

| Control | Source | What it does |
| --- | --- | --- |
| This screen is a skirmish of up to six ships, one of them you | `web/index.html:73-78` | The page on screen is the skirmish setup. It says up to six ships and one slot is you. |
| Campaigns and Conquest are not this build | `README.md:21-23 and docs/plan.md:96-98` | The roadmap marks missions, the remaining campaigns, and Conquest as planned phases. They are not a control on this page. |
| The fixture duel | `engine/duel/fixture.ts:18 and web/src/main.ts:71` | The banner names engine/duel/fixture.ts. The boot pair is the synthetic skirmish. |
| Bow is the strong face | `engine/duel/catalog.ts:50 and web/src/hud.ts:16` | Shields are 12, 10, 8, 8, 8, 10 from the bow, clockwise. The bow is 12 and the aft faces are 8. |
| Arc wedge and range gate | `docs/rules/data/weapon-arcs.json:68-70 and engine/sim/combat.ts:1012-1019` | TEST-FA is the bow wedge. A shot outside the arc is refused before a shot past the last band. |
| Twenty warp, one power per point of speed | `engine/duel/catalog.ts:49 and engine/duel/catalog.ts:107 and engine/sim/combat.ts:819-821` | Warp generation is 20. moveCost100 is one energy unit, so each point of speed asks for one point of power. |
| Life support and fire control before movement | `engine/sim/rules-tables.ts:79-80 and engine/sim/combat.ts:822-835` | Each costs 1 when left on, and both are paid before movement, shields, and weapons. |
| Run at sixteen leaves the mounts unfunded | `web/src/commands.ts:39` | The run preset sets speed 16 and weapon request 0. |
| Six faces, arming, and overload are what this build runs | `web/src/hud.ts:16 and engine/sim/combat.ts:918-927 and web/src/commands.ts:149-157` | The concepts section names only these three implemented ideas. The walkthrough cites the same lines again. |
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
