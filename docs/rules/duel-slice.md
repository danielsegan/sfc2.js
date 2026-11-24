# Phase 2 duel slice

Status: **spec, synthetic numbers, pending playtest.** One ship against one ship. Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Issue: [#24](https://github.com/danielsegan/sfc2.js/issues/24).

Clean-room. Mechanics are described in our own words. Numeric tables in [`data/`](data/) are placeholders we invented for tests, except the CE code names in the [mapping](shiplist-mapping.md). No published chart is copied here.

The engine contract is [`docs/engine/sim-core.md`](../engine/sim-core.md) (Engine Lead; the file is not on `main` yet, so this link is pending). Rules follow it:

| Rule | Duel slice |
| --- | --- |
| Tick | Fixed 30 Hz. One displayed second is 30 ticks. |
| Rules-turn | Written in seconds. Sim-core multiplies by 30. The product must be a whole number of ticks. The seconds value is still TO VERIFY; the default placeholder is 30 seconds. |
| Numbers | 16.16 fixed point, `FX_SHIFT = 16`. One unit is one range unit. A value that is not on that grid is `precisionExceeded`. |
| Headings | `uint16`. 0 is the bow. Increasing heading is clockwise from above. 65536 is a full circle. |
| Randomness | Named seeded streams. The `combat` stream is registered in sim-core. Rules read only that stream. Tests may inject `scriptedDraws` / `warheadRolls`; the sim does not. The checker uses mulberry32 as a test double until sim-core names the generator. |
| Distance | One range unit. Map positions are whole range units, each axis within ±8192. A value outside that is `badMapBounds` from the mission loader ([#52](https://github.com/danielsegan/sfc2.js/pull/52)). Position differences are computed in i64. |
| Long range | A 75-range-unit figure appears only as a fixture probe (`tests/map-bounds.json`) and is TO VERIFY. It is not a weapon-range rule. |

## 1. What this slice resolves

Energy allocation, movement and turn modes, six shield facings with general and specific reinforcement, phasers, one heavy weapon (photon torpedo), and damage allocation.

Drones in flight, boarding, mines, and fighter flights are named where the model has to store them, and they are not resolved. Firing one returns `notInDuelSlice`.

Electronic warfare, heavy-weapon overload, tractors, and cloaks are resolved in [phase3-systems.md](phase3-systems.md). A shot whose ECM shift is zero or better still hits whenever the mount is ready, fire control is paid, the target is inside the mapped arc, and the range is inside the weapon's band. That certain hit does not draw. A defender ECM advantage can miss. That is a placeholder, not a claim about CE.

## 2. Real-time adaptation

Tabletop play writes an energy plan and a move for a whole turn, then steps through impulses on a hex map. Turns of the ship are 60-degree hex faces. Damage is often saved up and allocated at the end of the turn.

The duel slice follows the real-time game:

1. The same spend categories exist (movement, life support, fire control, shields, weapons). They are amounts per rules-turn, dripped across the ticks sim-core derived from that turn's seconds. The player may send a new plan on any tick. It applies on the tick the input phase presents it, then covers that converted length.
2. Position is continuous. Heading is a uint16, not a six-step compass. Turn mode caps yaw per tick.
3. Weapons charge while the ship moves. They do not wait for a written fire phase.
4. A hit resolves on the tick it lands, including shield bleed and the chart.
5. To-hit and electronic warfare are the Phase 3 rule in [phase3-systems.md](phase3-systems.md). A non-negative shift stays a certain hit.
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

`speed` is rule-units per rules-turn of travel. Acceleration limits how far ordered speed may move in one `setEnergy`. Turn letters `AA` and `A`–`G`, and any other token that is not `H` or a `TEST-*` row, have no per-letter rate until playtest. They use `fallbackMaxYawPerTick` from [`data/turn-modes.json`](data/turn-modes.json) (placeholder 2000, the same integer as `TEST-C`, not a measured CE rate). The sim emits `turnModeUnverified` once, when that hull is spawned, and then keeps speed and yaw orders. `H` is immobile: speed and yaw become 0, reason `immobile`.

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

A mount is a phaser because its **code** maps to internal type `phaser`, not because of which slot it sits in. `Ph1`, `Ph2`, `Ph3`, `Ph4`, `PhG` and the synthetic `TEST-PH` are phasers. `Ph3` also occurs on heavy-weapon slots. A real phaser row that omits `chargeCost` takes `costFallback.phaser` in [`data/weapon-arcs.json`](data/weapon-arcs.json): the same integers as `TEST-PH` (charge 4, damage 3 out to 10 and 1 out to 20). Those numbers are not a CE measurement. Writing `chargeCost` on the code's own row replaces the fallback without a code change. A code that is not in the catalog is `unknownWeapon` and is not mounted at cost 0.

Charging is the dripped weapon budget. There is no minimum tick count beyond receiving the energy. When `charge` reaches the cost the mount is ready. `holdCost` is 0 in the placeholder, so a ready phaser does not bleed energy while it waits. A non-zero hold cost would come off the weapon budget first. Whether CE charges to hold is unverified.

Firing is instant in this slice: on the fire tick the damage band is applied to the facing struck. Travel time for phasers is unverified and may be added without changing the charge rule.

**Capacitor.** Every phaser feeds the ship capacitor, in a heavy slot or in slots 11–25. Energy allocated past that mount's own cost spills into the capacitor, up to the sum of the phaser costs on the ship. The capacitor can pay a later charge on any phaser. A heavy-slot `Ph3` doing this is `tests/heavy-slot-phaser.json` (the cost 4 on that fixture is synthetic, not a CE stat). The loader does not apply this; the rules module does, from the code's internal type.

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
| `maxRange` | 30 | Synthetic launch limit for `TEST-PHOT` only. Not the 75-unit probe. |

`Phot` and `PhoF` are the same internal type. A photon row that omits `armCost` takes `costFallback.photon`, the same integers as `TEST-PHOT`. A row that names `armCost` keeps its own numbers. The fallback is not a measured CE arming cost.

Modes are `normal`, `overload`, and `proximity`. Proximity uses the normal arming cost and the proximity damage row. Overload uses the overload cost and damage. Combining them is `notInDuelSlice`. Switching mode zeroes charge.

On launch the projectile remembers range, speed, mode and damage. Each later flight phase, including the fire tick's flight phase, subtracts speed from the remaining range. `normal` and `overload` detonate at remaining ≤ 0. `proximity` detonates when remaining ≤ `proxRadius`, so a head-on shot bursts short of the hull. The detonation uses the weapon-hit path (shield, then bleed).

**Overload vulnerability.** If a damage point removes a box from a mount that is in `overload` with charge still stored, the `combat` stream rolls `1..warheadRollSides` (placeholder d6). A roll ≤ `warheadThreshold` (placeholder 2) adds `warheadExtraPoints` (placeholder 2) chart points. Those extras are not part of `appliedValue`. This is a mechanism with synthetic odds, not a copied warhead table.

Worked flight, range 6, speed 2: the fire tick leaves remaining 4; the next tick leaves 2; the tick after that reaches 0 and a normal warhead hits. A proximity fuse at radius 2 detonates on the middle tick. Fixtures: `tests/photon-arm.json`, `tests/photon-proximity.json`.

**What the sim does** ([#23](https://github.com/danielsegan/sfc2.js/issues/23)). A phaser hit is resolved in the input phase of the fire tick, before that tick's energy drip. A photon `fire` spends the mount's charge and launches a seeker. The seeker stores the floored Q16.16 range (`isqrt64` of the exact distance squared), speed, mode, and damage. The weapons phase of every tick, including the launch tick, subtracts speed from the remaining range and detonates on the rule above. The impact emits a hit event on the detonation tick. The launch's `ruleResult` is the only rules result for that shot.

The energy slice applied photon damage inside the fire command. Flight replaces that. The fixtures already lock arming-to-impact time, and a same-tick impact would skip it.

A duel-slice miss is a rejected shot: `outOfArc` when the bearing is outside the mount, `outOfRange` when it is past the last phaser band or `maxRange`. The mount keeps its charge. This slice has no to-hit roll.

Axis-aligned integer positions match the worked range-6 example. A diagonal uses the floored distance, the sim-core distance rule. The overload warhead roll runs when a point removes a box from a charged overload mount. The placeholder chart rows are bridge, the hull section, sensors, and excess, so a penetrating weapon hit stops on those rows.

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

The sim walks this chart for a penetrating weapon hit. Armor absorbs before any draw. Draws come from the `combat` xoshiro128** stream. The fixture checker still resolves `damageSystem` and `repairSystem`.

Crew, boarding parties, and repair priority are state. Repair in combat is `repairSystem` (instant restore up to the original count). A damage-control rate over time is unverified and not run in this slice.

## 9. Fighters and PFs in this slice

The CE 2.670 shiplist has 15 `FTR` hull rows and no PF rows. The `class: "pf"` flag stays on the ship model for a later file or a mod. Stock fighters use the lighter model in the mapping doc. `damageShield` and the other entry points return `notAShip` for a fighter. Fighter weapon and arc names are mapped so the loader accepts them; their damage numbers are not in this slice.

## 10. Pending playtest (values)

Every balance number in `data/constants.json`, `data/turn-modes.json`, the `TEST-*` rows, and `costFallback`. How many seconds a CE rules-turn lasts. The ×2 scale factors. Shield bins versus model cones, and every arc facing set. Whether the numeric Arc on `Dro*` and ADD means reloads or rack capacity. Pay order. Battery dump and refill. Phaser hold cost and travel time. Photon arming, overload odds, proximity radius. Chart rows and the hull-section map. In-place yaw. ftrlist `Shots` versus reloads. The 75-unit range probe.

Verification method: [`fidelity-risk.md`](fidelity-risk.md).
