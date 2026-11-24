# Shiplist field map (CE 2.670)

Baseline: Community Edition 2.670. Column names are the 190-header inventory in [shiplist-ftrlist-ce-2.670.md](inventory/shiplist-ftrlist-ce-2.670.md) (names only, no data rows). Parser roles are [shiplist.md](shiplist.md) and `tools/formats/tokens.ts`. The loader is `engine/sim/bind-shiplist.ts`. Scale factors live in [docs/rules/data/scale-factors.json](../rules/data/scale-factors.json) and [docs/rules/data/measured.json](../rules/data/measured.json).

Clean-room. This map does not copy ship rows or install values. Real files are read only at runtime from `SFC2_INSTALL` by `pnpm ship-audit`. Capture files from `tools/ce-harness` stay on `sfc2-ci`.

## Shield pairing (measured) and the engine ×2

The shield pairing is measured, not assumed. `tools/ce-harness` reads the game's Vessel Library (see that tool's README, known limits). The capture is `results-*.json` from `tools/ce-harness/summarize.py`, and it stays on the private VM.

Measured rule, 1:1 per facing, no ×2:

| File column | Facings (0 = front, clockwise) | Factor |
| --- | --- | --- |
| Shield 1 | 0 front | ×1 |
| Shield 2 _ 6 | 1 and 5, each front-side facing | ×1 |
| Shield 3 _ 5 | 2 and 4, each rear-side facing | ×1 |
| Shield 4 | 3 rear | ×1 |

File identity: `Shield Total = Shield 1 + 2×Shield 2 _ 6 + 2×Shield 3 _ 5 + Shield 4`. The two side columns are counted twice because each one is two facings, not because of a scale factor.

The engine does not match that measurement yet. `shieldMaxFromCells` still applies `fallbackEndFactor` 2 and `fallbackSideColumnFactor` 2 from `docs/rules/data/measured.json` (both overrides are null). A file row 10, 8, 6, 4 therefore becomes engine shields `[20, 16, 12, 8, 12, 16]` and a measured row `[10, 8, 6, 4, 6, 8]`. The stored Shield Total is ignored by the loader, which rebuilds the six facings. Combat owns removing the ×2 in a separate PR. This map and `tools/ship-audit` do not change `measured.json`, `scale-factors.json`, or any sim source.

`pnpm ship-audit` checks the file identity above. It also counts hulls whose engine facings differ from the 1:1 reading (`shieldScale.engineNotOneToOne`). That count is a column stat. It is not a failed identity check, and it does not by itself fail the run.

## Status and the ignored flag

| Status | Meaning |
| --- | --- |
| measured | A harness capture on CE 2.670 fixed the reading. The citation is in the transform cell. |
| assumed | The loader reads the column with the transform shown. Playtest has not replaced it. |
| unused | No sim or rules reader. The parser may still store the cell or check it. |

Ignored `yes` means current sim and rules code does not read the column. There are 91 ignored columns, 5 measured, 95 assumed, and 90 unused. There is no speed column. Spawn speed is 0. Cruise speed in the audit is the whole generation spent on movement: `(warp + impulse + APR) × 100 / moveCost100`, integer division, and 0 when the hull cannot move.

## Every column

| # | Column | Parser field | Sim / rules consumer | Transform | Status | Ignored |
| ---: | --- | --- | --- | --- | --- | --- |
| 0 | Race | race | tools/formats/shiplist.ts ShiplistRow.spawnKey; engine/duel/roster.ts spawnKey | Trimmed, case kept. Spawn key is race + ':' + class name. | assumed | no |
| 1 | Hull Type | hullType | engine/sim/bind-shiplist.ts ShipSetup.classCode → engine/sim/hull.ts H.classCode | FTR → CLASS_FIGHTER, PF → CLASS_PF, every other token → CLASS_SHIP. ×1. | assumed | no |
| 2 | Class | className | tools/formats/shiplist.ts ShiplistRow.spawnKey; engine/duel/roster.ts className | Trimmed, case kept. Second half of the spawn key. | assumed | no |
| 3 | Class Type | classType | none in engine/sim or engine/render | Stored. No sim field. | unused | yes |
| 4 | BPV | bpv | none in engine/sim or engine/render | Stored. No sim field. | unused | yes |
| 5 | Special Role | specialRole | none in engine/sim or engine/render | Stored. No sim field. | unused | yes |
| 6 | Year First Available | yearFirstAvailable | none in engine/sim or engine/render | Stored. No sim field. | unused | yes |
| 7 | Year Last Available | yearLastAvailable | none in engine/sim or engine/render | Stored. No sim field. | unused | yes |
| 8 | Size Class | sizeClass | none in engine/sim or engine/render | Stored. No sim field. | unused | yes |
| 9 | Turn mode | turnMode | engine/sim/bind-shiplist.ts ShipSetup.turnMode → engine/sim/rules-tables.ts turnModeId and turnYawCap → engine/sim/hull.ts H.turnMode | ×1 letter. Empty becomes H (stationary). AA and A–G use docs/rules/data/turn-modes.json fallbackMaxYawPerTick until measured.json turnYaw.measuredMaxYawPerTick has that letter. The harness records HET and mouse-helm rates in results-*.json; those rates are not copied into the turn table here. | assumed | no |
| 10 | Move Cost | moveCost | engine/sim/bind-shiplist.ts ShipSetup.moveCost100 → engine/sim/hull.ts H.moveCost100 → engine/sim/combat.ts movement budget | File decimal, at most two places, stored as hundredths (1 → 100, 0.75 → 75). Not a ×2. | assumed | no |
| 11 | HET +2 Turns & Nimble | hetChance | none in engine/sim or engine/render | Header is HET +2 Turns & Nimble. Parsed. The loader does not read it. | unused | yes |
| 12 | HET Breakdown | hetBreakdown | none in engine/sim or engine/render | Parsed. The loader does not read it. | unused | yes |
| 13 | Stealth (+ECM) | stealth | engine/sim/bind-shiplist.ts ShipSetup.stealth → engine/sim/phase3.ts defensiveEcm → engine/sim/hull.ts H.stealth | ×1. May be negative. Added to paid ECM, then floored at 0. | assumed | no |
| 14 | Regular Crew | crew | engine/sim/bind-shiplist.ts ShipSetup.crew → engine/sim/hull.ts H.crew | ×1 whole crew. | assumed | no |
| 15 | Boarding Parties Base | boardingPartiesBase | none in engine/sim or engine/render | Parsed. The loader does not read it. | unused | yes |
| 16 | Boarding Parties Max | boardingPartiesMax | none in engine/sim or engine/render | Parsed. The loader does not read it. | unused | yes |
| 17 | Deck Crews | deckCrews | none in engine/sim or engine/render | Parsed. The loader does not read it. | unused | yes |
| 18 | Total Crew | totalCrew | tools/formats/shiplist.ts crewTotalMismatch only | Parser compares the cell to crew + boardingPartiesBase/2 + deckCrews/2. The sim does not read the cell. | unused | yes |
| 19 | Min Crew | minCrew | engine/sim/bind-shiplist.ts ShipSetup.minCrew → engine/sim/hull.ts H.minCrew | ×1. Crew below this disables the hull. | assumed | no |
| 20 | Shield 1 | shieldFront | engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[0] → engine/sim/hull.ts H.shieldMax0 | Measured on CE 2.670: tools/ce-harness Vessel Library capture (results-*.json stays on sfc2-ci; see tools/ce-harness/README.md). Shield 1 is the front facing (index 0), 1:1, no ×2. Engine today still multiplies by the fallback in docs/rules/data/measured.json via engine/sim/bind-shiplist.ts shieldMaxFromCells. Combat removes that ×2 in a separate PR. This map does not change the factor. fallbackEndFactor is 2, so the engine facing is twice the file cell. | measured | no |
| 21 | Shield 2 _ 6 | shieldForwardSide | engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[1] and shieldsMax[5] → engine/sim/hull.ts H.shieldMax0+1 and +5 | Measured on CE 2.670: tools/ce-harness Vessel Library capture (results-*.json stays on sfc2-ci; see tools/ce-harness/README.md). Shield 2 _ 6 is each front-side facing (indexes 1 and 5), 1:1, no ×2. Engine today still multiplies by the fallback in docs/rules/data/measured.json via engine/sim/bind-shiplist.ts shieldMaxFromCells. Combat removes that ×2 in a separate PR. This map does not change the factor. fallbackSideColumnFactor is 2, so each engine facing is twice the file cell. | measured | no |
| 22 | Shield 3 _ 5 | shieldAftSide | engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[2] and shieldsMax[4] → engine/sim/hull.ts H.shieldMax0+2 and +4 | Measured on CE 2.670: tools/ce-harness Vessel Library capture (results-*.json stays on sfc2-ci; see tools/ce-harness/README.md). Shield 3 _ 5 is each rear-side facing (indexes 2 and 4), 1:1, no ×2. Engine today still multiplies by the fallback in docs/rules/data/measured.json via engine/sim/bind-shiplist.ts shieldMaxFromCells. Combat removes that ×2 in a separate PR. This map does not change the factor. fallbackSideColumnFactor is 2, so each engine facing is twice the file cell. | measured | no |
| 23 | Shield 4 | shieldRear | engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[3] → engine/sim/hull.ts H.shieldMax0+3 | Measured on CE 2.670: tools/ce-harness Vessel Library capture (results-*.json stays on sfc2-ci; see tools/ce-harness/README.md). Shield 4 is the rear facing (index 3), 1:1, no ×2. Engine today still multiplies by the fallback in docs/rules/data/measured.json via engine/sim/bind-shiplist.ts shieldMaxFromCells. Combat removes that ×2 in a separate PR. This map does not change the factor. fallbackEndFactor is 2, so the engine facing is twice the file cell. | measured | no |
| 24 | Shield Total | shieldTotal | tools/formats/shiplist.ts shieldTotalMismatch; tools/ship-audit shield-total check. Not read by engine/sim/bind-shiplist.ts | Measured on CE 2.670: tools/ce-harness Vessel Library capture (results-*.json stays on sfc2-ci; see tools/ce-harness/README.md). Identity, file units, 1:1 per facing: Total = Shield 1 + 2×Shield 2 _ 6 + 2×Shield 3 _ 5 + Shield 4. The sim ignores the stored total and rebuilds facings with the ×2 factors, so the engine sum is twice this identity. | measured | yes |
| 25 | Cloak | cloakCost | engine/sim/bind-shiplist.ts ShipSetup.cloakCost → engine/sim/phase3.ts → engine/sim/hull.ts H.cloakCost | ×1 energy per rules-turn. Empty or 0 means no cloak. | assumed | no |
| 26 | Num | hardpoints[0].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 1) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 27 | Heavy Weapon 1 | hardpoints[0].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 1) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 28 | Arc | hardpoints[0].arc, or hardpoints[0].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 1) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 29 | Num | hardpoints[1].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 2) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 30 | Heavy Weapon 2 | hardpoints[1].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 2) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 31 | Arc | hardpoints[1].arc, or hardpoints[1].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 2) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 32 | Num | hardpoints[2].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 3) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 33 | Heavy Weapon 3 | hardpoints[2].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 3) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 34 | Arc | hardpoints[2].arc, or hardpoints[2].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 3) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 35 | Num | hardpoints[3].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 4) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 36 | Heavy Weapon 4 | hardpoints[3].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 4) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 37 | Arc | hardpoints[3].arc, or hardpoints[3].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 4) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 38 | Num | hardpoints[4].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 5) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 39 | Heavy Weapon 5 | hardpoints[4].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 5) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 40 | Arc | hardpoints[4].arc, or hardpoints[4].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 5) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 41 | Num | hardpoints[5].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 6) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 42 | Heavy Weapon 6 | hardpoints[5].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 6) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 43 | Arc | hardpoints[5].arc, or hardpoints[5].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 6) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 44 | Num | hardpoints[6].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 7) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 45 | Heavy Weapon 7 | hardpoints[6].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 7) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 46 | Arc | hardpoints[6].arc, or hardpoints[6].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 7) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 47 | Num | hardpoints[7].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 8) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 48 | Heavy Weapon 8 | hardpoints[7].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 8) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 49 | Arc | hardpoints[7].arc, or hardpoints[7].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 8) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 50 | Num | hardpoints[8].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 9) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 51 | Heavy Weapon 9 | hardpoints[8].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 9) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 52 | Arc | hardpoints[8].arc, or hardpoints[8].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 9) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 53 | Num | hardpoints[9].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 10) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 54 | Heavy Weapon 10 | hardpoints[9].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 10) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 55 | Arc | hardpoints[9].arc, or hardpoints[9].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 10) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 56 | Num | hardpoints[10].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 11) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 57 | Weapon 11 | hardpoints[10].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 11) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 58 | Arc | hardpoints[10].arc, or hardpoints[10].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 11) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 59 | Num | hardpoints[11].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 12) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 60 | Weapon 12 | hardpoints[11].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 12) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 61 | Arc | hardpoints[11].arc, or hardpoints[11].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 12) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 62 | Num | hardpoints[12].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 13) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 63 | Weapon 13 | hardpoints[12].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 13) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 64 | Arc | hardpoints[12].arc, or hardpoints[12].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 13) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 65 | Num | hardpoints[13].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 14) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 66 | Weapon 14 | hardpoints[13].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 14) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 67 | Arc | hardpoints[13].arc, or hardpoints[13].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 14) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 68 | Num | hardpoints[14].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 15) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 69 | Weapon 15 | hardpoints[14].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 15) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 70 | Arc | hardpoints[14].arc, or hardpoints[14].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 15) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 71 | Num | hardpoints[15].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 16) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 72 | Weapon 16 | hardpoints[15].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 16) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 73 | Arc | hardpoints[15].arc, or hardpoints[15].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 16) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 74 | Num | hardpoints[16].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 17) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 75 | Weapon 17 | hardpoints[16].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 17) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 76 | Arc | hardpoints[16].arc, or hardpoints[16].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 17) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 77 | Num | hardpoints[17].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 18) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 78 | Weapon 18 | hardpoints[17].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 18) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 79 | Arc | hardpoints[17].arc, or hardpoints[17].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 18) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 80 | Num | hardpoints[18].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 19) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 81 | Weapon 19 | hardpoints[18].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 19) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 82 | Arc | hardpoints[18].arc, or hardpoints[18].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 19) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 83 | Num | hardpoints[19].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 20) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 84 | Weapon 20 | hardpoints[19].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 20) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 85 | Arc | hardpoints[19].arc, or hardpoints[19].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 20) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 86 | Num | hardpoints[20].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 21) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 87 | Weapon 21 | hardpoints[20].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 21) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 88 | Arc | hardpoints[20].arc, or hardpoints[20].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 21) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 89 | Num | hardpoints[21].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 22) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 90 | Weapon 22 | hardpoints[21].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 22) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 91 | Arc | hardpoints[21].arc, or hardpoints[21].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 22) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 92 | Num | hardpoints[22].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 23) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 93 | Weapon 23 | hardpoints[22].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 23) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 94 | Arc | hardpoints[22].arc, or hardpoints[22].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 23) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 95 | Num | hardpoints[23].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 24) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 96 | Weapon 24 | hardpoints[23].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 24) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 97 | Arc | hardpoints[23].arc, or hardpoints[23].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 24) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 98 | Num | hardpoints[24].count | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.boxes (file slot 25) | ×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch. | assumed | no |
| 99 | Weapon 25 | hardpoints[24].weapon | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.weaponId via engine/sim/rules-tables.ts weaponId (file slot 25) | Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots. | assumed | no |
| 100 | Arc | hardpoints[24].arc, or hardpoints[24].reloads | engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup M.arcId via engine/sim/rules-tables.ts arcId (file slot 25) | Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null. | assumed | no |
| 101 | Probes | probes | none in engine/sim or engine/render | Parsed. Not read in the duel slice. | unused | yes |
| 102 | T Bombs Base | tBombsBase | none in engine/sim or engine/render | Parsed. Not read in the duel slice. | unused | yes |
| 103 | T Bombs Max | tBombsMax | none in engine/sim or engine/render | Parsed. Not read in the duel slice. | unused | yes |
| 104 | Nuclear Mine Base | nuclearMinesBase | none in engine/sim or engine/render | Parsed. Not read in the duel slice. | unused | yes |
| 105 | Nuclear Mine Max | nuclearMinesMax | none in engine/sim or engine/render | Parsed. Not read in the duel slice. | unused | yes |
| 106 | Drone Control | droneControl | none in engine/sim or engine/render | Parsed. Not read in the duel slice. | unused | yes |
| 107 | ADD_6 | add6 | none. docs/rules/shiplist-mapping.md records ship ADD_6 as not read by ship rules | Kept on the row. The EaW-lineage file ignores ADD_6 (docs/formats/shiplist.md S7). Not a weapon mount. | unused | yes |
| 108 | ADD_12 | add12 | none. docs/rules/shiplist-mapping.md records ship ADD_12 as not read by ship rules | Kept on the row. The EaW-lineage file ignores ADD_12 (docs/formats/shiplist.md S7). Not a weapon mount. | unused | yes |
| 109 | Shuttles Size | shuttleBayCapacity | none in engine/sim or engine/render | Header is Shuttles Size. Parsed. Not read by the sim. | unused | yes |
| 110 | Launch Rate | launchRate | none in engine/sim or engine/render | Parsed. Not read by the sim. | unused | yes |
| 111 | General Base | adminShuttlesBase | none in engine/sim or engine/render | Header is General Base. Parsed. Not read by the sim. | unused | yes |
| 112 | General Max | adminShuttlesMax | none in engine/sim or engine/render | Header is General Max. Parsed. Not read by the sim. | unused | yes |
| 113 | Fighter Bay 1 | fighterBay0 | none in engine/sim or engine/render | Header is Fighter Bay 1. Parsed. Not read by the sim. | unused | yes |
| 114 | Fighter Type 1 | fighterType0 | none in engine/sim or engine/render | Header is Fighter Type 1. Parsed. Not read by the sim. | unused | yes |
| 115 | Fighter Bay 2 | fighterBay1 | none in engine/sim or engine/render | Header is Fighter Bay 2. Parsed. Not read by the sim. | unused | yes |
| 116 | Fighter Type 2 | fighterType1 | none in engine/sim or engine/render | Header is Fighter Type 2. Parsed. Not read by the sim. | unused | yes |
| 117 | Fighter Bay 3 | fighterBay2 | none in engine/sim or engine/render | Header is Fighter Bay 3. Parsed. Not read by the sim. | unused | yes |
| 118 | Fighter Type 3 | fighterType2 | none in engine/sim or engine/render | Header is Fighter Type 3. Parsed. Not read by the sim. | unused | yes |
| 119 | Fighter Bay 4 | fighterBay3 | none in engine/sim or engine/render | Header is Fighter Bay 4. Parsed. Not read by the sim. | unused | yes |
| 120 | Fighter Type 4 | fighterType3 | none in engine/sim or engine/render | Header is Fighter Type 4. Parsed. Not read by the sim. | unused | yes |
| 121 | Armor | armor | engine/sim/hull.ts H.armor exists, but engine/sim/bind-shiplist.ts does not copy this column (systems.armor stays unset, so the field stays 0) | ×1 boxes in the file. The loader drops the cell. The audit still reports the file value next to the sim value. | unused | yes |
| 122 | Forward Hull | hullForward | engine/sim/hull.ts H.hullForward exists, but engine/sim/bind-shiplist.ts does not copy Forward Hull | ×1 boxes. The loader drops the cell, so H.hullForward stays 0. | unused | yes |
| 123 | Center Hull | hullCenter | engine/sim/hull.ts H.hullCenter exists, but engine/sim/bind-shiplist.ts does not copy Center Hull | ×1 boxes. The loader drops the cell, so H.hullCenter stays 0. | unused | yes |
| 124 | Aft Hull | hullAft | engine/sim/hull.ts H.hullAft exists, but engine/sim/bind-shiplist.ts does not copy Aft Hull | ×1 boxes. The loader drops the cell, so H.hullAft stays 0. | unused | yes |
| 125 | Cargo | cargo | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 126 | Barracks | barracks | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 127 | Repair | repair | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 128 | R_L_Warp | warpSide | engine/sim/bind-shiplist.ts ShipSetup.warp → engine/sim/hull.ts H.warp100 | ×2, then added to C_Warp. The file stores one side rating. The loader treats two engines. Unverified on CE 2.670. | assumed | no |
| 129 | C_Warp | warpCenter | engine/sim/bind-shiplist.ts ShipSetup.warp → engine/sim/hull.ts H.warp100 | ×1, added to the doubled side term. power.warp = 2×R_L_Warp + C_Warp. | assumed | no |
| 130 | Impulse | impulse | engine/sim/bind-shiplist.ts ShipSetup.impulse → engine/sim/hull.ts H.impulse100 | ×1. Included in the generation sum warp + impulse + APR. | assumed | no |
| 131 | Apr | apr | engine/sim/bind-shiplist.ts ShipSetup.apr → engine/sim/hull.ts H.apr100 | ×1. Included in the generation sum. | assumed | no |
| 132 | Battery | battery | engine/sim/bind-shiplist.ts ShipSetup.battery and batteryCapacity → engine/sim/hull.ts H.battery100 and H.batteryCapacity100 | ×1. The same cell is the starting charge and the capacity (the hull starts full). | assumed | no |
| 133 | Bridge | bridge | engine/sim/hull.ts H.bridge exists, but engine/sim/bind-shiplist.ts does not copy Bridge | ×1 boxes. The loader drops the cell, so H.bridge stays 0. | unused | yes |
| 134 | Security | security | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 135 | Lab | lab | none. engine/sim/phase3.ts EW cap reads sensors + scanners + specialSensors, not lab | Parsed. Not copied onto the hull. | unused | yes |
| 136 | Transporters | transporters | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 137 | Tractors | tractors | engine/sim/bind-shiplist.ts ShipSetup.tractors → engine/sim/phase3.ts → engine/sim/hull.ts H.tractors | ×1 boxes. Zero means no tractor. | assumed | no |
| 138 | Mech Tractors | mechTractors | none. docs/rules/phase3-systems.md leaves mechTractors unread | Parsed and not read. | unused | yes |
| 139 | Special Sensors | specialSensors | engine/sim/bind-shiplist.ts ShipSetup.specialSensors → engine/sim/phase3.ts → engine/sim/hull.ts H.specialSensors | ×1 boxes. Each box can spot a cloak the range check missed. | assumed | no |
| 140 | Sensors | sensors | engine/sim/bind-shiplist.ts ShipSetup.systems.sensors → engine/sim/hull.ts H.sensors | ×1 boxes. Part of the EW cap with scanners and special sensors. | assumed | no |
| 141 | Scanners | scanners | engine/sim/bind-shiplist.ts ShipSetup.scanners → engine/sim/phase3.ts → engine/sim/hull.ts H.scanners | ×1 boxes. Each box extends cloak detection. | assumed | no |
| 142 | Explosion Strength | explosionStrength | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 143 | Acceleration | acceleration | engine/sim/bind-shiplist.ts ShipSetup.acceleration → engine/sim/hull.ts H.acceleration → engine/sim/combat.ts speed step | ×1 speed per turn. Empty means the hull does not move (stored as -1). | assumed | no |
| 144 | Damage Control | damageControl | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 145 | Extra Damage | extraDamage | engine/sim/hull.ts H.extra exists, but engine/sim/bind-shiplist.ts does not copy Extra Damage | ×1. The loader drops the cell, so H.extra stays 0. | unused | yes |
| 146 | Ship Cost | cost | none in engine/sim or engine/render | Header is Ship Cost. Parsed. Not on ShipSetup. | unused | yes |
| 147 | Refit Base Class | refitBaseClass | tools/formats/shiplist.ts missingRefitBase only | String, case kept. The sim does not read it. | unused | yes |
| 148 | Geometry | geometry | engine/render/src/ship-catalog.ts LoadedShip.geometry | Install-relative path, slashes normalized. No scale. | assumed | no |
| 149 | UI | uiKey | none in engine/sim or engine/render | Header is UI. Parsed. No runtime reader yet. | unused | yes |
| 150 | Full Name | displayName | none in engine/sim or engine/render | Header is Full Name. Parsed. Values from an install are never committed. | unused | yes |
| 151 | refits | raw column (no role id; kept under the header name) | none | Spreadsheet column. Not a role and not a weapon slot. | unused | yes |
| 152 | Balance | raw column (no role id; kept under the header name) | none | Spreadsheet column. Not a role. | unused | yes |
| 153 | End | raw column (no role id; kept under the header name) | none | Spreadsheet column. Not a role. | unused | yes |
| 154 | (empty) | raw column (no role id; kept under the header name) | none | Blank header. Kept as a raw column. Not a role. | unused | yes |
| 155 | W1 | raw column (no role id; kept under the header name) | none | W1 is an extra spreadsheet column. It is not hardpoints[0] and it is not mounted. | unused | yes |
| 156 | W2 | raw column (no role id; kept under the header name) | none | W2 is an extra spreadsheet column. It is not hardpoints[1] and it is not mounted. | unused | yes |
| 157 | W3 | raw column (no role id; kept under the header name) | none | W3 is an extra spreadsheet column. It is not hardpoints[2] and it is not mounted. | unused | yes |
| 158 | W4 | raw column (no role id; kept under the header name) | none | W4 is an extra spreadsheet column. It is not hardpoints[3] and it is not mounted. | unused | yes |
| 159 | W5 | raw column (no role id; kept under the header name) | none | W5 is an extra spreadsheet column. It is not hardpoints[4] and it is not mounted. | unused | yes |
| 160 | W6 | raw column (no role id; kept under the header name) | none | W6 is an extra spreadsheet column. It is not hardpoints[5] and it is not mounted. | unused | yes |
| 161 | W7 | raw column (no role id; kept under the header name) | none | W7 is an extra spreadsheet column. It is not hardpoints[6] and it is not mounted. | unused | yes |
| 162 | W8 | raw column (no role id; kept under the header name) | none | W8 is an extra spreadsheet column. It is not hardpoints[7] and it is not mounted. | unused | yes |
| 163 | W9 | raw column (no role id; kept under the header name) | none | W9 is an extra spreadsheet column. It is not hardpoints[8] and it is not mounted. | unused | yes |
| 164 | W10 | raw column (no role id; kept under the header name) | none | W10 is an extra spreadsheet column. It is not hardpoints[9] and it is not mounted. | unused | yes |
| 165 | W11 | raw column (no role id; kept under the header name) | none | W11 is an extra spreadsheet column. It is not hardpoints[10] and it is not mounted. | unused | yes |
| 166 | W12 | raw column (no role id; kept under the header name) | none | W12 is an extra spreadsheet column. It is not hardpoints[11] and it is not mounted. | unused | yes |
| 167 | W13 | raw column (no role id; kept under the header name) | none | W13 is an extra spreadsheet column. It is not hardpoints[12] and it is not mounted. | unused | yes |
| 168 | W14 | raw column (no role id; kept under the header name) | none | W14 is an extra spreadsheet column. It is not hardpoints[13] and it is not mounted. | unused | yes |
| 169 | W15 | raw column (no role id; kept under the header name) | none | W15 is an extra spreadsheet column. It is not hardpoints[14] and it is not mounted. | unused | yes |
| 170 | W16 | raw column (no role id; kept under the header name) | none | W16 is an extra spreadsheet column. It is not hardpoints[15] and it is not mounted. | unused | yes |
| 171 | W17 | raw column (no role id; kept under the header name) | none | W17 is an extra spreadsheet column. It is not hardpoints[16] and it is not mounted. | unused | yes |
| 172 | W18 | raw column (no role id; kept under the header name) | none | W18 is an extra spreadsheet column. It is not hardpoints[17] and it is not mounted. | unused | yes |
| 173 | W19 | raw column (no role id; kept under the header name) | none | W19 is an extra spreadsheet column. It is not hardpoints[18] and it is not mounted. | unused | yes |
| 174 | W20 | raw column (no role id; kept under the header name) | none | W20 is an extra spreadsheet column. It is not hardpoints[19] and it is not mounted. | unused | yes |
| 175 | W21 | raw column (no role id; kept under the header name) | none | W21 is an extra spreadsheet column. It is not hardpoints[20] and it is not mounted. | unused | yes |
| 176 | W22 | raw column (no role id; kept under the header name) | none | W22 is an extra spreadsheet column. It is not hardpoints[21] and it is not mounted. | unused | yes |
| 177 | W23 | raw column (no role id; kept under the header name) | none | W23 is an extra spreadsheet column. It is not hardpoints[22] and it is not mounted. | unused | yes |
| 178 | W24 | raw column (no role id; kept under the header name) | none | W24 is an extra spreadsheet column. It is not hardpoints[23] and it is not mounted. | unused | yes |
| 179 | W25 | raw column (no role id; kept under the header name) | none | W25 is an extra spreadsheet column. It is not hardpoints[24] and it is not mounted. | unused | yes |
| 180 | Weapon BPV | raw column (no role id; kept under the header name) | none | Spreadsheet total. Not a weapon and not a sim field. | unused | yes |
| 181 | FB1 | raw column (no role id; kept under the header name) | none | Spreadsheet column FB1. Not Fighter Bay 1 and not a sim field. | unused | yes |
| 182 | FB2 | raw column (no role id; kept under the header name) | none | Spreadsheet column FB2. Not a sim field. | unused | yes |
| 183 | FB3 | raw column (no role id; kept under the header name) | none | Spreadsheet column FB3. Not a sim field. | unused | yes |
| 184 | FB4 | raw column (no role id; kept under the header name) | none | Spreadsheet column FB4. Not a sim field. | unused | yes |
| 185 | Fighter Subtotal | raw column (no role id; kept under the header name) | none | Spreadsheet total. Not a sim field. | unused | yes |
| 186 | System BPV | raw column (no role id; kept under the header name) | none | Spreadsheet total. Not a sim field. | unused | yes |
| 187 | BPV Subtotal | raw column (no role id; kept under the header name) | none | Spreadsheet total. Not a sim field. | unused | yes |
| 188 | SFB Year First Available | sfbYearFirstAvailable | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |
| 189 | SFB Year Last Available | sfbYearLastAvailable | none in engine/sim or engine/render | Parsed. Not on ShipSetup. | unused | yes |

## Ignored columns

Every column flagged ignored, by index:

- 3 Class Type
- 4 BPV
- 5 Special Role
- 6 Year First Available
- 7 Year Last Available
- 8 Size Class
- 11 HET +2 Turns & Nimble
- 12 HET Breakdown
- 15 Boarding Parties Base
- 16 Boarding Parties Max
- 17 Deck Crews
- 18 Total Crew
- 24 Shield Total
- 101 Probes
- 102 T Bombs Base
- 103 T Bombs Max
- 104 Nuclear Mine Base
- 105 Nuclear Mine Max
- 106 Drone Control
- 107 ADD_6
- 108 ADD_12
- 109 Shuttles Size
- 110 Launch Rate
- 111 General Base
- 112 General Max
- 113 Fighter Bay 1
- 114 Fighter Type 1
- 115 Fighter Bay 2
- 116 Fighter Type 2
- 117 Fighter Bay 3
- 118 Fighter Type 3
- 119 Fighter Bay 4
- 120 Fighter Type 4
- 121 Armor
- 122 Forward Hull
- 123 Center Hull
- 124 Aft Hull
- 125 Cargo
- 126 Barracks
- 127 Repair
- 133 Bridge
- 134 Security
- 135 Lab
- 136 Transporters
- 138 Mech Tractors
- 142 Explosion Strength
- 144 Damage Control
- 145 Extra Damage
- 146 Ship Cost
- 147 Refit Base Class
- 149 UI
- 150 Full Name
- 151 refits
- 152 Balance
- 153 End
- 154 (empty)
- 155 W1
- 156 W2
- 157 W3
- 158 W4
- 159 W5
- 160 W6
- 161 W7
- 162 W8
- 163 W9
- 164 W10
- 165 W11
- 166 W12
- 167 W13
- 168 W14
- 169 W15
- 170 W16
- 171 W17
- 172 W18
- 173 W19
- 174 W20
- 175 W21
- 176 W22
- 177 W23
- 178 W24
- 179 W25
- 180 Weapon BPV
- 181 FB1
- 182 FB2
- 183 FB3
- 184 FB4
- 185 Fighter Subtotal
- 186 System BPV
- 187 BPV Subtotal
- 188 SFB Year First Available
- 189 SFB Year Last Available
