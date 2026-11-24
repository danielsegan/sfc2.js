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
  location?: { file?: string; line?: number; column?: number; field?: string; offset?: number }; // file is install-root-relative with forward slashes, never a machine-local path; line/column 1-based; field = raw header name; offset = byte offset
}
```

`location.file`, when set, is a path relative to the player's install root, using forward slashes (for example `Specs/shiplist.txt`). It is never an absolute or machine-local path, so diagnostics never expose the player's machine. This matches [`docs/formats/README.md`](../formats/README.md) (#65).

## Rules

- Codes are stable camelCase. Add or deprecate, never rename or reuse.
- Codes must be unique within a source; the same code may appear under two sources.
- Locale key is `source.code` (e.g. `rules.noSuchSystem`, `shiplist.duplicateClassKey`), per the HUD spec.
- No message text: display text comes from the locale key `source.code` (matches PR #45). Tests assert `source` + `code`.
- Each owning role adds its codes here in the same PR that first emits them: Asset & Formats (parser sources), Engine Lead (`loader`, `mission` host), Combat (`rules`).
- `location.file`, when set, is a path relative to the player's install root using forward slashes (for example `Assets/Specs/shiplist.txt` or `Specs/shiplist.txt`). It is never an absolute path, a drive letter, a UNC path, or any other machine-local path. This matches `docs/formats/README.md` (#65).

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
| loader | `missingModel` | error | Engine | `{ spawnKey }`. The shiplist geometry path is not in the install index. `location.file` is that install-relative path |
| loader | `noHullModel` | warning | Engine | `{ spawnKey, hullType, race }`. A neutral `CY`, `CR`, or `CW` hull has no model. The viewer shows a placeholder and keeps the row. `location.file` is the shiplist |
| loader | `noDrawableMesh` | warning | Engine | `{ spawnKey }`. The model parsed and produced no triangles, so the viewer lists the row and continues. `location.file` is the model |
| loader | `shipLoadFailed` | error | Engine | `{ spawnKey }`. One row threw while loading. The exception text is not copied. The viewer continues with the next row |
| loader | `geometryColumnMissing` | error | Engine | `{ columns }`. The shiplist header has no column that binds to `geometry`. Each row is still listed. `location.file` is the shiplist |
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
| mod | `emptyFile` | error | Formats | Zero-byte `.mod`. No `location` |
| mod | `fileTooLarge` | error | Formats | `{ size, limit }`. Over 8 MiB; nothing is parsed |
| mod | `badSignature` | error | Formats | The first four bytes are not a printable chunk id |
| mod | `truncated` | error | Formats | `{ size?, expected? }`. Header, payload, or vertex block is short; bytes already read are kept |
| mod | `missingHeader` | error | Formats | No `MDLS` chunk |
| mod | `badCount` | error | Formats | `{ field, value }`. Negative, or over the ceiling (65,536 vertices or faces, 8 LODs, 256 materials, 4,096 points) |
| mod | `unknownChunk` | warning | Formats | `{ type, size }`. Skipped. Also listed on `unknownChunks` |
| mod | `duplicateChunk` | warning | Formats | `{ type }`. The first `STRS`, `MATS`, `PNTS`, `MDLS`, or `VTXS` wins |
| mod | `raggedChunk` | warning | Formats | `{ type }`. `PNTS` or `MATS` did not end on a record boundary |
| mod | `lodCountRange` | warning | Formats | `{ declared }`. `totalLODs` outside 1..5 |
| mod | `lodCountMismatch` | warning | Formats | `{ declared, meshes }`. `MOD0` count differs from `totalLODs` |
| mod | `faceCountMismatch` | warning | Formats | `{ declared, read, lod }` |
| mod | `faceVertexCount` | warning | Formats | `{ count, min, max }`. A face whose corner count is not 3. Stored, not drawn |
| mod | `vertexIndexOutOfRange` | warning | Formats | `{ count }` |
| mod | `materialIndexOutOfRange` | warning | Formats | `{ count }` |
| mod | `badStringOffset` | warning | Formats | `{ count }`. Name offset outside the string pool, or no NUL |
| mod | `missingTextureName` | warning | Formats | `{ which }`. `diffuse` or `luminance` flag set and the resolved name is empty |
| mod | `badNumber` | warning | Formats | `{ count }`. Non-finite floats are kept; the mesh builder writes 0 |
| mod | `orphanChunk` | warning | Formats | `{ type }`. `VTXS` or `POLY` outside a `MOD0` |
| mod | `modelPathRejected` | warning | Formats | The `.mod` path is not install-relative. The path is omitted |
| mod | `textureNameRejected` | warning | Formats | `{ reason: 'texture-name' }`. The pool string is not a single basename. The name is omitted |
| mod | `lodOutOfRange` | warning | Formats | `{ requested, lods }` |
| sounds | `emptyFile` | error | Formats | Zero-byte or whitespace-only index. No `location` |
| sounds | `badNumber` | warning | Formats | `{ value? }`. A numeric column is not a plain decimal. `location.field` names the column |
| sounds | `missingFilename` | warning | Formats | `{ identifier? }`. A sound row has an empty filename |
| sounds | `pathRejected` | warning | Formats | `{ reason: 'filename' }`. The filename is not install-relative. The path is omitted |
| sounds | `unknownPreempt` | warning | Formats | `{ value? }`. The preempt word is not Never, Higher Only, or Lower Only. The class is kept as `any` |
| sounds | `duplicateClassId` | warning | Formats | `{ id }` |
| sounds | `duplicateIndex` | warning | Formats | `{ index }`. Same index and the same load threshold. A different threshold is allowed |
| mission | `badMapBounds` | error | Engine | axis not a whole number, or outside ±8,192 range units; `location.field` names the offending value (sim-core.md §2; merged PR #52) |
| rules | `ok` | info | Combat | `ruleResult` applied. Not logged as a warning |
| rules | `noSuchShip` | warning | Combat | Spawn id is not a live ship |
| rules | `shipDestroyed` | warning | Combat | The ship is already destroyed |
| rules | `notAShip` | warning | Combat | Fighter. Duel commands accept ship and pf |
| rules | `negativeValue` | warning | Combat | A numeric input is negative |
| rules | `badFacing` | warning | Combat | Shield index outside 0..5 |
| rules | `unknownDraw` | warning | Combat | Allocation names a draw this slice does not recognise |
| rules | `unknownWeaponSlot` | warning | Combat | `slotIndex` is not a mount |
| rules | `notInDuelSlice` | warning | Combat | Weapon or mode is outside the Phase 2 duel |
| rules | `notCharged` | warning | Combat | Mount has not finished charging or arming |
| rules | `noFireControl` | warning | Combat | Fire control was not paid |
| rules | `outOfArc` | warning | Combat | Target bearing is outside the mount arc |
| rules | `outOfRange` | warning | Combat | Target is beyond the weapon's last range |
| rules | `weaponDestroyed` | warning | Combat | Mount has no boxes left |
| rules | `turnModeUnverified` | warning | Combat | Turn letter has no playtest rate. Once at spawn; movement uses the fallback yaw |
| rules | `crewDisabled` | warning | Combat | Crew is below the minimum |
| rules | `overDraw` | warning | Combat | Generation plus battery could not pay the plan |
| rules | `speedClamped` | warning | Combat | Speed was reduced to the acceleration limit |
| rules | `immobile` | warning | Combat | Hull cannot move; ordered speed became 0 |
| rules | `shieldAboveMax` | warning | Combat | `setShields` was clamped to the facing maximum |
| rules | `shieldDepleted` | warning | Combat | `damageShield` stopped at zero on that facing |
| rules | `chargeCapped` | warning | Combat | Weapon request was cut to what the mount can store |
| rules | `reinforceCapped` | warning | Combat | Reinforcement was cut by the per-turn cap or shield room |

The loader emits `unknownWeapon` and `unknownArc` with `source: "loader"` (not the format parser). One problem has one code; there are no separate `...Code` variants.

### Parser codes (verified against `main` @ `8492a39`; originating in PR #42, shape aligned in #45)

Sources (add-only): `shiplist`, `ftrlist`, `mod`, `bmp`, `sprites`, `sounds`, `strings`, `fms`. Severity and details per `docs/formats`.

Codes shared by shiplist and ftrlist: `emptyFile`, `raggedRow`, `noHeader`, `multipleHeaderRows`, `badNumber`, `unknownRace`, `yearOrder`, `specsMetaassetsDiffer`.

Shiplist-specific: `duplicateClassKey`, `duplicateClassName`, `crewTotalMismatch`, `shieldTotalMismatch`, `hardpointCountRange`, `missingGeometry`, `missingRefitBase`, `unknownHullType`, `unknownTurnMode`.

Ftrlist-specific: `duplicateFighterType`, `missingShipRef`.

Sounds-specific (spec in `docs/formats/sounds.md`): `emptyFile`, `badNumber`, `missingFilename`, `pathRejected`, `unknownPreempt`, `duplicateClassId`, `duplicateIndex`.

Mod-specific (spec in `docs/formats/mod.md`): `emptyFile`, `fileTooLarge`, `badSignature`, `truncated`, `missingHeader`, `badCount`, `unknownChunk`, `duplicateChunk`, `raggedChunk`, `lodCountRange`, `lodCountMismatch`, `faceCountMismatch`, `faceVertexCount`, `vertexIndexOutOfRange`, `materialIndexOutOfRange`, `badStringOffset`, `missingTextureName`, `badNumber`, `orphanChunk`, `modelPathRejected`, `textureNameRejected`, `lodOutOfRange`. Layout fields the public reader stores but does not interpret stay in the data and are not given a code.

`unknownWeapon` and `unknownArc` are **not** parser codes. Format parsers keep the exact file strings. They currently append the vocabulary check onto the same result, still with `source: "loader"`, because `engine/data` is not in the repo yet. The loader remains the owner of those codes.
