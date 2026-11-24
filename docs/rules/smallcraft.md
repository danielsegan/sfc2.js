# Fighters, PFs, mines, and raids

Status: **spec, synthetic numbers, pending playtest.** Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). The duel slice still owns energy, shields, phasers, and photons ([duel-slice.md](duel-slice.md)).

Clean-room. Mechanics are described in our own words. Numbers live in [`data/smallcraft.json`](data/smallcraft.json) and the sim reads that file. They are placeholders we invented so the commands can be tested. They are not CE timings or a published chart.

The engine contract is [`docs/engine/sim-core.md`](../engine/sim-core.md). This slice follows it: 30 Hz, 16.16 positions, integer bearings, and the named `combat` stream for raid dice only. Fighter steering, mine arming, and mine detection do not draw a stream.

## 1. What this slice resolves

| Order | Verb id | Who may issue it |
| --- | --- | --- |
| `setSide` | 20 | A live ship or PF. Side is 0 or 1. |
| `setStores` | 21 | Mines carried, boarding parties, and security rating. |
| `setBay` | 22 | One of four bays: empty, a fighter type, or a PF setup. |
| `launchFighter` | 23 | A ship or PF with a ready fighter in that bay. |
| `recall` | 24 | A launched fighter or PF. It turns for its carrier. |
| `launchPf` | 25 | A ship or PF with a ready PF in that bay. |
| `layMine` | 26 | A ship or PF that still has a mine. |
| `raid` | 27 | Hit-and-run (`mode` 0) or a boarding party (`mode` 1). |

Verbs 7–19 stay free for other Phase 3 work. Helm stays 6. Combat stays 1–5.

A fighter is entity kind `fighter`. A PF is entity kind `ship` with `class` `pf`, spawned from a shiplist-shaped setup. A mine is entity kind `mapObject`. Duel entry points still return `notAShip` for a fighter. They accept a PF.

Rejected commands do not draw the `combat` stream.

## 2. Fighters

The carrier's bay stores a catalog index. The catalog is `bindFtrlist` on a table the existing `parseFtrlist` parser already read. The sim does not open the file. It keeps the integer row: speed, damage points, and the first weapon group (`weapon`, `arc`, `load`).

Header cells used, by the raw names the parser stores:

| Header | Use |
| --- | --- |
| `Race`, `Type` | `fighterKey = race + ":" + type`. The first row wins. |
| `Speed` | Range units per rules-turn, the same unit as ship speed. |
| `Damage` | Hit points. A mine that reduces them to 0 destroys the fighter. |
| `Weapon1` / `Arc` / `Shots` | Copied onto mount 0. The fighter AI does not fire that mount. |

`Shots` stays `load`. There is still no rearm column in the CE header, so rearm time is `rearmTicks` from the JSON, not a file cell. `Carrier Size Class` is not enforced. A non-integer speed or damage drops that row at bind time.

`launchFighter` spends one ready fighter and spawns at the carrier's position and heading. The same tick's AI/mission phase steers it, then movement cruises it.

Steering is a pure function of positions:

1. While attacking, the target is the nearest live ship or PF on the other side. Distance is the exact i64 square. A tie keeps the lower entity index. Other fighters are not targets.
2. Heading steps toward that bearing by at most `fighterYawPerTick` (placeholder 8000, the same integer as turn mode `TEST-A`).
3. Inside `strikeRange` the fighter stops. Outside it, speed is the catalog speed.
4. On the first tick inside range, and again every `strikePeriod` ticks, it chips `strikeDamage` off the facing shield. Overflow hits armor, then `extraDamage`. It does not walk the damage chart and it does not destroy the ship.
5. After `enduranceTicks` in the attack state, or when `recall` arrives, the fighter turns for its carrier. Inside `dockRange` of a live carrier it leaves the map and joins that bay's rearm queue.

A destroyed fighter is expended. Only a fighter that docks rearms. Each bay has one timer. The tick it docks sets the timer to `rearmTicks` and does not count that tick. When the timer reaches 0, one fighter becomes ready. If more are queued, the timer starts again.

Worked launch, rules-turn of 1 tick, catalog speed 4, enemy 6 units ahead on the bow: the launch tick moves the fighter 4 units. Range is then 2, which is inside `strikeRange`, so facing 0 of the enemy loses `strikeDamage` (1). The next tick holds position and does not strike (`strikePeriod` 2). The tick after that strikes again.

## 3. PFs

`launchPf` spends one ready PF and calls the same hull placement as `spawn`, then copies the carrier's position and heading. The setup's `classCode` must be `pf`. Anything else is `unknownCraft`.

A PF is a ship. `setEnergy`, `setShields`, helm, and `fire` apply. The fighter AI does not fly it.

`recall` on a PF sets it to return. It yaws within its turn-mode cap and cruises at `pfRecoverSpeed` until it is inside `dockRange`. It then leaves the map and uses that bay's rearm timer, the same timer as fighters.

## 4. Mines

`layMine` spends one mine and leaves a map object on the layer's position.

| Phase | Rule |
| --- | --- |
| Arming | `mineArmTicks` weapons phases. No blast and no detection yet. |
| Detection | Once armed, the first other-side ship, PF, or fighter inside `mineDetectRange` marks it detected. One event. No die roll. |
| Detonation | Once armed, the nearest other ship, PF, or fighter inside `mineBlastRange` takes `mineDamage`. The layer is never the victim. Ties keep the lower entity index. The mine then leaves the map. |

Damage uses the shield facing on the incoming bearing, then armor, then `extraDamage`. Leftover points stop there. They do not walk the chart and they do not destroy the ship.

Worked arming: `mineArmTicks` 4. The lay tick and the next two ticks leave the mine unarmed. The fourth tick arms it. An enemy on the same point loses 6 shield points on the facing the bearing selects (facing 0 when both headings are 0 and the offset is zero). The layer's shields stay. An enemy 3 units away, with detect 4 and blast 1, is detected and is not damaged.

## 5. Boarding parties and hit-and-run

Both need two live ships or PFs, different recorded sides, and range within `transporterRange`. A fighter target is `notAShip`.

Dice are one d6 each, attack die then defense die, from the `combat` stream. A tie goes to the defense.

| Mode | Spend | Attack total | On a win | On a loss |
| --- | --- | --- | --- | --- |
| Hit-and-run (0) | None. Needs at least 1 party. | die + 1 | Remove one box. | `raidRepulsed`. No loss. |
| Boarding (1) | `commit` parties, before the dice. `commit` must be from 1 through the parties carried. | die + `commit` | Strip up to `commit` defender parties, then one box. | `boardingRepulsed`. The committed parties stay spent. |

Defense total is die + the defender's security rating.

The box order is `sensors`, then `bridge`, then `extraDamage`. That order is a placeholder, not a published raid table. No chart draw.

## 6. Reason codes

New `source: "rules"` codes, add-only, also listed in [`reason-codes.md`](reason-codes.md):

| Code | When |
| --- | --- |
| `bayEmpty` | Launch with no ready craft in that bay. |
| `badBay` | Bay index outside 0..3, or a side outside 0..1. |
| `unknownCraft` | Fighter type or PF setup is not in the catalog, or the setup is not a PF. |
| `noMines` | `layMine` with none carried. |
| `noParties` | Raid with no party, or a boarding commit the ship does not have. |
| `sameSide` | The two ships share a side, or either side was never set. |
| `badRaid` | `mode` is not 0 or 1. |
| `raidRepulsed` | Hit-and-run dice lost. |
| `boardingRepulsed` | Boarding dice lost after the parties were committed. |

`ok`, `noSuchShip`, `shipDestroyed`, `notAShip`, `negativeValue`, and `outOfRange` are the existing codes.

## 7. Pending playtest

Every number in `data/smallcraft.json`. Whether CE rearm time, mine arming, and transporter range match these placeholders. Whether a mine can hurt its layer. Whether fighter `Shots` is a magazine. Whether raids walk a published table. `Carrier Size Class` is stored by the parser and not applied here.
