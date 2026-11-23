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
- If the two copies differ, the importer emits `shiplist/specs-metaassets-differ` (warning) and uses the `Assets/Specs` copy for skirmish and the `MetaAssets` copy for campaign. Which copy wins in CE 2.670 is an open question.

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
2. **Header detection.** Treat the first non-empty line as the header if its first cell equals `Race` case-insensitively, or more generally if most of its cells are non-numeric. If more than one header-like line precedes the data, keep all of them in `data.headerRows` and emit `shiplist/multiple-header-rows` (info). CE 2.670's actual header count is unknown.
3. **Column mapping.** Map cells to fields by normalized header label (lower-case, trim, collapse spaces, drop a trailing `_`). Labels we do not know go into `row.extra[label]`. If there is no header, fall back to the proposed index order in section 4 and emit `shiplist/no-header` (warning).
4. Each row produces a `ShipSpec` even if fields fail to parse. Bad cells become `NaN`-free defaults plus a diagnostic that carries line and column.
5. Keep the raw cell array per row (`row.raw`) so we can diff against the real file on `sfc2-ci` and round-trip mods.

## 4. Field table

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
| 19 | `shieldFront` | number | file shield units | Shield 1 (forward facing). S1 says the game doubles file values in play. | unverified (S1) |
| 20 | `shieldFrontSides` | number | file shield units | Shared value for facings 2 and 6. | unverified (S1) |
| 21 | `shieldRearSides` | number | file shield units | Shared value for facings 3 and 5. | unverified (S1) |
| 22 | `shieldRear` | number | file shield units | Shield 4 (aft facing). | unverified (S1) |
| 23 | `shieldTotal` | number | file shield units | Sum over all six facings, stored in the file. Checked by rule V8. | unverified (S1) |
| 24 | `cloakCost` | number, empty = none | energy | Energy to run a cloak. Empty means no cloak. | unverified (S1) |

### 4.5 Weapon hardpoints (repeated group)

| # | Proposed field | Type | Units | Meaning | Confidence (source) |
| --- | --- | --- | --- | --- | --- |
| 25 + 3k (k = 0..24) | `hardpoints[k].count` | integer 0–4 | shots stored or mounts | How many shots the mount stores (S1 says above 4 crashes SFC1). | unverified (S1) |
| 26 + 3k | `hardpoints[k].weapon` | enum string, empty = unused | — | Weapon code, e.g. `Ph1`–`Ph4`, `PhG`, `Phot`, `Dis1`–`Dis4`, `PlaF`/`PlaG`/`PlaS`/`PlaR`, `DroA`… `DroG`, `ESG`, `Fus`, `HB` in SFC1. CE adds more (e.g. PPD, fast-load variants). Full CE list unknown. | unverified (S1) |
| 27 + 3k | `hardpoints[k].arc` | string | arc code, or count for drones | Firing arc code (`FA`, `FH`, `FX`, `RA`, `L`, `R`, `LS`, `RS`, `ALL`, `FLLX`, `FRRX` …, plus `SFBL`, `SFBR`, `RLP`, `RRP` named in S4). For drone racks S1 says this cell holds the number of reloads instead. | unverified (S1, S4) |

25 slots × 3 cells = 75 columns. S1 says slots 1–10 hold heavy weapons and slots 11–25 hold phasers, and that only slots 11–25 feed the phaser capacitor. Slot meaning also depends on the UI hardpoint layout picked by `uiKey` (and on `sprites.q3` in CE, per S4). Whether CE 2.670 still has exactly 25 slots is unknown.

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

- **Field definitions:** 80 rows above. 78 have a proposed column index (153 physical columns, because the hardpoint group repeats 25 times); 2 are placeholders with no known column.
- **By confidence:** 5 documented (`className`, `stealth`, `add6`, `add12`, `geometry`), 73 unverified, 2 unknown. None verified against CE 2.670.

## 5. Proposed data model (sketch, not code in this PR)

```ts
interface Shiplist {
  headerRows: string[][];        // raw header line(s)
  columns: string[];             // normalized labels, in file order
  ships: ShipSpec[];             // in file order
}

interface ShipSpec {
  line: number;                  // 1-based source line
  race: string; hullType: string; className: string;
  bpv: number; specialRole: string | null;
  yearFirstAvailable: number; yearLastAvailable: number;
  sizeClass: number; turnMode: string; moveCost: number;
  hetChance: number; hetBreakdown: number; stealth: number;
  crew: { regular: number; boardingBase: number; boardingMax: number;
          deck: number; total: number; min: number };
  shields: { front: number; frontSides: number; rearSides: number; rear: number;
             total: number };          // file units; doubling (if any) is a rules decision
  cloakCost: number | null;
  hardpoints: Array<{ slot: number; count: number; weapon: string; arc: string } | null>; // length 25
  // ... remaining groups as in section 4, same names
  geometry: string | null; uiKey: string | null;
  extra: Record<string, string>; // unknown columns, keyed by label
  raw: string[];                 // original cells
}
```

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

Errors keep the row but mark it unusable for spawning. Warnings keep it usable.

| ID | Code | Severity | Rule |
| --- | --- | --- | --- |
| V1 | `shiplist/empty-file` | error | No non-empty lines. |
| V2 | `shiplist/no-header` | warning | No header row detected; index fallback used. |
| V3 | `shiplist/ragged-row` | warning | Row has fewer cells than the header (missing cells read as empty) or more (extras kept in `extra` under `col<N>`). |
| V4 | `shiplist/duplicate-class` | error | Two rows share a `className` (case-insensitive). The first wins for lookups. |
| V5 | `shiplist/bad-number` | warning | A numeric field does not parse; default 0 and keep the raw cell. |
| V6 | `shiplist/unknown-race`, `shiplist/unknown-hull-type`, `shiplist/unknown-turn-mode`, `shiplist/unknown-weapon`, `shiplist/unknown-arc` | warning | Value outside the known token list. The lists start from S1 and grow from CE 2.670 observation. |
| V7 | `shiplist/hardpoint-count-range` | warning | Hardpoint count outside 0–4, or a count with an empty weapon code (or the reverse). |
| V8 | `shiplist/shield-total-mismatch` | info | `shieldTotal` ≠ front + 2×frontSides + 2×rearSides + rear. |
| V9 | `shiplist/crew-total-mismatch` | info | `totalCrew` disagrees with the S1 formula. |
| V10 | `shiplist/year-order` | warning | `yearFirstAvailable` > `yearLastAvailable`. |
| V11 | `shiplist/missing-refit-base` | warning | `refitBaseClass` names no row. |
| V12 | `shiplist/missing-geometry` | warning | Playable hull type with empty `geometry`. File existence is checked later by the importer (#16), not the parser. |
| V13 | `shiplist/multiple-header-rows` | info | More than one header-like line. |
| V14 | `shiplist/specs-metaassets-differ` | warning | Importer-level: the two copies differ. |

## 8. Open questions

### For the Combat Systems Designer
1. **Rules-facing names.** Please confirm or rename: `moveCost`, `hetChance`, `hetBreakdown`, `warpSide` / `warpCenter` / `impulse` / `apr` / `battery`, `shieldFront` / `shieldFrontSides` / `shieldRearSides` / `shieldRear`, `cloakCost`, `damageControl`, `extraDamage`, and the system box names in 4.8. Should energy sources be a nested `power` object?
2. **Shield doubling.** S1 says SFC1 doubles file shield values in play. The parser returns file values. Does the rules module own the ×2 (and the R_L_Warp ×2), so the data model stays a faithful copy of the file?
3. **Hardpoints.** Do you want slots kept as 25 fixed positions (null for empty, needed to match HUD layouts), or a compacted weapon list plus a slot index? And should the "slots 11–25 feed the phaser capacitor" rule live in data or rules?
4. **Weapon and arc vocabulary.** We need the full CE weapon code list (PPD, fast-load photons/disruptors, plasma variants, drone rack types) and arc codes, with your canonical enum names, so V6 can be strict.
5. **Drone racks.** S1 says the arc cell holds reloads for drone racks. Should the data model split this into `reloads` for drone weapons?
6. **Stealth.** Does CE 2.670 honour the stealth column (it was broken in EaW until 2.037)? Treat it as rules-ignored until we observe it?
7. **Fighters and PFs.** Are fighters/PFs given by `fighterBays[]` here plus type rows in `ftrlist.txt`, or by `FTR`/PF rows in this file? See [ftrlist.md](ftrlist.md).

### For observation on `sfc2-ci` (CE 2.670)
8. Exact header text and number of header rows; full column count; columns beyond S1 (PF, flag bridge, emergency bridge, aux control, probe launchers …).
9. Encoding (any bytes above 0x7F?), line ends, trailing tabs.
10. Which copy (`Assets/Specs` or `MetaAssets`) skirmish and campaign actually read; whether they are identical in a clean install.
11. CE race and hull-type token sets; year encoding; whether `className` is unique in the stock file.

## 9. Fixture

[`tools/fixtures/formats/shiplist/minimal.txt`](../../tools/fixtures/formats/shiplist/minimal.txt) is a hand-made, reduced-column table for tokenizer and header-mapping tests. It has 3 invented rows (`TEST-CA-01`, `TEST-FF-02`, `TEST-BS-03`), a few columns only, one empty cell and one trailing tab. Its header labels are placeholders based on S1's column names, not copied from any CE file. It is not a full-width row and carries no real ship data.
