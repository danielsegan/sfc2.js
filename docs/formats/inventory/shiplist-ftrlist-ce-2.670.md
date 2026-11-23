# CE 2.670 shiplist / ftrlist verification

Observed on `sfc2-ci`. Metadata only: no data rows.

- Generated (UTC): `2026-11-23T21:33:55Z`

## shiplist

- Source copy (Assets/Specs preferred over MetaAssets): `tables/Assets/specs/shiplist.txt`

### Copies (2)

| Path | Size | sha256 |
| --- | ---: | --- |
| `tables/Assets/specs/shiplist.txt` | 647855 | `44f09e060788c3e4ea15a178ee14189865c6e8db6776b25e7c0b6fe17150dfb9` |
| `tables/MetaAssets/shiplist.txt` | 647465 | `c201c5575a473d691ac48fba3fa56e226281e96183867d95644b43f014a825bd` |

Copies identical: **False** (2 distinct hash(es)).

### Encoding and layout

- Encoding: `ascii` (BOM: False)
- Line endings: `CRLF`
- Delimiter: `TAB`
- Header line (1-based): 2
- Header row count: 1
- Column count: 190
- Data row count: 1393
- Header names:

  - `Race`
  - `Hull Type`
  - `Class`
  - `Class Type`
  - `BPV`
  - `Special Role`
  - `Year First Available`
  - `Year Last Available`
  - `Size Class`
  - `Turn mode`
  - `Move Cost`
  - `HET +2 Turns & Nimble`
  - `HET Breakdown`
  - `Stealth (+ECM)`
  - `Regular Crew`
  - `Boarding Parties Base`
  - `Boarding Parties Max`
  - `Deck Crews`
  - `Total Crew`
  - `Min Crew`
  - `Shield 1`
  - `Shield 2 _ 6`
  - `Shield 3 _ 5`
  - `Shield 4`
  - `Shield Total`
  - `Cloak`
  - `Num`
  - `Heavy Weapon 1`
  - `Arc`
  - `Num`
  - `Heavy Weapon 2`
  - `Arc`
  - `Num`
  - `Heavy Weapon 3`
  - `Arc`
  - `Num`
  - `Heavy Weapon 4`
  - `Arc`
  - `Num`
  - `Heavy Weapon 5`
  - `Arc`
  - `Num`
  - `Heavy Weapon 6`
  - `Arc`
  - `Num`
  - `Heavy Weapon 7`
  - `Arc`
  - `Num`
  - `Heavy Weapon 8`
  - `Arc`
  - `Num`
  - `Heavy Weapon 9`
  - `Arc`
  - `Num`
  - `Heavy Weapon 10`
  - `Arc`
  - `Num`
  - `Weapon 11`
  - `Arc`
  - `Num`
  - `Weapon 12`
  - `Arc`
  - `Num`
  - `Weapon 13`
  - `Arc`
  - `Num`
  - `Weapon 14`
  - `Arc`
  - `Num`
  - `Weapon 15`
  - `Arc`
  - `Num`
  - `Weapon 16`
  - `Arc`
  - `Num`
  - `Weapon 17`
  - `Arc`
  - `Num`
  - `Weapon 18`
  - `Arc`
  - `Num`
  - `Weapon 19`
  - `Arc`
  - `Num`
  - `Weapon 20`
  - `Arc`
  - `Num`
  - `Weapon 21`
  - `Arc`
  - `Num`
  - `Weapon 22`
  - `Arc`
  - `Num`
  - `Weapon 23`
  - `Arc`
  - `Num`
  - `Weapon 24`
  - `Arc`
  - `Num`
  - `Weapon 25`
  - `Arc`
  - `Probes`
  - `T Bombs Base`
  - `T Bombs Max`
  - `Nuclear Mine Base`
  - `Nuclear Mine Max`
  - `Drone Control`
  - `ADD_6`
  - `ADD_12`
  - `Shuttles Size`
  - `Launch Rate`
  - `General Base`
  - `General Max`
  - `Fighter Bay 1`
  - `Fighter Type 1`
  - `Fighter Bay 2`
  - `Fighter Type 2`
  - `Fighter Bay 3`
  - `Fighter Type 3`
  - `Fighter Bay 4`
  - `Fighter Type 4`
  - `Armor`
  - `Forward Hull`
  - `Center Hull`
  - `Aft Hull`
  - `Cargo`
  - `Barracks`
  - `Repair`
  - `R_L_Warp`
  - `C_Warp`
  - `Impulse`
  - `Apr`
  - `Battery`
  - `Bridge`
  - `Security`
  - `Lab`
  - `Transporters`
  - `Tractors`
  - `Mech Tractors`
  - `Special Sensors`
  - `Sensors`
  - `Scanners`
  - `Explosion Strength`
  - `Acceleration`
  - `Damage Control`
  - `Extra Damage`
  - `Ship Cost`
  - `Refit Base Class`
  - `Geometry`
  - `UI`
  - `Full Name`
  - `refits`
  - `Balance`
  - `End`
  - ``
  - `W1`
  - `W2`
  - `W3`
  - `W4`
  - `W5`
  - `W6`
  - `W7`
  - `W8`
  - `W9`
  - `W10`
  - `W11`
  - `W12`
  - `W13`
  - `W14`
  - `W15`
  - `W16`
  - `W17`
  - `W18`
  - `W19`
  - `W20`
  - `W21`
  - `W22`
  - `W23`
  - `W24`
  - `W25`
  - `Weapon BPV`
  - `FB1`
  - `FB2`
  - `FB3`
  - `FB4`
  - `Fighter Subtotal`
  - `System BPV`
  - `BPV Subtotal`
  - `SFB Year First Available`
  - `SFB Year Last Available`

### Uniqueness (`race` + short class name)

- Key form: `${race}:${className}` (comparison: case-insensitive)
- Columns found: True
- Key count: 1393
- Unique: True
- Duplicate key count: 0
- Duplicate class-name count: 0

### Fighters and PFs

- Fighters present: True (row count: 15)
- Fighter hull tokens: `FTR`
- PFs present: False (row count: 0)
- PF hull tokens: (none)

### Distinct race and hull tokens (vocabulary)

- Races: `Federation`, `Gorn`, `Hydran`, `ISC`, `Klingon`, `Lyran`, `Mirak`, `Monster`, `Neutral`, `Orion`, `Romulan`
- Hull types: `Asteroid`, `BOX`, `BS`, `BT`, `CA`, `CL`, `DN`, `F`, `FF`, `FTR`, `KDP`, `KLP`, `KSD`, `MAM`, `MDM`, `MLC`, `MMT`, `MSG`, `MSS`, `Planet`, `SB`, `SHT`, `Star`, `UNKNOWN`, `XMN`

Race column values (row counts):

| Race | Rows |
| --- | ---: |
| `Federation` | 154 |
| `Gorn` | 131 |
| `Hydran` | 140 |
| `ISC` | 141 |
| `Klingon` | 159 |
| `Lyran` | 139 |
| `Mirak` | 136 |
| `Monster` | 19 |
| `Neutral` | 87 |
| `Orion` | 134 |
| `Romulan` | 153 |


### Weapon and arc codes (vocabulary, with row counts)

Empty cells are omitted. `rows` is the number of data rows that use the code at least once; `occurrences` is the number of filled slot cells.

Weapon codes:

| Code | Rows | Occurrences | Rows 1–10 | Occ. 1–10 | Rows 11–25 | Occ. 11–25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `Ph4` | 335 | 1869 | 0 | 0 | 335 | 1869 |
| `Ph1` | 618 | 1800 | 0 | 0 | 618 | 1800 |
| `Ph3` | 629 | 1400 | 5 | 7 | 626 | 1393 |
| `Ph2` | 267 | 600 | 0 | 0 | 267 | 600 |
| `Dis4` | 80 | 272 | 80 | 272 | 0 | 0 |
| `Phot` | 102 | 263 | 102 | 263 | 0 | 0 |
| `DroB` | 159 | 241 | 159 | 241 | 0 | 0 |
| `PhG` | 110 | 224 | 0 | 0 | 110 | 224 |
| `Dis3` | 127 | 212 | 127 | 212 | 0 | 0 |
| `PLaF` | 84 | 162 | 84 | 162 | 0 | 0 |
| `Fus` | 79 | 147 | 79 | 147 | 0 | 0 |
| `ADD12` | 130 | 132 | 130 | 132 | 0 | 0 |
| `PlaF` | 79 | 131 | 79 | 131 | 0 | 0 |
| `HB` | 66 | 126 | 66 | 126 | 0 | 0 |
| `ESG` | 88 | 125 | 88 | 125 | 0 | 0 |
| `ADD6` | 101 | 105 | 101 | 105 | 0 | 0 |
| `DroC` | 71 | 101 | 71 | 101 | 0 | 0 |
| `PlaS` | 47 | 100 | 47 | 100 | 0 | 0 |
| `PlaR` | 27 | 98 | 27 | 98 | 0 | 0 |
| `Dis2` | 58 | 97 | 58 | 97 | 0 | 0 |
| `PLaS` | 48 | 90 | 48 | 90 | 0 | 0 |
| `DroA` | 50 | 89 | 50 | 89 | 0 | 0 |
| `DroG` | 67 | 87 | 67 | 87 | 0 | 0 |
| `PPD` | 38 | 81 | 38 | 81 | 0 | 0 |
| `PlaG` | 29 | 51 | 29 | 51 | 0 | 0 |
| `PLaG` | 37 | 49 | 37 | 49 | 0 | 0 |
| `Dis1` | 31 | 48 | 31 | 48 | 0 | 0 |
| `PlaD` | 25 | 47 | 25 | 47 | 0 | 0 |
| `PlaI` | 21 | 44 | 21 | 44 | 0 | 0 |
| `PLaR` | 27 | 31 | 27 | 31 | 0 | 0 |
| `DroF` | 10 | 13 | 10 | 13 | 0 | 0 |

Arc codes:

| Code | Rows | Occurrences | Rows 1–10 | Occ. 1–10 | Rows 11–25 | Occ. 11–25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `RS` | 742 | 1157 | 117 | 182 | 669 | 975 |
| `LS` | 738 | 1151 | 114 | 178 | 667 | 973 |
| `ALL` | 549 | 919 | 196 | 290 | 477 | 629 |
| `FA` | 444 | 794 | 388 | 660 | 119 | 134 |
| `FX` | 331 | 552 | 88 | 108 | 298 | 444 |
| `FH` | 370 | 493 | 96 | 151 | 299 | 342 |
| `FAL` | 417 | 453 | 44 | 44 | 409 | 409 |
| `FAR` | 417 | 436 | 27 | 27 | 409 | 409 |
| `RX` | 222 | 406 | 45 | 60 | 215 | 346 |
| `1` | 272 | 383 | 272 | 383 | 0 | 0 |
| `2` | 163 | 280 | 163 | 280 | 0 | 0 |
| `RH` | 216 | 275 | 25 | 44 | 210 | 231 |
| `LLR` | 128 | 146 | 24 | 25 | 104 | 121 |
| `RRR` | 126 | 144 | 22 | 23 | 104 | 121 |
| `LP` | 127 | 141 | 112 | 126 | 15 | 15 |
| `RP` | 126 | 140 | 111 | 125 | 15 | 15 |
| `RAR` | 115 | 138 | 0 | 0 | 115 | 138 |
| `RAL` | 115 | 136 | 17 | 17 | 115 | 119 |
| `LW` | 86 | 131 | 0 | 0 | 86 | 131 |
| `RW` | 86 | 131 | 0 | 0 | 86 | 131 |
| `3` | 73 | 105 | 73 | 105 | 0 | 0 |
| `RA` | 73 | 98 | 12 | 15 | 65 | 83 |
| `FLL` | 63 | 71 | 34 | 34 | 35 | 37 |
| `FRR` | 61 | 69 | 32 | 32 | 35 | 37 |
| `FHL` | 22 | 22 | 20 | 20 | 2 | 2 |
| `FHR` | 22 | 22 | 20 | 20 | 2 | 2 |
| `FLLX` | 21 | 21 | 0 | 0 | 21 | 21 |
| `FRRX` | 21 | 21 | 0 | 0 | 21 | 21 |

Slot ranges 1–10 and 11–25 use a numeric suffix on the header when present, otherwise the slot of the paired weapon column (`Num` / `Heavy Weapon N` or `Weapon N` / `Arc`).

Numeric arc codes `1`, `2`, `3` (per-column sources; used to check Num/Arc pairing):

| Code | Column index | Header | Slot | Rows | Occurrences |
| --- | ---: | --- | ---: | ---: | ---: |
| `1` | 28 | `Arc` | 1 | 16 | 16 |
| `1` | 31 | `Arc` | 2 | 18 | 18 |
| `1` | 34 | `Arc` | 3 | 58 | 58 |
| `1` | 37 | `Arc` | 4 | 54 | 54 |
| `1` | 40 | `Arc` | 5 | 34 | 34 |
| `1` | 43 | `Arc` | 6 | 8 | 8 |
| `1` | 46 | `Arc` | 7 | 66 | 66 |
| `1` | 49 | `Arc` | 8 | 21 | 21 |
| `1` | 52 | `Arc` | 9 | 95 | 95 |
| `1` | 55 | `Arc` | 10 | 13 | 13 |
| `2` | 28 | `Arc` | 1 | 37 | 37 |
| `2` | 31 | `Arc` | 2 | 34 | 34 |
| `2` | 34 | `Arc` | 3 | 50 | 50 |
| `2` | 37 | `Arc` | 4 | 34 | 34 |
| `2` | 40 | `Arc` | 5 | 8 | 8 |
| `2` | 43 | `Arc` | 6 | 7 | 7 |
| `2` | 46 | `Arc` | 7 | 96 | 96 |
| `2` | 49 | `Arc` | 8 | 12 | 12 |
| `2` | 52 | `Arc` | 9 | 2 | 2 |
| `3` | 28 | `Arc` | 1 | 2 | 2 |
| `3` | 31 | `Arc` | 2 | 3 | 3 |
| `3` | 34 | `Arc` | 3 | 4 | 4 |
| `3` | 37 | `Arc` | 4 | 3 | 3 |
| `3` | 46 | `Arc` | 7 | 64 | 64 |
| `3` | 49 | `Arc` | 8 | 20 | 20 |
| `3` | 52 | `Arc` | 9 | 7 | 7 |
| `3` | 55 | `Arc` | 10 | 2 | 2 |

Per-slot arc counts for weapon slots 1–10 (after Num/Arc pairing):

| Slot | Weapon column | Weapon header | Arc column | Arc header | Arc code | Rows | Occurrences |
| ---: | ---: | --- | ---: | --- | --- | ---: | ---: |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `FA` | 235 | 235 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `ALL` | 102 | 102 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `FH` | 88 | 88 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `FX` | 86 | 86 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `2` | 37 | 37 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `1` | 16 | 16 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `FAL` | 16 | 16 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `FLL` | 8 | 8 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `FHR` | 6 | 6 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `LS` | 4 | 4 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `RA` | 3 | 3 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `3` | 2 | 2 |
| 1 | 27 | `Heavy Weapon 1` | 28 | `Arc` | `RS` | 1 | 1 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `FA` | 97 | 97 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `RS` | 72 | 72 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `FH` | 40 | 40 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `2` | 34 | 34 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `ALL` | 24 | 24 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `1` | 18 | 18 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `FAR` | 16 | 16 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `FRR` | 9 | 9 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `FHL` | 6 | 6 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `RA` | 6 | 6 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `3` | 3 | 3 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `LLR` | 2 | 2 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `LS` | 1 | 1 |
| 2 | 30 | `Heavy Weapon 2` | 31 | `Arc` | `RP` | 1 | 1 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `FA` | 169 | 169 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `RS` | 59 | 59 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `1` | 58 | 58 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `2` | 50 | 50 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `RP` | 37 | 37 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `LS` | 26 | 26 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `LP` | 16 | 16 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `FHR` | 14 | 14 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `FH` | 11 | 11 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `ALL` | 6 | 6 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `FAR` | 5 | 5 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `FRR` | 5 | 5 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `3` | 4 | 4 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `FLL` | 3 | 3 |
| 3 | 33 | `Heavy Weapon 3` | 34 | `Arc` | `RX` | 2 | 2 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `FA` | 129 | 129 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `1` | 54 | 54 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `RX` | 43 | 43 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `LP` | 39 | 39 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `2` | 34 | 34 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `RS` | 19 | 19 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `FHL` | 14 | 14 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `ALL` | 12 | 12 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `FH` | 8 | 8 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `FAL` | 5 | 5 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `FLL` | 5 | 5 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `3` | 3 | 3 |
| 4 | 36 | `Heavy Weapon 4` | 37 | `Arc` | `FX` | 2 | 2 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `RP` | 79 | 79 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `LS` | 40 | 40 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `1` | 34 | 34 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `RH` | 22 | 22 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `RS` | 13 | 13 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `FA` | 10 | 10 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `2` | 8 | 8 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `FAR` | 6 | 6 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `FH` | 4 | 4 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `ALL` | 3 | 3 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `RA` | 3 | 3 |
| 5 | 39 | `Heavy Weapon 5` | 40 | `Arc` | `FRR` | 2 | 2 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `ALL` | 70 | 70 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `LP` | 65 | 65 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `LS` | 53 | 53 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `RH` | 19 | 19 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `1` | 8 | 8 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `RP` | 8 | 8 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `2` | 7 | 7 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `FAL` | 6 | 6 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `FA` | 5 | 5 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `RS` | 4 | 4 |
| 6 | 42 | `Heavy Weapon 6` | 43 | `Arc` | `FLL` | 2 | 2 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `2` | 96 | 96 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `1` | 66 | 66 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `3` | 64 | 64 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `ALL` | 40 | 40 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `LS` | 24 | 24 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `LLR` | 22 | 22 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `FRR` | 16 | 16 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `LP` | 6 | 6 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `RS` | 5 | 5 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `RA` | 3 | 3 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `RH` | 2 | 2 |
| 7 | 45 | `Heavy Weapon 7` | 46 | `Arc` | `FA` | 1 | 1 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `LS` | 23 | 23 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `RRR` | 22 | 22 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `1` | 21 | 21 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `3` | 20 | 20 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `FX` | 20 | 20 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `FLL` | 16 | 16 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `ALL` | 13 | 13 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `2` | 12 | 12 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `RS` | 3 | 3 |
| 8 | 48 | `Heavy Weapon 8` | 49 | `Arc` | `FA` | 1 | 1 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `1` | 95 | 95 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `ALL` | 20 | 20 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `FAL` | 17 | 17 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `FA` | 13 | 13 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `3` | 7 | 7 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `RS` | 6 | 6 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `2` | 2 | 2 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `LLR` | 1 | 1 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `LS` | 1 | 1 |
| 9 | 51 | `Heavy Weapon 9` | 52 | `Arc` | `RH` | 1 | 1 |
| 10 | 54 | `Heavy Weapon 10` | 55 | `Arc` | `RAL` | 17 | 17 |
| 10 | 54 | `Heavy Weapon 10` | 55 | `Arc` | `RX` | 15 | 15 |
| 10 | 54 | `Heavy Weapon 10` | 55 | `Arc` | `1` | 13 | 13 |
| 10 | 54 | `Heavy Weapon 10` | 55 | `Arc` | `LS` | 6 | 6 |
| 10 | 54 | `Heavy Weapon 10` | 55 | `Arc` | `3` | 2 | 2 |
| 10 | 54 | `Heavy Weapon 10` | 55 | `Arc` | `RRR` | 1 | 1 |

### Column selection

```json
{
  "raceColumn": "Race",
  "raceColumnIndex": 0,
  "classNameColumn": "Class",
  "classNameColumnIndex": 2,
  "hullTypeColumn": "Hull Type",
  "hullTypeColumnIndex": 1,
  "weaponArc": {
    "method": "header-name-patterns",
    "weaponColumns": [
      27,
      30,
      33,
      36,
      39,
      42,
      45,
      48,
      51,
      54,
      57,
      60,
      63,
      66,
      69,
      72,
      75,
      78,
      81,
      84,
      87,
      90,
      93,
      96,
      99
    ],
    "arcColumns": [
      28,
      31,
      34,
      37,
      40,
      43,
      46,
      49,
      52,
      55,
      58,
      61,
      64,
      67,
      70,
      73,
      76,
      79,
      82,
      85,
      88,
      91,
      94,
      97,
      100
    ],
    "countColumns": [
      26,
      29,
      32,
      35,
      38,
      41,
      44,
      47,
      50,
      53,
      56,
      59,
      62,
      65,
      68,
      71,
      74,
      77,
      80,
      83,
      86,
      89,
      92,
      95,
      98
    ],
    "weaponColumnNames": [
      "Heavy Weapon 1",
      "Heavy Weapon 2",
      "Heavy Weapon 3",
      "Heavy Weapon 4",
      "Heavy Weapon 5",
      "Heavy Weapon 6",
      "Heavy Weapon 7",
      "Heavy Weapon 8",
      "Heavy Weapon 9",
      "Heavy Weapon 10",
      "Weapon 11",
      "Weapon 12",
      "Weapon 13",
      "Weapon 14",
      "Weapon 15",
      "Weapon 16",
      "Weapon 17",
      "Weapon 18",
      "Weapon 19",
      "Weapon 20",
      "Weapon 21",
      "Weapon 22",
      "Weapon 23",
      "Weapon 24",
      "Weapon 25"
    ],
    "arcColumnNames": [
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc"
    ],
    "countColumnNames": [
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num",
      "Num"
    ],
    "slotPairs": [
      {
        "slot": 1,
        "weaponColumnIndex": 27,
        "weaponColumnName": "Heavy Weapon 1",
        "arcColumnIndex": 28,
        "arcColumnName": "Arc",
        "countColumnIndex": 26,
        "countColumnName": "Num"
      },
      {
        "slot": 2,
        "weaponColumnIndex": 30,
        "weaponColumnName": "Heavy Weapon 2",
        "arcColumnIndex": 31,
        "arcColumnName": "Arc",
        "countColumnIndex": 29,
        "countColumnName": "Num"
      },
      {
        "slot": 3,
        "weaponColumnIndex": 33,
        "weaponColumnName": "Heavy Weapon 3",
        "arcColumnIndex": 34,
        "arcColumnName": "Arc",
        "countColumnIndex": 32,
        "countColumnName": "Num"
      },
      {
        "slot": 4,
        "weaponColumnIndex": 36,
        "weaponColumnName": "Heavy Weapon 4",
        "arcColumnIndex": 37,
        "arcColumnName": "Arc",
        "countColumnIndex": 35,
        "countColumnName": "Num"
      },
      {
        "slot": 5,
        "weaponColumnIndex": 39,
        "weaponColumnName": "Heavy Weapon 5",
        "arcColumnIndex": 40,
        "arcColumnName": "Arc",
        "countColumnIndex": 38,
        "countColumnName": "Num"
      },
      {
        "slot": 6,
        "weaponColumnIndex": 42,
        "weaponColumnName": "Heavy Weapon 6",
        "arcColumnIndex": 43,
        "arcColumnName": "Arc",
        "countColumnIndex": 41,
        "countColumnName": "Num"
      },
      {
        "slot": 7,
        "weaponColumnIndex": 45,
        "weaponColumnName": "Heavy Weapon 7",
        "arcColumnIndex": 46,
        "arcColumnName": "Arc",
        "countColumnIndex": 44,
        "countColumnName": "Num"
      },
      {
        "slot": 8,
        "weaponColumnIndex": 48,
        "weaponColumnName": "Heavy Weapon 8",
        "arcColumnIndex": 49,
        "arcColumnName": "Arc",
        "countColumnIndex": 47,
        "countColumnName": "Num"
      },
      {
        "slot": 9,
        "weaponColumnIndex": 51,
        "weaponColumnName": "Heavy Weapon 9",
        "arcColumnIndex": 52,
        "arcColumnName": "Arc",
        "countColumnIndex": 50,
        "countColumnName": "Num"
      },
      {
        "slot": 10,
        "weaponColumnIndex": 54,
        "weaponColumnName": "Heavy Weapon 10",
        "arcColumnIndex": 55,
        "arcColumnName": "Arc",
        "countColumnIndex": 53,
        "countColumnName": "Num"
      },
      {
        "slot": 11,
        "weaponColumnIndex": 57,
        "weaponColumnName": "Weapon 11",
        "arcColumnIndex": 58,
        "arcColumnName": "Arc",
        "countColumnIndex": 56,
        "countColumnName": "Num"
      },
      {
        "slot": 12,
        "weaponColumnIndex": 60,
        "weaponColumnName": "Weapon 12",
        "arcColumnIndex": 61,
        "arcColumnName": "Arc",
        "countColumnIndex": 59,
        "countColumnName": "Num"
      },
      {
        "slot": 13,
        "weaponColumnIndex": 63,
        "weaponColumnName": "Weapon 13",
        "arcColumnIndex": 64,
        "arcColumnName": "Arc",
        "countColumnIndex": 62,
        "countColumnName": "Num"
      },
      {
        "slot": 14,
        "weaponColumnIndex": 66,
        "weaponColumnName": "Weapon 14",
        "arcColumnIndex": 67,
        "arcColumnName": "Arc",
        "countColumnIndex": 65,
        "countColumnName": "Num"
      },
      {
        "slot": 15,
        "weaponColumnIndex": 69,
        "weaponColumnName": "Weapon 15",
        "arcColumnIndex": 70,
        "arcColumnName": "Arc",
        "countColumnIndex": 68,
        "countColumnName": "Num"
      },
      {
        "slot": 16,
        "weaponColumnIndex": 72,
        "weaponColumnName": "Weapon 16",
        "arcColumnIndex": 73,
        "arcColumnName": "Arc",
        "countColumnIndex": 71,
        "countColumnName": "Num"
      },
      {
        "slot": 17,
        "weaponColumnIndex": 75,
        "weaponColumnName": "Weapon 17",
        "arcColumnIndex": 76,
        "arcColumnName": "Arc",
        "countColumnIndex": 74,
        "countColumnName": "Num"
      },
      {
        "slot": 18,
        "weaponColumnIndex": 78,
        "weaponColumnName": "Weapon 18",
        "arcColumnIndex": 79,
        "arcColumnName": "Arc",
        "countColumnIndex": 77,
        "countColumnName": "Num"
      },
      {
        "slot": 19,
        "weaponColumnIndex": 81,
        "weaponColumnName": "Weapon 19",
        "arcColumnIndex": 82,
        "arcColumnName": "Arc",
        "countColumnIndex": 80,
        "countColumnName": "Num"
      },
      {
        "slot": 20,
        "weaponColumnIndex": 84,
        "weaponColumnName": "Weapon 20",
        "arcColumnIndex": 85,
        "arcColumnName": "Arc",
        "countColumnIndex": 83,
        "countColumnName": "Num"
      },
      {
        "slot": 21,
        "weaponColumnIndex": 87,
        "weaponColumnName": "Weapon 21",
        "arcColumnIndex": 88,
        "arcColumnName": "Arc",
        "countColumnIndex": 86,
        "countColumnName": "Num"
      },
      {
        "slot": 22,
        "weaponColumnIndex": 90,
        "weaponColumnName": "Weapon 22",
        "arcColumnIndex": 91,
        "arcColumnName": "Arc",
        "countColumnIndex": 89,
        "countColumnName": "Num"
      },
      {
        "slot": 23,
        "weaponColumnIndex": 93,
        "weaponColumnName": "Weapon 23",
        "arcColumnIndex": 94,
        "arcColumnName": "Arc",
        "countColumnIndex": 92,
        "countColumnName": "Num"
      },
      {
        "slot": 24,
        "weaponColumnIndex": 96,
        "weaponColumnName": "Weapon 24",
        "arcColumnIndex": 97,
        "arcColumnName": "Arc",
        "countColumnIndex": 95,
        "countColumnName": "Num"
      },
      {
        "slot": 25,
        "weaponColumnIndex": 99,
        "weaponColumnName": "Weapon 25",
        "arcColumnIndex": 100,
        "arcColumnName": "Arc",
        "countColumnIndex": 98,
        "countColumnName": "Num"
      }
    ],
    "weaponSlotOf": {
      "27": 1,
      "30": 2,
      "33": 3,
      "36": 4,
      "39": 5,
      "42": 6,
      "45": 7,
      "48": 8,
      "51": 9,
      "54": 10,
      "57": 11,
      "60": 12,
      "63": 13,
      "66": 14,
      "69": 15,
      "72": 16,
      "75": 17,
      "78": 18,
      "81": 19,
      "84": 20,
      "87": 21,
      "90": 22,
      "93": 23,
      "96": 24,
      "99": 25
    },
    "arcSlotOf": {
      "28": 1,
      "31": 2,
      "34": 3,
      "37": 4,
      "40": 5,
      "43": 6,
      "46": 7,
      "49": 8,
      "52": 9,
      "55": 10,
      "58": 11,
      "61": 12,
      "64": 13,
      "67": 14,
      "70": 15,
      "73": 16,
      "76": 17,
      "79": 18,
      "82": 19,
      "85": 20,
      "88": 21,
      "91": 22,
      "94": 23,
      "97": 24,
      "100": 25
    },
    "countSlotOf": {
      "26": 1,
      "29": 2,
      "32": 3,
      "35": 4,
      "38": 5,
      "41": 6,
      "44": 7,
      "47": 8,
      "50": 9,
      "53": 10,
      "56": 11,
      "59": 12,
      "62": 13,
      "65": 14,
      "68": 15,
      "71": 16,
      "74": 17,
      "77": 18,
      "80": 19,
      "83": 20,
      "86": 21,
      "89": 22,
      "92": 23,
      "95": 24,
      "98": 25
    }
  }
}
```

## ftrlist

- Source copy (Assets/Specs preferred over MetaAssets): `tables/Assets/specs/ftrlist.txt`

### Copies (2)

| Path | Size | sha256 |
| --- | ---: | --- |
| `tables/Assets/specs/ftrlist.txt` | 9617 | `af4a661a5b0418857d2d42db975e41c8560d1eadd2f9b16f13331c1b1d706fe1` |
| `tables/MetaAssets/ftrlist.txt` | 9617 | `af4a661a5b0418857d2d42db975e41c8560d1eadd2f9b16f13331c1b1d706fe1` |

Copies identical: **True** (1 distinct hash(es)).

### Encoding and layout

- Encoding: `ascii` (BOM: False)
- Line endings: `CRLF`
- Delimiter: `TAB`
- Header line (1-based): 2
- Header row count: 1
- Column count: 36
- Data row count: 81
- Header names:

  - `Race`
  - `Type`
  - `Speed`
  - `Num`
  - `Weapon1`
  - `Arc`
  - `Shots`
  - `Num`
  - `Weapon2`
  - `Arc`
  - `Shots`
  - `Num`
  - `Weapon3`
  - `Arc`
  - `Shots`
  - `Num`
  - `Weapon4`
  - `Arc`
  - `Shots`
  - `Num`
  - `Weapon5`
  - `Arc`
  - `Shots`
  - `Damage`
  - `ADD_6`
  - `Ground Attack Bonus`
  - `ECM`
  - `ECCM`
  - `BPV`
  - `Carrier Size Class`
  - `First Year Avail`
  - `Last Year Avail`
  - `Size`
  - `UI`
  - `Geometry`
  - `Name`

### Uniqueness (`race` + short class name)

- Key form: `${race}:${className}` (comparison: case-insensitive)
- Columns found: True
- Key count: 81
- Unique: True
- Duplicate key count: 0
- Duplicate class-name count: 0

### Fighters and PFs

- Fighters present: False (row count: 0)
- Fighter hull tokens: (none)
- PFs present: False (row count: 0)
- PF hull tokens: (none)

### Distinct race and hull tokens (vocabulary)

- Races: `Federation`, `Gorn`, `Hydran`, `ISC`, `Klingon`, `Lyran`, `Mirak`, `Orion`, `Romulan`
- Hull types: 

Race column values (row counts):

| Race | Rows |
| --- | ---: |
| `Federation` | 13 |
| `Gorn` | 1 |
| `Hydran` | 13 |
| `ISC` | 13 |
| `Klingon` | 13 |
| `Lyran` | 1 |
| `Mirak` | 13 |
| `Orion` | 13 |
| `Romulan` | 1 |


### Weapon and arc codes (vocabulary, with row counts)

Empty cells are omitted. `rows` is the number of data rows that use the code at least once; `occurrences` is the number of filled slot cells.

Weapon codes:

| Code | Rows | Occurrences | Rows 1–10 | Occ. 1–10 | Rows 11–25 | Occ. 11–25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `Ph3` | 58 | 65 | 58 | 65 | 0 | 0 |
| `Ph2` | 21 | 24 | 21 | 24 | 0 | 0 |
| `PhG` | 20 | 23 | 20 | 23 | 0 | 0 |
| `DroVI` | 17 | 17 | 17 | 17 | 0 | 0 |
| `DisF` | 15 | 15 | 15 | 15 | 0 | 0 |
| `DroI` | 10 | 10 | 10 | 10 | 0 | 0 |
| `HellF` | 8 | 8 | 8 | 8 | 0 | 0 |
| `FusF` | 6 | 6 | 6 | 6 | 0 | 0 |
| `PhoF` | 6 | 6 | 6 | 6 | 0 | 0 |

Arc codes:

| Code | Rows | Occurrences | Rows 1–10 | Occ. 1–10 | Rows 11–25 | Occ. 11–25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `FH` | 64 | 101 | 64 | 101 | 0 | 0 |
| `ALL` | 37 | 39 | 37 | 39 | 0 | 0 |
| `FX` | 19 | 20 | 19 | 20 | 0 | 0 |
| `RX` | 9 | 9 | 9 | 9 | 0 | 0 |
| `RA` | 3 | 3 | 3 | 3 | 0 | 0 |
| `LS` | 1 | 1 | 1 | 1 | 0 | 0 |
| `RS` | 1 | 1 | 1 | 1 | 0 | 0 |

Slot ranges 1–10 and 11–25 use a numeric suffix on the header when present, otherwise the slot of the paired weapon column (`Num` / `Heavy Weapon N` or `Weapon N` / `Arc`).

Numeric arc codes `1`, `2`, `3` (per-column sources; used to check Num/Arc pairing):

| Code | Column index | Header | Slot | Rows | Occurrences |
| --- | ---: | --- | ---: | ---: | ---: |
| `1` | — | *(not observed)* | | 0 | 0 |
| `2` | — | *(not observed)* | | 0 | 0 |
| `3` | — | *(not observed)* | | 0 | 0 |

Per-slot arc counts for weapon slots 1–10 (after Num/Arc pairing):

| Slot | Weapon column | Weapon header | Arc column | Arc header | Arc code | Rows | Occurrences |
| ---: | ---: | --- | ---: | --- | --- | ---: | ---: |
| 1 | 4 | `Weapon1` | 5 | `Arc` | `FH` | 58 | 58 |
| 1 | 4 | `Weapon1` | 5 | `Arc` | `FX` | 14 | 14 |
| 1 | 4 | `Weapon1` | 5 | `Arc` | `ALL` | 9 | 9 |
| 2 | 8 | `Weapon2` | 9 | `Arc` | `FH` | 31 | 31 |
| 2 | 8 | `Weapon2` | 9 | `Arc` | `ALL` | 19 | 19 |
| 2 | 8 | `Weapon2` | 9 | `Arc` | `RX` | 5 | 5 |
| 2 | 8 | `Weapon2` | 9 | `Arc` | `FX` | 1 | 1 |
| 2 | 8 | `Weapon2` | 9 | `Arc` | `LS` | 1 | 1 |
| 3 | 12 | `Weapon3` | 13 | `Arc` | `FH` | 12 | 12 |
| 3 | 12 | `Weapon3` | 13 | `Arc` | `ALL` | 11 | 11 |
| 3 | 12 | `Weapon3` | 13 | `Arc` | `FX` | 5 | 5 |
| 3 | 12 | `Weapon3` | 13 | `Arc` | `RX` | 4 | 4 |
| 3 | 12 | `Weapon3` | 13 | `Arc` | `RA` | 3 | 3 |
| 3 | 12 | `Weapon3` | 13 | `Arc` | `RS` | 1 | 1 |
| 4 | 16 | `Weapon4` | 17 | `Arc` | *(none)* | | |
| 5 | 20 | `Weapon5` | 21 | `Arc` | *(none)* | | |

### Column selection

```json
{
  "raceColumn": "Race",
  "raceColumnIndex": 0,
  "classNameColumn": "Type",
  "classNameColumnIndex": 1,
  "hullTypeColumn": null,
  "hullTypeColumnIndex": null,
  "weaponArc": {
    "method": "header-name-patterns",
    "weaponColumns": [
      4,
      8,
      12,
      16,
      20
    ],
    "arcColumns": [
      5,
      9,
      13,
      17,
      21
    ],
    "countColumns": [
      3,
      6,
      7,
      10,
      11,
      14,
      15,
      18,
      19,
      22
    ],
    "weaponColumnNames": [
      "Weapon1",
      "Weapon2",
      "Weapon3",
      "Weapon4",
      "Weapon5"
    ],
    "arcColumnNames": [
      "Arc",
      "Arc",
      "Arc",
      "Arc",
      "Arc"
    ],
    "countColumnNames": [
      "Num",
      "Shots",
      "Num",
      "Shots",
      "Num",
      "Shots",
      "Num",
      "Shots",
      "Num",
      "Shots"
    ],
    "slotPairs": [
      {
        "slot": 1,
        "weaponColumnIndex": 4,
        "weaponColumnName": "Weapon1",
        "arcColumnIndex": 5,
        "arcColumnName": "Arc",
        "countColumnIndex": 3,
        "countColumnName": "Num"
      },
      {
        "slot": 2,
        "weaponColumnIndex": 8,
        "weaponColumnName": "Weapon2",
        "arcColumnIndex": 9,
        "arcColumnName": "Arc",
        "countColumnIndex": 7,
        "countColumnName": "Num"
      },
      {
        "slot": 3,
        "weaponColumnIndex": 12,
        "weaponColumnName": "Weapon3",
        "arcColumnIndex": 13,
        "arcColumnName": "Arc",
        "countColumnIndex": 11,
        "countColumnName": "Num"
      },
      {
        "slot": 4,
        "weaponColumnIndex": 16,
        "weaponColumnName": "Weapon4",
        "arcColumnIndex": 17,
        "arcColumnName": "Arc",
        "countColumnIndex": 15,
        "countColumnName": "Num"
      },
      {
        "slot": 5,
        "weaponColumnIndex": 20,
        "weaponColumnName": "Weapon5",
        "arcColumnIndex": 21,
        "arcColumnName": "Arc",
        "countColumnIndex": 19,
        "countColumnName": "Num"
      }
    ],
    "weaponSlotOf": {
      "4": 1,
      "8": 2,
      "12": 3,
      "16": 4,
      "20": 5
    },
    "arcSlotOf": {
      "5": 1,
      "9": 2,
      "13": 3,
      "17": 4,
      "21": 5
    },
    "countSlotOf": {
      "3": 1,
      "7": 2,
      "11": 3,
      "15": 4,
      "19": 5
    }
  }
}
```

## GUI art: `*.q3` and `.bft`

- `*.q3` in extracted tree: 1
  - `sprites/Assets/Sprites/sprites.q3` size=80717666 sha256=`8558ca51240843c3e5595a3b4820ab97a7f4314546cfb4451428b3383d875346` format=`unidentified` entryCount=None
    - No identifiable archive directory (not ZIP or PACK).
- `*.q3` in reference tree: 1
  - `Assets/Sprites/sprites.q3` size=80717666 sha256=`8558ca51240843c3e5595a3b4820ab97a7f4314546cfb4451428b3383d875346` format=`unidentified` entryCount=None
    - No identifiable archive directory (not ZIP or PACK).
- `.bft` files: 126 (path and size only).

### `.bft` folder `fonts/Assets/aafonts`

| Path | Size | sha256 |
| --- | ---: | --- |
| `fonts/Assets/aafonts/Federation10.bft` | 27843 | `62659274e343bdb7c1216c255e9923c91302523849b956b5a6a385dbc37e7d23` |
| `fonts/Assets/aafonts/Federation11.bft` | 32482 | `ab7a2669b594a14d503b2913d51cf979ca6679afe21e551af71acf1d04761068` |
| `fonts/Assets/aafonts/Federation12.bft` | 36495 | `3731e51f38e5f55ad7ba63357c8a4be42bb7b559407774d712be4e4acca0cad8` |
| `fonts/Assets/aafonts/Federation14.bft` | 46955 | `d9c0d1a7bbe65e477e1250cf4d232c06307307b9e870f7a019fdb16660452fe1` |
| `fonts/Assets/aafonts/Federation16.bft` | 58840 | `12e88bd8335f2d8c572dd01ffbde74e68b3937c49797002816cd9cd3e069c245` |
| `fonts/Assets/aafonts/Federation18.bft` | 71801 | `65cec60f4ed1f94bd0ef8d08f4fa70929bf5a16ac5220dc00ab5d49ad5ccda4a` |
| `fonts/Assets/aafonts/Federation20.bft` | 86081 | `1d25e4c89387de921b098acb7fb3f7494835a73ddc23df90e8310eac4b4e6cfd` |
| `fonts/Assets/aafonts/Federation22.bft` | 101971 | `9c5daefdad85da6aa755fec4be18b4fb85cea7952bf630e647f4afdc661b4a17` |
| `fonts/Assets/aafonts/Federation24.bft` | 118586 | `0a8113ef188f4984857d5e2daf47e6bf54aeb0abb3e153742a6cd28751608a08` |
| `fonts/Assets/aafonts/Federation5.bft` | 11806 | `e905527e1eeca560a237a872e6ea7ee14cadc01808a6032c46219fd69032227b` |
| `fonts/Assets/aafonts/Federation6.bft` | 15133 | `82531c92f0927ab0b9b4110ab3038e2c2554a4fd5a1df4125cdc300dcfbf5c3f` |
| `fonts/Assets/aafonts/Federation7.bft` | 17599 | `a6210c6ec63c08a0537724e94f4d6487a81650fe154c40f5b09de28d239a8896` |
| `fonts/Assets/aafonts/Federation8.bft` | 20490 | `821558a1d45d239c7228cfcd031c5fe50209b132f8eaeee6e4485cfb9f3e5311` |
| `fonts/Assets/aafonts/Federation9.bft` | 24426 | `0c710abb220749362c05b3c7992e1ba09225490f6e0387e5927da48320f76b1b` |
| `fonts/Assets/aafonts/Klingon10.bft` | 23794 | `fa86495fd060e14366f254caf903f377046f79edded2273983fb0f4c126b17c0` |
| `fonts/Assets/aafonts/Klingon11.bft` | 27783 | `5c166ef4a2efb41acb6d03d66207bf8b3cb7ccc8a0738aa757b08148d2f42375` |
| `fonts/Assets/aafonts/Klingon12.bft` | 31047 | `30de3afca8bf5585db8d483317e8682ada107124241cf3613a47c0a430698114` |
| `fonts/Assets/aafonts/Klingon14.bft` | 39768 | `7ac68be372d3f6618a3db5ca735263ee5f82e6bed3b1400fbbff37d427f80468` |
| `fonts/Assets/aafonts/Klingon16.bft` | 49134 | `5b8e9454f5828b4201bb81ecd2a220ba81e6bd098e969ddf4cf718ebfe5140f2` |
| `fonts/Assets/aafonts/Klingon18.bft` | 59378 | `f269fc08ac12727fb40586a40fc8ad29ce21f1c882cf32345eee42791b1e9a91` |
| `fonts/Assets/aafonts/Klingon20.bft` | 71028 | `3def44bdec6e5996dd69c948b0b0b32c816edeb200d390b7afe4287d27fbdfa9` |
| `fonts/Assets/aafonts/Klingon22.bft` | 83739 | `55c63b7507db232e1b82300f55c120402776f8205fdf6e2f4324ebebea81fa9a` |
| `fonts/Assets/aafonts/Klingon24.bft` | 97784 | `a5aeecd60734028a6edbad1e9fbf4d80f1d0f9a02284f97ec0a047a352a20ce7` |
| `fonts/Assets/aafonts/Klingon5.bft` | 9675 | `3056cd1881e9290f0acd5ea865e579aefa890d9b92e428f06f63863e95029e57` |
| `fonts/Assets/aafonts/Klingon6.bft` | 11417 | `e131233880e0938ee0b402d80281b67a063b425b97dcbb5a1a827890896e45e1` |
| `fonts/Assets/aafonts/Klingon7.bft` | 15120 | `7b0d2da5e8b8bfb5fafe2b7143269842d2f1af92bbcd4cb836dec228d967d72e` |
| `fonts/Assets/aafonts/Klingon8.bft` | 16955 | `4fbe4f4ab81510802e2df8062f8824064b10122ba72c46031799d3cb4d4daeb1` |
| `fonts/Assets/aafonts/Klingon9.bft` | 20282 | `540a051fa1ef66bddf0b092c0f83e4499056e4d6e50a0eb62ee2649c8dd1e1bd` |
| `fonts/Assets/aafonts/arial10.bft` | 22986 | `6808fe130f83c58956b352139898ae8272c8bcd13fbb6130703a7647ddbc3eed` |
| `fonts/Assets/aafonts/arial11.bft` | 30323 | `9a1fa5a090414b932be1c01880d8483be8e3e4287f88d0b5b6d8b897ca942d95` |
| `fonts/Assets/aafonts/arial12.bft` | 34402 | `7441d8128c9386edc529dc1caba3343f379d78e8642a6f50f92eb6c0293636d1` |
| `fonts/Assets/aafonts/arial14.bft` | 43787 | `84f834f06b0aab298f5981eb4952b25aa3cc8e42ab369b1ff83f6cc9a94daefb` |
| `fonts/Assets/aafonts/arial16.bft` | 54986 | `d4302352661866aa7b396a85a80070169a1a90eabe4efab1030b52e71da3965e` |
| `fonts/Assets/aafonts/arial18.bft` | 66523 | `b315096c79797c07f3034a03eb5ee2c9d5d09eb955f163322d58c3bfe82a500e` |
| `fonts/Assets/aafonts/arial20.bft` | 79058 | `bf56e6f3090a1d59b99b155a978758e66f694dcab640aee0ddf56816bb46dafd` |
| `fonts/Assets/aafonts/arial22.bft` | 93575 | `786c09fb57e08780f03ac7142b69a2fdd2f6867fafd01157d1a9888300fdfb94` |
| `fonts/Assets/aafonts/arial24.bft` | 109303 | `33fafe1d38833030e9c6c14f4b2d5fa804517ba901a9b0163e946600f045538d` |
| `fonts/Assets/aafonts/arial5.bft` | 10194 | `a6fdca63165c22d20fa9a05b18abeb26e4ffb5fe4ec61731cc84235989240af1` |
| `fonts/Assets/aafonts/arial6.bft` | 12484 | `dd6b3b4e7d8db3703a2459c88da6893d1261ee0972441ef42c015ff623fc6356` |
| `fonts/Assets/aafonts/arial7.bft` | 14800 | `0f162ca3497426b16cb4e326d7eaaccc8901069b2180d77786de41a475f13c8e` |
| `fonts/Assets/aafonts/arial8.bft` | 17231 | `1a3eba70b98929ea28eb9e0904739357e5571856ebc309fae1f7062dcd8f56d3` |
| `fonts/Assets/aafonts/arial9.bft` | 20995 | `44eaaded6dfc040d22c4075411cbe117579d464910e6c52053dab4a8987243b9` |
| `fonts/Assets/aafonts/gorn10.bft` | 21254 | `25f8e0fbd655f594e7bccbbb72177499ae6b4b4c9f2d1959b5fa848db75f02e0` |
| `fonts/Assets/aafonts/gorn11.bft` | 24825 | `82c6d10eb6fa499d37ca148354ca48954452aebee75562c3487366403bbd56e8` |
| `fonts/Assets/aafonts/gorn12.bft` | 28205 | `e72b6a398916695141206d7b27b8f1c3feabd0b0bfade2acd5a3949aac9a3419` |
| `fonts/Assets/aafonts/gorn14.bft` | 36140 | `c03c1d728f3ade1a90c133036161ab6ad470cca6bb8aaaf36edb59d436d90086` |
| `fonts/Assets/aafonts/gorn16.bft` | 45159 | `6b523c6a138cbab649981865d5ecb24feacab72c4e28de9c1cd3bd1b8a7e3fb9` |
| `fonts/Assets/aafonts/gorn18.bft` | 54967 | `e321eb843be9e1b4674c2646f17588be533bd5ac5c344e947fde0b330eabc495` |
| `fonts/Assets/aafonts/gorn20.bft` | 64967 | `7948627d0c72121d051d13d9c8aebe5b70fa6f3011ab2605c36053b59e7c2339` |
| `fonts/Assets/aafonts/gorn22.bft` | 76275 | `f40ef969d30caaf24520959fb1d35dcd004fcc8be07e129481a4d0da954cb27b` |
| `fonts/Assets/aafonts/gorn24.bft` | 88023 | `1af06f36f56ff1d516b007c495e4883d91ae1605e5a8150ce0946b69aec52d81` |
| `fonts/Assets/aafonts/gorn5.bft` | 10177 | `ac73ed476412fe96c38c8047578cb16ae8074ab56c679c8c601d5b1b4454c03c` |
| `fonts/Assets/aafonts/gorn6.bft` | 12172 | `e5513374c9929f0bc9749331e981eeef1ef24fe318132171812d98cdc861d8c9` |
| `fonts/Assets/aafonts/gorn7.bft` | 14519 | `37d18cff2f0848cb86e692b8edab1af776b578d72115b4517af9373243971a6a` |
| `fonts/Assets/aafonts/gorn8.bft` | 16192 | `11b855c25c9c67dc253809f1333ff55c619d1c3622193db80628db02e63b210e` |
| `fonts/Assets/aafonts/gorn9.bft` | 19086 | `f2724632e3512ff47d8ca83716141e73d1b56cd9f97a7dd57ec5194363b28c56` |
| `fonts/Assets/aafonts/hydran10.bft` | 30266 | `08a8baca35a4f423e4265e0ac3f2e68710a600c45293951b065e5a5920633445` |
| `fonts/Assets/aafonts/hydran11.bft` | 34411 | `78003a4f39deef4a794836105990ad7f0f2f3531a2ce6d77d1d919bf57d30ed8` |
| `fonts/Assets/aafonts/hydran12.bft` | 41596 | `e596165d1f6d84334223db393aebfc60bc3aa7f4ec1c5f69a10e0f7a17c54053` |
| `fonts/Assets/aafonts/hydran14.bft` | 53399 | `95096549cf8fa038c32d53c384ae15e0241bae5d1c8f154393507b2c8080e025` |
| `fonts/Assets/aafonts/hydran16.bft` | 66239 | `cc3144a3a370a94cc3257e1eb04f0d0e724b3b2ef918029d5da1180c10fa3141` |
| `fonts/Assets/aafonts/hydran18.bft` | 80399 | `8fc0143679776a708f02c021c76da2ee6260842eec860efdd62527a0e99c8d4b` |
| `fonts/Assets/aafonts/hydran20.bft` | 96021 | `4e7b92e32edebf7ac662e3c6fbc052c7718f76fceb438a7d7e22bb6c8fdcfd80` |
| `fonts/Assets/aafonts/hydran22.bft` | 115974 | `bf20559d5b0122185764cece76c632c55a8d9b89c60fb806961932960815bd36` |
| `fonts/Assets/aafonts/hydran24.bft` | 135587 | `08def19e6970b0d3e80f0a0e08a8581798b1b8c29c50c359dbd6a1bc486b370b` |
| `fonts/Assets/aafonts/hydran5.bft` | 13017 | `ea2fa7251fc74ab17574a587e4e623863156d6f5bbe4be3d6d3a169c124ee190` |
| `fonts/Assets/aafonts/hydran6.bft` | 15089 | `e63ddd6c6b1d2820870dd1149a1602032a0b5e0f436fe0082fdc31c5ad2f8c0a` |
| `fonts/Assets/aafonts/hydran7.bft` | 18642 | `fdc2cae33aef3b6c8443264e9ca8b2a0cb0d79ae36a5849cfb6268ba6bef4c6c` |
| `fonts/Assets/aafonts/hydran8.bft` | 21083 | `7fd7ce203c69ecefc57ac28a7ad1c3678bb0c6f4d187b5f22b077671983ee3a1` |
| `fonts/Assets/aafonts/hydran9.bft` | 25853 | `05dc5db167c73043ebf02f07085d569c5f8c6b186db766ecc8d8594ae2b52646` |
| `fonts/Assets/aafonts/isc10.bft` | 24017 | `361dc9303b00bf5d27d4117053969866292af0aa6d03d93993572c49eb986953` |
| `fonts/Assets/aafonts/isc11.bft` | 27830 | `36d5eb1e01dac6c37ece4baa43d4b465dc9f3ba58cafb422264b34650447c783` |
| `fonts/Assets/aafonts/isc12.bft` | 31172 | `33723720bdb057762d0617b36b7814672abc6206847ce29d10bdcaf4f447b2e2` |
| `fonts/Assets/aafonts/isc14.bft` | 39627 | `78cb5590390fcdf6faa5b1efba26c20689fc193969ae1d08b5ecacad7c8c9ba3` |
| `fonts/Assets/aafonts/isc16.bft` | 48786 | `d664d854103195731d2bb8b5c69ec59565f3e4ad35458ecdd3e6132de23181b6` |
| `fonts/Assets/aafonts/isc18.bft` | 58978 | `808b80e59143560d26aba842270101f534cf1cf9b5442adccd44b590f5635317` |
| `fonts/Assets/aafonts/isc20.bft` | 71038 | `06219c90d607efd1cc1fe60225e9db9011dda55ba1c94afd19ad4e4242d95df9` |
| `fonts/Assets/aafonts/isc22.bft` | 84152 | `e850d00d2994ed023d3a991152e3bf138217683e332000361efb3ca5da475262` |
| `fonts/Assets/aafonts/isc24.bft` | 97625 | `f8f1639f8513a8f61e8d65f7d86576f751ed618a0d79b1ad8e834bf18ca6fce5` |
| `fonts/Assets/aafonts/isc5.bft` | 10630 | `14f4f778b57e0532b05ff9dd25e03fd915dcf4c45bf5c84fcc8880b41cad467c` |
| `fonts/Assets/aafonts/isc6.bft` | 12973 | `9f27d5831bd96ae0291624c056c8b1e060afd083b0784a2772168439eae0adc9` |
| `fonts/Assets/aafonts/isc7.bft` | 14683 | `0f086a631fd7ab6e172f455ab76600c7449cdef558638fb7efe2fb37091e9730` |
| `fonts/Assets/aafonts/isc8.bft` | 17265 | `d0af5b3f22b12421399a2b9f8ef7343e2fbe578aab784b94f2548fd09082dbf6` |
| `fonts/Assets/aafonts/isc9.bft` | 20405 | `46026d3fb73d987c89a342c97801bf516a2c8a045ac4b210a5169b6fc98d6cae` |
| `fonts/Assets/aafonts/lyran10.bft` | 23931 | `8997ded76b7e049015a4bd592d5cafdf3f1b6ee9872dd0050472774398d4527b` |
| `fonts/Assets/aafonts/lyran11.bft` | 30442 | `3ad77df17075dfa597532a7b9293c4db7441b1d2d267c7c2bf606ec8c2b6ba82` |
| `fonts/Assets/aafonts/lyran12.bft` | 34905 | `641e37af5cfbe9e2c18e6dbaf90c94748bb15327d4495972590fa7376ae7653b` |
| `fonts/Assets/aafonts/lyran14.bft` | 44812 | `8611f51152fad4b42b33925b816be07242abfe05aaf222b2eb82c0a611cb4d62` |
| `fonts/Assets/aafonts/lyran16.bft` | 55544 | `7a0af629dd34efd50380cda49e780d7e594239300a54fd84a987320af31cd108` |
| `fonts/Assets/aafonts/lyran18.bft` | 68426 | `b431451982521cb5d82490a1f137836caf7638b42ac2913a5246c022e00354e8` |
| `fonts/Assets/aafonts/lyran20.bft` | 81231 | `b75e16b306a6637b339ff4d7f4ab44af2382325d8083c626111629c8377fc278` |
| `fonts/Assets/aafonts/lyran22.bft` | 96163 | `3d5f11018ad50edb01be19489f2bd9571c064570254e4fe26e1d508dfc09ef49` |
| `fonts/Assets/aafonts/lyran24.bft` | 111969 | `9314ebbe2f227ed5f31f9022292423376585c51a8ced0ee646535c2aae7c5a31` |
| `fonts/Assets/aafonts/lyran5.bft` | 10388 | `8e930924d9e3a8a66c6f8733a45fb2f4a1f994d31b5705ee5da7b4d8d32ae119` |
| `fonts/Assets/aafonts/lyran6.bft` | 12532 | `d0cf50f7c1e51daa6e7aa19e5507e27bd53097f107af3cba7e02c25eeaddb960` |
| `fonts/Assets/aafonts/lyran7.bft` | 14911 | `84ea0d8471f465763b907336177010cd554cd4d7e849a88112492e143cb3f41b` |
| `fonts/Assets/aafonts/lyran8.bft` | 17376 | `2e1d1a23cab2ce915185955797a659dd6d231b99d2355883ad2b1768995a6635` |
| `fonts/Assets/aafonts/lyran9.bft` | 20353 | `d35a82e2e42e9ced5ec2e5c1856b5506a932512dd2f034f145b4f865fa0005ee` |
| `fonts/Assets/aafonts/mirak10.bft` | 23242 | `8fcdc2bc2c34653e23fe778bc03abe023cc268eb1080f5d70ff38d2f6963766b` |
| `fonts/Assets/aafonts/mirak11.bft` | 27213 | `22c07d39aadd7aa07547a39c7a79d1e119a1d7c489e49262af059120758ff19f` |
| `fonts/Assets/aafonts/mirak12.bft` | 29786 | `b5454d942d1b59b410838d43a226b4871a9a109627698051ad44a3bc7e568be9` |
| `fonts/Assets/aafonts/mirak14.bft` | 37969 | `b2cb11de4496ed62e4cce9c1568220238590aae8630f4255b2cc858b024f9ffc` |
| `fonts/Assets/aafonts/mirak16.bft` | 46993 | `c9b17db439dd7f269e17fac0a8d776150759d81b8a0a8c5ba7d1fd42718f73e6` |
| `fonts/Assets/aafonts/mirak18.bft` | 57179 | `64374a424eed254f9a30a4d499eb2c679d723f9eca61acf5e94dcc034c40ffbd` |
| `fonts/Assets/aafonts/mirak20.bft` | 68732 | `3f95331f7e56521ec174357490fedaf7ed1dfdd53fc0239b01c88e6366f44016` |
| `fonts/Assets/aafonts/mirak22.bft` | 81109 | `db86fa0c4afcd14c198d7fef724a462b8853ae30d8771b2526800cf46375a67f` |
| `fonts/Assets/aafonts/mirak24.bft` | 94257 | `b52ceea155dbbacb01dc8ce1a7a73448d3ac304f79d6deddaf1ef364e44e6f82` |
| `fonts/Assets/aafonts/mirak5.bft` | 10653 | `e9e51955ee1bed2309d8ab87ffc66aeea0188ec8942aedb6af73185dee591be1` |
| `fonts/Assets/aafonts/mirak6.bft` | 12572 | `833664855f982c0b89f521383300aaf9bc9ddc68153e6d17a0215af87d0a7699` |
| `fonts/Assets/aafonts/mirak7.bft` | 15109 | `018458ccc39d1e106e77fb96cea403a324e4a716c08a8ae4ca9f57c3800e4de0` |
| `fonts/Assets/aafonts/mirak8.bft` | 17425 | `e5b9b35ab6199c2d5955018732b36a2b367e404cf468e9b1d2b229cf3e78f645` |
| `fonts/Assets/aafonts/mirak9.bft` | 20738 | `fa66f26950a292f99b5d0ca55297aeac1893e2ba1a156f5895734efbb40c94eb` |
| `fonts/Assets/aafonts/romulan10.bft` | 28221 | `e1e644c128db1cd25ecda17aea250a3fcf4a53a24466a4ed623dd452715cca72` |
| `fonts/Assets/aafonts/romulan11.bft` | 33047 | `a441528bb3d7e365768255051fc1f7345d7447d41206f7bab86256dfc8faffac` |
| `fonts/Assets/aafonts/romulan12.bft` | 38061 | `c5bdbebd1ac3c19e6ef98c8f44e20a8b421f3b8c451e9965f6f6e40cd2127d8a` |
| `fonts/Assets/aafonts/romulan14.bft` | 48300 | `b817d872361b871e276eddeaa6d8573a8ab473775596814c1f2e53f9851e66a9` |
| `fonts/Assets/aafonts/romulan16.bft` | 60085 | `1fa1bd2cdb93b0f46db65edf7b51fdad53275567bc44d39e38ab88e42afd5ab5` |
| `fonts/Assets/aafonts/romulan18.bft` | 74527 | `73b6f3e70782f8393e220a6a9eca1ba90ec342cd966020a96dd44b690ba2c0ca` |
| `fonts/Assets/aafonts/romulan20.bft` | 88133 | `20505e429db5b8d00b9551c6aa17233b902ef26a55e8808574c5608bb98987fa` |
| `fonts/Assets/aafonts/romulan22.bft` | 104321 | `464ea6b42aa713d1276d85527ec6ce80eb95d2436054d8ac8bcb735603bc629f` |
| `fonts/Assets/aafonts/romulan24.bft` | 122416 | `ccb2e008d881e9bff17549cf58e62c5f70691cd846b3da868a04638a441820bb` |
| `fonts/Assets/aafonts/romulan5.bft` | 11755 | `02ef07537663e92114f85c6814d62d0b24bcce3a29690f6bdda4a81cc373bd54` |
| `fonts/Assets/aafonts/romulan6.bft` | 14501 | `ef967eb96267323c8b29a66d4a4271765e8caeaf11808b0b04d66f38003be30b` |
| `fonts/Assets/aafonts/romulan7.bft` | 16825 | `a1f909571340c8159d33becab526b1817c78f927a98e90a767fff3af40303c64` |
| `fonts/Assets/aafonts/romulan8.bft` | 19915 | `bb3a193acf4fb6ef36cc29787eefbbae03b68f0708ad3b6b63bce9add259091d` |
| `fonts/Assets/aafonts/romulan9.bft` | 25172 | `0c76491ec1ec21861d2b6616e47546cdb2807bd9f3510984c44f5d05e73812bd` |

