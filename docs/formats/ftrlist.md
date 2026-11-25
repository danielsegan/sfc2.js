# `ftrlist.txt`: fighter (and related craft) specification table

Issue: [#14](https://github.com/danielsegan/sfc2-browser-edition/issues/14) · Milestone: Phase 1: Asset pipeline · Owner: Asset & Formats Engineer
Status: **spec draft, mostly unknown.** Reference build is **SFC2 Community Edition 2.670** ([#37](https://github.com/danielsegan/sfc2-browser-edition/issues/37)). Every statement about real files is *unverified* until a real-data job on the private `sfc2-ci` runner checks it against the CE 2.670 install.

> Clean-room note. Written only from the public sources cited below and our own design choices. No SFC2-decomp or other decompiled material was used. No real fighter rows are reproduced. All examples are invented (`TEST-FTR-01` etc.).

Public documentation of this file is thin, and much thinner than for `shiplist.txt`. This spec is mostly a **proposal plus a list of questions** to answer by observing CE 2.670. That is deliberate: we would rather ship honest unknowns than guesses that look authoritative.

## 1. Sources

| ID | Source | What it tells us | Applies to |
| --- | --- | --- | --- |
| F1 | [SFC2: Empires At War, Patch 2.037 (Hot & Spicy Forums)](https://hotandspicyforums.com/sfc2-empires-at-war-patch-2-037-t20068.html) | `ftrlist.txt` sits in `assets\specs` next to `shiplist.txt`. | EaW 2.037 |
| F2 | [SFC2CE HD Patch thread (dynaverse.net)](http://www.dynaverse.net/forum/index.php/topic,163394477.0.html) | CE campaign loads `shiplist.txt` and `ftrlist.txt` from `MetaAssets`. | CE |
| F3 | [SFC2: Community Edition, Patch 2.679 (Hot & Spicy Forums)](https://hotandspicyforums.com/sfc2-community-edition-patch-2-679-t18932.html) | Tells players to back up `ftrlist.txt` before patching CE; the patch file list does not say it changes `ftrlist.txt`. | CE 2.679 |
| F4 | [SFC-related files list (klingon.lostexiles.net)](https://klingon.lostexiles.net/mediawiki/index.php?title=SFC-related_missions%2C_sources%2C_patches_and_misc_utilities) | EaW 2.036 `ftrlist.txt` is about 12 KB; OP builds about 20 KB. So: tens of rows, not hundreds. | EaW, OP |
| F5 | [OP+ Contents and Changes (klingon.lostexiles.net)](https://klingon.lostexiles.net/mediawiki/index.php?title=OP%2B_Contents_and_Changes) | Fighter rows carry an availability year (the mod set them to 999, i.e. never retired, and made a separate list for phase-out). PF phase-out is set in `shiplist.txt`, not here. | OP+ mod |
| F6 | jose614, [JRs Refit docs (Nexus Mods)](https://www.nexusmods.com/startrekstarfleetcommandorionpirates/mods/1?tab=docs) | ShipEdit can load and re-save `ftrlist.txt`, so it is a ShipEdit-compatible text table like the ship list. | OP |
| F7 | Pestalence_XC, [OP Enhancement Package v5.1 (dynaverse.net)](http://www.dynaverse.net/forum/index.php/topic,163378640.0.html) | `Assets\Specs` and `MetaAssets` copies of `ftrlist.txt` must match; servers check spec file sizes. | OP |
| S1 | MtZuul, [Ship Modding in Starfleet Command (Steam guide)](https://steamcommunity.com/sharedfiles/filedetails/?id=1403779769) | In SFC1, fighters exist as `FTR` hull-type rows in the ship spec file, and ships have four fighter-bay count columns. | SFC1; lineage only |

## 2. File location and role

- Path (unverified for CE 2.670): `<install>/Assets/Specs/ftrlist.txt`, plus a `MetaAssets` copy that campaign play reads (F1, F2, F7). Resolve case-insensitively.
- Role (unverified): per-type fighter definitions that carriers in `shiplist.txt` load into their fighter bays.
- **PFs (decided with Combat, provisional):** PFs use the full ship model with entity class `'pf'`, so they are expected as rows in `shiplist.txt` (F5 points the same way). If CE 2.670 also lists PFs here, the parser still reads them and the loader decides. Fighters are a lighter entity built from this file.
- Relation to `shiplist.txt`: CE 2.670 shiplist has 15 `FTR` rows and no PF rows (inventory metadata, `sfc2-ci`, 2026-11-23). This file has 81 data rows, the 36-column header in the rules mapping, and identical `Assets/specs` and `MetaAssets` copies. `DroI` and `DroVI` use the letter arc `ALL`; numeric arcs `1`/`2`/`3` were not observed here. Whether each fighter type also needs its `FTR` shiplist row for the model is still open. Shiplist `Fighter Type 1`–`4` are the observed per-bay type strings.

## 3. Encoding and layout

Same expectations and parsing rules as [`shiplist.md` §3](shiplist.md#3-encoding-and-layout), including **parser output keys = raw file header names** and values as written (no scaling, no renaming, exact weapon/arc strings): single-byte Windows text, TAB-delimited, header row(s) of labels, empty cells allowed, header-driven column mapping, unknown columns kept in `extra`, raw cells kept. Confidence: **unverified** (F6 shows it is a ShipEdit text table; everything else is assumed by analogy with the ship list).

Diagnostics use the shared `{ code, source, severity, details?, location? }` type (see [`README`](README.md#parser-conventions) and [`docs/engine/diagnostics.md`](../engine/diagnostics.md)). Parser diagnostics carry `source: "ftrlist"` and the same flat, stable camelCase codes as the ship list, with the same meanings (`emptyFile`, `noHeader`, `raggedRow`, `badNumber`, `duplicateFighterType`, `multipleHeaderRows`, `specsMetaassetsDiffer`). `unknownWeapon` and `unknownArc` are loader diagnostics (`source: "loader"`). `parseFtrlist` appends them until `engine/data` exists; see §7.

## 4. Field table

The metadata-only CE 2.670 inventory (issue #6) reports 36 columns: a comment on line 1 and the header on line 2. Combat's field mapping of those header names is in [`docs/rules/shiplist-mapping.md`](../rules/shiplist-mapping.md). That mapping does not include row counts or cell values. The parser still keys output by the raw header names. The camelCase names below are the earlier engine-model wishlist; where they disagree with the inventory header (no turn-mode column, `Shots` rather than a separate reload, an `ECCM` column), the rules mapping wins.

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| — | `race` | enum string | — | Owning empire (same tokens as `shiplist.race`). | unknown |
| — | `typeName` | string (unique key) | — | Fighter type identifier that carriers or missions refer to. | unknown |
| — | `shipClassRef` | string (shiplist `className`), may be absent | — | Link to an `FTR` row in `shiplist.txt`, if the game splits data across files. | unknown |
| — | `yearFirstAvailable` | integer | game year index | First year the type is issued. | unverified (F5, OP+) |
| — | `yearLastAvailable` | integer | game year index | Last year issued (999 used as "never retired" in OP+). | unverified (F5, OP+) |
| — | `speed` | number | speed units | Maximum speed. | unknown (wishlist) |
| — | `turnMode` | enum string | — | Not in the CE 2.670 header summary. Engine value stays null. | unknown (wishlist; header absent) |
| — | `damagePoints` | number | damage points | Damage the fighter absorbs before destruction. | unknown (wishlist) |
| — | `weapons[]` (`slotIndex`, `weapon`, `arc`, `load`, `reload`) | five groups | as in the rules mapping | `Num` / `WeaponN` / `Arc` / `Shots`. Codes stay exact. `Shots` maps to `load`; `reload` stays null until playtest. | documented (inventory names, #6) |
| — | `droneLoad` | integer | drones | Drones carried by drone-armed fighters, if separate from `weapons[]`. | unknown |
| — | `ecm` | number | ECM points | ECM, if the file has it. | unknown (wishlist) |
| — | bay / launch data: `carrier`, `count`, `rearmTime` | mixed | —, fighters, turns or seconds | Which carrier bays hold the type, how many, and rearm time. May come partly from `shiplist.txt` fighter-bay columns. | unknown (wishlist) |
| — | `bpv` / `cost` | number | points / prestige | Value of one fighter, for BPV totals and replacement costs. | unknown |
| — | `geometry` | string (relative path) | — | Model path, if not taken from a shiplist row. | unknown |
| — | `uiKey` / icon | string | — | Icon or HUD key. | unknown |
| — | `isPf` / category | enum | — | Fighter vs PF vs other craft, if the file mixes them. | unknown |

**Totals:** 16 proposed field definitions in the wishlist table. The CE 2.670 header names themselves are now documented from the metadata inventory (36 columns, no row counts); the binding of those names is [`docs/rules/shiplist-mapping.md`](../rules/shiplist-mapping.md). File-level facts other than that header (which copy campaign reads, byte size) stay unverified until the format spec is revised against the inventory artifact.

## 5. Parser data model

**Parser output** (keys are raw header names):

```ts
interface Ftrlist {
  headerRows: string[][];
  columns: string[];                          // raw header names, in file order
  rows: FtrlistRow[];
}

interface FtrlistRow {
  line: number;
  fields: Record<string, string | number>;    // key = raw header name; values as written
  weapons: Array<{
    slotIndex: number;                        // 0..4 for Weapon1..Weapon5
    count: number | null;                     // Num. Null when the cell is empty
    weapon: string | null;
    arc: string | null;
    load: number | null;                      // Shots
    reload: number | null;                    // reload-counted Arc cell only
  }>;                                         // only if weapon groups are found
  raw: string[];
  extra: Record<string, string | number>;     // cells past the header, keyed col<N>
}
```

The engine loader maps `fields` to a lightweight `Fighter` entity (`speed`, `turnMode`, `damagePoints`, `weapons`, `ecm`, bay/launch data) once the real headers are known. PFs do not use this entity; they are ships with class `'pf'`.

In the engine model, absent columns become `null` (not 0): `null` means "column absent", 0 means "file says zero".

## 6. Version differences (all unverified)

| Build | Note |
| --- | --- |
| SFC1 | No `ftrlist.txt` is mentioned in S1; fighters are `FTR` rows in the ship spec file and only Hydrans field them. |
| EaW 2.036 / 2.037 | `ftrlist.txt` in `assets\specs` (F1); about 12 KB (F4). |
| Orion Pirates 2.5xx | About 20 KB (F4); more fighter types. OP+ mod sets years and keeps a separate phase-out list (F5). |
| **CE 2.670 (baseline, [#37](https://github.com/danielsegan/sfc2-browser-edition/issues/37))** | `MetaAssets` copy used for campaign (F2). Layout unknown. |
| CE 2.677–2.679 (unofficial) | Patch notes don't list an `ftrlist.txt` change but tell players to back it up (F3). |

## 7. Validation rules

This parser raises codes only for fields it can't read (empty or malformed) and for structural checks on the table it parsed. Every diagnostic from this parser carries `source: "ftrlist"`.

| ID | Code | Severity | Rule |
| --- | --- | --- | --- |
| W1 | `emptyFile` | error | No non-empty lines. |
| W2 | `noHeader` | error | No header row. Unlike the ship list, there is no index fallback because no column order is documented. Rows are kept raw in `extra` keyed `col<N>`. |
| W3 | `raggedRow` | warning | Cell count differs from header. |
| W4 | `duplicateFighterType` | error | Two rows share a `typeName`. |
| W5 | `badNumber` | warning | Numeric cell fails to parse. |
| W6 | `unknownRace` | warning | Race token outside the known list (shared with shiplist). Weapon and arc tokens are not checked here; see loader diagnostics below. |
| W7 | `yearOrder` | warning | First year after last year. |
| W8 | `missingShipRef` | warning | Cross-file (importer-level): `shipClassRef` names no shiplist row, or a carrier bay references a fighter type that does not exist. |
| W9 | `specsMetaassetsDiffer` | warning | Importer-level: the two copies differ. |

### Loader diagnostics (`source: "loader"`)

Weapon and arc values are kept as the exact file strings. The engine loader checks them against the mapping table in `docs/rules` (owned by Combat). These codes use `source: "loader"`, not `"ftrlist"`. There is no `engine/data` module yet, so `parseFtrlist` appends them to its own result. Same codes as in [`shiplist.md` §7](shiplist.md#loader-diagnostics-source-loader).

| Code | Source | Severity | Rule |
| --- | --- | --- | --- |
| `unknownWeapon` | `loader` | warning | Weapon token is not in the `docs/rules` mapping table. |
| `unknownArc` | `loader` | warning | Arc token is not in the `docs/rules` mapping table. |

The CE weapon and arc code lists themselves will come later from the `sfc2-ci` inventory and are not listed here.

`parseFtrlist` appends `unknownWeapon` and `unknownArc` with `source: "loader"` on the same result until `engine/data` exists. `Shots` is `load`. A reload-counted Arc cell of `1`, `2` or `3` is `reload` and clears the firing arc. `DroI` and `DroVI` keep `ALL`. The ten `Pla*` spellings each stay their own code.

## 8. Open questions

### Answered by the Combat Systems Designer (provisional until CE 2.670 headers are seen)
1. ~~Fighter stats~~ **Answered (wishlist):** speed, turn mode, damage points, weapons with arcs, load and reload, ECM if present, and bay/launch data (carrier, count, rearm time). These stay a wishlist until verified.
2. ~~Carriers~~ **Partly answered:** bay/launch data is part of the wishlist. Whether the link is explicit, by race and year, or by loadout must be observed in CE 2.670.
3. ~~PFs~~ **Answered:** PFs use the full ship model with entity class `'pf'`. Fighters are a lighter entity.
4. ~~Weapon codes on fighters~~ **Answered:** canonical keys are the exact CE file strings, the mapping table lives in `docs/rules`, and we don't invent codes.

### For observation on `sfc2-ci` (CE 2.670)
5. Header text, column count and order; any comment or version lines.
6. Whether each fighter type also has an `FTR` (or PF) row in `shiplist.txt`, and which file holds model, hull and speed.
7. How year columns are encoded (same offset as shiplist?).
8. Whether PFs appear in `ftrlist.txt` at all in CE.

## 9. Fixture

[`tools/fixtures/formats/ftrlist/minimal.txt`](../../tools/fixtures/formats/ftrlist/minimal.txt) is a hand-made table with **our own placeholder header labels** and 2 invented rows (`TEST-FTR-01`, `TEST-PF-02`). It exists only to exercise the shared TAB-table tokenizer. It is not the CE 2.670 header and carries no real fighter data. The observed header names live in the rules mapping, not in this fixture. `edges.txt` is the malformed fixture. [`tools/formats/fuzz.test.ts`](../../tools/formats/fuzz.test.ts) feeds arbitrary tables and byte strings to `parseFtrlist`.

## Edge cases

Same text rules as [shiplist.md](shiplist.md#edge-cases), with two differences:

| Input | Result |
| --- | --- |
| No header row | `noHeader` is an **error**. There is no index fallback. Cells stay on `extra` as `col<N>`. `fields` stays empty. |
| Header cell `__proto__` | Stored as an own field. The prototype is unchanged. |
| `options.file` is not install-relative | `location.file` is omitted. |
| `options.shipClassNames` omitted | The cross-file `missingShipRef` check does not run. |

A bad numeric cell is `badNumber` and becomes 0. The row is kept. Empty or whitespace input is `emptyFile` with no `location`.

## Unknown / unparsed

Public documentation of this file is thin. The wishlist in §4 is not a claim that those columns exist.

- **Known from the CE 2.670 inventory metadata (names only, no cell values).** 36 columns, a comment on line 1, the header on line 2, 81 data rows, identical `Assets/specs` and `MetaAssets` copies. Combat's binding of those names is [`docs/rules/shiplist-mapping.md`](../rules/shiplist-mapping.md). The parser still keys `fields` by the raw header.
- **Unknown.** How a carrier bay picks a row (explicit id, race and year, or loadout). Whether each type also needs an `FTR` row in `shiplist.txt` for the model, hull, and speed. Year encoding. Whether any PF row appears here in CE 2.670 (the shiplist inventory found none). Turn mode: the observed header summary has no turn-mode column, so the engine value stays null. What `Shots` counts in play (`load` in the parser; `reload` stays null until a playtest, except a reload-counted Arc cell of `1`, `2`, or `3`).
- **Unparsed on purpose.** No ×2 scale. No renaming of weapon or arc codes. No check that a geometry path exists. PFs are not turned into the lighter fighter entity; the loader decides.
