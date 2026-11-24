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
  | 'mission'
  | 'importer';
  // add-only, like codes. 'loader' is the engine data loader, not a format parser.
  // 'rules' is only for ruleResult reasons (docs/rules/reason-codes.md).
  // 'mission' is the mission host / mission-file importer.
  // 'importer' is the user-install index (engine/platform), not a format parser.
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
- `location.file`, when set, is a path relative to the player's install root using forward slashes (for example `Assets/Specs/shiplist.txt` or `Specs/shiplist.txt`). It is never an absolute path, a drive letter, a UNC path, or any other machine-local path.

## Registry

| Source | Code | Severity | Owner | Details / effect |
| --- | --- | --- | --- | --- |
| shiplist, loader | `duplicateClassKey` | error | Formats / Engine | `{ race, className, rows[] }`; first row wins, MP refused |
| shiplist, loader | `duplicateClassName` | warning | Formats / Engine | `{ className, races[], rows[] }`; MP allowed |
| loader | `unknownWeapon` | warning | Engine | `{ spawnKey, slotIndex, code }` |
| loader | `unknownArc` | warning | Engine | `{ spawnKey, slotIndex, code }` |
| loader | `missingScaleEntry` | error | Engine | `{ field }` |
| loader | `fixedPointSaturated` | warning | Engine | `{ spawnKey, field, raw }` |
| loader | `buildUnknown` | warning | Engine | `{}`. Neither exe was found while loading the database |
| importer | `buildUnknown` | warning | Formats | `{}`. Same code as the loader, emitted when the install index finds neither exe. The executable bytes are not read |
| importer | `installNotRecognized` | error | Formats | `{ fileCount }`. The picked folder has neither an exe nor a shiplist |
| importer | `missingShiplist` | error | Formats | `{ expected }`. Root found, shiplist absent. `location.file` is the expected install-relative path |
| importer | `missingModels` | warning | Formats | `{}`. No `.mod` files in the index |
| importer | `noTextures` | warning | Formats | `{}`. No `.bmp` files in the index |
| importer | `multipleInstalls` | error | Formats | `{ count, roots[] }`. Two install roots at the same depth. `roots` are install-relative |
| importer | `pathRejected` | error | Formats | `{ reason, count }`. Absolute path, `..`, or another unsafe path. The rejected path is not stored |
| importer | `caseConflict` | warning | Formats | `{ path, other }`. Two paths differ only by case; the first wins |
| importer | `archiveUnsupported` | error | Formats | `{ reason, method? }`. Zip is missing, ZIP64, encrypted, compressed with an unknown method, corrupt, or over the size cap |
| importer | `permissionDenied` | error | Formats | A listed file could not be read. The underlying message is not copied |
| shiplist | `specsMetaassetsDiffer` | warning | Formats | `{ assets, metaassets }`. The importer emits this when the two shiplist copies differ |
| bmp | `emptyFile` | error | Formats | Zero-byte BMP |
| bmp | `badSignature` | error | Formats | First bytes are not `BM` |
| bmp | `truncated` | error | Formats | `{ width?, height?, expectedBytes? }`. Header or pixels are short; no partial texture is allocated |
| bmp | `unsupportedHeader` | error | Formats | `{ infoHeaderSize, planes? }` |
| bmp | `unsupportedBitDepth` | error | Formats | `{ bitCount }` |
| bmp | `unsupportedCompression` | error | Formats | `{ compression, compressionName? }` |
| bmp | `badDimensions` | error | Formats | `{ width, height }` |
| bmp | `badPalette` | error | Formats | `{ paletteCount }` |
| bmp | `paletteIndexOutOfRange` | warning | Formats | `{ count }`. Pixel uses palette entry 0 |
| bmp | `nonPowerOfTwo` | info | Formats | `{ width, height }`. The image is still loaded |
| bmp | `orphanSelfIllum` | warning | Formats | `{ illumPath }`. A `_<token>i` file with no base in the same directory |
| bmp | `missingTexture` | error | Formats | `{ path }`. Requested install-relative path is not in the VFS |
| bmp | `selfIllumSizeMismatch` | info | Formats | `{ baseWidth, baseHeight, illumWidth, illumHeight }`. Both maps are kept and sampled by UV |
| mission | `badMapBounds` | error | Engine | axis not a whole number, or outside ±8,192 range units; `location.field` names the offending value (sim-core.md §2; merged PR #52) |
| rules | `noSuchSystem` | (ruleResult reason) | Combat | example from Combat; full list to be added by Combat |

The loader emits `unknownWeapon` and `unknownArc` with `source: "loader"` (not the format parser). One problem has one code; there are no separate `...Code` variants.

### Parser codes (verified against `main` @ `8492a39`; originating in PR #42, shape aligned in #45)

Sources (add-only): `shiplist`, `ftrlist`, `mod`, `bmp`, `sprites`, `sounds`, `strings`, `fms`. Severity and details per `docs/formats`.

Codes shared by shiplist and ftrlist: `emptyFile`, `raggedRow`, `noHeader`, `multipleHeaderRows`, `badNumber`, `unknownRace`, `yearOrder`, `specsMetaassetsDiffer`.

Shiplist-specific: `duplicateClassKey`, `duplicateClassName`, `crewTotalMismatch`, `shieldTotalMismatch`, `hardpointCountRange`, `missingGeometry`, `missingRefitBase`, `unknownHullType`, `unknownTurnMode`.

Ftrlist-specific: `duplicateFighterType`, `missingShipRef`.

`unknownWeapon` and `unknownArc` are **not** parser codes. Format parsers keep the exact file strings; the loader checks them against Combat's mapping table and emits those codes with `source: "loader"`.
