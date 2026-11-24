# Fleet captains

Status: **synthetic policy, not a CE claim.** The numbers are placeholders so a six-ship match can run. What a Community Edition captain actually does is unverified.

A skirmish holds **1 to 6** ships. Each ship is side A or side B (stored as 0 or 1). Ships that were never assigned a side stay hostile to every other ship, which is how the one-on-one duel still behaves.

## Orders

A captain is a sim system. On each tick it may queue, for the next tick:

| Order | Verb | When |
| --- | --- | --- |
| Energy | `setEnergy` | The current plan has no ticks left, or the ship has just switched between engage and retreat |
| Overload | `setWeaponMode` | The same tick as energy, while fighting inside 10 range units. Each photon whose overload cost is non-zero is set to overload. The energy plan pays that cost. Outside the band the plan asks for a normal photon again |
| Helm | yaw, same payload as the player | The bow is not yet on the chosen heading, and the turn mode has a cap |
| Fire | `fire` | Fire control is paid, the mount is charged, the target is inside the arc and the outer range, and it is not a hidden cloak. A charged overload is a legal shot |
| ECM or ECCM | `setEw` | The same tick as energy, when the ship has sensor boxes. Retreat buys one ECM. Fighting buys one ECCM. Switching the same total spends nothing. A raise still needs the battery |
| Cloak | `setCloak` | The same tick as energy, when a cloak is fitted. Retreat raises it if the battery can pay. Fighting drops it so the fade back to weapons can start |
| Tractor | `setTractor` | Fighting, tractor boxes fitted, target inside `tractorRange`, battery can pay one point. The bid is one, capped by the boxes. A hold that is already paid on that target is left alone |
| Mine | `layMine` | The same tick as energy, while retreating, with a mine aboard and a hostile inside 24. One mine per energy plan |
| Fighter or PF | `launchFighter`, `launchPf` | Fighting, and that bay has a ready craft of the kind, and none of that kind is already out |
| Recall | `recall` | The craft is still attacking. A retreat recalls it. A PF is also recalled once the carrier is inside transporter range. A fighter is recalled once its attack timer has fallen by 8 ticks |
| Raid | `raid` | The same tick as energy, while fighting inside transporter range, with at least one boarding party. Two or more parties board with a commit of 1. The last party is a hit-and-run |

Slots are `8 + entity index`. The payload does not carry a tick. Manual ships are skipped, so the player's session is the only source of their orders.

## Target

Hostile ships are the other side, still afloat. The captain keeps its target for 30 ticks. Then it picks the nearest. An equal distance draws `ai.int` over the tied ids, in entity order. A single nearest ship does not draw.

## Facing

Six headings are considered, one per shield, so that facing's centre looks at the target. The centre of facing *k* is `floor(k * 65536 / 6)`.

While engaging, the captain prefers a facing that keeps a phaser or photon arc on the target and still points the bow within a right angle of the target. Among those, the strongest shield wins. A tie draws `ai.int`. Retreat starts when current shields are under a quarter of the maximum. The ship then presents the strongest shield that still points the bow away, and asks for speed 6.

## Energy

The plan spends generation only, in pay order: life support, fire control, movement, weapon costs, then up to 4 points of specific reinforcement on the facing turned toward the enemy. Retreat does not buy new weapon energy. An armed photon, including an overload that is already charged, may still be loosed. Inside 10, a photon ask is the overload cost and the overload mode. Farther out it is the normal cost.

Speed while engaging: 4 beyond 16 range units, 2 until the ship is inside transporter range, then 0. The creep is what lets a tractor and a raid reach their ranges. Retreat still asks for speed 6.

These speeds, the quarter-shield retreat, the 30-tick hold, the overload band, the 24-unit pursue range, the 8-tick recall, and the one-point tractor bid are fixture choices.
