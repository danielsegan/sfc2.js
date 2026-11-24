# Modern keymap

Default profile for the tactical HUD. Decided 2026-11-24: modern bindings are the default. An optional classic profile can be added later, once the original keys are checked against Community Edition 2.670. It is not shipped here.

Bindings use `KeyboardEvent.code` (the physical key), so the same binding works on AZERTY and QWERTZ. The rebind dialog shows the code with its modifiers. The profile is stored in the browser under `sfc2js.keymap.v1`. A chord the browser reserves (`F5`, `F11`, Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+R) cannot be bound. Binding a key that is already used swaps the two actions.

Held keys (turn) are sampled every frame. Speed up and speed down also accept key repeat. Everything else fires once per keydown.

Mouse actions on the 3D view and the sensor map follow the original grammar, and a left-click does send an order: a plain left-click sends `orderHeading` toward the clicked point, including when a hostile is under the cursor, and the order holds until the next click replaces it (no target-follow). Alt+left-drag and middle-drag orbit and never steer. Right-click never steers. A right-click under 4 logical pixels targets. The gate grows with `--hud-scale`. Shield facing clicks still send reinforcement.

| Action | Default |
| --- | --- |
| Speed up / down | `W` / `S` |
| Turn left / right | `A` / `D` (hold) |
| All stop | `X` |
| Reverse | `R` (not in this duel; the key explains that) |
| Erratic maneuvers | `E` (not in this duel) |
| Fire groups 1–6 | `1`–`6` |
| Assign the selected mount to a group | Ctrl+`1`–`6` |
| Fire the selected group | `Space` |
| Toggle overload on the selected photon | `O` |
| Toggle proximity | unbound |
| Reinforce bow, forward starboard, aft starboard, stern, aft port, forward port | Numpad `8` `9` `3` `2` `1` `7` |
| Clear that facing | Shift+the same numpad key |
| Toggle general reinforcement | Numpad `5` |
| Attack / Balanced / Run / Defense presets | `F1`–`F4` |
| Next / previous hostile | `Tab` / Shift+`Tab` |
| Nearest hostile | `T` |
| Cycle friendlies | `Y` |
| Tractor / repel | `G` / Shift+`G` |
| Board / hit-and-run | `B` / Shift+`B` |
| Cloak | `C` |
| Launch / recall | `L` / Shift+`L` |
| Drone | `J` |
| Mine | `K` |
| EW toward ECM / ECCM | `[` / `]` |
| EW power down / up | Ctrl+`[` / Ctrl+`]` |
| Cycle camera | `V` |
| Orbit the camera | Middle-drag or Alt+left-drag, or Alt+Left / Alt+Right. A plain left-press does not orbit. |
| Order a heading | Left-click in the 3D view or on the sensor map. A ship under the cursor is only the bearing. |
| Target a contact | Right-click under 4 logical px in the 3D view or on the sensor map, or click an off-screen tag. |
| Toggle the sensor map size | `M` |
| Toggle north-up / heading-up | `H` |
| Reset the camera | `Home` |
| Pause (single player) | `Esc` |
| Zoom the camera | Wheel on the view |
| Zoom the sensor map | Wheel on the map |
| Change desired speed | Wheel or click the lower speed bar |
| Add one point of reinforcement | Left-click a shield arc. Shift-click clears it. |

EW, tractor, cloak, fighter, mine, and boarding keys send the same sim verbs the captain uses. Reverse, erratic maneuvers, and drones still only report that they are not in this duel.

Volume sliders (master, effects, alerts) are separate from the keymap and are stored under `sfc2js.volume.v1`.
