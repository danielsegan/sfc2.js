# Field mapping, scale factors, weapons and arcs

Status: Phase 2. Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Parser contract: [`docs/formats/shiplist.md`](../formats/shiplist.md) and [`docs/formats/ftrlist.md`](../formats/ftrlist.md). Spawn key `{ race, className }`: [`docs/missions/mission-api.md`](../missions/mission-api.md) ([#41](https://github.com/danielsegan/sfc2.js/pull/41)).

The parser keeps raw header names and cell values as written. It emits all 25 shiplist weapon slots, including empty ones, each with `slotIndex`. It does not apply ×2 and it does not rename weapon or arc codes. The engine loader binds headers, applies the scale table below at fixed-point conversion, and compacts empty hardpoints while keeping `slotIndex`.

Shiplist header detection is still pending the metadata inventory ([#6](https://github.com/danielsegan/sfc2.js/issues/6)). The shiplist keys below are the provisional source keys from the format spec, not claimed CE header strings. The ftrlist header is the inventory summary: a comment on line 1, the 36-column header on line 2. The comment text is not copied.

## 1. Engine model

```ts
interface ShipModel {
  spawnKey: string;                 // `${race}:${className}`
  race: string;
  className: string;
  class: "ship" | "pf";             // rules flag; PFs use the full ship model
  power: { warp: Fx; impulse: Fx; apr: Fx; battery: Fx; batteryCapacity: Fx };
  movement: { moveCost: Fx; turnMode: string; acceleration: Fx | null; speed: Fx; heading16: number };
  shields: Fx[];                    // length 6, index 0 = front, clockwise
  shieldsMax: Fx[];
  systems: Record<string, number>; // flat box counts
  crew: { crewUnits: number; boardingParties: number; minCrew: number };
  weapons: Mount[];
  capacitor: Fx;
}

interface Mount {
  slotIndex: number;                // shiplist 0..24; ftrlist group 0..4
  weapon: string | null;            // exact file code
  arc: string | null;               // exact file code; null when the cell is empty
  count: number | null;
  reloads: number | null;           // shiplist drone racks; separate from arc
  load: number | null;              // ftrlist Shots column
}

interface FighterModel {
  fighterKey: string;               // `${race}:${type}`
  race: string;
  typeName: string;
  class: "fighter";
  speed: number | null;
  turnMode: null;                   // no turn-mode column in the observed header
  damagePoints: number | null;
  weapons: Mount[];                 // five groups, slotIndex 0..4
  ecm: number | null;
  eccm: number | null;
  add6: number | null;
  groundAttackBonus: number | null;
  bpv: number | null;
  carrierSizeClass: number | null;
  yearFirstAvailable: number | null;
  yearLastAvailable: number | null;
  sizeClass: number | null;
  uiKey: string | null;
  geometry: string | null;
  displayName: string | null;       // never commit values from the install
  bay: { rearmTicks: null };        // no rearm column observed
}
```

The duel target list, fleet roster, target plate, and field tags use that `displayName` when the row has a `Full Name`, `Name`, or `Display Name` column. An empty name falls back to the class token. Synthetic skirmish rows stay `Federation Fixture cruiser` and are not shiplist names.

Absent ftrlist columns become `null`. A written zero stays 0. Fixed-point conversion uses 16.16 (`FX_SHIFT = 16`, one unit = one range unit) from [`docs/engine/sim-core.md`](../engine/sim-core.md). That file is not on `main` yet.

The CE 2.670 shiplist has 15 `FTR` hull rows and no PF rows. `class: "pf"` stays on the model for a mod or a later file. Stock fighters are the lighter model, and the duel entry points reject them with `notAShip`.

## 2. Shiplist source key → engine field

Provisional keys, pending real headers. Shield fan-out (1:1 per facing) and `warpSide` ×2 happen in the loader, in that order.

| Provisional source | Engine field | Transform |
| --- | --- | --- |
| `race`, `className` | `race`, `className`, `spawnKey` | Spawn key is `${race}:${className}` with case kept. |
| `hullType` | `class` | `ship` until the CE PF token is identified, then `pf`. |
| `bpv`, years, `specialRole`, `cost`, refit fields | identity block, same names | ×1. |
| `sizeClass`, `turnMode`, `moveCost`, `acceleration`, `hetChance`, `hetBreakdown` | `movement.*` | ×1. Empty acceleration means the hull does not move. |
| `stealth` | `stealth` | Free ECM added to paid ECM. Negative is allowed. The sum floors at 0. See [phase3-systems.md](phase3-systems.md). |
| `crew` | `crew.crewUnits` | ×1. Observed CE header: `Regular Crew`. |
| `boardingPartiesBase` | `crew.boardingParties` | Current parties. `boardingPartiesMax` kept beside it. |
| `minCrew`, `deckCrews` | `crew.minCrew`, `crew.deckCrews` | ×1. |
| shield front (`Shield 1`), forward-side (`Shield 2 _ 6`, role `shieldForwardSide`), aft-side (`Shield 3 _ 5`, role `shieldAftSide`), rear (`Shield 4`) | `shieldsMax[0..5]` | Fan out, ×1 (1:1 per facing; measured CE in-battle capture 2026-11-24). See the scale table. |
| `cloakCost` | `cloakCost` | Empty means no cloak. Resolution is [phase3-systems.md](phase3-systems.md). |
| hardpoint `slotIndex`, `weapon`, `arc`, `count` | `weapons[]` | Codes stay exact, including case. File slot 1 is `slotIndex` 0. Empty slots drop only after `slotIndex` is kept. |
| hardpoint numeric `Arc` on `DroA`/`DroB`/`DroC`/`DroF`/`DroG`/`ADD6`/`ADD12` | `weapons[].reloads` | The cell is a whole number (1–3 observed; ADD only ever shows 1). Those racks have no firing arc. A number on any other weapon, or a letter or empty cell on these weapons, is `unknownArc`. |
| `warpSide`, `warpCenter` | `power.warp` | Side term ×2, centre term ×1, then add. Observed CE headers: `R_L_Warp`, `C_Warp`. |
| `impulse`, `apr` | `power.impulse`, `power.apr` | ×1. |
| `battery` | `power.battery` and `power.batteryCapacity` | The file number is both the starting charge and the capacity (ship starts full). Pending playtest. |
| `armor`, `hullForward`, `hullCenter`, `hullAft`, `cargo`, `barracks`, `repair`, `bridge`, `security`, `lab`, `transporters`, `tractors`, `mechTractors`, `specialSensors`, `sensors`, `scanners`, `damageControl`, `extraDamage` | `systems.<same key>` | Flat box counts. The lab key is `lab`, lowercase and singular. Phase 3 also reads `sensors` + `scanners` + `specialSensors` as the EW cap, `scanners` and `specialSensors` for cloak detection, and `tractors` as the tractor bid cap. `mechTractors` stays stored and unresolved. |
| `probes`, mine and shuttle counts, `fighterBays` | `systems` or `bays`, same names | Carried stores. Not resolved in the duel slice. |
| `geometry`, `uiKey` | `geometry`, `uiKey` | Art. Passed through. |

`add6` and `add12` are kept and not read by ship rules (the format spec already records them as ignored on the EaW-lineage file). Fighter `ADD_6` is a different column and is mapped below.

## 3. Scale-factor table

Canonical copy: [`data/scale-factors.json`](data/scale-factors.json). The loader applies it when it converts to fixed-point. The parser does not.

| Source | Factor | Engine result | Verification |
| --- | --- | --- | --- |
| Each shield file cell, after fan-out (`Shield 1`, `Shield 2 _ 6`, `Shield 3 _ 5`, `Shield 4`) | ×1 | `shieldsMax[i]` | Measured on CE 2.670 (CE in-battle capture 2026-11-24): 1:1 per facing, no ×2. `Shield Total = S1 + 2·S2_6 + 2·S3_5 + S4` held on all 1,157 CE rows. Live overrides are [`data/measured.json`](data/measured.json). |
| `warpSide` | ×2 | Side-engine term of `power.warp` | Unverified on CE 2.670. The file stores one side rating; the model treats two engines. |
| `warpCenter` | ×1 | Centre-engine term, added to the side term | |
| `impulse`, `apr`, `battery` | ×1 | `power` fields | |
| Every other numeric source | ×1 | As mapped | Includes `moveCost`, crew, boxes, weapon counts, drone `reloads`. |

Shield fan-out, file order front, forward-side, aft-side, rear:

| Index | Facing | File cell |
| --- | --- | --- |
| 0 | front (SFB #1) | front |
| 1 | front-right (SFB #2) | forward-side |
| 2 | rear-right (SFB #3) | aft-side |
| 3 | rear (SFB #4) | rear |
| 4 | rear-left (SFB #5) | aft-side |
| 5 | front-left (SFB #6) | forward-side |

Worked synthetic case: file cells 10, 8, 6, 4 and `warpSide` 5, `warpCenter` 3 become shields `[10, 8, 6, 4, 6, 8]` and `power.warp` 13. Fixture: `tests/scale-factors.json`.

The observed CE 2.670 header (inventory metadata, no rows copied) has four shield columns, not six: `Shield 1`, `Shield 2 _ 6`, `Shield 3 _ 5`, `Shield 4`. Side values are not separate columns. The loader reads `Shield 1` to facing index 0 (front), `Shield 2 _ 6` (`shieldForwardSide`) to facing indexes 1 (front right) and 5 (front left), `Shield 3 _ 5` (`shieldAftSide`) to facing indexes 2 (rear right) and 4 (rear left), and `Shield 4` to facing index 3 (rear), each 1:1 with no ×2. A row that shows bow and stern filled and all four sides at 0 is that paired header left unbound.

HUD sanity check (2026-11-24, `main` after #103). The in-battle HUD read `F-CA` 30 / 24 / 20 / 20 / 20 / 24 and `K-D7` 30 / 22 / 15 / 13 / 15 / 22 (bow, forward starboard, aft starboard, stern, aft port, forward port). Both rows have the shape the 1:1 fan-out gives: index 2 equals index 4, index 1 equals index 5, and index 3 is its own cell. `F-CA`'s aft-side value equalling its stern is not an index error on its own; `K-D7`, where those cells differ (15 and 13), shows aft-side and stern in their own slots. A synthetic test with four distinct cells in three column orders (`engine/sim/combat.test.ts`) checks binder, spawn, and snapshot keep every cell on its facing, and the HUD labels the six facings in the same index order. The CE row cells themselves stay on sfc2-ci and were not re-read for this check (**TO VERIFY** there: `F-CA` `Shield 3 _ 5` and `Shield 4` cells).

Measured against CE 2.670 (CE in-battle capture 2026-11-24): each cell maps 1:1 to its facing(s) with no ×2, `Shield Total = S1 + 2·S2_6 + 2·S3_5 + S4` held on all 1,157 CE rows, and no sixth shield column is in the header. Note: the CE Vessel Library screen is unreliable for shields (some rear values, e.g. on D7/POL/E4 rows, disagree with the table); the in-battle six-segment ring and the table agree.

## 4. Weapon and arc mapping

Canonical copy: [`data/weapon-arcs.json`](data/weapon-arcs.json). Codes match the CE 2.670 metadata exactly, including case. The loader checks the union of the shiplist rows and the ftrlist-only rows. A non-empty code that is not in that set is `unknownWeapon` or `unknownArc` (`source: "loader"`, severity warning). A mod that spells a plasma code differently, including `PLAF`, is unknown and is not folded into a nearby row. Empty cells are silent.

### 4.1 Slots

File slots are 1–25. The engine `slotIndex` is the file slot minus 1.

| File slots | Weapon column | Columns |
| --- | --- | --- |
| 1–10 | `Heavy Weapon 1` … `Heavy Weapon 10` | Slot 1 is columns 26–28 (Num, weapon, Arc). Each next slot is the next three columns. |
| 11–25 | `Weapon 11` … `Weapon 25` | Slot 25 is columns 98–100. |

`Ph3` also appears on heavy-slot rows (5 rows in the inventory summary). A weapon is a phaser because its code maps to `phaser`, not because of the slot. Every phaser feeds the capacitor.

### 4.2 Shiplist weapon codes

Thirty-one codes. Cost rows in this file stay empty until playtest. The sim applies `costFallback` to a phaser or photon that has no cost of its own, so a CE hull can arm; other codes stay at cost 0 and are outside the duel. A code that is not in this table is `unknownWeapon` and is not mounted. `PLaF` is the same weapon as `PlaF`, and the same pairing holds for G, R and S. `PlaD` and `PlaI` have no `PLa` twin.

| Code | Internal | Notes |
| --- | --- | --- |
| `Phot` | `photon` | |
| `Dis1` `Dis2` `Dis3` `Dis4` | `disruptor` | Distinct rows, not aliases. |
| `PlaD` | `plasma` | `weaponId` `plasma-d` |
| `PlaF` / `PLaF` | `plasma` | Both `weaponId` `plasma-f` |
| `PlaG` / `PLaG` | `plasma` | Both `weaponId` `plasma-g` |
| `PlaI` | `plasma` | `weaponId` `plasma-i` |
| `PlaR` / `PLaR` | `plasma` | Both `weaponId` `plasma-r` |
| `PlaS` / `PLaS` | `plasma` | Both `weaponId` `plasma-s` |
| `DroA` `DroB` `DroC` `DroF` `DroG` | `drone` | `reloadCounted` true. No firing arc. Seeking, so they launch in any direction. |
| `ESG` | `esg` | |
| `Fus` | `fusion` | |
| `HB` | `hellbore` | |
| `PPD` | `ppd` | |
| `ADD6` `ADD12` | `add` | `reloadCounted` true. No firing arc, so they fire in any direction. Observed count is only 1. |
| `Ph1` `Ph2` `Ph3` `Ph4` `PhG` | `phaser` | Capacitor follows the code, any slot |

`TEST-PH`, `TEST-PHOT` and `TEST-DRN` stay in the data file as synthetic duel stand-ins. They are not CE codes.

### 4.3 Ftrlist weapon codes

`Ph2`, `Ph3` and `PhG` are the shiplist rows above. These six are ftrlist-only:

| Code | Internal | Notes |
| --- | --- | --- |
| `PhoF` | `photon` | Trailing F is read as fighter-scale. That reading is TO VERIFY. |
| `DisF` | `disruptor` | Same F caution. Outside the Phase 2 fire path. |
| `HellF` | `hellbore` | Same F caution. |
| `FusF` | `fusion` | Same F caution. |
| `DroI` `DroVI` | `drone` | Not `reloadCounted`. ftrlist gives them the letter arc `ALL`. The roman suffix may be a mark, a speed or a warhead. TO VERIFY. |

Fighter drones keep a letter arc. Shiplist `Dro*` and `ADD*` do not: their Arc cell is only the count.

### 4.4 Arcs

Twenty-eight codes: `RS`, `LS`, `ALL`, `FA`, `FX`, `FH`, `FAL`, `FAR`, `RX`, `RH`, `LLR`, `RRR`, `LP`, `RP`, `RAR`, `RAL`, `LW`, `RW`, `RA`, `FLL`, `FRR`, `FHL`, `FHR`, `FLLX`, `FRRX`, plus `1`, `2` and `3`. The numbers appear only in heavy-slot Arc cells.

`1`, `2` and `3` are not facings. Confirmed pairing: they occur only on `DroA`, `DroB`, `DroC`, `DroF`, `DroG`, `ADD6` and `ADD12`, and every shiplist row of those codes has one. The number is stored as `reloads`. Whether it means reloads or rack capacity is TO VERIFY by playtest. ADD racks only ever show 1. A numeric Arc on any other weapon is `unknownArc`. A letter arc or an empty cell on these weapons is also `unknownArc`. Fixtures: `tests/shiplist-code-load.json`.

Every letter arc below is a provisional set of the six shield facings (0 = front, clockwise). **All of them are TO VERIFY by playtest.** Some provisional sets coincide; playtest has to split them. Spans are the facing bins from the duel slice, half-open, wrapped when they cross the bow.

| Code | Facings | Reading |
| --- | --- | --- |
| `ALL` | 0–5 | Every facing. |
| `FH` | 0 | Bow only. |
| `FA` | 5, 0, 1 | Bow and both forward shoulders. |
| `FX` | 4, 5, 0, 1, 2 | Forward arc extended through both side facings. Stern stays out. |
| `FAL` | 5, 0 | Bow and forward-left. |
| `FAR` | 0, 1 | Bow and forward-right. |
| `FLL` | 5 | Forward-left shoulder. |
| `FRR` | 1 | Forward-right shoulder. |
| `FHL` | 4, 5, 0 | Left half of the extended forward arc, bow included. |
| `FHR` | 0, 1, 2 | Right half of the extended forward arc, bow included. |
| `FLLX` | 4, 5 | Forward-left plus rear-left. Bow stays out. |
| `FRRX` | 1, 2 | Forward-right plus rear-right. Bow stays out. |
| `RH` | 3 | Stern only. |
| `RA` | 2, 3, 4 | Stern and both rear shoulders. |
| `RX` | 1, 2, 3, 4, 5 | Rear arc extended through both forward shoulders. Bow stays out. |
| `RAL` | 3, 4 | Stern and rear-left. |
| `RAR` | 2, 3 | Stern and rear-right. |
| `LS` | 4, 5 | Both left-side facings. Same provisional set as `FLLX`. |
| `RS` | 1, 2 | Both right-side facings. Same provisional set as `FRRX`. |
| `LP` | 5 | Narrow port. Same provisional set as `FLL`. |
| `RP` | 1 | Narrow starboard. Same provisional set as `FRR`. |
| `LW` | 4 | Rear-left, read as a left wing. |
| `RW` | 2 | Rear-right, read as a right wing. |
| `LLR` | 3, 4 | Rear-left and stern. Same provisional set as `RAL`. |
| `RRR` | 2, 3 | Rear-right and stern. Same provisional set as `RAR`. |

Synthetic duel arcs `TEST-FA`, `TEST-ALL`, `TEST-STBD` and `TEST-PORT` stay in the data file for the old fixtures. They are not CE codes.

Relative bearings are uint16, 0 at the bow, increasing clockwise. Boundary headings belong to the clockwise-next shield facing. The six facing bins are:



| Facing | Index | Headings |
| --- | --- | --- |
| front | 0 | `[60075, 65536)` and `[0, 5462)` |
| front-right | 1 | `[5462, 16384)` |
| rear-right | 2 | `[16384, 27307)` |
| rear | 3 | `[27307, 38230)` |
| rear-left | 4 | `[38230, 49152)` |
| front-left | 5 | `[49152, 60075)` |

## 5. Ftrlist header → engine field

Inventory summary, CE 2.670, names only. Line 1 is a comment (text not stored here). Line 2 is the header. Thirty-six columns. Five weapon groups follow Speed. `Weapon1` through `Weapon5` pair with their `Num`, `Arc` and `Shots` neighbours by column order (`slotIndex` 0..4). Slots 4 and 5 (`Weapon4`, `Weapon5`) have no Arc filled in. The shiplist beside this file has 15 `FTR` hull rows and no PF rows.

| # | Header | Engine field |
| --- | --- | --- |
| 1 | `Race` | `race` |
| 2 | `Type` | `typeName`, and `fighterKey = race + ":" + type` |
| 3 | `Speed` | `speed` |
| 4 | `Num` | `weapons[0].count` |
| 5 | `Weapon1` | `weapons[0].weapon` |
| 6 | `Arc` | `weapons[0].arc` |
| 7 | `Shots` | `weapons[0].load` |
| 8 | `Num` | `weapons[1].count` |
| 9 | `Weapon2` | `weapons[1].weapon` |
| 10 | `Arc` | `weapons[1].arc` |
| 11 | `Shots` | `weapons[1].load` |
| 12 | `Num` | `weapons[2].count` |
| 13 | `Weapon3` | `weapons[2].weapon` |
| 14 | `Arc` | `weapons[2].arc` |
| 15 | `Shots` | `weapons[2].load` |
| 16 | `Num` | `weapons[3].count` |
| 17 | `Weapon4` | `weapons[3].weapon` |
| 18 | `Arc` | `weapons[3].arc` |
| 19 | `Shots` | `weapons[3].load` |
| 20 | `Num` | `weapons[4].count` |
| 21 | `Weapon5` | `weapons[4].weapon` |
| 22 | `Arc` | `weapons[4].arc` |
| 23 | `Shots` | `weapons[4].load` |
| 24 | `Damage` | `damagePoints` |
| 25 | `ADD_6` | `add6` |
| 26 | `Ground Attack Bonus` | `groundAttackBonus` |
| 27 | `ECM` | `ecm` |
| 28 | `ECCM` | `eccm` |
| 29 | `BPV` | `bpv` |
| 30 | `Carrier Size Class` | `carrierSizeClass` |
| 31 | `First Year Avail` | `yearFirstAvailable` |
| 32 | `Last Year Avail` | `yearLastAvailable` |
| 33 | `Size` | `sizeClass` |
| 34 | `UI` | `uiKey` |
| 35 | `Geometry` | `geometry` |
| 36 | `Name` | `displayName` |

`Shots` is mapped to `load` (rounds on the mount). `reload` stays `null` until playtest shows whether `Shots` is the magazine or the reload stock. `turnMode` and `rearmTicks` stay `null` because those columns are not in the header. `ADD_6` is stored; whether a fighter's anti-drone magazine actually fires is pending. `Ground Attack Bonus` is stored; the ground-attack rule is pending. `Carrier Size Class` says which carrier size can field the type. It is not a bay count.

No scale factor other than ×1 applies to ftrlist numbers.
