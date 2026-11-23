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

Absent ftrlist columns become `null`. A written zero stays 0. Fixed-point conversion uses the provisional scale `fxScale = 1000` milli-units until [`docs/engine/determinism.md`](../engine/determinism.md) names the production format. That file is not on `main` yet.

PFs are shiplist rows with `class: "pf"` once the CE hull token is known (still pending). They run the ship rules. Fighters are the lighter model and the duel entry points reject them with `notAShip`.

## 2. Shiplist source key → engine field

Provisional keys, pending real headers. Fan-out and ×2 happen in the loader, in that order.

| Provisional source | Engine field | Transform |
| --- | --- | --- |
| `race`, `className` | `race`, `className`, `spawnKey` | Spawn key is `${race}:${className}` with case kept. |
| `hullType` | `class` | `ship` until the CE PF token is identified, then `pf`. |
| `bpv`, years, `specialRole`, `cost`, refit fields | identity block, same names | ×1. |
| `sizeClass`, `turnMode`, `moveCost`, `acceleration`, `hetChance`, `hetBreakdown` | `movement.*` | ×1. Empty acceleration means the hull does not move. |
| `stealth` | `movement.stealth` | Stored. Rules ignore it until CE 2.670 is seen using it. |
| `crew` | `crew.crewUnits` | ×1. |
| `boardingPartiesBase` | `crew.boardingParties` | Current parties. `boardingPartiesMax` kept beside it. |
| `minCrew`, `deckCrews` | `crew.minCrew`, `crew.deckCrews` | ×1. |
| shield front, forward-side, aft-side, rear | `shieldsMax[0..5]` | Fan out, then ×2. See the scale table. |
| `cloakCost` | `systems.cloakCost` | Empty means no cloak. Cloak resolution is Phase 3. |
| hardpoint `slotIndex`, `weapon`, `arc`, `count` | `weapons[]` | Codes stay exact. Empty slots dropped only after `slotIndex` is kept. |
| hardpoint `reloads` | `weapons[].reloads` | Drone racks only. The arc cell is not also an arc. |
| `warpSide`, `warpCenter` | `power.warp` | Side term ×2, centre term ×1, then add. |
| `impulse`, `apr` | `power.impulse`, `power.apr` | ×1. |
| `battery` | `power.battery` and `power.batteryCapacity` | The file number is both the starting charge and the capacity (ship starts full). Pending playtest. |
| `armor`, `hullForward`, `hullCenter`, `hullAft`, `cargo`, `barracks`, `repair`, `bridge`, `security`, `lab`, `transporters`, `tractors`, `mechTractors`, `specialSensors`, `sensors`, `scanners`, `damageControl`, `extraDamage` | `systems.<same key>` | Flat box counts. The format spec's engine sketch says `labs`; this mapping uses `lab` to match the proposed source key. |
| `probes`, mine and shuttle counts, `fighterBays` | `systems` or `bays`, same names | Carried stores. Not resolved in the duel slice. |
| `geometry`, `uiKey` | `geometry`, `uiKey` | Art. Passed through. |

`add6` and `add12` are kept and not read by ship rules (the format spec already records them as ignored on the EaW-lineage file). Fighter `ADD_6` is a different column and is mapped below.

## 3. Scale-factor table

Canonical copy: [`data/scale-factors.json`](data/scale-factors.json). The loader applies it when it converts to fixed-point. The parser does not.

| Source | Factor | Engine result | Verification |
| --- | --- | --- | --- |
| Each shield file cell, after fan-out | ×2 | `shieldsMax[i]` | Unverified on CE 2.670. Recorded from the SFC1-lineage note in the shiplist spec. |
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

Worked synthetic case: file cells 10, 8, 6, 4 and `warpSide` 5, `warpCenter` 3 become shields `[20, 16, 12, 8, 12, 16]` and `power.warp` 13. Fixture: `tests/scale-factors.json`.

## 4. Weapon and arc mapping

One table, two sections. Canonical copy: [`data/weapon-arcs.json`](data/weapon-arcs.json). The loader checks the union. A code in either section is known. `unknownWeapon` and `unknownArc` (`source: "loader"`, severity warning) fire when the cell is non-empty and absent from both sections. Empty cells are silent. Drone rows with a null arc do not raise `unknownArc`.

Relative bearings are uint16, 0 at the bow, increasing clockwise. Spans are half-open `[from16, to16)`. A wrapped span crosses 0. Boundary headings belong to the clockwise-next shield facing. The six facing bins, from the duel-slice function, are:

| Facing | Index | Headings |
| --- | --- | --- |
| front | 0 | `[60075, 65536)` and `[0, 5462)` |
| front-right | 1 | `[5462, 16384)` |
| rear-right | 2 | `[16384, 27307)` |
| rear | 3 | `[27307, 38230)` |
| rear-left | 4 | `[38230, 49152)` |
| front-left | 5 | `[49152, 60075)` |

### 4.1 Ship (shiplist) — placeholder

Real CE shiplist codes are not known yet. **TODO:** fill this section from the #6 inventory. Synthetic keys only:

| Code | Internal | Notes |
| --- | --- | --- |
| `TEST-PH` | `phaser` | Synthetic charge cost 4. Range bands 10 → 3 damage, 20 → 1 damage. |
| `TEST-PHOT` | `photon` | Synthetic arming, overload and proximity numbers in the data file. |
| `TEST-DRN` | `drone` | Reloads live in `reloads`, not in the arc. |
| `TEST-FA` | arc | Front wedge, same headings as facing 0. |
| `TEST-ALL` | arc | Full circle. |
| `TEST-STBD` | arc | `[0, 32768)`. |
| `TEST-PORT` | arc | `[32768, 65536)`. |

### 4.2 Fighter (ftrlist) — real CE codes

Names from the metadata-only CE 2.670 ftrlist inventory (#6, baseline #37). No occurrence counts. Angular ranges are a working geometry so the loader has a number. **Every range, and every suffix reading below, is pending verification.**

| Code | Internal | Reading |
| --- | --- | --- |
| `Ph2` | `phaser` | Second phaser family. Costs and damage rows left empty. |
| `Ph3` | `phaser` | Third phaser family. Range numbers left empty. |
| `PhG` | `phaser` | Rapid-fire phaser. The G suffix has no tighter definition here. |
| `PhoF` | `photon` | Fighter photon. Trailing F is read as fighter-scale and might instead mean fast or a special warhead. Uses the photon mechanism once a cost row exists. |
| `DisF` | `disruptor` | Fighter disruptor. Same F caution. Outside the Phase 2 fire path. |
| `HellF` | `hellbore` | Fighter hellbore. Same F caution. Outside the Phase 2 fire path. |
| `FusF` | `fusion` | Fighter fusion beam. Same F caution. Outside the Phase 2 fire path. |
| `DroI` | `drone` | Drone, suffix read as mark I. The suffix may be a mark, a speed or a warhead. |
| `DroVI` | `drone` | Drone, suffix read as mark VI. Same caution. |

Fighter drones have their own Arc column. They do not use the shiplist convention that the arc cell holds a reload count.

| Code | Working uint16 span | Reading | Pending because |
| --- | --- | --- | --- |
| `ALL` | full circle | Every relative bearing. | Confirm there is no blind spot. |
| `FH` | `[60075, 5462)` wrapped | Narrow forward, shield facing 0. | H may be a different forward width. |
| `FX` | `[49152, 16384)` wrapped | Extended forward, facings 5, 0 and 1 (forward half). | Extended may be wider than a hemisphere. |
| `RA` | `[27307, 38230)` | Rear, shield facing 3. | Rear may be wider than one facing. |
| `RX` | `[16384, 49152)` | Extended rear, facings 2, 3 and 4. | Same width question as `FX`. |
| `LS` | `[38230, 60075)` | Port side, facings 4 and 5, centred near bearing 49152. | A side arc might be one facing or a half-circle. |
| `RS` | `[5462, 27307)` | Starboard side, facings 1 and 2, centred near bearing 16384. | Same width question as `LS`. |

## 5. Ftrlist header → engine field

Inventory summary, CE 2.670, names only. Line 1 is a comment (text not stored here). Line 2 is the header. Thirty-six columns. Five weapon groups follow Speed. The summary names each group `Num`, `WeaponN`, `Arc`, `Shots`. This mapping writes the weapon column as `Weapon1` … `Weapon5` and binds repeated `Num`, `Arc` and `Shots` labels by group order (`slotIndex` 0..4). If a header dump shows suffixes or different spacing, add aliases; do not rename the engine fields.

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
