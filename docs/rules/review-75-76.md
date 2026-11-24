# Review: rule calls in #75 and #76

Owner: Combat Systems Designer. This note lists the calls those two pulls made so they can be confirmed or replaced. It does not change the spec. The mechanism those calls implement is [duel-slice.md](duel-slice.md). Baseline remains Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)).

[#75](https://github.com/danielsegan/sfc2.js/pull/75) added energy, six shields, and arcs. [#76](https://github.com/danielsegan/sfc2.js/pull/76) made phasers and photons fire. The call that changed between them is the photon: #75 applied its damage on the fire tick, and #76 launches a seeker that flies.

## Photon flight (the change #76 made)

| | #75 | #76, current sim |
| --- | --- | --- |
| When a ready photon that is in arc and in range resolves | Damage is applied inside the fire command, on the fire tick. | The fire command spends the armed charge and launches a seeker. It does not apply damage. |
| Flight | Not flown. | The weapons phase flies the seeker on the launch tick and on later ticks. |
| Impact | Same tick as fire. `ruleResult.appliedValue` is the damage. | A hit event on the detonation tick. No second `ruleResult`. The launch's `ruleResult` is the only rules result for that shot. |
| Worked example | Not a flight. | Range 6 at speed 2: the fire tick leaves remaining 4, the next tick leaves 2, the tick after that hits for `directDamage` 8. |
| Proximity | `proxDamage` if the target is inside `maxRange`. | Fuse radius 2. The same range-6 shot detonates one step earlier, short of the hull, for `proxDamage` 4. |

#76 made this change because the duel slice already locks arming-to-impact time. A same-tick impact would skip that time. Phasers stay instant. Whether CE phasers have travel time is still unverified.

Please confirm or replace:

1. A photon should fly, including on the launch tick, rather than hit inside the fire command.
2. The launch `ruleResult` is the only rules result. The impact is a hit event.
3. The worked range-6, speed-2 timing, and the proximity fuse detonating one step early, match the slice we want to playtest.
4. A miss in this slice is only `outOfArc` or `outOfRange`. The mount keeps its charge. There is no to-hit roll.

## Calls #75 made that #76 left in place

1. Energy is stored as hundredths of a rule point (1 point = 100). Command plans are whole points. The `setEnergy` applied value is hundredths.
2. Shield strength is integer points. Energy under one point is not spent on shields. That remainder can pay weapons, then becomes surplus battery.
3. Every phaser feeds one capacitor, including a phaser in a heavy slot. At the start of `setEnergy`, capacitor energy moves onto phasers in ascending slot order, before the request is capped.
4. A short shield budget cuts facing points from index 5 down to 0.
5. Switching a mount's mode clears its charge before the cap is applied.
6. Empty acceleration means the hull does not move. A non-positive move cost spends nothing and is never used as a divisor.
7. A weapon whose cost row is empty cannot charge or fire. #76 did not fill those rows. (A later change, [#80](https://github.com/danielsegan/sfc2.js/pull/80), applies `costFallback` to a phaser or photon that omits its cost. Other codes are still empty and still cannot charge.)
8. When several clamps apply, the reason priority is `overDraw`, then `speedClamped`, then `immobile`, then `reinforceCapped`, then `chargeCapped`.
9. Fire uses the cross/dot wedge of the arc. The bearing table is the half-open uint16 span. On the four axes the two agree.
10. An unknown id is `noSuchShip`. A fighter is `notAShip`.
11. Ordered speed is stored and paid. #75 did not integrate position from speed.
12. The default rules-turn is 30 seconds × 30 Hz = 900 ticks.
13. A shiplist bind starts shields full, battery full, and charge at 0. Boxes are the hardpoint count, or 1 when the count cell is empty. An unknown weapon code is not mounted.
14. Phaser damage is applied on the fire tick, before that tick's energy drip. The struck facing absorbs `min(shield, damage)`. The remainder walks armor, then the placeholder chart, on the `combat` xoshiro128** stream.
15. The placeholder chart is bridge, the hull section, sensors, and excess. A penetrating hit stops on those rows, so it does not reach a mount and does not roll the overload warhead check. That roll stays specified for a point that removes a box from a charged overload mount.

## What this review is not

Later pulls moved some neighbouring behaviour. They are not part of the #75/#76 list above, except the cost-fallback note in item 7:

- [#79](https://github.com/danielsegan/sfc2.js/pull/79) lets an unverified turn letter move at the fallback yaw and warns once at spawn, instead of refusing the order.
- [#80](https://github.com/danielsegan/sfc2.js/pull/80) gives empty phaser and photon rows the synthetic costs so a CE hull can arm.

Confirming or replacing a row in this note is a combat change to [duel-slice.md](duel-slice.md) and the fixtures under [tests/](tests/).
