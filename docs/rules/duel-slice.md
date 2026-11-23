# Phase 2 duel slice

Status: **spec, synthetic numbers, pending playtest.** One ship against one ship. Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Issue: [#24](https://github.com/danielsegan/sfc2.js/issues/24).

Clean-room. Mechanics are described in our own words. Numeric tables in [`data/`](data/) are placeholders we invented for tests, except the ftrlist code names, which are inventory names ([mapping](shiplist-mapping.md)). No published chart is copied here.

The sim contract, provisional until [`docs/engine/determinism.md`](../engine/determinism.md) lands (Engine Lead; not on `main`):

| Rule | Duel slice |
| --- | --- |
| Tick | Fixed 30 Hz. One displayed second is 30 ticks. |
| Numbers | Integer fixed-point. Provisional scale `fxScale = 1000` (milli-units). A value that is not a whole milli-unit is `precisionExceeded`. |
| Headings | `uint16`. 0 is the bow. Increasing heading is clockwise from above. 65536 is a full circle. |
| Randomness | Named seeded streams. Rules read only `combat`. Chart draws and warhead checks use it. Tests may inject `scriptedDraws` / `warheadRolls`; the sim does not. |
| Distance | One swappable unit. Weapon ranges in the placeholder table are in that unit. |

A **rules-turn** is `rulesTurnTicks` ticks. The placeholder is **900** (30 displayed seconds). That number is unverified. It is also the provisional Combat answer to the mission API's "game turn" length, and it will move when a Wine session times one CE turn.

## 1. What this slice resolves

Energy allocation, movement and turn modes, six shield facings with general and specific reinforcement, phasers, one heavy weapon (photon torpedo), and damage allocation.

Electronic warfare, to-hit rolls, drones in flight, cloaks, tractors, boarding, mines, and fighter flights are named where the model has to store them, and they are not resolved. Firing one returns `notInDuelSlice`.

Phase 2 shots **hit** when the mount is ready, fire control is paid, the target is inside the mapped arc, and the range is inside the weapon's band. There is no miss roll. That is a slice limit, not a claim about CE.

## 2. Real-time adaptation

Tabletop play writes an energy plan and a move for a whole turn, then steps through impulses on a hex map. Turns of the ship are 60-degree hex faces. Damage is often saved up and allocated at the end of the turn.

The duel slice follows the real-time game:

1. The same spend categories exist (movement, life support, fire control, shields, weapons). They are amounts per rules-turn, dripped across ticks. The player may send a new plan on any tick. It applies on the tick the input phase presents it, then covers the next `rulesTurnTicks` ticks.
2. Position is continuous. Heading is a uint16, not a six-step compass. Turn mode caps yaw per tick.
3. Weapons charge while the ship moves. They do not wait for a written fire phase.
4. A hit resolves on the tick it lands, including shield bleed and the chart.
5. To-hit and electronic warfare wait for Phase 3.
6. Which shield is struck is a bearing bin on the uint16 circle (section 4), not a hex side.

Which of these match CE 2.670, and which are our reading of a real-time adaptation, is the fidelity list in [`fidelity-risk.md`](fidelity-risk.md).

## 3. Energy

Sources, after the scale table: `power.warp`, `power.impulse`, `power.apr`. `power.battery` is storage, not generation. Generation per rules-turn is the sum of the three sources. Pending playtest: damaging a warp box scales that source by boxes remaining over boxes original. The fixtures keep sources undamaged, so output equals the rating.

Draws, per rules-turn, placeholder costs in [`data/constants.json`](data/constants.json):

| Draw | Placeholder | Unpaid result |
| --- | --- | --- |
| Life support | 1 if requested | At the end of the rules-turn, lose 1 crew. Crew below `minCrew` sets `disabled`. |
| Fire control | 1 if requested | `fire` returns `noFireControl`. |
| Movement | `moveCost × speed` | Speed falls to what was paid (`overDraw`). |
| Shields | general + specific, after caps | Reinforcement is the reduced plan. |
| Weapons | sum of requests, after charge caps | Mounts charge only from what was paid. |

Pay order, highest priority first: life support, fire control, movement, shields, weapons. This order is unverified. The HUD asks which system is starved first; under this order weapons drop first and life support last.

Each tick of the plan receives a Bresenham share so the shares sum to the committed total:

`share(i) = floor(total × (i+1) / period) − floor(total × i / period)`.

Surplus generation refills the battery up to capacity. The placeholder lets the ship dump the whole battery in one rules-turn and refill it from one turn of surplus. Both the dump and the refill rate are unverified.

A worked balance, all integers, generation 10: speed 4 at `moveCost` 1, life support, fire control, 2 general reinforcement, 2 weapon energy. Total 10. Status `ok`, `appliedValue` 10. Asking for speed 20 instead pays life support 1, fire control 1 and speed 8, and returns `overDraw` with `appliedValue` 10. Fixtures: `tests/set-energy.json`, `tests/life-support.json`.

## 4. Movement and turn modes

`speed` is rule-units per rules-turn of travel. Acceleration limits how far ordered speed may move in one `setEnergy`. Turn letters `AA` and `A`–`G` are recognised and have **no rate** until playtest; speed or yaw on them is `turnModeUnverified`. `H` is immobile: speed and yaw become 0, reason `immobile`.

Synthetic rates used by fixtures only ([`data/turn-modes.json`](data/turn-modes.json)):

| Mode | `maxYawPerTick` | Immobile |
| --- | --- | --- |
| `TEST-A` | 8000 | no |
| `TEST-C` | 2000 | no |
| `H` | 0 | yes |

Yaw is allowed at speed 0 for `TEST-*` modes. Whether CE lets a ship rotate in place is unverified. A requested yaw larger than the cap is `yawClamped` to the cap, sign preserved. Heading wraps mod 65536.

High-energy turns are stored as `hetChance` and `hetBreakdown` and are not resolved in this slice.

## 5. Shields

Six facings, index 0 = front, clockwise. SFB shield *n* is index *n − 1*. Same index as the HUD and the mission API.

Incoming bearing relative to the target's heading maps to a facing by:

`facing = floor((rel × 6 + 32768) / 65536) mod 6`

with `rel` in `[0, 65536)`. Facing 0 is centred on the bow. A heading that lands on a boundary belongs to the clockwise-next facing. The resulting bins are listed in the [mapping](shiplist-mapping.md). This equal-sector split is a design choice. CE may use the model's shield cones instead.

**General reinforcement.** Whole energy points are split across the six facings. Base share is `floor(points / 6)`. The remainder is handed out one point at a time from facing 0 clockwise. Fractional energy under one point is not spent.

**Specific reinforcement** adds whole points to one facing after that split.

Each energy point restores `reinforcePerEnergy` shield points (placeholder 1), up to the facing maximum and up to `reinforceCapPerTurn` (placeholder 100, so the cap does not bind in the default fixtures). Energy removed by the cap or by a full facing is `reinforceCapped` and is not spent. The per-turn cap is the sort of limit tabletop reinforcement has; the CE number is unverified.

Example, cap not binding: general 8 and specific 3 on facing 0. General becomes `[2, 2, 1, 1, 1, 1]`. Facing 0 then has 5. Fixture: `tests/shield-reinforcement.json`.

`setShields` writes current strength directly, spends nothing, and clamps to `[0, max]` only on the high side (`shieldAboveMax`). Negatives are rejected.

`damageShield` removes points and **stops at zero**. Weapon impacts do not use that command. They absorb `min(shield, damage)` and the remainder penetrates.

## 6. Phasers

A mount whose mapped internal type is `phaser` charges up to `chargeCost`. The placeholder `TEST-PH` costs 4 and has two range bands (3 damage out to 10, 1 damage out to 20). Real ftrlist codes `Ph2`, `Ph3` and `PhG` map to `phaser` with **empty** cost rows until playtest.

Charging is the dripped weapon budget. There is no minimum tick count beyond receiving the energy. When `charge` reaches `chargeCost` the mount is ready. `holdCost` is 0 in the placeholder, so a ready phaser does not bleed energy while it waits. A non-zero hold cost would come off the weapon budget first. Whether CE charges to hold is unverified.

Firing is instant in this slice: on the fire tick the damage band is applied to the facing struck. Travel time for phasers is unverified and may be added without changing the charge rule.

**Capacitor hypothesis (unverified, default off).** File slots 11–25 are `slotIndex` 10–24. When `phaserCapacitorFromHighSlots` is true, energy allocated to such a phaser past its own `chargeCost` spills into a ship capacitor, up to the sum of those mounts' charge costs. Slots 0–9 do not feed it. The capacitor can pay a later phaser charge on a high slot. The flag ships **false** so the unverified rule is not on by accident. The on behaviour is fixture `tests/capacitor-hypothesis.json`. The loader does not implement this; the rules module does, keyed on `slotIndex`.

## 7. Photon torpedo

The one heavy weapon. Internal type `photon`. Placeholder `TEST-PHOT`:

| Field | Placeholder | Meaning |
| --- | --- | --- |
| `armCost` / `armTicks` | 4 / 4 | Energy required, and the minimum number of ticks that must deliver energy. The mount cannot finish in fewer ticks by dumping the cost at once. |
| `overloadArmCost` / `overloadArmTicks` | 8 / 4 | Overload arming. |
| `directDamage` | 8 | Damage if the projectile reaches the target in `normal` mode. |
| `overloadDamage` | 12 | Damage in `overload` mode. |
| `proxRadius` / `proxDamage` | 2 / 4 | Proximity fuse. |
| `projectileSpeed` | 2 | Range units per tick. |
| `photonMaxRange` | 30 | Launch past this range is `outOfRange`. |

`PhoF` is the same internal type. Its cost row is empty until playtest.

Modes are `normal`, `overload`, and `proximity`. Proximity uses the normal arming cost and the proximity damage row. Overload uses the overload cost and damage. Combining them is `notInDuelSlice`. Switching mode zeroes charge.

On launch the projectile remembers range, speed, mode and damage. Each later flight phase, including the fire tick's flight phase, subtracts speed from the remaining range. `normal` and `overload` detonate at remaining ≤ 0. `proximity` detonates when remaining ≤ `proxRadius`, so a head-on shot bursts short of the hull. The detonation uses the weapon-hit path (shield, then bleed).

**Overload vulnerability.** If a damage point removes a box from a mount that is in `overload` with charge still stored, the `combat` stream rolls `1..warheadRollSides` (placeholder d6). A roll ≤ `warheadThreshold` (placeholder 2) adds `warheadExtraPoints` (placeholder 2) chart points. Those extras are not part of `appliedValue`. This is a mechanism with synthetic odds, not a copied warhead table.

Worked flight, range 6, speed 2: the fire tick leaves remaining 4; the next tick leaves 2; the tick after that reaches 0 and a normal warhead hits. A proximity fuse at radius 2 detonates on the middle tick. Fixtures: `tests/photon-arm.json`, `tests/photon-proximity.json`.

## 8. Damage allocation

Weapon hit:

1. Bin the incoming bearing to a facing.
2. That facing's shield absorbs up to its current strength.
3. Each remaining damage point, at `chartPointSize` 1, is an internal point.

Internal points (`damageSystem`, or bleed from a hit):

1. `armor` boxes absorb one point each, before any system.
2. If a system was named, further points hit that system until it is gone. `"any"` skips this step. Weapon bleed uses `"any"`.
3. Each leftover point draws a row on the chart. The placeholder chart is four synthetic rows, **not** a published chart: `bridge`, `hullStruck`, `sensors`, `excess`.
4. `hullStruck` means the hull section for the facing: 0, 1 and 5 → `hullForward`; 2 and 4 → `hullCenter`; 3 → `hullAft`. That map is unverified.
5. A row whose system is already at 0 boxes floats forward through the chart, wrapping once. `excess` with `extraDamage` boxes left consumes one of those boxes. `excess` with none left destroys the ship.
6. A full chart with nowhere to put the point also destroys the ship.

The production chart will be a data file filled after playtest. It must not be pasted from a book.

Crew, boarding parties, and repair priority are state. Repair in combat is `repairSystem` (instant restore up to the original count). A damage-control rate over time is unverified and not run in this slice.

## 9. Fighters and PFs in this slice

PFs use the ship model with `class: "pf"` and the entry points above. Fighters use the lighter model in the mapping doc (speed, damage points, five weapon groups, ECM / ECCM, bay fields that the header actually contains). `damageShield` and the other entry points return `notAShip` for a fighter. Fighter weapon and arc **names** are mapped so the loader accepts them; their damage numbers are not in this slice.

## 10. Pending playtest (values)

Every number in `data/constants.json`, `data/turn-modes.json`, and the `TEST-*` weapon rows. The ×2 scale factors. `rulesTurnTicks`. Capacitor flag (keep off). Shield bins versus model cones. Pay order. Battery dump and refill. Phaser hold cost and travel time. Photon arming, overload odds, proximity radius. Chart rows and the hull-section map. In-place yaw. Fighter arc spans and suffix readings. ftrlist `Shots` versus reloads. Shiplist codes and headers (#6).

Verification method: [`fidelity-risk.md`](fidelity-risk.md).
