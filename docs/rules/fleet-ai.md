# Fleet captains

Status: **synthetic policy, not a CE claim.** The numbers are placeholders so a six-ship match can run. What a Community Edition captain actually does is unverified.

A skirmish holds **1 to 6** ships. Each ship is side A or side B (stored as 0 or 1). Ships that were never assigned a side stay hostile to every other ship, which is how the one-on-one duel still behaves.

## Orders

A captain is a sim system. On each tick it may queue, for the next tick:

| Order | Verb | When |
| --- | --- | --- |
| Energy | `setEnergy` | The current plan has no ticks left, or the ship has just switched between engage and retreat |
| Helm | yaw, same payload as the player | The bow is not yet on the chosen heading, and the turn mode has a cap |
| Fire | `fire` | Fire control is paid, the mount is charged, the target is inside the arc and the outer range, and it is not a hidden cloak |
| ECM or ECCM | `setEw` | The same tick as energy, when the ship has sensor boxes and battery for one point and no EW is paid yet. Retreat buys one ECM. Fighting buys one ECCM |
| Cloak | `setCloak` | The same tick as energy, when a cloak is fitted. Retreat raises it if the battery can pay. Fighting drops it so the weapons unlock |

Slots are `8 + entity index`. The payload does not carry a tick. Manual ships are skipped, so the player's session is the only source of their orders.

## Target

Hostile ships are the other side, still afloat. The captain keeps its target for 30 ticks. Then it picks the nearest. An equal distance draws `ai.int` over the tied ids, in entity order. A single nearest ship does not draw.

## Facing

Six headings are considered, one per shield, so that facing's centre looks at the target. The centre of facing *k* is `floor(k * 65536 / 6)`.

While engaging, the captain prefers a facing that keeps a phaser or photon arc on the target and still points the bow within a right angle of the target. Among those, the strongest shield wins. A tie draws `ai.int`. Retreat starts when current shields are under a quarter of the maximum. The ship then presents the strongest shield that still points the bow away, and asks for speed 6.

## Energy

The plan spends generation only, in pay order: life support, fire control, movement, weapon costs, then up to 4 points of specific reinforcement on the facing turned toward the enemy. Retreat does not buy new weapon energy. An armed photon may still be loosed. An overload is not requested and is not fired.

Speed while engaging: 4 beyond 16 range units, 2 beyond 10, otherwise 0 so a charged mount can sit inside the placeholder phaser band.

These speeds, the quarter-shield retreat, and the 30-tick hold are fixture choices.
