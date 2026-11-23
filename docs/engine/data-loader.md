# Data loader contract

Status: **Draft, Engine Lead, Nov 23 2026.** Supports [#21](https://github.com/danielsegan/sfc2.js/issues/21) and consumes [#13](https://github.com/danielsegan/sfc2.js/issues/13)/[#14](https://github.com/danielsegan/sfc2.js/issues/14) parser output. Baseline **CE 2.670** per [#37](https://github.com/danielsegan/sfc2.js/issues/37) (no 2.679 patch). Package: `engine/data`.

CE 2.670 is now installed on `sfc2-ci`. **No field below counts as verified** until the Formats checklist in PR #38's follow-up is ticked. The extracted set has **no `.q3` or `.tga` files**, so whether `sprites.q3` is present at all is **UNVERIFIED**.

## 1. Pipeline

```
Vfs (player install) → tools/formats parsers → { data, diagnostics } (raw, file units, float-friendly)
                     → engine/data loader → GameDatabase (immutable, integer/fixed-point, interned ids) + LoadReport
                     → engine/sim (reads only GameDatabase)
```

- **The importer** reads `Specs/shiplist.txt` (the `Assets/Specs` copy of the ship list). Which copy campaign mode uses is still as in §6.
- **Parsers** (Asset & Formats, `docs/formats/README.md`) are pure and never throw. They return `{ data, diagnostics }` with values exactly as the file has them (raw shields, all 25 hardpoint slots, unknown columns in `extra`, raw cells in `raw`).
- **The loader** is the only place where file data becomes sim data. It runs once per session, on the same input on every peer, and is deterministic: no `parseFloat`, no locale functions, no Map/object iteration order [determinism.md N6, N8].

## 2. Interfaces

```ts
type Severity = 'error' | 'warning' | 'info';
interface Diagnostic {
  code: DiagnosticCode;          // stable camelCase, see diagnostics.md
  source: DiagnosticSource;      // 'shiplist' | 'ftrlist' | 'loader' | 'rules' | 'mission' | ...
  severity: Severity;
  location?: { file?: string; line?: number; column?: number; field?: string; offset?: number }; // line/column 1-based; field = raw header name; offset = byte offset
  details?: Record<string, unknown>;
}
interface ParseResult<T> { data: T; diagnostics: Diagnostic[] }

interface LoadInput { build: BuildInfo; shiplist: ParseResult<Shiplist>; ftrlist: ParseResult<Ftrlist>; rules: RulesScaleTable }
interface LoadReport { diagnostics: Diagnostic[]; mpAllowed: boolean; dataHash: number }
function loadGameDatabase(input: LoadInput): { db: GameDatabase; report: LoadReport };

interface GameDatabase {
  readonly build: BuildInfo;
  readonly classes: readonly ShipClass[];           // index = ClassId
  readonly classIdByKey: (spawnKey: string) => ClassId | undefined;
  readonly fighters: readonly FighterType[];        // index = FighterTypeId
  readonly dataHash: number;                        // §6
}
```

## 3. Conversion to sim units

- **Fixed point from raw text.** Any value that enters the sim is converted from the parser's **raw decimal string** (the `raw` cell) by integer parsing, never through a float (`"1.25"` → `125 × 2^F / 100`, floored). The parser's float field is for tools and the ship viewer only. Doing it this way meets determinism N8, even though parsers return floats.
- **Column scales.** Move Cost is stored in hundredths. BPV uses its per-column scale. Overflow of the column scale is `badNumber`.
- **Rules scale table.** The loader applies Combat's single scale table from `docs/rules/` while it converts. Today that means **shield ×2 and side-warp ×2** (**UNVERIFIED**, S1 lineage, Combat to confirm against the CE manual). The parser never doubles anything. A later correction to the table changes only `dataHash`.

```ts
interface RulesScaleTable { readonly [field: string]: { mul: number; div: number } } // integers only; owned by Combat
```

## 4. Engine ship model

Naming follows the Combat Systems Designer (Nov 23):

```ts
interface ShipClass {
  id: ClassId; spawnKey: string; race: string; className: string; hullType: string;
  class: 'ship' | 'pf' | 'base' | 'other';         // PFs: full ship model, class 'pf'
  power:    { warp: Fx; impulse: Fx; apr: Fx; battery: Fx };   // box counts / capacity
  movement: { moveCost: Fx; turnMode: string };
  shields:  readonly [Fx, Fx, Fx, Fx, Fx, Fx];     // index 0 = front, clockwise (SFB #1–#6 in prose only)
  systems:  Readonly<Record<SystemKey, number>>;   // flat box counts: hull, sensors, scanners, damageControl, lab, ...
  crew:     { crewUnits: number; boardingParties: number };
  weapons:  readonly WeaponMount[];                // compact, see below
  fighterBays: readonly { count: number; fighterType?: FighterTypeId }[];
  art: { geometry: string | null; uiKey: string | null };      // UI & Art; UNVERIFIED columns
}
interface WeaponMount { slotIndex: number /* 0..24, original slot */; weapon: string /* exact CE code */; arc: string /* CE code, or unused when reloads is set */; count: number; reloads?: number /* reload-counted weapons only */ }
```

- **Shields:** the raw file has four values (front, frontSides, rearSides, rear) per `docs/formats/shiplist.md` §4.4. The loader expands them to `[front, frontSides, rearSides, rear, rearSides, frontSides]` before scaling (**UNVERIFIED** mirror mapping, S1).
- **Slot layout.** Shiplist hardpoints are **Num / Weapon / Arc** triplets. **Heavy Weapon 1–10** are slots 1–10 (`slotIndex` 0–9). **Weapon 11–25** are slots 11–25 (`slotIndex` 10–24). The 25 raw slots are **compacted to a list of non-empty mounts, each keeping its `slotIndex`**.
- **Phasers are identified by weapon code, not by slot.** A `Ph*` mount is a phaser in any slot, including a heavy slot, and every phaser feeds the phaser capacitor. The old S1 “slots 11–25 only” capacitor hypothesis is not a loader rule.
- **Weapon codes** are matched against Combat's mapping table in `docs/rules` **exactly, including case**. The table lists each distinct `Pla*` spelling as its own entry, all pointing at the same weapon. The loader never folds case. A code that is not in the table, including a new spelling from a mod, is kept on the mount and yields `unknownWeapon` (`source: "loader"`).
- **CE 2.670 `Pla*` spellings** (names only, no row counts; metadata from the inventory): `PlaD`, `PlaF`, `PlaG`, `PlaI`, `PlaR`, `PlaS`, `PLaF`, `PLaG`, `PLaR`, `PLaS`. There are exactly these ten. Combat's table must include each one.
- **Arc cells are interpreted according to the weapon in that slot.** If Combat's mapping table marks the weapon as reload-counted (drone racks), a whole number in the Arc cell is the reload count and is stored in `reloads`, not as an arc. For any other weapon, a numeric Arc cell is `unknownArc` (`source: "loader"`).
- **Fighters** are a lighter entity type (speed, turn mode, damage points, weapons with arc/load/reload, ECM if present, bay and rearm data). `ftrlist.txt` is mostly **unknown** (12 of its 14 fields), and whether fighters need a matching `FTR` shiplist row is open (`docs/formats/ftrlist.md` §2).
- **PFs** use the full ship model with `class: 'pf'`. Where PF rows live (probably `shiplist.txt`) is **UNVERIFIED**.

## 5. Spawn keys → class ids

- Spawn key = `${race}:${className}` as built by the parser (`docs/formats/shiplist.md` §4.11). Missions, saves, the lobby and `requestSpawn` use the string.
- The loader **interns** keys to dense integer `ClassId`s: it normalizes each key (ASCII-lowercase, since keys are case-insensitive), sorts by **code-unit order** (`<` on strings, never `localeCompare`), and assigns 0..n-1. Every peer with the same data gets the same ids. The sim, snapshots and replays store only `ClassId`.
- **Duplicate keys:** a `duplicateClassKey` diagnostic (§7, severity `error`). Lookup resolves to the first row in file order, matching the parser. `report.mpAllowed = false`, so **multiplayer is refused** with that data. Single player may continue, with the diagnostic shown in the load report.
- Whether keys are unique in the stock CE shiplist is **UNVERIFIED** (Formats checklist).

## 6. Build detection and dataHash

```ts
interface BuildInfo { exe: 'Starfleet2CE.exe' | 'Starfleet2.exe' | 'unknown'; detectedVersion?: string }
```

- Detection checks for **`Starfleet2CE.exe`** (CE lineage) or **`Starfleet2.exe`** (EAW lineage) in the install root (case-insensitive Vfs). The loader records the result and never branches rules on it. Build differences live in data or in `docs/rules/` flags. The exe is only *detected*, never read beyond presence, and never stored.
- `dataHash` = xxHash32 over the canonical serialization of the converted `GameDatabase` (classes in ClassId order, fighters in id order, fields as LE int32, strings as UTF-8 with length prefix). A modded shiplist changes it, and it feeds `versionHash` (sim-core.md §8, determinism.md V1).
- Which copy each mode reads (`assets/specs` vs `MetaAssets`) is **UNVERIFIED**. If the copies differ, the loader uses the copy for the selected mode and reports it.

## 7. Diagnostic codes

- Codes are **stable camelCase strings**. New codes may be **added**, and old ones **deprecated** (kept recognised and documented). A code is **never renamed or reused**. Tests assert codes, not messages.
- All sources (parsers, loader, rules `ruleResult` reasons, mission host) share one registry, documented in `docs/engine/diagnostics.md`. Codes are unique within a source; locale keys are `source.code` (e.g. `rules.noSuchSystem`). The loader's own codes are listed below.

| Code | Severity | Emitted by | Details |
| --- | --- | --- | --- |
| `duplicateClassKey` | error | parser + loader | `{ race: string; className: string; rows: number[] }` (1-based file lines). Effect: first row wins and MP is refused |
| `duplicateClassName` | warning | parser + loader | `{ className: string; races: string[]; rows: number[] }`. Same class name under different races; informational, MP allowed |
| `unknownWeapon` | warning | loader (`source: "loader"`) | `{ spawnKey, slotIndex, code }`. The mount is kept but inert until Combat maps the code |
| `unknownArc` | warning | loader (`source: "loader"`) | `{ spawnKey, slotIndex, code }` |
| `missingScaleEntry` | error | loader | `{ field }`. The rules table lacks a field the loader must scale |
| `fixedPointSaturated` | warning | loader | `{ spawnKey, field, raw }` |
| `buildUnknown` | warning | loader | `{}`. Neither exe was found |

`badNumber` is a parser code (overflow or an unparsable numeric cell). `badMapBounds` is a mission-host code (`source: "mission"`); see [diagnostics.md](diagnostics.md).

## 8. Unverified / open

- Real CE headers, column count, encoding and which copy each mode reads (Formats checklist on `sfc2-ci`).
- The shield mirror mapping and the ×2 factors (Combat + real data).
- Fighter/PF row placement. `sprites.q3` presence (not in the extracted set).

## Deviations from plan.md (#8)

- plan.md lists a "Data model" stage without saying who owns it. Here the Engine Lead owns `engine/data`, and the parsers stay in `tools/formats` (browser-safe) per the plan's Formats ownership. The parser location (`tools/` vs `engine/formats`) is still a proposal.
- **Cross-doc alignment:** PR #42 moves `docs/formats/` to these camelCase codes (`duplicateClassKey`, `duplicateClassName`), replacing the `<format>/<kebab-case>` codes merged in #38. The originating format goes in `Diagnostic.source`.
