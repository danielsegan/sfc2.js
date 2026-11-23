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
- Role (unverified): per-type fighter definitions that carriers in `shiplist.txt` load into their fighter bays. Whether PFs are here, in `shiplist.txt`, or split between the two is open: F5 suggests PF availability is in the ship list.
- Relation to `shiplist.txt` (unknown): a fighter type may need a matching `FTR` row in `shiplist.txt` (for model, hull boxes, size class), with `ftrlist.txt` adding fighter-only data, or `ftrlist.txt` may be self-contained. This is the most important thing to settle on `sfc2-ci`.

## 3. Encoding and layout

Same expectations and parsing rules as [`shiplist.md` §3](shiplist.md#3-encoding-and-layout): single-byte Windows text, TAB-delimited, header row(s) of labels, empty cells allowed, header-driven column mapping, unknown columns kept in `extra`, raw cells kept. Confidence: **unverified** (F6 shows it is a ShipEdit text table; everything else is assumed by analogy with the ship list).

Diagnostic codes use the `ftrlist/` prefix with the same meanings as the ship list (`ftrlist/empty-file`, `ftrlist/no-header`, `ftrlist/ragged-row`, `ftrlist/bad-number`, `ftrlist/duplicate-type`, `ftrlist/multiple-header-rows`, `ftrlist/specs-metaassets-differ`).

## 4. Field table

No public source gives the column order, so **no column indices are proposed**. The parser must be header-driven. The fields below are what a fighter needs for SFC2-style play, written as proposals to check against the real header.

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| — | `race` | enum string | — | Owning empire (same tokens as `shiplist.race`). | unknown |
| — | `typeName` | string (unique key) | — | Fighter type identifier that carriers or missions refer to. | unknown |
| — | `shipClassRef` | string (shiplist `className`), may be absent | — | Link to an `FTR` row in `shiplist.txt`, if the game splits data across files. | unknown |
| — | `yearFirstAvailable` | integer | game year index | First year the type is issued. | unverified (F5, OP+) |
| — | `yearLastAvailable` | integer | game year index | Last year issued (999 used as "never retired" in OP+). | unverified (F5, OP+) |
| — | `speed` | number | speed units | Maximum speed. | unknown |
| — | `damageCapacity` | number | damage points | Damage the fighter absorbs before destruction. | unknown |
| — | `weapons[]` (`count`, `weapon`, `arc`) | repeated group | as in shiplist hardpoints | Weapon fit. Number of slots unknown. | unknown |
| — | `droneLoad` | integer | drones | Drones carried by drone-armed fighters, if separate from `weapons[]`. | unknown |
| — | `ecm` / `chaff` | number | — | Electronic-warfare or chaff capability, if present. | unknown |
| — | `bpv` / `cost` | number | points / prestige | Value of one fighter, for BPV totals and replacement costs. | unknown |
| — | `geometry` | string (relative path) | — | Model path, if not taken from a shiplist row. | unknown |
| — | `uiKey` / icon | string | — | Icon or HUD key. | unknown |
| — | `isPf` / category | enum | — | Fighter vs PF vs other craft, if the file mixes them. | unknown |

**Totals:** 14 proposed field definitions. 0 documented, 2 unverified (`yearFirstAvailable`, `yearLastAvailable`, from an OP mod note), 12 unknown. File-level facts (location, TAB table, `MetaAssets` copy, size ~12 KB in EaW) are unverified and listed in sections 1–3.

## 5. Proposed data model (sketch, not code in this PR)

```ts
interface Ftrlist {
  headerRows: string[][];
  columns: string[];
  fighters: FighterSpec[];
}

interface FighterSpec {
  line: number;
  race: string | null;
  typeName: string;
  shipClassRef: string | null;
  yearFirstAvailable: number | null;
  yearLastAvailable: number | null;
  speed: number | null;
  damageCapacity: number | null;
  weapons: Array<{ count: number; weapon: string; arc: string } | null>;
  extra: Record<string, string>;   // every column we have not mapped yet
  raw: string[];
}
```

Fields default to `null` (not 0) because we don't yet know which columns exist; `null` means "column absent", 0 means "file says zero".

## 6. Version differences (all unverified)

| Build | Note |
| --- | --- |
| SFC1 | No `ftrlist.txt` is mentioned in S1; fighters are `FTR` rows in the ship spec file and only Hydrans field them. |
| EaW 2.036 / 2.037 | `ftrlist.txt` in `assets\specs` (F1); about 12 KB (F4). |
| Orion Pirates 2.5xx | About 20 KB (F4); more fighter types. OP+ mod sets years and keeps a separate phase-out list (F5). |
| **CE 2.670 (baseline, [#37](https://github.com/danielsegan/sfc2-browser-edition/issues/37))** | `MetaAssets` copy used for campaign (F2). Layout unknown. |
| CE 2.677–2.679 (unofficial) | Patch notes don't list an `ftrlist.txt` change but tell players to back it up (F3). |

## 7. Validation rules

| ID | Code | Severity | Rule |
| --- | --- | --- | --- |
| W1 | `ftrlist/empty-file` | error | No non-empty lines. |
| W2 | `ftrlist/no-header` | error | No header row. Unlike the ship list, there is no index fallback because no column order is documented. Rows are kept raw in `extra` keyed `col<N>`. |
| W3 | `ftrlist/ragged-row` | warning | Cell count differs from header. |
| W4 | `ftrlist/duplicate-type` | error | Two rows share a `typeName`. |
| W5 | `ftrlist/bad-number` | warning | Numeric cell fails to parse. |
| W6 | `ftrlist/unknown-race`, `ftrlist/unknown-weapon` | warning | Token outside the known lists (shared with shiplist). |
| W7 | `ftrlist/year-order` | warning | First year after last year. |
| W8 | `ftrlist/missing-ship-ref` | warning | Cross-file (importer-level): `shipClassRef` names no shiplist row, or a carrier bay references a fighter type that does not exist. |
| W9 | `ftrlist/specs-metaassets-differ` | warning | Importer-level: the two copies differ. |

## 8. Open questions

### For the Combat Systems Designer
1. **Fighter model in the rules.** Which fighter stats does the sim need (speed, damage capacity, weapons and their arcs, drones, chaff/ECM, endurance, reload time on the carrier)? Your list sets the field names here.
2. **Carriers.** How does a carrier pick its fighter type: by race and year, by an explicit link, or by mission/loadout choice? (The ship list only gives counts per bay.)
3. **PFs.** Do you want PFs as ships (shiplist rows with a PF hull type, launched from tenders) or as a fighter subclass? Recorded data will follow whatever the CE files do; the rules model may differ.
4. **Weapon codes on fighters.** Same vocabulary as ship hardpoints, or fighter-specific codes (e.g. fighter-sized drones or phasers)?

### For observation on `sfc2-ci` (CE 2.670)
5. Header text, column count and order; any comment or version lines.
6. Whether each fighter type also has an `FTR` (or PF) row in `shiplist.txt`, and which file holds model, hull and speed.
7. How year columns are encoded (same offset as shiplist?).
8. Whether PFs appear in `ftrlist.txt` at all in CE.

## 9. Fixture

[`tools/fixtures/formats/ftrlist/minimal.txt`](../../tools/fixtures/formats/ftrlist/minimal.txt) is a hand-made table with **our own placeholder header labels** (the real labels are unknown) and 2 invented rows (`TEST-FTR-01`, `TEST-PF-02`). It exists only to exercise the shared TAB-table tokenizer and header mapping. It carries no real fighter data and must be replaced or relabelled once CE 2.670's real header is observed.
