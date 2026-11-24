# Empire skins

Status: draft v0.1 (2026-11-24). The contract is [hud-layout.md](hud-layout.md) §4. This file is the file lookup and the slot resolution the tactical page implements. Where the two disagree, `hud-layout.md` wins.

Daniel, 2026-11-24: left-click sets a fixed heading toward the clicked point, and right-click targets. The mini map stays an officer page; this build does not add a pinnable map. HUD scale is 1.0–4.0× in 0.25 steps (`hud-layout.md` §6). Vector plates use that exact scale. A bitmap plate, if one is used later, samples the nearest larger 2× or 4× plate. Install bitmaps stay nearest-neighbour. `--panel-edge` stays the style-guide value and is not a skin token.

## Skin id

`EmpireSkin` is the interface in `hud-layout.md` §4.2, implemented in `web/src/skins/catalog.ts`. Ids: `fed`, `kli`, `rom`, `lyr`, `hyd`, `gor`, `isc`, `mir`, `ori`, `neutral`.

The id comes from the player's slot in the skirmish setup (shiplist `race`, or the synthetic empire name). The target's empire does not change the console. `interceptor` resolves to `ori`. Monster and any unknown token use `neutral`. Exact CE race tokens are still **TO VERIFY** (`hud-layout.md` §4.1).

A skin changes art, accent, header weight, case and tracking. It does not change panel positions, hit targets, text colours, or `--state-*` colours. `web/src/skins/hit-map.test.ts` checks that every skin shares one hit map and that skin CSS sets only custom properties.

## Resolution order

Per slot, per skin (`hud-layout.md` §4.4):

1. A bitmap in the player's install, read through `@sfc2js/platform` and decoded with `@sfc2js/render` `loadInterfaceBitmap`. Bytes stay in memory. Nothing is copied into the repo or `web/dist`.
2. Our placeholder in `web/art/skins/<id>/`.
3. `web/art/skins/neutral/`, the style-guide plate with no motif.

`sprites.q3` still has no readable directory (`docs/formats/inventory/ce-2.670.md`, `docs/ui/asset-pipeline.md` §3a), so step 1 cannot name a frame entry inside it. That mapping is **TODO**.

## Bitmap lookup

Paths are the CE 2.670 inventory names (`docs/formats/inventory/ce-2.670.md` at the inventory commit, and the copy on `main`). The extracted tree prefixes a category folder (`textures/`, `cursors/`, `fonts/`). The install root uses the path without that prefix (`Assets/...`), the same way `docs/formats/bmp.md` describes install-relative paths. Lookup tries both, case-insensitive.

A role is assigned only when the file name or folder states it. Anything else is **TODO** and is not drawn.

| Id | Path | Role |
| --- | --- | --- |
| `ui.offscreen` | `Assets/bitmaps/ui/offScr.BMP` | **TODO.** The name does not say which console piece this is. |
| `ui.offscreen-grid` | `Assets/bitmaps/ui/off-scr-icon-grid.bmp` | **TODO.** Icon contents are not documented. |
| `reticle.hyd` | `Assets/textures/HydranRedicleCircle.BMP` | Reticle for `hyd`. The name says a Hydran reticle circle. Loaded, not drawn: the helm panel is a button grid. |
| `reticle.hyd-noise1` | `Assets/textures/HydranRedicleCircle-noise1.BMP` | **TODO.** The noise suffix is not documented. |
| `reticle.hyd-noise2` | `Assets/textures/HydranRedicleCircle-noise2.BMP` | **TODO.** |
| `reticle.isc` | `Assets/textures/ISCRedicle.BMP` | Reticle for `isc`. |
| `reticle.mir` | `Assets/textures/MirakReticles.bmp` | Reticle for `mir`. |
| `reticle.targeting` | `Assets/textures/TargetingRedicles.BMP` | Shared reticle when the empire has no named one. |
| `reticle.targeting-noise1` | `Assets/textures/TargetingRedicles-noise1.BMP` | **TODO.** |
| `reticle.targeting-noise2` | `Assets/textures/TargetingRedicles-noise2.BMP` | **TODO.** |
| `kli.splat` | `Assets/textures/Klingon-splat.BMP` | **TODO.** "Splat" is not a plate, frame, or button. |
| `crosshair.l` | `Assets/textures/L-crosshair-bar.BMP` | **TODO.** The name says crosshair. `L-` is not a documented empire token, so it is not the Lyran plate. |
| `crosshair.l-noise1` | `Assets/textures/L-crosshair-bar-noise1.BMP` | **TODO.** |
| `crosshair.l-noise2` | `Assets/textures/L-crosshair-bar-noise2.BMP` | **TODO.** |

Other files under `Assets/textures` (explosions, plasma, damage, sky, suns) are not console plates. They are not loaded for the skin.

Colour-key for these BMPs stays `none` until `docs/formats/bmp.md` §6 settles it. A reticle is not painted over the 3D view or the helm buttons. There is no placeholder reticle, and the helm panel has no compass face, so a missing install reticle is simply not drawn.

## Cursors and fonts

Not decoded. The formats are not in `docs/formats`.

Cursor files in `cursors/Assets/mouse` (also tried as `Assets/mouse`): `federation.cur`, `klingon.cur`, `romulan.cur`, `lyran.cur`, `hydran.cur`, `gorn.cur`, `ISC.cur`, `mirak.cur`, plus `arrow.cur`, `transNA.cur`, `transOK.cur`. No `ori` cursor is in the inventory. **TODO:** a `.cur` reader.

Font files in `fonts/Assets/aafonts` are `<stem><size>.bft`. Stems in the inventory: `Federation`, `Klingon`, `romulan`, `lyran`, `hydran`, `gorn`, `isc`, `mirak`, and `arial`. No Orion, Monster, or Neutral stem. **TODO:** a `.bft` reader. The HUD keeps the style-guide families and only changes weight, case, and tracking.

## Placeholders

`web/art/skins/<id>/plate.svg` and `mark.svg`. Motifs follow `hud-layout.md` §4.5. They are original geometry, not emblems. Nine-slice insets are 8 units on every skin so the border width does not move a hit target. The ISC plate uses the style-guide ISC accent `#D0D4DA`. `panelBg.texture` is unset: §4.2 reserves it for a low-contrast texture separate from the frame. `accent.cvd` is on the type and left empty until the style-guide follow-up fills the colour-vision pairs.
