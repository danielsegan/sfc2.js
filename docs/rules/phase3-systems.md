# Phase 3 systems: EW, overloads, tractors, cloaks

Status: **spec, synthetic numbers, pending playtest.** Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). The duel slice in [duel-slice.md](duel-slice.md) still governs energy, shields, phasers, and photons. This file is the resolution rule for the four systems that slice left open.

Clean-room. The mechanisms are described in our own words. Every balance number lives in [`data/constants.json`](data/constants.json) and is a placeholder, not a copied chart. Shiplist columns supply the ship's ratings. Empty cells stay "not fitted."

A rules-turn is `RULES_TURN_SECONDS` (33 seconds, 990 ticks at 30 Hz), dripped across that many ticks. Fixed point stays 16.16. The only random draws are the `combat` xoshiro128** stream.

## 1. Electronic warfare

Shiplist inputs:

| Column | Engine field | Role |
| --- | --- | --- |
| `stealth` (header may read `stealth (+ecm)`) | `stealth` | Free ECM. May be negative. Not paid. |
| `sensors`, `scanners`, `specialSensors` | the same box counts | Powered EW capacity is the sum of the boxes still left. Chart damage to `sensors` lowers the next allocation. |

`setEw(ecm, eccm)` buys whole points from the battery. One point costs one energy point. Raising the total spends the difference. Lowering it refunds the difference up to battery capacity. Retasking the same total (more ECM, less ECCM) spends nothing.

A ship whose sensor sum is 0 cannot buy points (`noEw`). A request above the sum is cut, ECCM first, and returns `ewCapped`. A battery that cannot cover the increase returns `overDraw` and buys what the battery can pay. `appliedValue` is the points now allocated.

Defensive ECM is `max(0, ecmPaid + stealth)`. Negative stealth cannot push that below zero, so it does not grant the shooter a bonus while a non-negative shift is a certain hit. Attacker ECCM is the attacker's paid ECCM. The shift is `eccm − defensiveEcm`.

Hit chance, out of `ewHitDenom` (placeholder 100):

- Shift ≥ 0: certainty. The combat stream is not drawn.
- Each point of negative shift subtracts `ewPenaltyPerPoint` (placeholder 20), and the chance does not fall below `ewHitFloor` (placeholder 5).

A phaser rolls on the fire tick, after arc and range succeed. A miss spends the charge, returns `ewMiss`, and does not strike. A photon still launches. The same roll is made when the seeker detonates, against the ECM and ECCM paid at that tick. A miss emits an `ewMiss` alert and does not strike. It is not a second `ruleResult` for that shot. The launch result stays `ok`.

A duel that never buys ECM, and whose stealth is not positive, still hits exactly as the Phase 2 slice did.

## 2. Heavy-weapon overload

`setWeaponMode(slot, mode)` selects `normal`, `overload`, or `proximity`. Changing mode zeroes charge and arming ticks. The command does not spend energy. The next `setEnergy` pays the mode's cost through the weapon budget, the same drip as a normal arm.

| Mode | Cost and effect |
| --- | --- |
| `normal` | `armCost` / `armTicks`, `directDamage` |
| `overload` | `overloadArmCost` / `overloadArmTicks`, `overloadDamage` |
| `proximity` | Normal arming cost, proximity damage |

A phaser accepts only `normal`. Anything else is `notInDuelSlice`. Overload on a heavy weapon whose `overloadArmCost` is 0 is `noOverload`. A photon row that omits `armCost` inherits the placeholder block, including the overload cost, until a measured cost is written on that code. `TEST-PHOT` and that placeholder both overload for 8, arm in 4 ticks, and hit for 12. The overload warhead check in the duel slice is unchanged.

The duel UI sends this verb. `O` toggles overload on the selected mount. The standing energy plan then asks for that mode's cost when the weapon request is left on automatic.

## 3. Tractor beams

`tractors` is the box count. Zero boxes is `noTractor`. `mechTractors` stays stored and is not read.

`setTractor(target, mode, energy)`:

| Mode | Effect |
| --- | --- |
| `off` | Drops the beam and refunds the paid bid, up to battery capacity. |
| `reinforce` | Parks energy in the tractor so another ship's beam has to beat it. No target. |
| `hold` | Beam in. The target is dragged toward the holder. |
| `repel` | Beam in. The target is pushed away along the same line. |

The bid is whole energy points, capped by the tractor boxes (`tractorCapped` when the boxes cut it). The increase comes out of the battery. A short battery is `overDraw` and the bid is what was paid. Hold and repel must be inside `tractorRange` (placeholder 5) or the command is `outOfRange` and spends nothing. The holder cannot target itself (`badTarget`).

The contest is `paid − target.tractorPaid`. A margin of 1 or more forms the link. A margin of 0 or less leaves the bid in place and returns `tractorBroken`. Each later movement tick checks again. Leaving range, losing the contest, or losing the target drops a live link and emits `tractorBroken` once.

While the link holds, each point of margin pulls or pushes `tractorPullPerPoint` range units per rules-turn (placeholder 1), shared across the turn the way cruise shares speed. The target's cruise speed for that tick is 0. The holder's cruise speed drops by `tractorSelfSlow` (placeholder 1). Ordered speed is left as the energy plan set it. The override lasts one tick.

## 4. Cloak

`cloakCost` empty or 0 means the hull has no cloak (`noCloak`). A fitted cloak spends that many energy points from the battery to start, and again each rules-turn while it is not off. The first bill is part of the command. If the battery cannot cover it, the command is `overDraw` and the cloak stays off. A later bill that fails drops the cloak and emits `cloakCollapsed`.

States are `off`, `engaging`, `on`, and `disengaging`. Entering or leaving takes `cloakTicks` (placeholder 30, one second). The command's own tick counts. Weapons stay locked for the whole cycle, including the fade (`cloaked`). Charge is not spent on that refusal.

A ship whose cloak state is `on` is hidden from another ship unless one of these is true:

- Range is within `cloakBaseDetect` (placeholder 2), inclusive.
- The searcher has scanner boxes, and range is within `scanners × cloakScanPerBox` (placeholder 3 per box).
- The searcher's special sensors spot it. Each box is `specialSensorChancePerBox` out of `ewHitDenom` (placeholder 10). The roll is once per searcher per energy tick, and only when the range checks missed. The result is stored on the cloaked ship for indices 0 through 31. A certain chance does not draw.

Firing at a hidden ship is `notDetected` and does not spend charge. The firing ship always knows its own cloak. The duel view omits a hostile contact the player's ship does not detect, including on the sensor plot and the 3D hull.

## 5. Commands

Payloads are little-endian int32 words. The session stamps tick, slot, and seq.

| Verb | Id | Words |
| --- | --- | --- |
| `setEw` | 11 | entity, ecm, eccm. 7 is `setAllegiance` |
| `setWeaponMode` | 8 | entity, slot, mode (`0` normal, `1` overload, `2` proximity) |
| `setTractor` | 9 | entity, target, mode (`0` off, `1` hold, `2` repel, `3` reinforce), energy |
| `setCloak` | 10 | entity, on (`0` or `1`) |

Helm stays verb 6. Fire checks, after `noFireControl`: `cloaked`, then the existing target, arc, and range checks, then `notDetected`, then the shot. A phaser `ewMiss` is that fire's `ruleResult`.

## 6. Pending playtest

Whether CE allocates EW from the battery or from the rules-turn pool. The penalty per ECM point, the floor, and whether a positive shift should do more than cancel ECM. Cloak fade time, the detection ranges, and whether firing is forbidden for the whole fade. Tractor range, whether the bid is per turn instead of a stake, and how hard a held ship is dragged. Overload costs on real heavy-weapon codes. All of those are unverified. The method is [fidelity-risk.md](fidelity-risk.md).
