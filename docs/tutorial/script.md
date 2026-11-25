# SFC2.js control tutorial

Narration for the 1080p capture of the production web build. Vite preview serves it on port 1701. The page boots the synthetic skirmish and the banner names `engine/duel/fixture.ts`. No install is mounted and no game files are read.

Voice: Piper en_US-ljspeech-medium (LJ Speech, public domain). Length scale 1. Sentence gap 0.12 s. There is no music. Captions are burned in, and the key line names the control for that segment.

The capture selects UI scale 1× before the first paint so the field and the console both fit in 1920×1080. The page's own fit at this size is 1.25×. Time scale stays on the page default of 4× until the high-energy-turn segment sets it to 1×, then puts it back to 4×.

Timestamps are the burned-in captions from this recording.

| Start | End | Action | Keys on screen | Narration |
| --- | --- | --- | --- | --- |
| 0:00.0 | 0:00.7 | Opening hold after the fixture is ready. | SFC2.js | Synthetic fixture. No game install. |
| 0:00.7 | 0:15.1 | Press Escape to pause. No install query, no folder picker. | Synthetic fixture | This is SFC2.js. The banner names the placeholder fixture, and no game install is mounted. You fly one fixture cruiser. A built-in captain flies the other. Escape pauses, and the picture holds. |
| 0:15.1 | 0:30.7 | Read the target plate, the top and bottom bars, and the helm plate. No key. | Target   Hull   Speed   Helm | Target shows the name, the range, and the bearing. The top bar is hull, the phaser capacitor, the clock, and the target hull. The bottom bar is speed, turn rate, power, and Fire. Helm reads speed, heading, and turn delay. |
| 0:30.7 | 0:39.3 | Press Tab, Shift+Tab, KeyT, then KeyY, while the other cruiser is still there. | TAB   SHIFT+TAB   T   Y | Tab cycles hostiles. Shift Tab goes back. T picks the nearest. Y reports that there is no friendly contact. |
| 0:39.3 | 0:54.8 | Set time scale to 1, click the port high-energy-turn arrow, then set time scale back to 4. | Helm ← port    → starboard    (no key) | High-energy turns have no key. Only the port and starboard helm arrows are live. The other arrows and Go are disabled. At time scale one, port counts down on the helm plate, then the ship swings. The scale then returns to four. |
| 0:54.8 | 1:06.5 | Press Digit1, Space, then click the Fire button. | 1 – 6    SPACE    FIRE | Keys 1 through 6 select a weapon group. Both mounts use the forward test arc, so the wedge stays on the bow. Key 1 is the phaser. Space fires it, and so does the Fire button. |
| 1:06.5 | 1:13.7 | Press KeyO on the phaser, Digit2, then KeyO on the photon. | O    2    O | O toggles overload. The phaser refuses it. Key 2 selects the photon, and O toggles overload there. |
| 1:13.7 | 1:31.0 | Press F1, F2, F3, F4, then F2 again. | F1 Attack   F2 Balanced   F3 Run   F4 Defense | F1 attack sets speed eight. F2 balanced sets speed four and two general reinforcement. F3 run sets speed sixteen and zero weapon energy. F4 defense sets speed two and six general. F2 restores the balanced plan. |
| 1:31.0 | 1:51.7 | Press Numpad 8, 9, 3, 2, 1, 7, Shift+Numpad8, Numpad5, then click the bow arc. | Numpad 8  9  3  2  1  7    Shift+8    Numpad 5    click | Numpad 8, 9, 3, 2, 1, and 7 order one more point on bow, forward starboard, aft starboard, stern, aft port, and forward port. The order column is the request. Shift plus the key clears that order. Numpad 5 toggles general reinforcement. A click on an arc sends the same order. |
| 1:51.7 | 2:00.1 | Left-click two points on the 3D view, off the ship, so each one orders a heading. | LEFT CLICK | A plain left click orders a heading toward that point, and holds it until the next click. A ship under the cursor is only the bearing. |
| 2:00.1 | 2:11.0 | Short right-click, middle-drag, Alt+left-drag, wheel zoom, then Home. | RIGHT CLICK   MIDDLE DRAG   ALT+LEFT DRAG   WHEEL   HOME | A short right click targets and does not steer. Middle drag, or Alt plus left drag, orbits and never steers. The wheel zooms. Home resets the view. |
| 2:11.0 | 2:23.0 | Hold KeyA, hold KeyD, tap KeyW and KeyS, press KeyX, then click the speed bar. | A  D  hold    W  S    X    speed bar | Hold A or D to turn. Those keys are read every frame. W and S change speed and accept key repeat. X is all stop. The speed bar takes a click as well. |
| 2:23.0 | 2:33.4 | Press KeyR, KeyE, and KeyJ. Do not press a proximity or PF key, because none is bound. | R   E   J    unbound: proximity, PF | R, E, and J are refusals. Reverse, erratic maneuvers, and drones are not in this duel. Proximity is unbound. The PF button has no key. |
| 2:33.4 | 2:43.9 | Press KeyV, Escape twice, KeyM, KeyH, then open and close the Keys dialog. | V   ESC   M   H   KEYS | V cycles the camera. Escape pauses and resumes. M and H change the sensor map. The Keys button opens rebinding. That is the live set. |

## Said plainly because it is not in this duel

| Topic | Why the recording treats it this way |
| --- | --- |
| Reverse, erratic maneuvers, and drones | The keys are bound, and the duel answers that those orders are not in this duel. The capture presses them and shows that answer. |
| Proximity weapon mode | weapons.proximity is in the action list with binding null. There is no key to demonstrate. |
| PF launch key | craft.launchPf is in the action list with binding null. The PF control is a button only. |
| High-energy turns other than port and starboard, and Go | Those helm buttons are disabled. The capture leaves them disabled. Port and starboard call orderHet. |
| A keyboard binding for high-energy turns | helm.hetPort and helm.hetStarboard are button actions. They are not in the default keymap. |

## Live keys not walked through in this cut

The default keymap has more working bindings than a four-minute lesson can show. They are real. This recording does not press them:

- Ctrl+1 through Ctrl+6 assign the selected mount to a weapon group.
- Bracket keys shift electronic warfare and, with Ctrl, change its power.
- G and Shift+G are tractor and repel. B and Shift+B are boarding and hit-and-run.
- C is cloak. L and Shift+L launch and recall. K lays a mine.
- Alt+Left and Alt+Right orbit the camera from the keyboard.

## Where the controls live

| Control | Source | What it does |
| --- | --- | --- |
| Mouse heading | `web/src/main.ts:316-324 and web/src/main.ts:455-462` | Plain left click calls steerAt, which stores orderHeading. |
| Click gate | `web/src/tactical/pointer.ts:9-24` | Left click steers. Right click under 4 CSS pixels targets. Middle and Alt+left orbit. |
| Held turn | `web/src/main.ts:649-654` | KeyA and KeyD call orderYaw while held. A mouse heading wins for that frame. |
| Speed keys | `web/src/input/actions.ts:33-37 and web/src/commands.ts:54-56` | KeyW, KeyS, and KeyX. W and S allow key repeat. |
| Speed bar | `web/src/main.ts:336-344` | Click or wheel on the lower speed bar sets ordered speed. |
| Energy presets | `web/src/input/actions.ts:68-71 and web/src/commands.ts:36-52` | F1 attack, F2 balanced, F3 run, F4 defense. |
| Energy fields | `web/src/main.ts:173-188 and web/index.html:145-150` | Life support, fire control, general reinforcement, weapon energy. |
| Six facings | `web/src/input/actions.ts:55-67 and web/src/hud.ts:16` | Numpad 8, 9, 3, 2, 1, 7, and Shift to clear. Numpad 5 toggles general. |
| Shield click | `web/src/main.ts:278-287 and web/src/shield-hit.ts:5-18` | A click on an arc adds one point. Shift-click clears it. |
| Weapon groups and fire | `web/src/input/actions.ts:40-47 and web/src/commands.ts:59 and web/src/commands.ts:92-102` | Digit 1–6 select a group. Space and the Fire button fire it. |
| Weapon arcs | `engine/duel/fixture.ts:63-80 and web/src/tactical/arcs.ts:62-93` | Both fixture mounts use arc TEST-FA. The selected group draws that wedge. |
| Overload | `web/src/commands.ts:149-157` | O toggles overload, and only a photon mount accepts it. |
| Target keys | `web/src/input/actions.ts:72-75` | Tab, Shift+Tab, KeyT, KeyY. |
| High-energy turn | `web/index.html:172-181 and web/src/commands.ts:57-58` | Port and starboard buttons call orderHet. There is no keymap entry. |
| Disabled helm | `web/index.html:173-181 and web/index.html:198` | The other arrows and Go are disabled. |
| HET readout | `web/src/hud.ts:11-14 and web/index.html:188` | The helm plate shows the delay while a high-energy turn is pending. |
| Refusals | `web/src/commands.ts:30-34` | KeyR, KeyE, and KeyJ report that the order is not in this duel. |
| Unbound | `web/src/input/actions.ts:48 and web/src/input/actions.ts:82` | Proximity and PF launch have binding null. |
| View keys | `web/src/input/actions.ts:90-98` | KeyV, Home, KeyM, KeyH, Escape. |
| HUD text | `web/src/hud.ts:43-102 and web/index.html:82-127` | Target, energy, shields, weapons, helm, and the field bars. |
