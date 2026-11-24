# Diagnostics and reason-code registry

Status: Draft, Engine Lead, Nov 23 2026. Refs #21, #37.

One registry for every code the engine and its data layer emit: parser diagnostics, loader diagnostics, rules `ruleResult` reasons and mission-host errors.

## Shape

```ts
type Severity = 'error' | 'warning' | 'info';
type DiagnosticSource =
  | 'shiplist' | 'ftrlist' | 'mod' | 'bmp' | 'sprites' | 'sounds' | 'strings' | 'fms'
  | 'loader'
  | 'rules'
  | 'mission';
  // add-only, like codes. 'loader' is the engine data loader, not a format parser.
  // 'rules' is only for ruleResult reasons (docs/rules/reason-codes.md).
  // 'mission' is the mission host / mission-file importer.
interface Diagnostic {
  code: string;                   // stable camelCase
  source: DiagnosticSource;       // plain string
  severity: Severity;
  details?: Record<string, unknown>;
  location?: { file?: string; line?: number; column?: number; field?: string; offset?: number }; // line/column 1-based; field = raw header name; offset = byte offset
}
```

## Rules

- Codes are stable camelCase. Add or deprecate, never rename or reuse.
- Codes must be unique within a source; the same code may appear under two sources.
- Locale key is `source.code` (e.g. `rules.noSuchSystem`, `shiplist.duplicateClassKey`), per the HUD spec.
- No message text: display text comes from the locale key `source.code` (matches PR #45). Tests assert `source` + `code`.
- Each owning role adds its codes here in the same PR that first emits them: Asset & Formats (parser sources), Engine Lead (`loader`, `mission` host), Combat (`rules`).

## Registry

| Source | Code | Severity | Owner | Details / effect |
| --- | --- | --- | --- | --- |
| shiplist, loader | `duplicateClassKey` | error | Formats / Engine | `{ race, className, rows[] }`; first row wins, MP refused |
| shiplist, loader | `duplicateClassName` | warning | Formats / Engine | `{ className, races[], rows[] }`; MP allowed |
| loader | `unknownWeapon` | warning | Engine | `{ spawnKey, slotIndex, code }` |
| loader | `unknownArc` | warning | Engine | `{ spawnKey, slotIndex, code }` |
| loader | `missingScaleEntry` | error | Engine | `{ field }` |
| loader | `fixedPointSaturated` | warning | Engine | `{ spawnKey, field, raw }` |
| loader | `buildUnknown` | warning | Engine | `{}` |
| mission | `badMapBounds` | error | Engine | axis not a whole number, or outside ±8,192 range units; `location.field` names the offending value (sim-core.md §2; merged PR #52) |
| rules | `noSuchSystem` | (ruleResult reason) | Combat | example from Combat; full list to be added by Combat |

The loader emits `unknownWeapon` and `unknownArc` with `source: "loader"` (not the format parser). One problem has one code; there are no separate `...Code` variants.

### Parser codes (verified against `main` @ `8492a39`; originating in PR #42, shape aligned in #45)

Sources (add-only): `shiplist`, `ftrlist`, `mod`, `bmp`, `sprites`, `sounds`, `strings`, `fms`. Severity and details per `docs/formats`.

Codes shared by shiplist and ftrlist: `emptyFile`, `raggedRow`, `noHeader`, `multipleHeaderRows`, `badNumber`, `unknownRace`, `yearOrder`, `specsMetaassetsDiffer`.

Shiplist-specific: `duplicateClassKey`, `duplicateClassName`, `crewTotalMismatch`, `shieldTotalMismatch`, `hardpointCountRange`, `missingGeometry`, `missingRefitBase`, `unknownHullType`, `unknownTurnMode`.

Ftrlist-specific: `duplicateFighterType`, `missingShipRef`.

`unknownWeapon` and `unknownArc` are **not** parser codes. Format parsers keep the exact file strings. They currently append the vocabulary check onto the same result, still with `source: "loader"`, because `engine/data` is not in the repo yet. The loader remains the owner of those codes.
