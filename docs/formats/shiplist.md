# `shiplist.txt`: ship specification table

Issue: [#13](https://github.com/danielsegan/sfc2-browser-edition/issues/13) · Milestone: Phase 1: Asset pipeline · Owner: Asset & Formats Engineer
Status: **spec draft, nothing verified.** Reference build is **SFC2 Community Edition 2.670** ([#37](https://github.com/danielsegan/sfc2-browser-edition/issues/37)). Every statement about real files below is *unverified* until a real-data job on the private `sfc2-ci` runner checks it against the CE 2.670 install.

> Clean-room note. This spec is written only from public community documentation and forum posts cited below, plus our own design choices. It does not use, cite or derive from SFC2-decomp or any other decompilation or disassembly. No real ship rows or weapon tables are reproduced here. All example names and numbers are invented (`TEST-CA-01` etc.).

## 1. Sources

| ID | Source | What it tells us | Applies to |
| --- | --- | --- | --- |
| S1 | MtZuul, [Ship Modding in Starfleet Command (Steam guide)](https://steamcommunity.com/sharedfiles/filedetails/?id=1403779769) | Column-by-column walkthrough of the SFC1 spec file `sfbspc13.txt`, which is the ancestor of `shiplist.txt` (tab-delimited, one ship per row, hardpoint groups, shields, crew, power, hull, shuttles). | SFC1 1.03; lineage only |
| S2 | Capt Starkiller & 3dot14, [Mod installation FAQ (kontek archive)](https://archive.kontek.net/sfc.strategyplanet.gamespy.com/sfc1/faq_mod.shtml) | SFC2 spec file is `shiplist.txt` in `assets\specs` with a second copy in `metaassets`; a `Geometry` column holds a relative `.mod` path; ShipEdit edits it. | SFC2 EaW and OP |
| S3 | TarMinyatur, [SCF2CE Mod/ship installation (dynaverse.net)](http://www.dynaverse.net/forum/index.php/topic,163394532.0.html) | CE `shiplist.txt` has a `Geometry` column of the form `assets/models/<folder>/<file>.mod`; ShipEdit and spreadsheets work on CE; EaW mods work in CE. | CE |
| S4 | [SFC2: Community Edition, Patch 2.679 (Hot & Spicy Forums)](https://hotandspicyforums.com/sfc2-community-edition-patch-2-679-t18932.html) | Unofficial 2.677–2.679 patches replace `shiplist.txt`: scout entries removed, admin shuttles raised, compatible OP 2.552 ships added, more hardpoints used (with a matching `sprites.q3`). | CE 2.677–2.679 (not our baseline) |
| S5 | [SFC2CE HD Patch thread (dynaverse.net)](http://www.dynaverse.net/forum/index.php/topic,163394477.0.html) | Campaign play loads `shiplist.txt` and `ftrlist.txt` from `MetaAssets`. | CE |
| S6 | [SFC2: Empires At War, Patch 2.037 (Hot & Spicy Forums)](https://hotandspicyforums.com/sfc2-empires-at-war-patch-2-037-t20068.html) | The shiplist has a stealth column whose header label is matched by the executable (a trailing `_` disabled it until a 2.037 update); stealth adds free ECM and may be negative. | EaW 2.037 |
| S7 | [EaW Patch 2.037 thread (dynaverse.net)](http://www.dynaverse.net/forum/index.php/topic,163396632.0.html), seen only as a search-result excerpt (site timed out) | `ADD_6` and `ADD_12` columns are ignored by the game. | EaW 2.037 |
| S8 | [SFC-related files list (klingon.lostexiles.net)](https://klingon.lostexiles.net/mediawiki/index.php?title=SFC-related_missions%2C_sources%2C_patches_and_misc_utilities) | File sizes: EaW 2.036 `shiplist.txt` about 816 KB, OP builds about 1.1 MB. | EaW, OP |
| S9 | [OP+ Contents and Changes (klingon.lostexiles.net)](https://klingon.lostexiles.net/mediawiki/index.php?title=OP%2B_Contents_and_Changes) | PF phase-out years live in `shiplist.txt`, fighter years in `ftrlist.txt`. | OP+ mod |
| S10 | Pestalence_XC, [OP Enhancement Package v5.1 (dynaverse.net)](http://www.dynaverse.net/forum/index.php/topic,163378640.0.html) | `Assets\Specs` and `MetaAssets` copies must match; servers check spec file sizes. | OP |

## 2. File location and role

- Path (unverified for CE 2.670): `<install>/Assets/Specs/shiplist.txt`, and a second copy at `<install>/MetaAssets/shiplist.txt` that campaign / Dynaverse play reads (S2, S5, S10). Windows paths are case-insensitive, so the importer must resolve both names case-insensitively.
- Role: one row per spawnable unit. That includes playable ships, and also bases, freighters, monsters, planets, mines, shuttles and fighters, each told apart by hull type (S1).
- If the two copies differ, the importer emits `specsMetaassetsDiffer` (warning) and uses the `Assets/Specs` copy for skirmish and the `MetaAssets` copy for campaign. Which copy wins in CE 2.670 is an open question.

## 3. Encoding and layout

| Property | Expectation | Confidence |
| --- | --- | --- |
| Encoding | Single-byte Windows text (ASCII / Windows-1252). Decode as Windows-1252, strip a UTF-8 BOM if one is present. | unknown |
| Line ends | CRLF expected; accept LF and CR as well. | unknown |
| Field delimiter | One TAB (`\t`) per field. No quoting or escaping. | unverified (S1 for SFC1; S2/S3 say "spreadsheet import" for SFC2) |
| Empty cells | Allowed. An empty numeric cell means 0 or "not fitted" (S1: blank cloak means no cloak; blank acceleration means the unit cannot move). | unverified |
| Trailing tabs | Rows may end with empty trailing fields; tolerate them. | unknown |
| Header | At least one header row of column labels. The executable appears to look up at least one column by its label text (S6), so labels may be significant. | unverified |
| Row count / size | Hundreds of rows; EaW 2.036 file is about 816 KB (S8). CE 2.670 size unknown. | unverified |
| Numbers | Decimal, `.` as separator; integers and fractions (move cost, cost) both occur. | unverified |
| Comments | None known. | unknown |

### Parsing rules (our design)

1. Decode, split into lines, drop a trailing empty line.
2. **Header detection.** Treat the first non-empty line as the header if its first cell equals `Race` case-insensitively, or more generally if most of its cells are non-numeric. A leading instruction row is not the header: first cell blank, a sentence in the second cell, and every later cell empty. A lone `<0` marker is the same kind of preamble. If more than one header-like line precedes the data, keep all of them in `data.headerRows` and emit `multipleHeaderRows` (info).

   Observed on `sfc2-ci` against CE 2.670 (inventory metadata, 2026-11-23, no rows copied): ASCII, no BOM, CRLF, TAB, column header on line 2, 190 columns, 1393 data rows. The `Assets/specs` and `MetaAssets` copies differ. Spawn keys are unique. There are 15 `FTR` rows and no PF rows. Hull tokens beyond the S1 list: `BOX`, `MAM`, `MDM`, `MLC`, `MMT`, `MSG`, `MSS`, `SB`. Header labels the parser now binds include `Stealth (+ECM)`, `Regular Crew`, `Shield 2 _ 6`, `Shield 3 _ 5`, `HET +2 Turns & Nimble`, `T Bombs Base`, `Nuclear Mine Base`, `Forward Hull`, `R_L_Warp`, `C_Warp`, `Ship Cost`, `Full Name`, `Fighter Type 1`–`4`, `Class Type`, `Shuttles Size`, and `General Base` / `General Max`. `General` is the observed name where S1 said admin shuttles; that reading is still a proposal. `W1`–`W25` stay extra columns, not weapon slots.
3. **Column keys.** Output keys are the raw header names exactly as written, so known and unknown columns are treated alike. For lookups (race, class name, hardpoint groups, spawn key) the parser matches headers after normalizing them (lower-case, trim, collapse spaces, drop a trailing `_`). If there is no header, it falls back to the proposed index order in section 4, uses `col<N>` keys and emits `noHeader` (warning).
4. Each row produces a `ShipSpec` even if fields fail to parse. Bad cells become `NaN`-free defaults plus a diagnostic whose optional `location` carries the 1-based line and column, or the field name.
5. Keep the raw cell array per row (`row.raw`) so we can diff against the real file on `sfc2-ci` and round-trip mods.

## 4. Field table

**Parser output vs engine model (agreed with Combat, provisional until CE 2.670 headers are seen).** The parser's output keys are the **raw file header names** exactly as written (e.g. `Move Cost`), so a row round-trips without a rename table. The camelCase names in the "Proposed field" column below are the **proposed engine-model mapping**, owned by the Engine Lead and Combat Systems Designer, and are grouped as in section 5.2. They are documented here so the loader has one place to read them from.

Column indices are **proposed only**. They follow the left-to-right order of the SFC1 file as S1 walks through it. CE 2.670 almost certainly adds, renames or reorders columns, which is why the parser maps by header label. Field names are our own camelCase proposals, and the Combat Systems Designer should confirm the rules-facing ones (see section 8).

Units: "file units" means the number exactly as written. The data-model layer converts later (see [README](README.md#parser-conventions)).

### 4.1 Identity and availability

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 0 | `race` | enum string | — | Owning empire or pseudo-race. SFC1 values: Federation, Klingon, Romulan, Lyran, Hydran, Gorn, plus non-playable Orion, Neutral, Monster. SFC2 adds at least ISC and Mirak; the exact CE token set is unknown. | unverified (S1) |
| 1 | `hullType` | enum string | — | Category: playable FF, CL, CA, DN; non-playable codes such as BS, BT, F (freighter), KDP, KLP, KSD, SHT (shuttle), FTR (fighter), XMN (mine), monster codes, Planet, Asteroid, Star, UNKNOWN. SFC2 classes such as DD, BC, PF unknown. | unverified (S1) |
| 2 | `className` | string (unique key) | — | Class identifier that missions, refits and other files use to find the row. Treat as the primary key. | documented (S3) |
| 3 | `bpv` | number | points | Basic point value used to balance fleets and skirmish budgets. | unverified (S1) |
| 4 | `specialRole` | enum string, may be empty | — | Fleet-composition role flag (S1 lists command, commando, missile, restricted and Romulan-hull variants). | unverified (S1) |
| 5 | `yearFirstAvailable` | integer | game year index | First year the class can be bought; also used to place a ship in an era. Encoding is an offset, not a calendar year. | unverified (S1) |
| 6 | `yearLastAvailable` | integer | game year index | Last year the class can be bought in a campaign. | unverified (S1) |

### 4.2 Movement and signature

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 7 | `sizeClass` | integer 1–6 | — | Size category (1 largest, e.g. bases; 6 smallest, e.g. shuttles, fighters, mines). | unverified (S1) |
| 8 | `turnMode` | enum `AA`,`A`–`H` | — | Turn-radius class; `H` means stationary. | unverified (S1) |
| 9 | `moveCost` | number | energy per unit of speed | Energy needed per point of speed. | unverified (S1) |
| 10 | `hetChance` | number | fraction | Base high-energy-turn success value. | unverified (S1) |
| 11 | `hetBreakdown` | integer 0–6 | — | Breakdown likelihood factor for a HET below full chance. | unverified (S1) |
| 12 | `stealth` | number, may be negative | ECM points | Free ECM added to the unit's own ECM. Negative means a noisy unit. The header label text matters to the executable (S6). Whether CE 2.670 honours it is unknown. | documented (S6, EaW 2.037) |

### 4.3 Crew

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 13 | `crew` | integer | crew units | Regular crew. | unverified (S1) |
| 14 | `boardingPartiesBase` | integer | parties | Marines carried at purchase. | unverified (S1) |
| 15 | `boardingPartiesMax` | integer | parties | Maximum marines. | unverified (S1) |
| 16 | `deckCrews` | integer | crew units | Deck crews. | unverified (S1) |
| 17 | `totalCrew` | integer | crew units | Derived total stored in the file. S1 gives it as crew + half the base boarding parties + half the deck crews. We store the file value and check it (rule V9). | unverified (S1) |
| 18 | `minCrew` | integer | crew units | Minimum crew below which the ship stops working. | unverified (S1) |

### 4.4 Shields and cloak

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 19 | `shields[0]` | number | file shield units | Front facing. S1 says the game doubles file values in play; the factor lives in the docs/rules scale table. | unverified (S1) |
| 20 | `shields[1]` and `shields[5]` | number | file shield units | One file value shared by front-right and front-left. | unverified (S1) |
| 21 | `shields[2]` and `shields[4]` | number | file shield units | One file value shared by rear-right and rear-left. | unverified (S1) |
| 22 | `shields[3]` | number | file shield units | Rear facing. | unverified (S1) |
| 23 | `shieldTotal` | number | file shield units | Sum over all six facings, stored in the file. Checked by rule V8. | unverified (S1) |

Engine shields are an array indexed 0–5, 0 = front, going clockwise (matches the HUD spec). SFB shield #n = index n−1.
| 24 | `cloakCost` | number, empty = none | energy | Energy to run a cloak. Empty means no cloak. | unverified (S1) |

### 4.5 Weapon hardpoints (repeated group)

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 25 + 3k (k = 0..24) | `hardpoints[k].count` (with `slotIndex` = k) | integer 0–4 | shots stored or mounts | How many shots the mount stores (S1 says above 4 crashes SFC1). | unverified (S1) |
| 26 + 3k | `hardpoints[k].weapon` | enum string, empty = unused | — | Weapon code, e.g. `Ph1`–`Ph4`, `PhG`, `Phot`, `Dis1`–`Dis4`, `PlaF`/`PlaG`/`PlaS`/`PlaR`, `DroA`… `DroG`, `ESG`, `Fus`, `HB` in SFC1. CE adds more (e.g. PPD, fast-load variants). Full CE list unknown. | unverified (S1) |
| 27 + 3k | `hardpoints[k].arc` | string | arc code, or count for drones | Firing arc code (`FA`, `FH`, `FX`, `RA`, `L`, `R`, `LS`, `RS`, `ALL`, `FLLX`, `FRRX` …, plus `SFBL`, `SFBR`, `RLP`, `RRP` named in S4). For drone racks S1 says this cell holds the number of reloads instead; the parser then also fills a separate `reloads` field. | unverified (S1, S4) |

25 slots × 3 cells = 75 columns.

**Parser contract for hardpoints (agreed with the Engine Lead and Combat).** The parser always emits all 25 slots in file order, **including empty ones**, each with its `slotIndex` (0–24) so a row round-trips exactly. Values stay as written: no ×2 for shields or side warp, no compaction, and no capacitor rule. The engine loader compacts slots but keeps `slotIndex`, and converts to fixed-point. ×2 scale factors live in one table in `docs/rules`, applied by the engine loader. See section 5.1.

**Weapon and arc codes.** Canonical keys are the exact CE file strings. The parser does not rename or invent codes. The mapping from those strings to rules behaviour is a table in `docs/rules` (Combat). Example codes below come from S1 (SFC1) and only illustrate the shape.

S1 says slots 1–10 hold heavy weapons and slots 11–25 hold phasers, and that only slots 11–25 feed the phaser capacitor. For us that is a **rules-side, unverified hypothesis**, not parser behaviour. Slot meaning also depends on the UI hardpoint layout picked by `uiKey` (and on `sprites.q3` in CE, per S4). Whether CE 2.670 still has exactly 25 slots is unknown.

### 4.6 Probes, mines and drone support

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 100 | `probes` | integer | groups (×5 probes per S1) | Probe supply. | unverified (S1) |
| 101 | `tBombsBase` | integer | mines | Transporter bombs carried at purchase. | unverified (S1) |
| 102 | `tBombsMax` | integer | mines | Maximum transporter bombs. | unverified (S1) |
| 103 | `nuclearMinesBase` | integer | mines | Nuclear space mines at purchase. | unverified (S1) |
| 104 | `nuclearMinesMax` | integer | mines | Maximum nuclear space mines. | unverified (S1) |
| 105 | `droneControl` | integer | — | Labelled "Drone Rack B" in S1; meaning unclear there (maybe drone control limit). | unverified (S1) |
| 106 | `add6` | integer | — | Anti-drone rack (6-shot). Ignored by the game. | documented (S7, EaW 2.037) |
| 107 | `add12` | integer | — | Anti-drone rack (12-shot). Ignored by the game. | documented (S7, EaW 2.037) |

### 4.7 Shuttles and fighters

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 108 | `shuttleBayCapacity` | integer | shuttles | Bay size; S1 says unused and usually equal to admin max. | unverified (S1) |
| 109 | `launchRate` | integer ≤ 4 | shuttles per cycle | Launches before the bay recharges. | unverified (S1) |
| 110 | `adminShuttlesBase` | integer | shuttles | Admin shuttles at purchase. | unverified (S1) |
| 111 | `adminShuttlesMax` | integer | shuttles | Max admin shuttles. | unverified (S1) |
| 112 | `suicideShuttlesBase` | integer | shuttles | | unverified (S1) |
| 113 | `suicideShuttlesMax` | integer | shuttles | | unverified (S1) |
| 114 | `scatterPacksBase` | integer | shuttles | | unverified (S1) |
| 115 | `scatterPacksMax` | integer | shuttles | | unverified (S1) |
| 116 | `wildWeaselsBase` | integer | shuttles | | unverified (S1) |
| 117 | `wildWeaselsMax` | integer | shuttles | | unverified (S1) |
| 118 | `replacementShuttles` | integer | shuttles | S1 says unused. | unverified (S1) |
| 119–122 | `fighterBays[0..3]` | integer | fighters | Fighters per bay; each bay launches as one squadron (S1). How a bay picks its fighter type from `ftrlist.txt` is unknown (see [ftrlist.md](ftrlist.md)). | unverified (S1) |
| — | `pfBays` / PF tender fields | ? | ? | SFC2 has PFs and PF tenders; S9 says PF phase-out is set in `shiplist.txt` (so PFs are probably their own rows). Tender columns are unknown. | unknown |
| — | `fighterTypeRef` per bay | ? | ? | A per-bay or per-ship link to a fighter type, if it exists. | unknown |

### 4.8 Hull, power and internal systems

All are integer box counts (damage capacity) unless noted, per S1.

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 123 | `armor` | integer | boxes | Absorbs internal damage before systems. | unverified (S1) |
| 124 | `hullForward` | integer | boxes | | unverified (S1) |
| 125 | `hullCenter` | integer | boxes | | unverified (S1) |
| 126 | `hullAft` | integer | boxes | | unverified (S1) |
| 127 | `cargo` | integer | boxes | Acts like extra hull. | unverified (S1) |
| 128 | `barracks` | integer | boxes | | unverified (S1) |
| 129 | `repair` | integer | boxes | Repair system; effect unclear in S1. | unverified (S1) |
| 130 | `warpSide` | number | energy per engine | Left/right warp engines; S1 says the value counts twice (two engines). | unverified (S1) |
| 131 | `warpCenter` | number | energy | Centre warp engine. | unverified (S1) |
| 132 | `impulse` | number | energy | | unverified (S1) |
| 133 | `apr` | number | energy | Auxiliary power reactor. | unverified (S1) |
| 134 | `battery` | number | energy capacity | | unverified (S1) |
| 135 | `bridge` | integer | boxes | | unverified (S1) |
| 136 | `security` | integer | boxes | | unverified (S1) |
| 137 | `lab` | integer | boxes | | unverified (S1) |
| 138 | `transporters` | integer | boxes | | unverified (S1) |
| 139 | `tractors` | integer | boxes | | unverified (S1) |
| 140 | `mechTractors` | integer | boxes | S1 says unused in SFC1. | unverified (S1) |
| 141 | `specialSensors` | integer | boxes | | unverified (S1) |
| 142 | `sensors` | integer | boxes / track level | | unverified (S1) |
| 143 | `scanners` | integer | boxes / track level | | unverified (S1) |

SFB-derived systems that SFC2 may track separately (flag bridge, emergency bridge, auxiliary control, probe launchers, drone/ADD storage, damage-control boxes) are not in S1's walkthrough. Whether CE 2.670 has columns for them is unknown.

### 4.9 Misc, cost, refit, presentation

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 144 | `explosionStrength` | number | damage points | Damage dealt to nearby units when this one explodes. | unverified (S1) |
| 145 | `acceleration` | number | speed per turn | Speed change per turn; empty means immobile. | unverified (S1) |
| 146 | `damageControl` | integer | — | Damage-control rating / spare-parts capacity. | unverified (S1) |
| 147 | `extraDamage` | integer | damage points | Excess-damage pool before destruction. | unverified (S1) |
| 148 | `cost` | number | prestige | Campaign purchase cost. | unverified (S1) |
| 149 | `refitBaseClass` | string (className ref), may be empty | — | Class this row is a refit of. | unverified (S1) |
| 150 | `refitCost` | number, may be empty | prestige | S1 says unused in SFC1. | unverified (S1) |
| 151 | `geometry` | string (relative path) | — | Model path such as `assets/models/test_ca01/test_ca01.mod`. Either slash style; resolve case-insensitively from the install root. The matching `_brk.mod` is found next to it. | documented (S2, S3) |
| 152 | `uiKey` | string | — | HUD picture and hardpoint layout key; ties slots to on-screen positions (S1). In CE the layouts come from `sprites.q3` (S4). | unverified (S1, S4) |

### 4.10 Totals

(Totals count file columns only; the derived `spawnKey` in 4.11 is not a column.)


- **Field definitions:** 80 rows above. 78 have a proposed column index (153 physical columns, because the hardpoint group repeats 25 times); 2 are placeholders with no known column.
- **By confidence:** 5 documented (`className`, `stealth`, `add6`, `add12`, `geometry`), 73 unverified, 2 unknown. None verified against CE 2.670.

### 4.11 Spawn key

Each row gets a stable **spawn key**, built by the parser as:

```ts
spawnKey = `${race}:${className}`   // e.g. "Federation:TEST-CA-01"
```

- `race` and `className` are the trimmed cell values as written (case kept). Duplicate detection compares keys case-insensitively, because Windows-era tools treat names that way.
- Missions, saves, replays, lobby messages and the importer refer to ships by spawn key, never by row number, so a reordered or modded shiplist keeps the same keys.
- **Uniqueness across the full CE 2.670 shiplist is unverified.** S1 says class IDs identify ships to the engine, which suggests they are unique, but we have not checked the CE file. If the real file has duplicate keys, we will need a tie-breaker (for example line order), recorded in this spec once observed.
- Duplicate keys raise `duplicateClassKey` (severity error, `details: { race, className, rows[] }`, rule V15, same code as in the planned engine diagnostics registry). A duplicate `className` under different races is only a warning (V4), since the spawn key still tells them apart.

### 4.12 Ship art references (for UI & Art)

These are the fields that name or select a ship's art. Anything marked **TO VERIFY** has not been checked against CE 2.670.

| Art reference | Field / source | What it selects | Confidence | Status |
| --- | --- | --- | --- | --- |
| Model | `geometry` | Relative path to the ship's `.mod` mesh, e.g. `assets/models/test_ca01/test_ca01.mod`. | documented (S2, S3) | TO VERIFY |
| Break-up / damaged model | derived from `geometry` | Sibling `<name>_brk.mod` in the same folder (S2, S3 mention it next to the main `.mod`). Not a shiplist column. | unverified | TO VERIFY |
| Textures (incl. self-illumination) | not in shiplist, as far as known | BMP files in the model's folder, probably named inside the `.mod`. Shiplist has no known texture column; resolution belongs to the `.mod` spec (#19) and textures (#15). | unknown | TO VERIFY |
| HUD picture and hardpoint layout | `uiKey` | Ship picture in the tactical HUD and Vessel Library, and on-screen hardpoint positions (S1). In CE the images and layouts are in `sprites.q3` (S4). | unverified (S1, S4) | TO VERIFY |
| Icon / portrait key | none known | No shiplist column for a map icon or captain portrait is documented; icons may come from `hullType` + `race` or from `uiKey`. | unknown | TO VERIFY |
| Class code | `className` | Ship class ID; also the second half of the spawn key, and may be used to build string-table keys for the display name (with `strings.txt` / `shipnames.txt`). | documented (S3) | TO VERIFY |
| Hull-type code | `hullType` | Category (FF, CL, CA, DN, BS …); likely picks generic icons and Vessel Library grouping (S1). | unverified (S1) | TO VERIFY |
| Empire | `race` | Empire colour scheme and HUD skin. | unverified (S1) | TO VERIFY |

## 5. Proposed data model (sketch, not code in this PR)

### 5.1 Who does what

| Layer | Owner | Does | Does not |
| --- | --- | --- | --- |
| Parser (`parseShiplist`) | Asset & Formats | Returns every row keyed by raw header names, values as written; all 25 hardpoint slots including empty ones, with `slotIndex`; drone-rack `reloads`; raw cells in `raw`. | Renaming to camelCase, scale factors, compacting slots, the capacitor hypothesis, fixed-point. |
| Engine loader | Engine Lead | Maps raw headers to the engine model (5.2), applies the ×2 scale factors from the single `docs/rules` table, compacts hardpoints keeping `slotIndex`, converts to fixed-point, builds the spawn-key index. | Game rules beyond the scale table. |
| Rules module | Combat Systems Designer | Owns the scale table and code-mapping table in `docs/rules`, the slot 11–25 capacitor hypothesis, and all SFB rules. | File parsing. |


**Parser output** (keys are raw header names):

```ts
interface Shiplist {
  headerRows: string[][];        // raw header line(s)
  columns: string[];             // raw header names, in file order
  rows: ShiplistRow[];           // in file order
}

interface ShiplistRow {
  line: number;                  // 1-based source line
  spawnKey: string;              // `${race}:${className}`, see section 4.11
  fields: Record<string, string | number>; // key = raw header name; numeric cells parsed, never scaled
  hardpoints: HardpointSlot[];   // always 25 entries, empty slots included
  raw: string[];                 // original cells, for exact round-trip
}

interface HardpointSlot {
  slotIndex: number;             // 0..24, file order
  count: number | null;          // as written
  weapon: string | null;         // exact CE file string, never renamed
  arc: string | null;            // exact CE file string
  reloads: number | null;        // drone racks only (arc cell holds a count)
}
```

### 5.2 Proposed engine-model mapping (owned by Engine Lead and Combat)

Provisional until the CE 2.670 headers are observed. The engine loader builds this from `ShiplistRow.fields`; the parser does not.

| Engine group | Keys | From file fields (section 4) |
| --- | --- | --- |
| `power` | `warp`, `impulse`, `apr`, `battery`, `batteryCapacity` | Side warp + centre warp (side-warp ×2 comes from the `docs/rules` scale table), impulse, APR, battery. |
| `movement` | `moveCost`, `turnMode` (proposed extras: `acceleration`, `hetChance`, `hetBreakdown`, `sizeClass`) | 4.2, 4.9 |
| `shields` | array indexed 0–5, 0 = front, clockwise (matches the HUD spec) | 4.4. The two shared file values each fan out to two indices. SFB shield #n = index n−1. |
| `systems` | flat map of box counts: `hull` (fwd/centre/aft), `armor`, `cargo`, `barracks`, `repair`, `bridge`, `security`, `labs`, `transporters`, `tractors`, `mechTractors`, `specialSensors`, `sensors`, `scanners`, `damageControl`, `probes`, `shuttleBays`, `excessDamage` … | 4.6–4.9 |
| `crew` | `crewUnits`, `boardingParties` (proposed extras: base/max, deck crews, min crew) | 4.3 |
| `weapons` | compacted hardpoints, each keeping `slotIndex`, `weapon`, `arc`, `count`, `reloads` | 4.5 |
| identity | `spawnKey`, `race`, `hullType`, `className`, `bpv`, years, `cost`, refit link | 4.1, 4.9 |
| art | `geometry`, `uiKey` | 4.12 |
| entity class | `'ship'` or `'pf'` (PFs use the full ship model) | `hullType`; the CE PF token is TO VERIFY |

## 6. Version differences (all unverified)

| Build | Difference relevant to the parser |
| --- | --- |
| SFC1 (`sfbspc13.txt`) | Ancestor format, documented column by column in S1. Different filename, fewer empires. We use it only as a guide to field meanings. |
| EaW 2.036 | `shiplist.txt` in `assets\specs` and `metaassets` (S2). About 816 KB (S8). |
| EaW 2.037 (unofficial) | Merges EaW-compatible OP ships into the list and enables the stealth column by fixing its header label (S6). |
| Orion Pirates 2.5xx | About 1.1 MB (S8); adds Orion cartels and more rows; used with `model.siz` (S10). Column differences from EaW are unknown. |
| **CE 2.670 (baseline)** | Official Community Edition. Campaign reads the `MetaAssets` specs (S5). EaW mods are reported to work (S3), which suggests the column layout is close to EaW. Unverified. |
| CE 2.677–2.679 (unofficial) | Replaces `shiplist.txt`: scouts removed, admin shuttles raised, OP 2.552 ships added, extra hardpoints that need the matching `sprites.q3` (S4). Our parser must accept these lists as mods, but they are not the baseline. |

## 7. Validation rules

The shared diagnostic type is `{ code, source, severity, details?, location? }` (see [README](README.md#parser-conventions)). Codes are flat, stable camelCase strings: add-only, never renamed. The single registry is the planned [`docs/engine/diagnostics.md`](../engine/diagnostics.md) (Engine Lead; not on `main` yet).

This parser raises codes only for fields it can't read (empty or malformed) and for structural checks on the table it parsed. Every diagnostic from this parser carries `source: "shiplist"`. Example:

```ts
{ code: "duplicateClassKey", source: "shiplist", severity: "error",
  details: { race: "Federation", className: "TEST-CA-01", rows: [3, 7] },
  location: { line: 7 } }
```

`location` is optional and minimal: a 1-based `line`, a 1-based field `column`, and/or the raw header `field` name. File-level codes (`emptyFile`, `noHeader`) omit it. Human-readable text is looked up as `source.code`; there is no `message` field.

Errors keep the row but mark it unusable for spawning. Warnings keep it usable.

| ID | Code | Severity | Rule |
| --- | --- | --- | --- |
| V1 | `emptyFile` | error | No non-empty lines. |
| V2 | `noHeader` | warning | No header row detected; index fallback used. |
| V3 | `raggedRow` | warning | Row has fewer cells than the header (missing cells read as empty) or more (extras kept in `extra` under `col<N>`). |
| V4 | `duplicateClassName` | warning | Two rows share a `className` (case-insensitive) under different races. References by `className` alone (e.g. `refitBaseClass`) become ambiguous; the spawn key still tells them apart. |
| V5 | `badNumber` | warning | A numeric field does not parse; default 0 and keep the raw cell. |
| V6 | `unknownRace`, `unknownHullType`, `unknownTurnMode` | warning | Value outside the known token list. The lists start from S1 and grow from CE 2.670 observation. Weapon and arc tokens are not checked here; see loader diagnostics below. |
| V7 | `hardpointCountRange` | warning | Hardpoint count outside 0–4, or a count with an empty weapon code (or the reverse). |
| V8 | `shieldTotalMismatch` | info | `shieldTotal` ≠ the sum of `shields[0..5]` (the four file values, with the two shared ones counted twice). |
| V9 | `crewTotalMismatch` | info | `totalCrew` disagrees with the S1 formula. |
| V10 | `yearOrder` | warning | `yearFirstAvailable` > `yearLastAvailable`. |
| V11 | `missingRefitBase` | warning | `refitBaseClass` names no row. |
| V12 | `missingGeometry` | warning | Playable hull type with empty `geometry`. File existence is checked later by the importer (#16), not the parser. |
| V13 | `multipleHeaderRows` | info | More than one header-like line. |
| V14 | `specsMetaassetsDiffer` | warning | Importer-level: the two copies differ. |
| V15 | `duplicateClassKey` | error | Two rows produce the same spawn key `${race}:${className}` (case-insensitive). `details: { race, className, rows: number[] }` (1-based lines of every row involved). Both rows are kept; lookups by key resolve to the first. Same code and shape as in the planned engine diagnostics registry. |

### Loader diagnostics (`source: "loader"`)

Weapon and arc values are kept as the exact file strings. The engine loader checks them against the mapping table in `docs/rules` (owned by Combat). These codes use `source: "loader"`, not `"shiplist"`. There is no `engine/data` module yet, so `parseShiplist` appends them to its own result.

| Code | Source | Severity | Rule |
| --- | --- | --- | --- |
| `unknownWeapon` | `loader` | warning | Weapon token is not in the `docs/rules` mapping table. |
| `unknownArc` | `loader` | warning | Arc token is not in the `docs/rules` mapping table. |

The CE weapon and arc code lists themselves will come later from the `sfc2-ci` inventory and are not listed here.

`parseShiplist` appends these two codes with `source: "loader"` on the same result until `engine/data` exists (`{ checkVocabulary: false }` skips them). Reload-counted racks (`DroA`, `DroB`, `DroC`, `DroF`, `DroG`, `ADD6`, `ADD12`) store an Arc cell of exactly `1`, `2` or `3` in `reloads` and set `arc` to null. Any other Arc cell on those codes, including empty, is `unknownArc`. `DroI` and `DroVI` are not reload-counted and keep a letter arc such as `ALL`. Each of the ten `Pla*` spellings is its own mapping-table row; any other spelling, including `PLAF` or `plaF`, is `unknownWeapon`.

## 8. Open questions

### Answered by the Combat Systems Designer (provisional until CE 2.670 headers are seen)
1. ~~Rules-facing names~~ **Answered.** Parser output keys are the raw file header names. The engine model uses camelCase nested groups (`power`, `movement`, `shields`, `systems`, `crew`), documented as the proposed mapping in 5.2.
2. ~~Doubling~~ **Answered.** The parser keeps values as written. ×2 scale factors live in one table in `docs/rules` and the engine loader applies them.
3. ~~Hardpoints~~ **Answered.** The parser emits all 25 slots, empty ones included, with `slotIndex` for round-trip. The engine compacts and keeps `slotIndex`. The slot 11–25 capacitor rule is a rules-side, unverified hypothesis.
4. ~~Weapon and arc vocabulary~~ **Answered.** Canonical keys are the exact CE file strings. The mapping table lives in `docs/rules`. We don't invent codes.
5. ~~Drone racks~~ **Answered.** Drone-rack reloads get their own field (`HardpointSlot.reloads`).
6. **Stealth.** Still open: treat as rules-ignored until observed working in CE 2.670.
7. ~~Fighters and PFs~~ **Answered.** PFs use the full ship model with entity class `'pf'` (rows in this file). Fighters are a lighter entity; see [ftrlist.md](ftrlist.md).

### For observation on `sfc2-ci` (CE 2.670)
8. Exact header text and number of header rows; full column count; columns beyond S1 (PF, flag bridge, emergency bridge, aux control, probe launchers …).
9. Encoding (any bytes above 0x7F?), line ends, trailing tabs.
10. Which copy (`Assets/Specs` or `MetaAssets`) skirmish and campaign actually read; whether they are identical in a clean install.
11. CE race and hull-type token sets; year encoding; whether `className` and the spawn key `${race}:${className}` are unique in the stock file.
12. Art references: whether any texture, icon or portrait column exists; how `uiKey` maps into `sprites.q3`.

## 9. Fixture

[`tools/fixtures/formats/shiplist/minimal.txt`](../../tools/fixtures/formats/shiplist/minimal.txt) is a hand-made, reduced-column table for tokenizer and header-mapping tests. It has 3 invented rows (`TEST-CA-01`, `TEST-FF-02`, `TEST-BS-03`), a few columns only, one empty cell and one trailing tab. Its header labels are placeholders based on S1's column names, not copied from any CE file. It is not a full-width row and carries no real ship data.
