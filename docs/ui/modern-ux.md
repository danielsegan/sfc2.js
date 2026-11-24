# Modern UX

Status: draft v0.1. These are layers on top of SFC2's own HUD (baseline Community Edition (CE) 2.670). Defaults keep the original feel; everything here is switchable. Several items are listed under the plan's "Stretch" row ("HD rendering, smarter AI, controller support, ultrawide HUD") and its Phase 8 ("Mod loader, HD upgrades, controller, Tauri release"). Scaling, rebinding and the basic accessibility settings are needed earlier, by Phase 3, because they're cheap to build in and expensive to retrofit.

## 1. Resolution scaling and UI scale

- The 3D view renders at native resolution × `renderScale` (0.5–2.0, default 1.0; auto-lowered by the quality preset).
**Agreed with Engine Lead (pending docs/engine HUD contract):** the tactical HUD draws on its own 2D overlay canvas above the three.js view, scaled in **whole-number steps** so original sprites stay pixel-exact. Menus, options, briefings and accessibility surfaces are **HTML** and scale freely.

- **Tactical HUD (overlay canvas), integer scale.** The HUD is authored on a **1024 × 768 logical canvas** (style-guide §1). The canvas backing store is sized in physical pixels (`devicePixelRatio` applied), and `hudScale = N`, a whole number: `Nmax = max(1, floor(min(physW / 1024, physH / 768)))`. The default is `N = Nmax`; the user can step down (`N = 1 … Nmax`). Sprites draw with `imageSmoothingEnabled = false` at exactly N× so original `sprites.q3` art stays pixel-exact. Space left over after the integer scale goes to the 3D view (anchors push outwards, see §2); the HUD is never stretched by a fractional amount. **Superseded 2026-11-24:** Daniel allowed fractional HUD scale 1.0–4.0× (`hud-layout.md` §6, D3).
- **Fallback vector and HD art** are rasterised at the same N× step, so the layout is identical whatever the art source.
- **Canvas text** (readouts, labels) is drawn at N× the style-guide size; the smallest canvas size is 11 logical px, so it never drops below 11 physical px.
- **HTML layer, free scale.** Menus, options, briefings, the message-log reader and accessibility mirrors use CSS pixels with the user's **text size** setting (§5) and browser zoom. They aren't bound to N.
- Example: 1920×1080 gives N = 1 (HUD 1024×768 physical, centred or anchored, with more 3D view); 2560×1440 gives N = 1; 3840×2160 gives N = 2 (2048×1536).
- `devicePixelRatio` changes (monitor move, browser zoom) recompute `Nmax`.

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
- Profiles: **Modern** (default, decided 2026-11-24), **Classic** (optional "SFC2 classic" remap preset, built once original defaults are verified against CE 2.670; not listed here), user profiles. Export and import as JSON.
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
| Screen-reader-friendly menus | Menus, options, briefings and every accessibility surface are **HTML** (agreed with Engine Lead) with real buttons, headings and labels; focus order follows layout; dialogs trap focus. The tactical HUD canvas is `aria-hidden`; an HTML mirror reads the same `ViewModel` and provides live regions for alerts and text table views for shields, weapons, contacts and damage (`hud-spec.md` §0). The real-time battle itself is not fully screen-reader playable. |
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
- Our own app icon only (no franchise art). The window title and About screen use the project name, **SFC2.js**.

## Open questions

1. **Resolved 2026-11-24 (Daniel): fractional scale allowed, 1.0–4.0× in 0.25 steps. See `hud-layout.md` §6.**
2. Engine Lead: does the sim support a single-player time-scale (for example 0.5×) without breaking determinism, or should "game speed" be dropped?
3. Engine Lead: Tauri webview differences (WebView2 / WKWebView / WebKitGTK) for the Gamepad API and pointer lock: test matrix owner?
4. Daniel: default layout on 16:9 — safe-area centred (closer to the original) or wide (more modern)?
5. Daniel: should controller support stay in Phase 8 as planned, or should basic gamepad input move earlier?
6. Combat Systems: are there rules that assume mouse precision (for example free aim) that a controller can't do well?
