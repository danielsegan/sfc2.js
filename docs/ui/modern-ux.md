# Modern UX

Status: draft v0.1. These are layers on top of the SFC2 (Empires at War) reference layout. Defaults keep the original feel; everything here is switchable. Several items are listed under the plan's "Stretch" row ("HD rendering, smarter AI, controller support, ultrawide HUD") and its Phase 8 ("Mod loader, HD upgrades, controller, Tauri release"). Scaling, rebinding and the basic accessibility settings are needed earlier, by Phase 3, because they're cheap to build in and expensive to retrofit.

## 1. Resolution scaling and UI scale

- The 3D view renders at native resolution × `renderScale` (0.5–2.0, default 1.0; auto-lowered by the quality preset).
- The HUD is authored on a **1024 × 768 logical canvas** (style-guide §1). `uiScale = clamp(viewportHeight / 768 × userScale, 0.75, 3.0)`, with `userScale` 0.75–2.0 in settings (default 1.0).
- **Period sprites** (from the player's `sprites.q3`) scale by integer factors when `uiScale ≥ 2` (nearest-neighbour, to keep the pixel look crisp) and by a smooth filter otherwise. The user can force "pixel-perfect" (integer only, with letterboxing of the HUD region).
- **Vector fallback and HD art** scale freely.
- Text never renders below 11 physical px; if it would, `uiScale` stops shrinking.
- `devicePixelRatio` is respected for canvas layers (sensor map, arcs).

## 2. 4:3 safe area vs 16:9 and ultrawide

```
4:3 (reference)            16:9                                 21:9 / 32:9 ultrawide
+------------+         +------------------------+       +---------------------------------------+
|  HUD + 3D  |         |   |  4:3 safe area  |   |       |        |   4:3 safe area   |          |
|            |         | 3D|  HUD anchors    |3D |       |  3D    |   (or wide HUD)   |   3D     |
+------------+         +------------------------+       +---------------------------------------+
```

| Mode | Behaviour |
| --- | --- |
| **Classic** (default on 4:3) | HUD fills the frame as in the original. |
| **Safe-area centred** (default on 16:9) | The HUD stays inside a centred 4:3 rectangle; the 3D view fills the full width. Corner panels (target info, sensor map) can optionally move to the screen edges. |
| **Wide** (opt-in, default on 21:9 and wider) | Anchored panels move out to the screen edges; the bottom console splits into left and right clusters so the centre of the 3D view stays clear. Panels never sit more than ~30° of view angle off-centre on 32:9 (cap at 2560 logical width, rest is 3D only). |

The 3D camera uses Hor+ field of view (vertical FOV fixed, wider screens see more), with a cap on 32:9 to avoid fisheye distortion.

## 3. Controller and gamepad

Uses the browser Gamepad API (and the same API inside Tauri's webview). Standard mapping layout, Xbox labels shown, PlayStation and generic glyphs available. Our own button glyphs, not platform trademark art.

| Input | Default action |
| --- | --- |
| Left stick | Turn (X), speed up/down (Y, with deadzone and step repeat) |
| Right stick | Camera orbit; click = camera mode |
| LT / RT | Previous / next fire group; RT hold + A = fire |
| A | Fire selected group |
| B | Back / cancel |
| X | Toggle overload on selection |
| Y | Target nearest hostile; hold = cycle |
| LB / RB | Cycle HUD panel focus (radial selection) |
| D-pad | Within the focused panel: navigate / adjust (e.g. shield facing, power row) |
| View / Select | Sensor map full screen |
| Menu / Start | Pause menu |
| L3 | Erratic maneuvers (if supported) |

- **Radial menus** (hold RB): tractor, transporter, cloak, launch, mine — one flick each.
- Focus is always visible; the D-pad navigates panels in a predictable grid order.
- Rumble on hits is optional (off by default).

## 4. Rebinding

- Every command in `hud-spec.md` is an **action id** (for example `weapons.fireGroup.1`). Bindings map inputs → action ids; the HUD never hard-codes keys.
- Profiles: **Modern** (default proposal), **Classic** (SFC2 original defaults, built once those are verified in the install), user profiles. Export and import as JSON.
- Conflict detection with a "swap" prompt; chord support (`Ctrl/Shift/Alt`); separate keyboard and gamepad maps.
- Browser-reserved keys (`Ctrl+W`, `Ctrl+T`, `F5`, `F11` etc.) can't be bound in the web build; the Tauri build may allow more. The UI marks reserved keys.
- Keys use `KeyboardEvent.code` (physical position) so AZERTY and QWERTZ layouts work, with labels shown via `navigator.keyboard.getLayoutMap()` where available.

## 5. Accessibility

| Setting | Detail |
| --- | --- |
| Colour-blind palettes | Deuteranopia, protanopia, tritanopia and high-contrast palettes swap the state tokens (style-guide §4.1). States always also carry shape and pattern cues, so no information is colour-only. |
| Text size | Separate from UI scale: 100 / 125 / 150 / 200% for log, tooltips and menus. |
| Legible font | Swaps to Atkinson Hyperlegible (SIL OFL 1.1). |
| Reduced motion | Follows `prefers-reduced-motion` by default; disables screen shake, pulses, flashes and camera auto-moves; bars snap per tick. |
| Flash safety | Nothing above 3 Hz; large-area flashes (explosions) capped in brightness change. |
| Screen-reader-friendly menus | All menus and settings are DOM with real buttons, headings and labels; focus order follows layout; dialogs trap focus. The real-time tactical view itself is not fully screen-reader playable, but key state is reachable: the live regions for alerts, the text table views for shields, contacts and damage (`hud-spec.md`). |
| Hold vs toggle | Any "hold" action can be set to toggle. |
| Game speed | Single player only: a slower sim rate option (if the Engine Lead's fixed tick allows a time-scale) helps players with slower reaction. Never available in multiplayer. |
| Subtitles | Voice cues and mission audio get captions in the message log. |

## 6. Tauri desktop window

The plan targets a Tauri desktop shell (plan.md, "Vision and scope"; Phase 8 "Tauri release").

- Window modes: windowed, borderless fullscreen (default), exclusive fullscreen if Tauri and the OS support it. `Alt+Enter` toggles.
- Remember size, position, monitor and mode between runs; recover if the monitor is gone.
- Minimum window 1024 × 768 logical; smaller windows letterbox the HUD.
- Pause single-player on focus loss (setting); in multiplayer, never pause, only mute.
- Native file dialogs for pointing at the SFC2 install folder (the web build uses the File System Access API or archive import, per plan.md "Architecture").
- Cursor confinement during camera drag; release on focus loss.
- High-DPI and mixed-DPI monitors: re-compute `uiScale` on `scaleFactorChanged`.
- Our own app icon only (no franchise art). The window title uses the working name until Daniel decides the project name (open decision).

## Open questions

1. Engine Lead: does the sim support a single-player time-scale (for example 0.5×) without breaking determinism, or should "game speed" be dropped?
2. Engine Lead: Tauri webview differences (WebView2 / WKWebView / WebKitGTK) for the Gamepad API and pointer lock: test matrix owner?
3. Daniel: default layout on 16:9 — safe-area centred (closer to the original) or wide (more modern)?
4. Daniel: should controller support stay in Phase 8 as planned, or should basic gamepad input move earlier?
5. Combat Systems: are there rules that assume mouse precision (for example free aim) that a controller can't do well?
