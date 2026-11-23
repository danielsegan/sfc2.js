# Mission entry points and `ruleResult`

Status: Phase 2 duel slice. Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Mission queue and tokens: [`docs/missions/mission-api.md`](../missions/mission-api.md) §4.3 and §6.5 ([#41](https://github.com/danielsegan/sfc2.js/pull/41)). HUD presentation: [`docs/ui/hud-spec.md`](../ui/hud-spec.md) §14e.

The mission runtime queues a command on tick T and the sim presents it in tick T+1's input phase. The rules module sees the command that is already due. It does not add a second delay. Fixtures name the tick whose input phase runs the command.

Every rules command returns a token. The matching `ruleResult` is emitted after the command is resolved. Rejection does not throw. A rejected command leaves state unchanged. A clamped command writes the applied values.

```ts
interface RuleResult {
  token: number;
  status: "applied" | "clamped" | "rejected";
  reason: string;                 // camelCase code from reason-codes.md
  appliedValue: number | null;    // null when rejected
  details?: Record<string, unknown>;
  location?: { field?: string };
}
```

Logged form: `{ code: reason, source: "rules", severity, details?, location? }`. Severity comes from [`reason-codes.md`](reason-codes.md). The mission event sketch calls the number `applied`, and the HUD reads `value`. Those are the same number as `appliedValue`. Aligning the three names is an open Engine / Missions question; rules fixtures use `appliedValue`.

`appliedValue` is, by command: shield points now on the facing (`setShields`), points removed (`damageShield`), boxes restored (`repairSystem`), requested internal points actually placed (`damageSystem`, warhead extras excluded), energy committed for the rules-turn (`setEnergy`), yaw actually applied (`orderHelm`), or the weapon's damage rating (`fire`).

Identity checks, in order, for every entry point: unknown spawn key → `noSuchShip`; `class: "fighter"` → `notAShip`; `destroyed` → `shipDestroyed`. `crewDisabled` is checked only on `fire` and `orderHelm`.

## `setShields(ship, facing, value)`

Sets the current strength of one facing. It does not spend energy and it does not change the maximum.

1. Facing not an integer in 0..5 → `badFacing`.
2. Value not on the milli-unit grid → `precisionExceeded`.
3. Value &lt; 0 → `negativeValue`.
4. Value above max → clamp to max, `shieldAboveMax`, `appliedValue` = max.
5. Otherwise `ok`, `appliedValue` = value.

## `damageShield(ship, facing, points)`

Removes points from one facing. Leftover points are discarded. This command does not penetrate to internals. Weapon hits use a different path and do bleed; see the duel slice.

1. Facing check, precision check, negative check, as above.
2. Remove `min(current, points)`. If that is less than requested, `shieldDepleted` and `appliedValue` is the points removed.
3. A request of 0 is `ok` with `appliedValue` 0.

## `repairSystem(ship, system, boxes)`

Restores destroyed boxes up to the original count (`systemsMax`, or `boxesMax` on a mount addressed as `weapon:<slotIndex>`).

1. `boxes` not an integer → `nonIntegerBoxes`. Negative → `negativeValue`.
2. Unknown key → `noSuchSystem`, `location.field` = the key.
3. `boxes === 0` → `ok`, `appliedValue` 0.
4. Nothing missing and `boxes > 0` → `nothingToRepair`, `appliedValue` 0.
5. Restored count below the request → `repairCapped`, `appliedValue` = restored.
6. Otherwise `ok`.

## `damageSystem(ship, system, boxes)`

Injects `boxes` points of penetrating damage. Shields are not touched. Armor absorbs first, one box per point. If `system` is not `"any"`, remaining points then land on that system until it has no boxes left. Whatever is still unplaced walks the damage chart. The chart, the float rule, and the excess pool are in the duel slice.

1. Non-integer or negative boxes rejected as above. Zero boxes → `ok`.
2. Unknown system (and not `"any"`) → `noSuchSystem`.
3. `appliedValue` counts requested points placed, including a point that destroys the ship, and does not count warhead extras.
4. If requested points remain, `excessDamage`. If the last requested point is the one that destroys the ship, the status is `ok`.

A mount is the system key `weapon:<slotIndex>`. Hitting an overloaded photon with charge still on it can add chart points; see the duel slice.

## `setEnergy(ship, allocation)`

Sets the standing power plan. Recognised keys: `speed`, `lifeSupport`, `fireControl`, `shields` (`general` and `specific` keyed by facing `"0"`..`"5"`), `weapons` (`slotIndex`, `request`, optional `mode`). Any other key → `unknownDraw` and the previous plan stands.

Magnitude checks before any write: negative numbers, milli-unit precision, `badFacing`, `unknownWeaponSlot`, `notInDuelSlice` (drones, disruptors, and any mode other than `normal` / `overload` / `proximity`; phasers accept only `normal`). A speed above 0 on a turn letter with no rate → `turnModeUnverified`.

Then the plan is settled for one rules-turn:

1. Immobile hulls (`turnMode` `H`, or a mode flagged immobile) force speed to 0.
2. Otherwise speed changes by at most `acceleration` per rules-turn.
3. Weapon requests are cut to the energy the mount can still take. With the capacitor flag on, phaser mounts whose `slotIndex` is 10..24 may also fill the capacitor. A cut here is `chargeCapped` if nothing else clamps the plan.
4. General reinforcement is split in whole energy points across six facings (remainder starts at facing 0 and walks clockwise), then specific points are added, then each facing is cut to `reinforceCapPerTurn` and to the room under its maximum. A cut here is `reinforceCapped` if nothing harsher applies.
5. Generation is `power.warp + power.impulse + power.apr`. Battery charge may be spent down to zero this turn (pending playtest) and surplus generation refills the battery up to capacity.
6. The pool is paid in order: life support, fire control, movement, shields, weapons. Movement that cannot be paid reduces speed to what was paid, and the leftover milli-units continue to shields and weapons. Any category paid below its (already capped) desire yields `overDraw`. That reason wins over `speedClamped`, `immobile`, `reinforceCapped` and `chargeCapped`.
7. `appliedValue` is the energy committed, in rule units.

Fire-control permission latches from this settlement until the next `setEnergy`. Weapon and reinforcement budgets drip across `rulesTurnTicks` ticks starting on the applying tick. Changing mode on a mount zeroes its charge.

Life-support failure (demanded and unpaid) removes `crewLossIfLifeSupportUnpaid` crew at the end of that rules-turn. Crew below `minCrew` sets `disabled`. The tick loop applies that consequence; a resolve-only call reports `overDraw` and waits for the loop.

## Commands the duel slice also resolves

These are player and AI commands, not mission entry points. They use the same `ruleResult`.

`orderHelm({ yaw16 })` — one tick of yaw. Disabled crew → `crewDisabled`. Unrated turn letter → `turnModeUnverified`. Immobile hull and non-zero yaw → `immobile`, `appliedValue` 0. Yaw past `maxYawPerTick` → `yawClamped`.

`fire({ slotIndex, target })` — check order after identity: `crewDisabled`, `unknownWeaponSlot`, `notInDuelSlice`, `weaponDestroyed`, `notCharged`, `noFireControl`, missing or destroyed target (`noSuchShip` / `shipDestroyed`), `outOfArc`, `outOfRange`, then the shot. A rejection does not spend charge. Phaser damage is applied on this tick. Photon shots launch a projectile; the impact is a later sim consequence and does not emit a second `ruleResult` in this slice.

## AI orders

Mission AI orders (`target`, `moveTo`, `patrol`, and the rest of mission-api §6.6) enter the captain's order queue. The duel slice does not resolve them. A later combat spec maps each order onto `setEnergy`, `orderHelm` and `fire`. The queue itself is not a rules reason code.
