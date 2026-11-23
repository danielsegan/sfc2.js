# Style guide — tactical HUD, menus and the 3D space look

Status: draft v0.1. The reference is SFC2 itself (Empires at War), the only skin designed here (README, "Reference build"). The Period look is built from the player's own `sprites.q3` GUI art wherever possible. Everything described as "like the original" is a description in our own words, to be checked against the player's install (**TO VERIFY**). No original art is reproduced here.

Two visual tiers run through this whole guide:

| Tier | Intent | Default |
| --- | --- | --- |
| **Period** | Looks and reads like the 2000-era game: original sprites from the player's install, low-poly models, additive sprite VFX, simple lighting. | On |
| **HD** | Optional, Phase 8 (plan.md, "Roadmap": "Mod loader, HD upgrades, controller, Tauri release"). Same layout, our own vector or HD art, PBR-lite materials, bloom, particles. | Off; user opt-in |

The tier is a single setting with per-feature overrides (for example Period HUD with HD explosions).

---

## 1. Layout grid

- **Design canvas:** 1024 × 768 logical units (4:3). All HUD positions are authored on this canvas and scaled (see `modern-ux.md` for scaling, 16:9 and ultrawide).
- **Base unit:** 8 logical px. Panel padding 8, gutter between panels 8, minimum hit target 24 × 24 (32 × 32 in "large targets" mode).
- **Anchors:** every component anchors to one of nine points (TL, T, TR, L, C, R, BL, B, BR) plus an offset in units. On wide screens the anchors move outwards and the 3D view fills the middle.
- **Regions** (proposed default, arranged like SFC2's console; exact placement **TO VERIFY**):

```
+--------------------------------------------------------------+
| [Target info]              [Alerts / mission]    [Sensor map]|
|                                                              |
|                                                              |
|                     3D tactical view                        |
|  [Message log]                                               |
|                                                              |
|--------------------------------------------------------------|
| [Energy] [Shields 6-facing] [Weapons + arcs] [Damage] [Speed]|
| [EW]  [Tractor/Transp/Board] [Cloak] [Craft/Drones/Mines]    |
+--------------------------------------------------------------+
```

The bottom console is a docked bar about 22% of canvas height in Period tier. In HD tier it can float as separate panels.

## 2. Panel chrome

Original look, not a copy of anything. The theme is "starship console, late-20th-century game UI": dark translucent plates, thin bevels, chamfered corners.

| Element | Spec |
| --- | --- |
| Plate | `--panel-bg` at 85% opacity, 1-unit inner bevel (light top-left, dark bottom-right) |
| Corners | 45° chamfer of 6 px on the outer corners. **No** rounded "elbow" sweeps or pill-shaped colour blocks (avoids LCARS-style trade dress). |
| Border | 1 px `--panel-edge`, plus a 2 px empire-accent strip on the panel's top edge |
| Header | 16 px tall, small-caps label, left-aligned, optional collapse chevron on the right |
| Divider | 1 px `--panel-edge` at 50% opacity |
| Focus ring | 2 px `--focus` outline, offset 2 px, always visible on keyboard or gamepad focus |
| Period skin | When the player's sprites load, plates and frames come from their install (see `asset-pipeline.md`). Our chrome is the fallback and the HD look. |

## 3. Typography

Open-licensed fonts only, self-hosted with the web app (no CDN calls), with the license files committed next to them.

| Role | Font | License | Use |
| --- | --- | --- | --- |
| Labels / headers | **Saira Semi Condensed** | SIL Open Font License 1.1 | Panel headers, buttons, menu items |
| Numerals / readouts | **IBM Plex Mono** | SIL Open Font License 1.1 | Energy, speed, ranges, timers (tabular figures so digits don't jitter) |
| Body / log | **Inter** | SIL Open Font License 1.1 | Message log, tooltips, briefings |
| Accessibility alt | **Atkinson Hyperlegible** | SIL Open Font License 1.1 | Swapped in for Inter and Saira when "legible font" is on |

Scale (logical px at UI scale 1.0): 10 (micro, tick labels), 12 (readouts), 14 (body), 16 (headers), 20 (menu items), 28 (menu titles). Minimum rendered size is 11 physical px; the UI scale clamps to keep it there. In Period tier, bitmap fonts from the player's install may be used if the Asset & Formats Engineer can parse them (**TO VERIFY** whether the original fonts are bitmaps inside the GUI archives).

## 4. Color tokens

Tokens are CSS custom properties (DOM HUD) mirrored as a JSON table for canvas and WebGL layers. Names are stable; values can be themed.

### 4.1 Base and state tokens

| Token | Value | Use |
| --- | --- | --- |
| `--panel-bg` | `#0B1118` | Plates |
| `--panel-edge` | `#3A4A5C` | Borders, dividers |
| `--text` | `#D8E2EC` | Primary text |
| `--text-dim` | `#8A9AAB` | Secondary text |
| `--state-normal` | `#5FD3A0` | Systems nominal, weapon ready |
| `--state-charging` | `#4FA3E0` | Charging, in progress |
| `--state-warning` | `#F2B33D` | Low power, partial shield, overload armed |
| `--state-damage` | `#E5484D` | Damaged, destroyed, shield down |
| `--state-disabled` | `#55606B` | Offline, not fitted, out of arc |
| `--state-friendly` | `#5FB7FF` | Friendly contacts |
| `--state-hostile` | `#FF6B5E` | Hostile contacts |
| `--state-neutral` | `#C9C9C9` | Neutral / unknown |
| `--focus` | `#FFFFFF` | Focus ring |

Every state also has a **shape or pattern cue**: warning = diagonal hatch plus ⚠-style glyph (our own icon), damage = cross-hatch plus a broken outline, disabled = 40% opacity plus a dashed outline. Colorblind palettes swap the values only (see `modern-ux.md`).

### 4.2 Empire accent tokens

Empire roster per plan.md ("Vision and scope"), to be confirmed against installed data in Phase 0. The values are our own picks; they are not sampled from original art.

| Empire | Token | Accent | Secondary |
| --- | --- | --- | --- |
| Federation | `--emp-fed` | `#4F8FD6` | `#C8D6E5` |
| Klingon | `--emp-kli` | `#B23A3A` | `#4A4A4A` |
| Romulan | `--emp-rom` | `#3FA36B` | `#C9B26A` |
| Lyran | `--emp-lyr` | `#D9A441` | `#6B4A2A` |
| Hydran | `--emp-hyd` | `#3FB5A8` | `#7A5FB0` |
| Gorn | `--emp-gor` | `#7FA640` | `#5A3A2A` |
| ISC | `--emp-isc` | `#D0D4DA` | `#6B7FA0` |
| Mirak | `--emp-mir` | `#C46A2E` | `#3A3A5A` |
| Orion Pirates | `--emp-ori` | `#9B6BD1` | `#2E2E2E` |

Orion cartels may need sub-accents if the install defines them (**TO VERIFY**). Accent colors are only for chrome tint, the panel top strip and the player's ship marker. They never carry state meaning.

## 5. Iconography

- Original icon set drawn by the project: 24-unit grid, 2-unit stroke, chamfered (not rounded) joins, monochrome and tinted by state tokens.
- SVG source in `web/` (path set by the Engine Lead), exported to a sprite sheet for the canvas layer.
- Required set for Phase 2–3: weapon families (phaser, photon, disruptor, plasma, hellbore, fusion, drone, ESG, PPD), systems (warp, impulse, APR, battery, sensors, scanners, tractor, transporter, cloak, shuttle bay, fighter, PF, mine), states (ready, charging, overload, damaged, disabled, out of arc), alerts (incoming seeking weapon, boarding, shield down, self-destruct), camera modes.
- No franchise symbols. Empire markers are **our own abstract glyphs** (simple geometric marks), not insignia from the shows or the game.

## 6. Animation and timing

Presentation only; never reads the wall clock into the sim.

| Event | Duration | Easing | Reduced motion |
| --- | --- | --- | --- |
| Panel open / close | 120 ms | ease-out | instant |
| Value change (bar fill) | interpolated between sim ticks at display rate | linear | snap per tick |
| Weapon ready pulse | 1 pulse, 300 ms | ease-in-out | static outline |
| Shield hit flash (HUD) | 150 ms | ease-out | border thickens, no flash |
| Alert banner | 200 ms in, holds, 200 ms out | ease-out | instant |
| Critical blink (shield down, hull breach) | 2 Hz, max 3 s, then steady | step | steady colour plus icon |

- Nothing flashes faster than 3 Hz (photosensitivity).
- Sim timing (provisional, Engine Lead): the sim runs at a **fixed 30 Hz**, so charge and energy change in whole ticks. The HUD interpolates between the previous and current snapshot for smooth bars.

## 7. Sound-cue hooks

The HUD raises named UI events. The Audio & Netcode QA Lead maps them to the player's `sounds.txt` entries, so no audio file names live in the HUD.

| Hook | Fires when |
| --- | --- |
| `ui.click`, `ui.hover`, `ui.back`, `ui.error` | Menu and button interaction |
| `hud.weapon.ready`, `hud.weapon.fired`, `hud.weapon.overload_armed` | Weapon state changes (player ship only) |
| `hud.shield.down`, `hud.shield.reinforce` | A facing reaches 0, or reinforcement changes |
| `hud.alert.seeking_weapon`, `hud.alert.boarding`, `hud.alert.hull_critical`, `hud.alert.self_destruct` | Alert raised |
| `hud.energy.overdraw` | Allocation exceeds available power |
| `hud.target.locked`, `hud.target.lost` | Target change |
| `hud.comms.message` | Log message with a voice cue |

Voice and alert cues in the original (bridge-officer style call-outs) are **TO VERIFY** in `sounds.txt` and handled by Audio.

---

## 8. The 3D space look

Renderer: three.js (plan.md, "Vision and scope"). Material and shader specifics are proposals for the Engine Lead.

### 8.1 Ship materials and self-illumination

| | Period | HD |
| --- | --- | --- |
| Base | Diffuse texture from the player's BMP, simple Lambert plus one specular term | Same texture, `MeshStandardMaterial` with derived roughness, optional user-supplied normal map from an HD pack |
| Self-illum | The original self-illum map (windows, running lights, warp glow) added unlit on top | Same map driving `emissive`, with a bloom threshold so only lit areas glow |
| Damage | Swap to `_brk` destruction mesh on breakup; scorch decals optional | Plus dynamic scorch decals and flickering emissive on damaged sections |
| Shadows | None | Optional single-light soft shadow |

Self-illum must read correctly at the Phase 1 exit ("Every ship in `shiplist.txt` loads and spins with textures and self-illum").

### 8.2 Weapon VFX per family

All VFX are ours: procedural or our own textures. Colors per family follow the general feel of the originals (**TO VERIFY** each in the install). Empire variants, such as different phaser colours, come from data where the install defines them.

| Family | Period | HD addition |
| --- | --- | --- |
| Phasers | Instant beam: additive quad, 120 ms life, slight width taper | Core plus glow layers, impact sparks |
| Photon torpedoes | Bright point sprite with halo, travels | Flare streaks, trail |
| Disruptors | Short bolt, fast, hot colour | Heat-shimmer trail |
| Plasma torpedoes | Large pulsing orb, grows with warhead strength | Particle shell, shrinks as it decays with range |
| Hellbores | Expanding sphere wavefront at impact, ring on shields | Volumetric-ish sphere |
| Fusion beams | Short, thick, ragged beam | Noise-distorted beam |
| Drones | Small mesh or sprite, exhaust trail | Smoke trail, lock-on bracket |
| ESGs | Expanding ring around the firing ship | Distortion ring |
| PPDs | Pulse train of short bolts | Per-pulse glow |
| Tractor | Faint beam between ships, pulsing | Ripple shader |
| Transporter | Sparkle column on the target ship | Particle column |
| Mines | Blinking point sprite; sensor-ring when detected | Proximity glow |
| Cloak | Fade plus shimmer while engaging, ghost outline for the owner | Refraction shimmer |

### 8.3 Explosions and breakup

- Period: flipbook explosion sprites (from the player's install if present, else ours), plus switching to the `_brk` mesh pieces with a seeded spin. Debris uses a presentation-only RNG, never the sim streams.
- HD: layered fireball, shockwave ring, ember particles, a short point-light flash, light camera shake (off when reduced motion is on).
- Size scales with ship size class from the shiplist.

### 8.4 Shields

- Period: on a hit, show a flash on the struck facing (one of six) as an ellipsoid section, tinted by remaining strength.
- HD: hex or noise-patterned fresnel bubble, local ripple at the impact point, colour going from normal to warning to damage as strength drops.
- The shield-facing boundaries in 3D must match the HUD's six-facing display exactly (shared constant).

### 8.5 Nebulae, planets, starfield, lighting

| | Period | HD |
| --- | --- | --- |
| Starfield | Skybox from player's backdrop BMPs if present, else our procedural point stars | Procedural multi-layer stars with subtle parallax |
| Nebulae | Tinted fog plus backdrop | Raymarched or layered-billboard volumes (budget-gated) |
| Planets / moons | Textured sphere from install textures if present, else procedural | Atmosphere rim, night-side lights |
| Asteroids / terrain | Install models if present | Instanced, LOD |
| Lighting | One directional "sun" plus ambient | Plus a low-intensity fill, bloom, tone mapping (ACES) |

Performance budgets are the Engine Lead's call; HD effects must degrade gracefully per a quality preset.

## Open questions

1. Engine Lead: DOM/CSS HUD over the WebGL canvas, or a canvas/WebGL HUD? (This guide assumes a DOM HUD for text and accessibility, with a canvas layer for the sensor map and arcs.)
2. Engine Lead: WebGL2 only, or also WebGPU? plan.md names three.js but not a backend.
3. Asset & Formats: are the original HUD fonts bitmap glyph sheets inside `sprites.q3`, and are explosion flipbooks in BMP or another format?
4. Asset & Formats: does the shiplist or another spec table define per-empire weapon colours, or are they baked into textures?
5. Combat Systems: how should the HUD show shield strength — raw boxes, or percent of max?
6. Daniel: are the empire accent colours above acceptable, or should they be sampled to match the in-game feel (sampling original art for exact values is off the table; matching by eye in our own palette is fine)?
