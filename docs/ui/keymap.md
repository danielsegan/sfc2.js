# Keymap

Default profile for the tactical HUD is **Modern** (Daniel, 2026-11-24). An opt-in **SFC2 Classic** preset, written from the CE 2.670 Hot Keys notes (Wintermute, 2026-11-25), is available in the Keys dialog. Switching presets replaces the active defaults; each preset keeps its own rebinds. The chosen preset and both profiles are stored under `sfc2js.keymap.v1` (older saves that stored only a Modern profile still load as Modern).

Bindings use `KeyboardEvent.code` (the physical key), so the same binding works on AZERTY and QWERTZ. The rebind dialog shows the code with its modifiers. A chord the browser reserves (`F5`, `F11`, Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+R) cannot be bound. Binding a key that is already used swaps the two actions.

Held keys (turn) are sampled every frame. Speed up and speed down also accept key repeat. Everything else fires once per keydown.

Mouse actions on the 3D view follow the original grammar, and a left-click there does send an order: a plain left-click sends `orderHeading` toward the clicked point, including when a hostile is under the cursor, and the order holds until the next click replaces it (no target-follow). Alt+left-drag and middle-drag orbit and never steer. Right-click never steers. A right-click under 4 logical pixels targets. The gate grows with `--hud-scale`. Clicks on the Officer MFD Tactical Map are display-only (CE 2.670; Daniel D2) and neither steer nor target. Shield facing clicks still send reinforcement. A plain click on a weapon mount selects only that mount; Shift+click adds or removes it from the selection, and Ctrl+`1`–`6` assigns the whole selection to that group.

| Action | Default |
| --- | --- |
| Speed up / down | `W` / `S` |
| Turn left / right | `A` / `D` (hold) |
| All stop | `X` |
| Reverse | `R` (not in this duel; the key explains that) |
| Erratic maneuvers | `E` (not in this duel) |
| High-energy turn port / starboard | `Q` / `F` |
| Fire groups 1–6 | `1`–`6` |
| Assign the selected mount(s) to a group | Ctrl+`1`–`6` |
| Fire the selected group | `Space` |
| Select all weapons | unbound (Weapons panel button) |
| Alpha strike (fire the selection) | unbound (Weapons panel button) |
| Toggle overload on the selected photon | `O` |
| Toggle proximity | unbound; the Proximity button is shown when a selected mount is a photon |
| Select bow, forward starboard, aft starboard, stern, aft port, forward port | Numpad `8` `9` `3` `2` `1` `7` |
| Clear committed reinforcement on that facing | Shift+the same numpad key |
| Select all shield facings, then none | Numpad `5` |
| Reinforce the selected facings | `N` |
| Reinforce all (general) | Shift+`N` |
| Toggle general reinforcement | unbound |
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
| Officer MFD pages (Helm, Repair, Science, Marines, Shuttles, Comms, Map, Fleet, Energy, Options) | unbound (`mfd.page.*`, rebindable) |
| Orbit the camera | Middle-drag or Alt+left-drag, or Alt+Left / Alt+Right. A plain left-press does not orbit. |
| Order a heading | Left-click in the 3D view. A ship under the cursor is only the bearing. The Officer MFD map does not steer. |
| Target a contact | Right-click under 4 logical px in the 3D view, or click an off-screen tag. The Officer MFD map does not target. |
| Open the Tactical Map officer page | `M` |
| Toggle north-up / heading-up | `H` |
| Reset the camera | `Home` |
| Pause (single player) | `Esc` |
| Toggle the interface bar | `` ` `` (Backquote). The console hides and the field takes back that height. The lower display keeps a Show/Hide console button so it can be opened again. |
| Zoom the camera | Wheel on the view. `view.zoomIn` / `view.zoomOut` exist but stay unbound here so `-`/`=` can be used in SFC2 Classic. |
| Zoom the tactical map in / out | Shift+`=` / Shift+`-` (three discrete ~2× tiers). Wheel over the Officer MFD does not dolly the 3D camera. |
| Change desired speed | Wheel (`±1`), or click / drag the lower speed bar. Click and drag map the bar position to a whole speed in `0..speedMax`. Whether CE 2.670 uses the same integer snap on drag is **TO VERIFY**. |
| Select a shield facing | Left-click an arc. Shift-click adds or removes that facing. Click the centre ship to select all, then none. Set the Reinforcement amount (integer energy points, step 1; the CE 2.670 slider detent is **TO VERIFY**) and click Reinforce or Reinforce all, or use `N` / Shift+`N`. Down / Minimal / Up are disabled until a shield-state verb exists (issue #145). |

EW, tractor, cloak, fighter, mine, and boarding keys send the same sim verbs the captain uses. Reverse, erratic maneuvers, and drones still only report that they are not in this duel.

Volume sliders (master, effects, alerts) are separate from the keymap and are stored under `sfc2js.volume.v1`.


## SFC2 Classic

Opt-in preset in the Keys dialog. It replaces the Modern defaults rather than overlaying them. Bindings below are only for actions that exist in this build. CE keys with no matching action stay unbound and are listed after the table. Written from the CE 2.670 Hot Keys notes, not from screenshots.

| Action | SFC2 Classic |
| --- | --- |
| Speed up / down | `S` / `A` |
| All stop | Numpad `0` |
| Erratic maneuvers | Numpad `/` (still reports that the verb is not in this duel) |
| Fire the selection | `Z` |
| Alpha strike | Shift+`Z` |
| Select weapon groups 1–4 | `1`–`4` |
| Assign the selection to a group | Ctrl+`1`–`4` |
| Select bow, forward starboard, aft starboard, stern, aft port, forward port | Numpad `8` `9` `3` `2` `1` `7` |
| Reinforce the selected facings | `N` |
| Reinforce all (general) | Shift+`N` |
| Cycle hostiles | `Y` |
| Cycle friendlies | `U` |
| Nearest hostile | `` ` `` (Backquote) |
| Cloak | `X` |
| Lay mine | `M` |
| Toggle the interface bar | `D` |
| Officer page: Helm | `'` (Quote) |
| Officer page: Repair | `;` |
| Officer page: Map | `Tab` (opens the Tactical Map page; same command as `view.map`) |
| Officer page: Energy | `.` |
| Officer page: Options | `/` |
| Officer page: Comms | `0` |
| Viewport zoom in / out | `-` / `=` |
| Map zoom in / out | Numpad `+` / Numpad `-` (the Map page `-`/`+` buttons still step the three zoom tiers). Main-row `-`/`=` stay on the viewport, as in the CE Fixed Keys tab. |
| Pause | `Pause` |
| Orbit the camera | Middle-drag or Alt+left-drag, or Alt+Left / Alt+Right (unchanged mouse grammar) |

### Unbound Classic gaps

These CE keys have no action in this build yet, or the CE default in the notes is already empty. They stay unbound and can be rebound later when a verb exists.

| CE key (from the Hot Keys notes) | Intended action | Gap |
| --- | --- | --- |
| `T` | Cycle any target | No "any target" cycle (`target.next` is hostile-only, `target.nearest` is on `` ` ``) |
| `Space` | Select nearest hostile missile | No missile-target action |
| `5`–`8` / Ctrl+`5`–`8` | Target memory slots | No target-memory action |
| `F1`–`F4` | Overhead / Chase / Follow / Enemy cameras | `DuelScene` still only cycles overhead and chase (`view.camera` is unbound here so it does not steal those keys) |
| `F5` | Target padlock | No padlock action; also reserved by the browser |
| `F6`–`F8` | Jump camera to a ship | No action |
| `F9`–`F11` | HUD information overlays | No action; `F11` is reserved by the browser |
| `F12` | Save screenshot | No action |
| `R` / unbound Yellow Alert | Red / Yellow Alert | No `alert.*` actions (the lower lamps are readouts). Tracked with `#144` / `#145` if a sim verb is required |
| `Esc` | End mission / exit menu | No exit-menu action (`view.pause` is on `Pause` instead) |
| `Home` / `End` / `PageUp` / `PageDown` | Pan and tilt the camera | No pan/tilt actions (`view.reset` stays unbound so `Home` is not stolen) |
| Numpad `*` / Numpad `.` | Follow target / Orbit target | Helm verbs not in this duel (`#144`) |
| Numpad `5` / Numpad `+` | HET toward heading / HET 180 | HET verbs not fully wired (`#144`); HET port/starboard also have empty CE defaults and stay unbound |
| Numpad `4` / Numpad `6` | Reinforce all port / starboard shields | No side-pair reinforce action |
| Unbound CE rows | Steady as she goes; HET hard port/starboard; flee; science / security / weapons officer shortcuts; self-destruct; weapon normal / offline / overload-all | No actions, or already empty in CE |
| `W`, `E`, `Q`, `B` | Wild Weasel, scatter-pack, suicide shuttle, transporter bomb | No craft verbs (`#145`) |
| Unbound CE fighter / general shuttle launch | Launch fighters / shuttles | `craft.launch` exists but CE leaves this row empty, so it stays unbound |
| `C`, `V`, `F`, `G` | Maximize defensive tractor, point defense, ECM, ECCM | No maximize actions (`#145`) |
| `[` / `]` | Game speed | No game-speed action |
| `O` | Swap displays | No swap-displays action |
| `Enter` / `Backspace` | Chat / quick jump | No actions |
| `L`, `H`, `K`, `,`, `J` | Defense / Sensors / Shields / Shuttle Bay / Tractor sub-panels | No System MFD shortcut actions (those panels already have buttons) |
| `N` as Transporter panel (CE Tab 7) | Open Transporters | Intentionally not bound: the brief keeps `N` / Shift+`N` as reinforce / reinforce all |
| `P` / `I` | Science probe / deep scan | No science verbs (`#145`) |
| Shift+`0` | Mission briefing | No briefing action |

Turn left/right, energy presets, groups 5–6, and other Modern-only defaults are also unbound in this preset so they cannot collide with Classic keys. They remain available to rebind. `'` / `;` / `Tab` / `.` / `/` / `0` open the Officer MFD pages that exist today.
