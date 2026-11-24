# UI & Art — docs/ui

Owner: UI & Art Director. Status: **draft v0.1** (first pass, pre-Phase 2).

This folder holds the visual and interaction design for the tactical HUD, the menus, and the 3D space look of **SFC2.js** (the project and repo name; the repo was renamed from `sfc2-browser-edition` on 2026-11-23). It follows `docs/plan.md` (the source of truth for scope and phases) and `docs/LEGAL.md` (asset and clean-room rules).

## Index

| Doc | What it covers |
| --- | --- |
| [style-guide.md](style-guide.md) | Visual language: layout grid, panel chrome, type, color tokens per empire and state, icons, motion, sound-cue hooks, and the 3D space look (materials, self-illum, weapon VFX, explosions, shields, nebulae, planets, starfield, lighting), with period-accurate and HD tiers. |
| [hud-spec.md](hud-spec.md) | Component-by-component tactical HUD spec: purpose, proposed sim read fields, states, interactions and keys, accessibility, and TO VERIFY items. |
| [hud-layout.md](hud-layout.md) | The original tactical screen arrangement (paraphrased, TO VERIFY), the cleaned-up layout that preserves it, the per-empire skin contract, and mouse-helm HUD affordances. |
| [keymap.md](keymap.md) | Modern default keymap: physical keys, rebinding, and the mouse actions. |
| [modern-ux.md](modern-ux.md) | Resolution and UI scale, 4:3 safe area vs 16:9 and ultrawide, gamepad mapping, rebinding, accessibility, Tauri window behavior. |
| [asset-pipeline.md](asset-pipeline.md) | How the HUD loads GUI sprites from the player's own install, the vector fallback, opt-in HD packs, and texture and self-illum conventions for the renderer. |

## Where this sits in the plan

- **Role** (plan.md, "The studio"): the UI & Art Director owns the "Period-accurate HUD and menus, rendering look (self-illum, effects), HD upgrades, controller layouts", and hands off to Engine and Formats.
- **Phases** (plan.md, "Roadmap"): the HUD is a Phase 3 deliverable ("All weapons and systems, fleets, AI, HUD, sound"). Phase 2 ("Tactical duel") needs a minimal HUD for energy, six shields and arcs. Phase 1's exit ("Every ship in `shiplist.txt` loads and spins with textures and self-illum") is the first thing the material conventions in this folder must support. HD upgrades and controller support land in Phase 8 ("Mod loader, HD upgrades, controller, Tauri release"); the plan's "Stretch" row lists "HD rendering, smarter AI, controller support, ultrawide HUD".
- **Architecture** (plan.md, "Architecture"): "Rendering, UI and audio only read sim state". The HUD lives in `web/` ("Browser application and HUD", `web/README.md`); the renderer lives in `engine/`.

## Reference build (Daniel's decisions, 2026-11-23)

- **Version baseline:** *Star Trek: Starfleet Command II* **Community Edition 2.670**, from the CE installer Daniel owns (written as **CE 2.670** in these docs; changed from EaW 2.036 + unofficial 2.037 on 2026-11-23; decision recorded in [#37](https://github.com/danielsegan/sfc2.js/issues/37)).
- **HUD reference:** the HUD and menus follow SFC2's own HUD. There is one reference skin; no alternate skin is designed here (a possible future one is a single item under Open questions).
- **Art source:** the HUD is built from the player's own `sprites.q3` GUI art wherever possible; every fallback is original project art.
- **TO VERIFY** in these docs means: check against a CE 2.670 install running under Wine. Each one is a check to make, not a claim.

These decisions postdate `docs/plan.md`, which still lists the name, language and game version as open. The Producer owns updating the plan.

## Principles

1. **Read, never write.** The HUD reads a per-frame read-only `ViewModel` and sends player intent through the command queue. It never mutates sim state (plan.md, "Architecture"; Engine Lead working rules, provisional).
2. **Feels like SFC2 first, better second.** Default layout and behavior follow the reference build. Modern features (scaling, rebinding, accessibility, HD) are layered on and switchable.
3. **The player's files skin the game; our art keeps it working.** Original GUI sprites load from the player's install at runtime. When they are missing, original project-made vector art takes over. The HUD must be fully usable with zero original assets.
4. **Information first.** SFC2 is an energy-and-arcs game. Shield facings, charge state and power budget must be readable at a glance, without relying on color alone.
5. **Deterministic-friendly.** Nothing in the HUD feeds back into the sim. Interpolation, animation and VFX are presentation only and may vary per machine.
6. **Concrete and testable.** Every component has states, keys and data fields that can be checked in a test or a screenshot diff (using our own art).

## Asset policy (summary — the full rules are in `docs/LEGAL.md`)

- Never commit, embed, trace, or recreate original SFC2 art, screenshots, logos, fonts or manual text. No screenshots of the original game in this repo, PRs or issues.
- No Paramount / Star Trek trademarks or trade dress: no delta insignia, no LCARS-style rounded-elbow panels or its color blocking, no franchise logos or typefaces.
- All new art (vector fallback, HD packs, icons, our studio emblem) is original and licensed with the project. Fonts must be open-licensed and named with their license.
- Layouts are described in our own words and drawn as ASCII or mermaid wireframes, not copied from manuals.
- Clean-room: we observe the original game as a black box under Wine and use published manuals and community format notes. We never use or reference decompiled code.
- `tools/check-no-game-files.sh` blocks `.bmp`, `.q3`, `.tga`, `.mod`, `.wav` and other asset types in CI. Our own art goes in as SVG, PNG or KTX2 and must stay under the 1 MB per-file limit, or go through the allowlist with Producer sign-off.

## Decided vs still open

Decided by Daniel on 2026-11-23 (after plan.md was written):

| Decision | Effect on these docs |
| --- | --- |
| **Language: TypeScript** | Interfaces in these docs are TypeScript and are intended to become real `.ts` types once the Engine Lead confirms field names. |
| **Version baseline: CE 2.670** | All TO VERIFY items are checked against CE 2.670. |
| **HUD follows SFC2's own HUD** | Single reference skin. |
| **Project name: SFC2.js** | Used in prose and UI text (title screen, window title, About). Repo name and paths are unchanged. |

Still open: **Cursor cloud agents** (plan.md, "Open decisions for Daniel"). It doesn't affect the UI docs. (Hosting tooling is also listed in plan.md; GitHub is in use and nothing here depends on it.)

## HUD architecture

The HUD architecture agreed with the Engine Lead is recorded in `hud-spec.md` §0 ("Agreed with Engine Lead (pending docs/engine HUD contract)"): a per-frame read-only `ViewModel` (gauges not interpolated, only positions and headings blend, plus one-off events), a 2D overlay canvas for the tactical HUD at whole-number scale steps, and HTML for menus, options, briefings and accessibility surfaces.

## Open questions

1. Daniel: is a future alternate skin (for example one modelled on a later SFC release) wanted at all? Not designed here; if yes, it would be a Phase 8 item.
2. Producer: which milestone gets the minimal Phase 2 HUD (energy, shields, weapons) — Phase 2 or Phase 3?
3. Producer / legal: is a small original studio emblem (silver ring with a four-pointed star) OK next to the SFC2.js wordmark in menus and the loading screen? Should the name be reviewed legally before going public, given it includes "SFC2"?
