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
| `turnModeUnverified` | rejected | The turn-mode letter has no playtest rate, so speed and yaw orders are refused. |
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
