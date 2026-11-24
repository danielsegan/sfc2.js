# File formats (Asset & Formats)

This folder holds one clean-room spec per original *Starfleet Command 2* file type that the engine reads from the **player's own install**. The Asset & Formats Engineer owns these specs and the parsers built from them.

**Reference build:** *Starfleet Command 2* **Community Edition 2.670** (the official CE installer; baseline decision: [#37](https://github.com/danielsegan/sfc2-browser-edition/issues/37)). Real-data claims stay marked *unverified* until a real-data job checks them against the CE 2.670 install on the private `sfc2-ci` runner. Every claim cites the public source it came from. Older builds (SFC1, Empires at War 2.036 and the unofficial 2.037, Orion Pirates, the unofficial CE 2.677–2.679 patches) appear only as version-difference notes. See [docs/LEGAL.md](../LEGAL.md) for the clean-room rule. We never consult the SFC2-decomp project or any other decompilation or disassembly.

## Format index

Status values: **spec draft** (written from public sources, unverified), **planned** (no spec yet), **verified** (checked against the CE 2.670 install on the private `sfc2-ci` runner), **parser** (parser merged with synthetic tests).

| Format | Files (typical install location, unverified) | Consumers | Issue | Spec | Parser | Verified vs CE 2.670 |
| --- | --- | --- | --- | --- | --- | --- |
| Ship list | `assets/specs/shiplist.txt` (copy in `metaassets/`) | Engine, Combat, Missions, UI, ship viewer | [#13](https://github.com/danielsegan/sfc2-browser-edition/issues/13) | [spec draft](shiplist.md) | [parser](../../tools/formats/shiplist.ts) | no |
| Fighter list | `assets/specs/ftrlist.txt` (copy in `metaassets/`) | Combat (fighters, PFs), UI | [#14](https://github.com/danielsegan/sfc2-browser-edition/issues/14) | [spec draft](ftrlist.md) | [parser](../../tools/formats/ftrlist.ts) | no |
| Models | `Assets/MODELS/<folder>/*.mod`, `*_brk.mod` (inventory spelling; case-insensitive) | Renderer, ship viewer | [#19](https://github.com/danielsegan/sfc2.js/issues/19) | [spec draft](mod.md) | [synthetic tests](../../tools/formats/src/mod.ts) | no |
| Textures + self-illumination | BMP files next to each model (`_<n>i` glow maps) | Renderer, UI & Art | [#15](https://github.com/danielsegan/sfc2.js/issues/15) | [spec draft](bmp.md) | synthetic tests | no |
| UI sprites | `assets/sprites/sprites.q3` | HUD, menus | — | planned | not started | no |
| Sounds | `sounds.txt` index + WAV files | Audio | [#35](https://github.com/danielsegan/sfc2-browser-edition/issues/35) | planned | not started | no |
| Strings | `assets/strings/strings.txt`, `aaStrings.txt`, `quicktips.txt`, `shipnames.txt` | UI, Missions (string keys) | — | planned | not started | no |
| Custom missions | FMSE `.fms` files (community-authored) | Missions (converter to our JSON schema) | — | planned (after Phase 1 formats) | not started | no |
| Our own mission files | JSON, schema owned by Mission & Campaign Designer | Missions | PR #1 | validated against Missions' schema | — | n/a (our format) |

File locations in the table come from community install guides: the [CE 2.679 patch thread](https://hotandspicyforums.com/sfc2-community-edition-patch-2-679-t18932.html) and the [SFC2CE HD patch thread](http://www.dynaverse.net/forum/index.php/topic,163394477.0.html) (CE `shiplist.txt` / `ftrlist.txt` in `MetaAssets`, campaign loads those copies), the [EaW 2.037 patch thread](https://hotandspicyforums.com/sfc2-empires-at-war-patch-2-037-t20068.html) (spec and string folders in EaW) and the [kontek mod-installation FAQ](https://archive.kontek.net/sfc.strategyplanet.gamespy.com/sfc1/faq_mod.shtml) (models, `assets/specs` and `metaassets` copies). All are unverified for CE 2.670.

## Parser conventions

Every parser in this project follows the same contract, so the importer, tests and fuzzers can treat them alike.

1. **TypeScript, pure functions.** A parser is a single exported function with no I/O, no globals, no clock and no randomness:
   ```ts
   // Shared shape (Engine Lead). The single registry is
   // docs/engine/diagnostics.md (merged in #55); do not invent a second list.
   export type DiagnosticSource =
     | 'shiplist' | 'ftrlist' | 'mod' | 'bmp' | 'sprites' | 'sounds' | 'strings' | 'fms'
     | 'loader'
     | 'rules'
     | 'mission'
     | 'importer';
     // add-only, like codes; 'loader' is the engine data loader, not a format parser.
     // 'importer' is the user-install index (engine/platform), not a format parser.
     // 'rules' is only for ruleResult reasons (docs/rules/reason-codes.md).
     // 'mission' is the mission host / mission-file importer.

   export interface DiagnosticLocation {
     file?: string;    // path relative to the player's install root, forward slashes, e.g. Specs/shiplist.txt; never an absolute or machine-local path
     line?: number;    // 1-based line (text formats)
     column?: number;  // 1-based field index (tab-delimited tables)
     field?: string;   // raw header name, when known
     offset?: number;  // byte offset (binary formats)
   }

   export interface Diagnostic {
     code: string;              // flat, stable camelCase, e.g. 'badNumber', 'unknownWeapon'
     source: DiagnosticSource;  // who emitted it, e.g. 'shiplist' or 'loader'
     severity: 'error' | 'warning' | 'info';
     details?: Record<string, unknown>; // structured context, e.g. { race, className, rows }
     location?: DiagnosticLocation;     // omit when not applicable (e.g. emptyFile)
   }

   export interface ParseResult<T> {
     data: T;               // best-effort result, never undefined
     diagnostics: Diagnostic[];
   }

   // Binary formats take bytes; text tables may take an already-decoded string.
   export function parseMod(bytes: ArrayBuffer): ParseResult<ModModel>;
   export function parseShiplist(input: ArrayBuffer | string): ParseResult<Shiplist>;
   ```
2. **Never throw on bad input.** Malformed, truncated or unexpected data becomes a diagnostic. The parser returns as much as it could read. Only programmer errors (wrong argument type) may throw.
3. **Plain floats in file units.** Parsers return numbers exactly as the file means them (game distance units, energy points, turns, years as the file encodes them). No unit conversion and no fixed-point. The Engine Lead's data-model layer converts to sim units and fixed-point for the deterministic core.
4. **Lossless where cheap.** Keep the raw string of any cell we could not interpret (`raw` / `extra` fields) so mods with extra columns survive a round trip and so we can diff against the real install later.
5. **Header-driven text tables.** For tab-delimited tables, parser output keys are the **raw file header names** as written. Fall back to documented column indices (`col<N>` keys) only when there is no header. Unknown columns are kept, not dropped. Renaming to the engine's camelCase model, scale factors (e.g. ×2) and compaction happen in the Engine Lead's loader, using tables in `docs/rules`.
6. **Text decoding.** Original text files are expected to be single-byte Windows text (ASCII / Windows-1252, CRLF line ends). This is unverified. Parsers accept `ArrayBuffer`, strip a UTF-8 BOM if present, decode as Windows-1252 without throwing, and accept LF, CRLF or CR line ends.
7. **Stable diagnostic codes (Engine Lead's convention).** The shared shape is exactly `{ code, source, severity, details?, location? }`. `code` is a flat camelCase string with no format prefix (e.g. `duplicateClassKey`, `unknownWeapon`); `source` names who emitted it (`"shiplist"`, `"ftrlist"`, `"loader"`, …). Codes are listed in each spec's validation section and shared across formats when the meaning is the same (`emptyFile`, `noHeader` …); `source` tells them apart. They are **add-only and never renamed**. The single registry is [`docs/engine/diagnostics.md`](../engine/diagnostics.md) (Engine Lead; merged in #55). Human-readable text is looked up as `source.code` (see `docs/ui/hud-spec.md` §14d); there is no `message` field. `location` is optional and minimal: a `file` path relative to the player's install root using forward slashes (e.g. `Specs/shiplist.txt`; never an absolute or machine-local path, so diagnostics don't expose the player's machine), a 1-based `line`, a 1-based field `column`, a raw header `field` name, and/or a byte `offset` for binary formats. `file` lets a diagnostic like `badNumber` say which spec table (`shiplist.txt` vs `ftrlist.txt`) it came from. Tests assert codes, not messages.

   Format parsers raise codes only for fields they can't read (empty or malformed), for example `emptyFile`, `noHeader`, `raggedRow` and `badNumber`, with `source: "shiplist"` or `"ftrlist"`. Vocabulary checks against the Combat mapping table in `docs/rules` — `unknownWeapon` and `unknownArc` — are loader diagnostics with `source: "loader"`. There is no `engine/data` module yet, so `parseShiplist` and `parseFtrlist` append those loader diagnostics to the same result. Pass `{ checkVocabulary: false }` to skip them. `location.file`, when set, is the install-relative path with forward slashes. `emptyFile` and `noHeader` omit `location`.
8. **Synthetic fixtures only.** In-repo fixtures are hand-written by us with invented names and values (e.g. `TEST-CA-01`). They live under `tools/fixtures/formats/` and are listed in [`tools/allowed-fixtures.txt`](../../tools/allowed-fixtures.txt). Nothing copied from an install, including single rows. Real-data tests run only on the private runner (`runs-on: [self-hosted, sfc2-ci]`) against its local install, and their outputs stay on that machine.

## Confidence labels used in the specs

| Label | Meaning |
| --- | --- |
| **documented** | Described for SFC2 (EaW, OP or CE) by a cited public source (manual, modding guide, forum post). Still not checked against our CE 2.670 install. |
| **unverified** | Inferred from a related public source (for example the SFC1 spec-file guide, or an Orion Pirates note) and expected to carry over, but no SFC2-family source confirms it. |
| **unknown** | No public source found. A proposal only; must be settled by observing the real install. |

Nothing in these specs is **verified** yet. A field moves to verified only after a real-data job on `sfc2-ci` confirms it, and the spec records which build was checked.
