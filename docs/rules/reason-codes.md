# Rules reason codes

Status: Phase 2 duel slice. Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)).

The rules module emits these codes only as `ruleResult.reason`. The diagnostic shape is the shared one, `{ code, source, severity, details?, location? }`, with `code` set to the reason and `source` set to `"rules"`. Example: `{ code: "noSuchSystem", source: "rules" }`.

`source: "rules"` is only for these reason codes. `unknownWeapon` and `unknownArc` are loader diagnostics (`source: "loader"`), defined in [`docs/formats/shiplist.md`](../formats/shiplist.md). They are not in this list.

The HUD locale key is `source.code`, for example `rules.noSuchSystem` ([`docs/ui/hud-spec.md`](../ui/hud-spec.md) §14d and §14e). Applied results stay off the log. Clamped and rejected results are warning lines. The HUD uses `status` for the gauge flash (warn for clamped, crit for rejected), not this severity.

Codes are flat camelCase and **add-only**. This file is the Combat-owned list. The Engine Lead copies it into [`docs/engine/diagnostics.md`](../engine/diagnostics.md) (that registry is not on `main` yet; this spec does not create it).

Canonical machine list: [`data/reason-codes.json`](data/reason-codes.json).

| Code | Status | Summary |
| --- | --- | --- |
| `ok` | applied | The command was applied as requested. |
| `noSuchShip` | rejected | The spawn key is not in the current sim. |
| `shipDestroyed` | rejected | The ship is already destroyed. |
| `notAShip` | rejected | The entity is a fighter. Duel entry points accept `class: "ship"` and `class: "pf"`. |
| `negativeValue` | rejected | A numeric input is negative. |
| `nonIntegerBoxes` | rejected | A box count is not an integer. |
| `precisionExceeded` | rejected | A fixed-point quantity is finer than the provisional milli-unit scale. |
| `badFacing` | rejected | A shield index is outside 0..5. |
| `noSuchSystem` | rejected | The system key is not present on this ship. |
| `unknownDraw` | rejected | The energy allocation names a draw the duel slice does not recognise. |
| `unknownWeaponSlot` | rejected | The `slotIndex` is not a mount on this ship. |
| `notInDuelSlice` | rejected | The weapon or mode is outside the Phase 2 duel. |
| `notCharged` | rejected | The mount has not finished charging or arming. |
| `noFireControl` | rejected | Fire control was not paid for the standing allocation. |
| `outOfArc` | rejected | The target bearing is outside the mount's mapped arc. |
| `outOfRange` | rejected | The target is beyond the weapon's last range band, or beyond `photonMaxRange`. |
| `weaponDestroyed` | rejected | The mount has no boxes left. |
| `turnModeUnverified` | rejected | The turn-mode letter has no playtest rate. Emitted once when the hull is spawned. Speed and yaw then use the documented fallback and are kept. |
| `crewDisabled` | rejected | Crew is below the minimum. Helm and fire are refused. |
| `overDraw` | clamped | Requested energy exceeded generation plus battery. Lower-priority draws were reduced. |
| `speedClamped` | clamped | Ordered speed was reduced to the acceleration limit. |
| `immobile` | clamped | The hull cannot move or yaw. Ordered speed or yaw was set to 0. |
| `shieldAboveMax` | clamped | `setShields` was above the facing maximum. |
| `shieldDepleted` | clamped | `damageShield` removed only the points remaining on that facing. |
| `repairCapped` | clamped | `repairSystem` stopped at the original box count. |
| `nothingToRepair` | clamped | `repairSystem` was asked to restore boxes and the system was already full. |
| `excessDamage` | clamped | Some requested internal points could not be placed. |
| `chargeCapped` | clamped | A weapon request was reduced to what the mount (and capacitor, when enabled) can store. |
| `reinforceCapped` | clamped | Shield reinforcement was reduced by the per-turn cap or by remaining shield room. |
| `yawClamped` | clamped | The heading change was reduced to the turn mode's per-tick yaw limit. |
| `ewMiss` | clamped | The shot was fired and missed because defender ECM beat attacker ECCM. |
| `noEw` | rejected | No sensor boxes, so ECM and ECCM cannot be bought. |
| `ewCapped` | clamped | The EW request was cut to the sensor boxes still fitted. |
| `noOverload` | rejected | The mount has no overload arming cost. |
| `noTractor` | rejected | The hull has no tractor boxes. |
| `badTarget` | rejected | A tractor cannot lock onto the ship projecting it. |
| `tractorBroken` | clamped | The bid lost the contest, or a live beam lost range or the contest. |
| `noCloak` | rejected | Cloak cost is empty. |
| `cloaked` | rejected | Weapons are locked for the whole cloak cycle. |
| `notDetected` | rejected | The target is cloaked and not currently detected. |
| `cloakCollapsed` | clamped | The battery missed a cloak payment, so the cloak dropped. |
| `tractorCapped` | clamped | The tractor bid was cut to the tractor boxes. |
| `bayEmpty` | rejected | Launch found no ready fighter or PF in that bay. |
| `badBay` | rejected | The bay index is outside 0..3, the bay kind is unknown, or the side is not 0 or 1. |
| `unknownCraft` | rejected | The fighter type or PF setup is not in the catalog, or the setup is not a PF. |
| `noMines` | rejected | `layMine` found no mine aboard. |
| `noParties` | rejected | The raid has no boarding party, or the commit is larger than the parties carried. |
| `sameSide` | rejected | The two ships share a side, or either side was never set. |
| `badRaid` | rejected | The raid mode is not hit-and-run or boarding. |
| `raidRepulsed` | rejected | The hit-and-run dice lost. No party was spent. |
| `boardingRepulsed` | rejected | The boarding dice lost. The committed parties stay spent. |
| `hetActive` | rejected | Provisional (TO VERIFY): a High-Energy Turn is already pending delay or executing. Refuses a second `orderHet`, `orderHeading`, and `orderHelm`. |
| `hetInvalidDir` | rejected | `orderHet` `dir` is not `-1` (port) or `+1` (starboard). |
