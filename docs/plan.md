# Starfleet Command 2: Browser Edition — Studio & Project Plan

A clean-room browser engine for *Star Trek: Starfleet Command 2*, built to full-game parity by a new AI studio. This plan covers scope, the team, architecture, a phased roadmap with risks, and the decisions Daniel needs to make.

This document is the committed source of truth for the plan (also published as a canvas). Keep it current as the project evolves.

## Vision and scope

Rebuild the whole of SFC2 as a modern web and desktop app, not just a demo. Like Glenn332's Empire at War Browser Edition, the engine is new code (three.js, plain JS modules, AssemblyScript/WASM for hot paths, a Tauri desktop shell, a Cloudflare multiplayer lobby, GPL-3.0). It loads the player's own installed game files and ships none of them.

| Area | Parity target | Source material |
| --- | --- | --- |
| Skirmish | Any ships, any empires, fleets, all weapons and systems, AI opponents | `shiplist.txt`, `ftrlist.txt`, manuals, SFB rules |
| Campaigns | One per empire: Federation, Klingon, Romulan, Lyran, Hydran, Gorn, ISC, Mirak, plus Orion Pirates | Taldren-released C++ mission sources, Mission API |
| Conquest | Dynaverse-style persistent map: hexes, territory, economy, ship purchases, promotions | SfcOpServer_Public behaviour, community docs |
| Multiplayer | Lobby, 1v1 to 6-player battles, a hosted persistent server | New netcode; GameSpy and Dynaverse are gone |
| Mods | Shiplist mods, OP and EAW ship packs, FMSE-style custom missions | Community packs the user owns |
| Stretch | HD rendering, smarter AI, controller support, ultrawide HUD | Our own work |

The empire roster above is SFC2: Empires at War's as Daniel's install should show it; Phase 0 confirms it against the installed mission and shiplist data.

> **Legal posture.** Star Trek is Paramount's IP. This is a non-commercial fan engine. It ships no game assets, needs a legal SFC2 install, and is a clean-room build: we don't take code from the SFC2-decomp project.

## The studio

A new group chat, "SFC2 Browser Edition Studio", set up like the Eaten By Kittens studio (Producer, Developer, Art Director, Narrative and Puzzle Designer, Audio and Rhythm Designer in one team chat). SFC2 needs more engineering depth, so there are seven bots, and Wintermute supports them on infrastructure.

| Role | Mission | Owns | Key deliverables | Hands off to |
| --- | --- | --- | --- | --- |
| Producer | Ship the whole game, one phase at a time | Roadmap, milestones, backlog, scope control, weekly status to Daniel, legal posture | Phase plans, exit-criteria reviews, release notes | Everyone |
| Engine Lead | Build a fast, deterministic engine | Architecture, three.js renderer, fixed-timestep sim core, WASM hot paths, Tauri shell, code review | Engine core, renderer, perf budgets, ADRs | Combat, UI, Netcode |
| Asset & Formats Engineer | Read every original file format, cleanly | Format specs, parsers (`shiplist`, `ftrlist`, `.mod`, BMP, `sounds.txt`, `sprites.q3`), importer, data pipeline | `/tools` parsers, format docs, asset importer, ship viewer data | Engine, Art, Audio, Missions |
| Combat Systems Designer | Make battles play like SFC2 | SFB rules: energy allocation, six shields, arcs, EW, overloads, hit-and-run, boarding, tractors, cloaks, mines, fighters and PFs; tactical AI | Rules spec, combat sim, AI captains, balance tests | Engine, Missions, QA |
| Mission & Campaign Designer | Bring back every campaign and the Conquest map | JS Mission API, porting Taldren's mission sources, campaign flow, Dynaverse-style map | Mission runtime, eight-plus campaigns, Conquest mode | Combat, Netcode, Audio |
| UI & Art Director | Make it look like SFC2, then better | Period-accurate HUD and menus, rendering look (self-illum, effects), HD upgrades, controller layouts | HUD, menus, shader and effects style guide | Engine, Formats |
| Audio & Netcode QA Lead | Make it sound right and stay in sync | Sound pipeline from `sounds.txt` and WAV, music, lockstep multiplayer, lobby, desync and regression testing | Audio system, lobby server, MP protocol, test suites | Engine, Missions, Producer |

> **Wintermute (infra).** Provides a Proxmox dev and CI VM, the Wine install that extracts assets, test and lobby servers, GitHub repo security (branch protection, secrets, Dependabot), and backups. Wintermute isn't a studio member that writes game code.

## Architecture

```
User's SFC2 install  →  Format parsers  →  Data model  →  Sim core  →  Renderer / UI / Audio  →  Web app and Tauri shell
(File System Access      (shiplist,          (ships,         (fixed timestep,
 API or archive import)   ftrlist, .mod,      weapons,        deterministic,
                          BMP, sounds.txt,    fighters,       WASM hot paths)
                          sprites.q3)         empires)

Mission runtime  ──events──►  Sim core
AI               ──orders──►  Sim core
Netcode          ──inputs──►  Sim core
```

- The sim core never reads the clock or random numbers directly: a seeded RNG and fixed ticks make it replayable and lockstep-ready from day one.
- Rendering, UI and audio only read sim state, so the same sim runs headless for AI training, tests and servers.
- Missions run as sandboxed JS against an API modelled on Taldren's Mission API, which also becomes the modding surface.

## Repository

| | |
| --- | --- |
| Where | Private GitHub repo `danielsegan/sfc2-browser-edition` |
| License | GPL-3.0 from the first commit; going public is a release-time decision |
| Plan | This plan is committed as `docs/plan.md` and kept current there |

```
sfc2-browser-edition/
├── docs/          plan.md, gdd.md, formats/ (one spec per file type), rules/ (SFB rules spec), adr/
├── engine/        sim core, renderer, mission runtime, AI, audio, netcode
├── tools/         parsers, extractors, asset inventory scripts
├── web/           browser app and HUD
├── desktop/       Tauri shell
├── server/        Cloudflare lobby and Conquest server
├── .github/       CI workflows, CODEOWNERS, PR template
├── LICENSE        GPL-3.0
└── .gitignore     blocks *.mod, *.bmp, *.wav, *.scr, *.q3, game folders and installers
```

> **Never commit original game files.** The `.gitignore` and a CI check both reject game assets. Tests use synthetic fixtures, and real-data tests run only on the private CI VM against the local install.

## Roadmap

Durations assume AI-assisted pace like the EaW project, with Daniel reviewing at each exit. Glenn reached a playable skirmish in about 3½ weeks; full parity is a much longer job.

| Phase | Goal | Exit criteria | Estimate |
| --- | --- | --- | --- |
| 0 Setup | Private repo, CI, legal posture, CE installed under Wine, asset inventory | Repo live with layout, CI green, asset-blocking check working, `docs/plan.md` committed, inventory of every file type | 1–2 weeks |
| 1 Asset pipeline | Parsers, importer, ship viewer | Every ship in `shiplist.txt` loads and spins with textures and self-illum | 2–4 weeks |
| 2 Tactical duel | One ship against one, core SFB rules | Energy, six shields, arcs, phasers and heavy weapons; deterministic replay passes | 4–6 weeks |
| 3 Full skirmish | All weapons and systems, fleets, AI, HUD, sound | Six-ship skirmish with every empire; EW, overloads, boarding, tractors, cloaks, mines, fighters, PFs | 8–12 weeks |
| 4 Missions | Mission runtime and the first campaign | One empire's campaign playable start to finish | 6–8 weeks |
| 5 All campaigns | Port the remaining campaigns | Every empire's campaign complete | 10–16 weeks |
| 6 Conquest | Dynaverse-style persistent map | Single-player Conquest with territory, economy and promotions | 8–12 weeks |
| 7 Multiplayer | Lockstep battles, lobby, shared Conquest server | Six-player match without desync; hosted persistent server on pve | 8–12 weeks |
| 8 Mods and polish | Mod loader, HD upgrades, controller, Tauri release | OP and EAW packs load; desktop builds; release review | 6–8 weeks |

> **Honest total.** About 13 to 20 months to full parity. Skirmish (Phases 0–3) is about 4 to 6 months and is the first point where it's genuinely fun to play.

## Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| IP and legal | High | Non-commercial, no assets shipped, private repo, clean-room rule, no SFC2-decomp code, a takedown plan before going public |
| SFB rule fidelity | High | Written rules spec in `/docs/rules`, side-by-side tests against the original running under Wine, community playtesters |
| Undocumented formats | Medium | Start from sfcmod and community docs, write a spec per format, fuzz the parsers |
| Mission porting | High | Mission API shim that mirrors Taldren's, port one campaign end to end before scaling |
| Determinism for multiplayer | High | Fixed timestep, seeded RNG, integer or WASM math in the sim, replay hash checks in CI from Phase 2 |
| Scope creep | High | Phase exit criteria, stretch work held until Phase 8, Producer owns the cut list |
| AI bots drifting | Medium | Short ADRs, CODEOWNERS review, CI as the gatekeeper |

## Open decisions for Daniel

These remain open. Do not treat any option below as decided until Daniel records a choice.

- **Project name.** Repo name `sfc2-browser-edition` is in use; a game title can come later.
- **Hosting tooling.** GitHub was chosen for the repo; Cursor Origin could still mirror it or host CI.
- **JavaScript or TypeScript.** EaW uses plain JS; TypeScript is recommended for a codebase this big written by several bots.
- **Game version.** Community Edition 2.670 (the installer in Dropbox) or 2.679 as the reference build.
- **Cursor cloud agents.** Whether studio bots hand coding tasks to cloud agents that open PRs against the repo.

### Next steps

1. **Approve the roster and plan.** Then the studio bots and group chat get created.
2. **Phase 0 kickoff.** Wintermute creates the private repo and CI VM and installs CE under Wine.
3. **Phase 1 begins.** Asset & Formats Engineer starts the parsers.
