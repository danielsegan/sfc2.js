# CE 2.670 mission roster (port tracker)

Status: **draft**. Owner: Mission & Campaign Designer. Milestone: Phase 4 (Missions). Refs [#37](https://github.com/danielsegan/sfc2.js/issues/37).

This roster lists the mission and campaign files in the reference build, SFC2 Community Edition 2.670, and
tracks porting progress for each one. It is built **only** from the metadata in Asset & Formats' inventory,
[`docs/formats/inventory/missions-ce-2.670.md`](https://github.com/danielsegan/sfc2.js/blob/35dbbbd606831a72d8f9515fcae490eba9d48362/docs/formats/inventory/missions-ce-2.670.md)
(branch `formats/inventory-ce2670`, PR [#46](https://github.com/danielsegan/sfc2.js/pull/46), commit `35dbbbd`). That inventory was generated on the private `sfc2-ci` runner at
`2026-11-23T21:34:01Z` UTC.

> **Clean-room and data rules.** Only file names, folder paths, sizes and counts from the inventory appear
> here. sha256 hashes stay in the inventory and aren't repeated. No file contents, mission text or titles
> beyond the file names, no game files, and nothing from SFC2-decomp.

> **What the names do and don't tell us.** Grouping below is by **file-name prefix and name tokens only**
> (for example `ISC_`, `Mir_`, `Conquest Fed`). It's not confirmed which campaign uses which `.scr`, what
> each `.mct` file means, or how the generic and unique missions are scheduled per empire. Those are
> **unverified** until the port work reads the campaign data on `sfc2-ci`.

## 1. Totals

The inventory lists **183 files in 13 folders**:

| Kind | Count | Folder(s) |
| --- | ---: | --- |
| `.scr` mission modules | 127 | `scripts/Assets/Scripts` (one flat folder; there are no per-empire subfolders) |
| `.mct` campaign files | 12 | `scripts/Assets/Scripts/Campaigns` |
| `.mct` Conquest files | 8 | `scripts/Assets/Scripts/Campaigns/ConquestBonus` |
| `.mct` custom-mission files | 8 | `scripts/Assets/Scripts/Campaigns/custommissions` |
| `.gf` settings files | 28 | `settings/...` (not missions; listed in the inventory only) |

Port status for every mission and campaign file below is **not started**.

## 2. Per-empire counts

Counts of files whose **name** carries the empire's token. CE 2.670 has **no per-empire campaign folders**,
so this is the closest grouping the metadata supports. A `Campaigns` file such as `ISC-Fed.mct` names two
empires and is counted under both.

| Empire | `.scr` with empire prefix | `Campaigns` `.mct` naming it | `ConquestBonus` `.mct` | `custommissions` `.mct` | Port status |
| --- | ---: | ---: | ---: | ---: | --- |
| Federation | 0 | 1 | 1 | 1 | not started |
| Klingon | 0 | 2 | 1 | 1 | not started |
| Romulan | 0 | 1 | 1 | 1 | not started |
| ISC | 16 | 8 | 1 | 1 | not started |
| Hydran | 0 | 2 | 1 | 1 | not started |
| Lyran | 0 | 2 | 1 | 1 | not started |
| Mirak | 12 | 5 | 1 | 1 | not started |
| Orion | 0 | 0 | 0 | 0 | not started |
| Gorn | 0 | 1 | 1 | 1 | not started |

Observations from the names (unverified as to meaning):

- Only **ISC** (`ISC_`, 16 files) and **Mirak** (`Mir_`, 12 files) have
  empire-prefixed `.scr` modules. Only they have `Campaigns` files whose name **starts** with the empire
  (`ISC-*.mct`: 8; `Mirak - *.mct`: 4).
- Federation, Klingon, Romulan, Hydran, Lyran and Gorn have no empire-prefixed `.scr` files. They appear as
  the second name in `ISC-*` / `Mirak - *` campaign files, and each has one `Conquest` and one `Custom` file.
- **Orion:** no file in the inventory carries an Orion token. Whether CE 2.670 has an Orion campaign stays
  **unverified**; the file names give no evidence for one.
- The 38 `Met_` and 37 `Uni_` modules aren't tied to an empire by name. How
  they're assigned to campaigns needs the campaign data.

## 3. ISC (`ISC_` prefix and `ISC-*` campaign files)

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `ISC_10Criminals.scr` | 373248 | not started |
| `ISC_1Peace.scr` | 379392 | not started |
| `ISC_2Promises.scr` | 370688 | not started |
| `ISC_3IronCage.scr` | 389120 | not started |
| `ISC_4Resolve.scr` | 375808 | not started |
| `ISC_5Accuse.scr` | 407040 | not started |
| `ISC_6Immunity.scr` | 375808 | not started |
| `ISC_7BattleGrave.scr` | 387072 | not started |
| `ISC_8Diplomacy.scr` | 394752 | not started |
| `ISC_9B1Homeworld.scr` | 405504 | not started |
| `ISC_9B2Homeworld.scr` | 405504 | not started |
| `ISC_9B4Homeworld.scr` | 405504 | not started |
| `ISC_X3M1BTemple.scr` | 384000 | not started |
| `ISC_X4M1BThief.scr` | 375808 | not started |
| `ISC_X4M2BBomber.scr` | 378368 | not started |
| `ISC_X4M3BFoxtrot.scr` | 393216 | not started |

Campaign files:

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `ISC-Fed.mct` | 1366 | not started |
| `ISC-Gorn.mct` | 1379 | not started |
| `ISC-Hydran.mct` | 1288 | not started |
| `ISC-ISC.mct` | 1228 | not started |
| `ISC-Klingon.mct` | 1274 | not started |
| `ISC-Lyran.mct` | 1306 | not started |
| `ISC-Mirak.mct` | 1305 | not started |
| `ISC-Romulan.mct` | 1347 | not started |

## 4. Mirak (`Mir_` prefix and `Mirak - *` campaign files)

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Mir_10Search.scr` | 372736 | not started |
| `Mir_11Wedding.scr` | 381440 | not started |
| `Mir_1Desecration.scr` | 365056 | not started |
| `Mir_2Dance.scr` | 390656 | not started |
| `Mir_3Tug.scr` | 377344 | not started |
| `Mir_4Playtime.scr` | 376832 | not started |
| `Mir_5AFunny1.scr` | 373248 | not started |
| `Mir_5BFunny2.scr` | 384512 | not started |
| `Mir_6Wheel.scr` | 385024 | not started |
| `Mir_7Gates.scr` | 376832 | not started |
| `Mir_8Massacre.scr` | 395776 | not started |
| `Mir_9Edge.scr` | 378880 | not started |

Campaign files:

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Mirak - Hydran.mct` | 1192 | not started |
| `Mirak - Klingon.mct` | 1194 | not started |
| `Mirak - Lyran.mct` | 1173 | not started |
| `Mirak - Mirak.mct` | 1162 | not started |

## 5. Federation, Klingon, Romulan, Hydran, Lyran, Gorn, Orion

No empire-prefixed `.scr` modules and no `Campaigns` file starting with these names. Their per-empire
Conquest and custom-mission files are in sections 6 and 7. Orion has no files at all.

## 6. Conquest (`ConquestBonus`)

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Conquest Fed .mct` | 814 | not started |
| `Conquest Gorn .mct` | 814 | not started |
| `Conquest Hydran .mct` | 816 | not started |
| `Conquest ISC .mct` | 813 | not started |
| `Conquest Klingon .mct` | 817 | not started |
| `Conquest Lyran .mct` | 815 | not started |
| `Conquest Mirak .mct` | 815 | not started |
| `Conquest Rom .mct` | 817 | not started |

## 7. Custom missions (`custommissions`)

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Custom-Federation.mct` | 826 | not started |
| `Custom-Gorn.mct` | 819 | not started |
| `Custom-Hydran.mct` | 825 | not started |
| `Custom-ISC.mct` | 814 | not started |
| `Custom-Klingon.mct` | 835 | not started |
| `Custom-Lyran.mct` | 824 | not started |
| `Custom-Mirak.mct` | 821 | not started |
| `Custom-Romulan.mct` | 837 | not started |

## 8. Other mission modules (all in `scripts/Assets/Scripts`)

### Generic missions (`Met_` prefix): 38

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Met_10BasePlacement.scr` | 554496 | not started |
| `Met_10Patrol.scr` | 391168 | not started |
| `Met_11ConvoyRaid.scr` | 378368 | not started |
| `Met_12ConvoyEscort.scr` | 380928 | not started |
| `Met_13Monster.scr` | 370688 | not started |
| `Met_14Enigma.scr` | 372736 | not started |
| `Met_15BaseDefense.scr` | 375296 | not started |
| `Met_16ShipDefense.scr` | 376320 | not started |
| `Met_17Patrol.scr` | 389120 | not started |
| `Met_18HomeworldAssault.scr` | 374784 | not started |
| `Met_19Scan.scr` | 391680 | not started |
| `Met_1Scout.scr` | 367104 | not started |
| `Met_2HoldingAction.scr` | 375296 | not started |
| `Met_3Ambushee.scr` | 377856 | not started |
| `Met_4Ambusher.scr` | 367104 | not started |
| `Met_5FleetAction.scr` | 363520 | not started |
| `Met_6Patrol.scr` | 391168 | not started |
| `Met_7BaseAssault.scr` | 374784 | not started |
| `Met_8ShipAssault.scr` | 375808 | not started |
| `Met_9PlanetaryAssault.scr` | 375296 | not started |
| `Met_ED10Monster.scr` | 561664 | not started |
| `Met_ED10Patrol.scr` | 566784 | not started |
| `Met_ED10PatrolEnemy.scr` | 566784 | not started |
| `Met_ED17Patrol.scr` | 560128 | not started |
| `Met_ED17PatrolEnemy.scr` | 567808 | not started |
| `Met_ED5FleetAction.scr` | 542720 | not started |
| `Met_ED5PlayerFleet.scr` | 543744 | not started |
| `Met_ED6Patrol.scr` | 564736 | not started |
| `Met_NW11ConvoyRaid.scr` | 375296 | not started |
| `Met_NW12ConvoyEscort.scr` | 375296 | not started |
| `Met_NW14Enigma.scr` | 374272 | not started |
| `Met_NW18HomeworldAssault.scr` | 377344 | not started |
| `Met_NW19Scan.scr` | 393728 | not started |
| `Met_NW2HoldingAction.scr` | 377344 | not started |
| `Met_NW7BaseStationAssault.scr` | 380416 | not started |
| `Met_NW7BattleStationAssault.scr` | 380416 | not started |
| `Met_NW9PlanetaryAssault.scr` | 377856 | not started |
| `Met_NW9TimedAssault.scr` | 442368 | not started |

### Unique missions (`Uni_` prefix): 37

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Uni_10Criminals.scr` | 389632 | not started |
| `Uni_10Search.scr` | 371712 | not started |
| `Uni_11Wedding.scr` | 380928 | not started |
| `Uni_1Desecration.scr` | 387584 | not started |
| `Uni_1Peace.scr` | 385536 | not started |
| `Uni_2Dance.scr` | 390656 | not started |
| `Uni_2Promises.scr` | 400384 | not started |
| `Uni_3IronCage.scr` | 389120 | not started |
| `Uni_3Tug.scr` | 377344 | not started |
| `Uni_4Playtime.scr` | 376832 | not started |
| `Uni_4Resolve.scr` | 388096 | not started |
| `Uni_5Accuse.scr` | 399360 | not started |
| `Uni_5AFunny1.scr` | 373760 | not started |
| `Uni_5BFunny2.scr` | 387584 | not started |
| `Uni_6Immunity.scr` | 400384 | not started |
| `Uni_6Wheel.scr` | 385536 | not started |
| `Uni_7BattleGrave.scr` | 448512 | not started |
| `Uni_7Gates.scr` | 376320 | not started |
| `Uni_8Hammer.scr` | 395264 | not started |
| `Uni_8Massacre.scr` | 391168 | not started |
| `Uni_9A1Tyr.scr` | 410624 | not started |
| `Uni_9C1Welcome.scr` | 370688 | not started |
| `Uni_9Edge.scr` | 400384 | not started |
| `Uni_X1M1ASmuggler.scr` | 387072 | not started |
| `Uni_X1M1FInsurrection.scr` | 373248 | not started |
| `Uni_X1M2Trial.scr` | 377344 | not started |
| `Uni_X1M3Poison.scr` | 373760 | not started |
| `Uni_X2M1Interceptor.scr` | 358400 | not started |
| `Uni_X2M2Reclamation.scr` | 386560 | not started |
| `Uni_X2M3Apes.scr` | 380928 | not started |
| `Uni_X3M1ATemple.scr` | 388096 | not started |
| `Uni_X4M1AThief.scr` | 386560 | not started |
| `Uni_X4M2ACuckoo.scr` | 394240 | not started |
| `Uni_X4M3ADoors.scr` | 414208 | not started |
| `Uni_X5M1AMoon.scr` | 365568 | not started |
| `Uni_X5M1FPyre.scr` | 366592 | not started |
| `Uni_X5M2Sake.scr` | 378880 | not started |

### Multiplayer (`Mul_` prefix): 13

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Mul_10Hockey.scr` | 381952 | not started |
| `Mul_11Tinyfest.scr` | 368128 | not started |
| `Mul_12Slugfest.scr` | 368128 | not started |
| `Mul_13RandomBattle.scr` | 361472 | not started |
| `Mul_14TimedBattle.scr` | 365056 | not started |
| `Mul_1Free4All.scr` | 361472 | not started |
| `Mul_2BaseAssault.scr` | 371712 | not started |
| `Mul_3Battlefest.scr` | 376832 | not started |
| `Mul_4Tourneyfest.scr` | 376832 | not started |
| `Mul_5BattlefestLite.scr` | 368128 | not started |
| `Mul_6TourneyfestLite.scr` | 368128 | not started |
| `Mul_7Tourney.scr` | 360448 | not started |
| `Mul_9TeamAssault.scr` | 370688 | not started |

### Skirmish (`Ski_` prefix): 1

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Ski_1Free4All.scr` | 360960 | not started |

### Tutorial (`Tut_` prefix): 6

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Tut_Command190.scr` | 350720 | not started |
| `Tut_Command290.scr` | 352768 | not started |
| `Tut_Command590.scr` | 366080 | not started |
| `Tut_Science310.scr` | 366592 | not started |
| `Tut_Weapons380.scr` | 363520 | not started |
| `Tut_Weapons480.scr` | 360960 | not started |

### Bonus (`Bon_` prefix): 4

| File | Size (bytes) | Port status |
| --- | ---: | --- |
| `Bon_1Sulu.scr` | 385536 | not started |
| `Bon_2Sulu.scr` | 368640 | not started |
| `Bon_3Sulu.scr` | 374272 | not started |
| `Bon_4Sulu.scr` | 376320 | not started |

## 9. Keeping this current

- Port status values: `not started`, `spec written`, `in progress`, `ported`, `verified` (replay test green
  and black-box comparison done; see [`mission-api.md`](mission-api.md)).
- When the inventory is regenerated (a new run on `sfc2-ci`), refresh the names, sizes and counts here from
  it, and keep hashes only in the inventory.
- Which mission and campaign to port first in Phase 4 is still an open question for the Producer.
