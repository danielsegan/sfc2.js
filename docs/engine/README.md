# SFC2.js engine contracts (`docs/engine/`)

Status: **Draft, Engine Lead, Nov 23 2026.** Not yet reviewed. Supports [#21](https://github.com/danielsegan/sfc2.js/issues/21) (deterministic fixed-timestep sim core). Reference baseline: **SFC2 Community Edition 2.670**, per [#37](https://github.com/danielsegan/sfc2.js/issues/37) (no 2.679 patch).

Clean room: these docs are original design. Allowed references are listed in [`docs/LEGAL.md`](../LEGAL.md). No decompiled or disassembled code is consulted. No game data appears here, and every example name and value is made up. Weapon-code *spellings* listed in [data-loader.md](data-loader.md) are metadata-only names from the CE 2.670 inventory; no data rows are included.

## Index

| Doc | Owner | What it fixes |
| --- | --- | --- |
| [determinism.md](determinism.md) | Audio & Netcode QA Lead (co-owner: Engine Lead) | **The normative determinism contract** (T/R/N/S/C/H/V requirement IDs). The docs below cite it and don't restate it. On `main` via PR #53. |
| [sim-core.md](sim-core.md) | Engine Lead | Tick loop, math core (committed `FX_SHIFT = 16`), RNG streams, ECS and ids, phase order, command envelope, sessions, hashing and versioning, all as TypeScript shapes |
| [data-loader.md](data-loader.md) | Engine Lead | How `{data, diagnostics}` parser output becomes the immutable fixed-point `GameDatabase`: scale table, exact-case weapon matching, weapon compaction, spawn-key interning, build detection |
| [mission-host.md](mission-host.md) | Engine Lead (API surface: Mission & Campaign Designer) | Emit-only mission runtime host: commands on slot 255, token events, sandbox, operation budget, read-only queries |
| [hud-viewmodel.md](hud-viewmodel.md) | Engine Lead (HUD: UI & Art Director) | The per-frame read-only `ViewModel`, event list and render surfaces |
| [diagnostics.md](diagnostics.md) | Engine Lead | Shared diagnostic registry (`{ code, source, severity, details?, location? }`), including `duplicateClassName`, loader `unknownWeapon` / `unknownArc`, and mission `badMapBounds` |

Related specs, all on `main` @ `8492a39`: [`determinism.md`](determinism.md) (PR #53), [`docs/missions/mission-api.md`](../missions/mission-api.md) (PR #1, with #52), [`docs/formats/`](../formats/README.md) (PR #38, with #42 and #45), [`docs/ui/hud-spec.md`](../ui/hud-spec.md) (PR #39, with #44 and #51), and [`docs/rules/`](../rules/README.md) (PR #50).

## Module map

Top-level folders follow `docs/plan.md`. The sub-folders are an **Engine Lead proposal**. They become final only through the plan-updating PR for [#8](https://github.com/danielsegan/sfc2.js/issues/8).

```
engine/
  core/      fixed point (Fx), Angle16 + LUT trig, isqrt, RNG streams, xxHash32, command codec, ids. Zero deps, no DOM
  data/      data loader -> immutable GameDatabase (data-loader.md)
  sim/       ECS world, allocator, phase scheduler, command apply, snapshots, state hash (sim-core.md)
  combat/    SFB rule systems + rules scale table (Combat Systems Designer)
  ai/        AI captains -> commands on slots 8-15 (Combat Systems Designer)
  mission/   MissionHost + Taldren-shaped API shim + sandbox (mission-host.md; Mission & Campaign Designer)
  conquest/  Dynaverse-style map model, deterministic (Phase 6)
  view/      ViewModel builder (hud-viewmodel.md); read-only over snapshots
  render/    three.js renderer
  audio/     Web Audio engine (Audio & Netcode QA Lead)
  net/       LocalSession, LockstepSession, transports, desync reports (Audio & Netcode QA Lead)
  platform/  Vfs + Platform interfaces (browser FS Access / archive import, Tauri, Node on sfc2-ci)
  wasm/      AssemblyScript sources for hot paths
tools/
  formats/   parsers: pure, browser-safe, imported by web/ and by Node CLIs (Asset & Formats)
  fixtures/  synthetic fixture generators (test time)
  cli/       dump-*, inventory, replay runner, bench, Wine comparison harness
web/         Vite app: importer, ship viewer, HUD overlay canvas + HTML menus (UI & Art Director), composition root
desktop/     Tauri shell (release in Phase 8)
server/      Cloudflare lobby + Conquest server (Phase 7), headless sim
tests/       cross-package integration + synthetic determinism replay corpus
```

Dependency direction (enforced by lint, determinism.md B1): `engine/core ← tools/formats ← engine/data ← engine/sim ← {combat, ai, mission, conquest, net}`. `{view, render, audio, web}` read snapshots, events and data only. `web/`, `desktop/` and `server/` compose everything. **Sim packages** (`core, data, sim, combat, ai, mission, conquest`) import no DOM, three.js, timers, `Math.random` or float transcendentals.

## Toolchain

- **TypeScript strict, erasable syntax only** (`"erasableSyntaxOnly": true`, which rules out `enum`, `namespace`, parameter properties and `import =`). Node type stripping runs `.ts` directly, and Vite serves it unbuilt in dev. CI runs `tsc --noEmit`. Use `as const` objects in place of enums.
- **Branded numeric types** (`Fx`, `Angle16`, `EntityId`, `Tick`) turn float/fixed mixing into compile errors. ESLint (typescript-eslint) enforces the rest of determinism.md §9.2.
- **pnpm** workspaces, with one package per sub-folder above. The scope is `@sfc2js/*` (**proposal**, following the decided name SFC2.js).
- **Vite** for `web/`, **Vitest** for unit, golden and property tests in Node, and **Playwright** for the cross-browser replay (Chromium, Firefox and WebKit must produce identical hash sequences, determinism.md §9.5).
- **AssemblyScript** for WASM hot paths. `.wasm` is **built in CI and never committed**. `tools/check-no-game-files.sh` already rejects large binaries, and built bundles stay out of git. Every WASM port must match the TS hashes bit for bit (determinism.md H5).
- Real-data tests run only on the private `sfc2-ci` runner (`runs-on: [self-hosted, sfc2-ci]`), and their outputs stay there. In-repo tests use synthetic fixtures only.

## Deviations from `docs/plan.md` (for #8)

`plan.md` on `main` already records TypeScript, the SFC2.js name, the CE 2.670 baseline, Cursor cloud agents, and a `docs/engine/` folder (diagnostics registry). Remaining differences:

| plan.md says | These docs assume | Status |
| --- | --- | --- |
| AssemblyScript or Rust WASM; no package layout below top level | AssemblyScript; `engine/` sub-packages as above | **Open in #8** until the plan PR lands |
| Parsers live in `/tools` | `tools/formats/`, but browser-safe so `web/` can import them at runtime | Proposal (alternative: `engine/formats/`) |
| Diagram: "Mission runtime ──events──► Sim core" | Missions *emit commands* on slot 255. Events flow sim → mission | Agreed with QA Lead (determinism.md §10 Q3). plan.md wording to fix |

## Status of this folder

- `determinism.md` is on `main` (PR #53, still present at `8492a39`). It still names Empires at War 2.036+2.037 as the reference build (V3 and §0), which #37 superseded, and some of its links still use the old `sfc2-browser-edition` repo name. The QA Lead owns those fixes.
- [sim-core.md](sim-core.md) commits `FX_SHIFT = 16`, answering the position-scale question that determinism.md N1 / §10 Engine Q1 left open once map extents were known (±8,192 range units per axis).
- CE 2.670 (no 2.679 patch) is installed on `sfc2-ci`. The extracted set has no `.q3` or `.tga` files, so whether `sprites.q3` is present is **UNVERIFIED**.
- Everything marked **UNVERIFIED** depends on the CE 2.670 install on `sfc2-ci` (Phase 0 inventory, #4) or on Combat's rules spec (#24).
