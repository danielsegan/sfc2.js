# Normal turning

Status: **spec with CE 2.670 measurements (2026-11-24) and remaining TO VERIFY items.** Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Linked from [duel-slice.md](duel-slice.md) §4.

Clean-room. Mechanics are described in our own words. This is ordinary helm yaw, not a High-Energy Turn ([het.md](het.md)). Per-hull, speed-keyed integer table data and `tools/ship-audit` expectations live in [`data/turn-normal.json`](data/turn-normal.json). No rulebook table or raw capture row is copied here.

The engine consumes this table in `engine/sim/turn-curve.ts` (see §5). A hull whose setup names a turn hull turns at the curve rate; other hulls keep the per-letter cap in [`data/turn-modes.json`](data/turn-modes.json).

## 1. Units, rounding, and representation

Normal-turn rates, delays, and interpolations use the same units as [`docs/engine/sim-core.md`](../engine/sim-core.md), `engine/sim/heading.ts`, and [het.md](het.md) §1:

- **Angles and rates:** 16-bit angle units (`65536 = full turn`) as signed `i32`, **not** Q16.16. A rate is integer angle units per tick at `TICK_HZ = 30` Hz (`turnRate16PerTick`). Converted from `deg/s` by nearest-integer rounding:
  `round(degPerSec × 65536 / (360 × 30)) = round(degPerSec × 65536 / 10800)`.
  Worked rounding example: `8°/s → 8 × 65536 / 10800 = 48.545... → 49` integer angle units per tick.
- **Durations:** integer tick counts at `30` Hz (`round(seconds × 30)`). A measured delay of `1.3–1.6 s` is `39–48` ticks; the table's midpoint point is `44` ticks (`1.45 s`).
- **Speed keys:** sim table entries are integers. Whole speeds also store integer `speed`. The interpolation key is integer `speedHundredths` (`speed × 100`) so a measured half-speed point (captured at `29.5`) stays integer (`2950`) with no float in the table. When `speedHundredths` is omitted, lookup uses `speed × 100`.

## 2. Table shape and interpolation

[`data/turn-normal.json`](data/turn-normal.json) uses the same shape as [`data/het.json`](data/het.json): top-level `interpolation` and `rounding`, then `hulls.<key>.speedPoints` and optional `hulls.<key>.audit`. Each speed point has integer `delayTicks`, `turnRate16PerTick`, `speedHundredths`, and `speed` when the speed is a whole number. There is no `turnAngle16` column: a normal turn does not use a fixed HET sweep; the ordered yaw comes from helm or `orderHeading`.

Hull keys are the CE skirmish class keys (`classNameOf(spawnKey)`, the part after the last colon): the six Federation hulls (`F-CA`, `F-FF`, `F-DD`, `F-CL`, `F-CC`, `F-DN`), 40 measured Klingon, Romulan, Lyran, Hydran, Gorn, ISC, and Mirak hulls (`L-FF` and `H-LN` have no usable Tier-2 normal points and remain on `default`; Orion is parked because it is unreachable in the skirmish empire picker), and `default` for unmeasured hulls.

At lookup time for speed `s`, let `q = round(s × 100)` (or an already-integer `speedHundredths`):

1. **Clamping outside table range:** if `q <= speedPoints[0].speedHundredths`, use `speedPoints[0]`; if `q >= speedPoints[last].speedHundredths`, use `speedPoints[last]`.
2. **Linear interpolation in fixed-point integer math (no floats):** if `q` falls strictly between adjacent entries `(q0, y0)` and `(q1, y1)` (`dx = q1 - q0 > 0`, `t = q - q0`, `dy = y1 - y0`), interpolate `turnRate16PerTick` with the same `rulesDiv` / `interpInt` rounding as [het.md](het.md) §4:
   ```
   num = dy * t
   half = dx >> 1
   y = num >= 0
     ? y0 + rulesDiv(num + half, dx)
     : y0 - rulesDiv(-num + half, dx)
   ```
   Lookup interpolates `delayTicks` alongside `turnRate16PerTick` using the same rule (constant `44` on Federation hulls and `default`; per-speed `round(order_delay_s × 30)` on Tier-2 non-Federation hulls).

A start-of-turn delay of `delayTicks` applies before the ship begins rotating on a new normal-turn order, in the same two-phase sense as a HET delay (count the delay down, then step heading). Exact interaction with an already-turning ship is **TO VERIFY**.

## 3. Measured hulls (CE in-battle capture, 2026-11-24)

| Hull key | Speed points | `turnRate16PerTick` (from measured °/s) | `delayTicks` | Status |
| --- | --- | --- | --- | --- |
| `F-CA` | `4, 5, 7, 8, 10, 13, 14, 20, 25`, and `29.5` (`speedHundredths` `2950`) | `24, 29, 39, 42, 47, 46, 46, 46, 48, 49` | `44` (range `39–48`) | **Measured**. Tier-1 game-clock curve reconciled with Tier-2 speed `5` (`4.70°/s → 29`). The `13–14` band is a midpoint; the `13–20` dip is real data and is kept. |
| `F-FF` | `5, 10, 15, 20` | `31, 57, 60, 60` (`5.11, 9.39, 9.89, 9.89°/s`) | `33` (1.1 s) [H] | Checkpoint 1. Speeds outside 5–20 clamp to the endpoints. |
| `F-DD` | `5, 10, 20` | `33, 50, 52` (`5.44, 8.16, 8.51°/s`) | `44` (**TO VERIFY**) | Tier-2 rates **measured** at `5, 10, 20`; speeds `<5` / `>20` clamp to endpoints (**TO VERIFY**); delay reuses `F-CA` (**TO VERIFY**). |
| `F-CL` | `5, 10, 20` | `32, 51, 58` (`5.35, 8.36, 9.51°/s`) | `44` (**TO VERIFY**) | Tier-2 rates **measured** at `5, 10, 20`; speeds `<5` / `>20` clamp to endpoints (**TO VERIFY**); delay reuses `F-CA` (**TO VERIFY**). |
| `F-CC` | `5, 10, 20` | `28, 44, 48` (`4.65, 7.24, 7.92°/s`) | `44` (**TO VERIFY**) | Tier-2 rates **measured** at `5, 10, 20`; speeds `<5` / `>20` clamp to endpoints (**TO VERIFY**); delay reuses `F-CA` (**TO VERIFY**). |
| `F-DN` | `5, 10, 16, 20` | `26, 38, 42, 45` (`4.28, 6.26, 6.92, 7.42°/s`) | `36` (1.2 s) [H] | Checkpoint 1. Speeds outside 5–20 clamp to the endpoints. |
| `K-D7` | `5, 10, 20` | `32, 61, 57` (`5.34, 10.1, 9.44°/s`) | `69, 27, 54` | Tier-2 measured; wall-clock at 5, 20 (**TO VERIFY** game-clock). |
| `K-E4` | `5, 20` | `29, 65` (`4.76, 10.74°/s`) | `141, 15` | Tier-2 measured; omitted (speed 10: null, null). |
| `K-F5` | `5, 10, 20` | `34, 70, 59` (`5.63, 11.47, 9.7°/s`) | `108, 24, 21` | Tier-2 measured; wall-clock at 10 (**TO VERIFY** game-clock). |
| `K-D5` | `5, 10, 20` | `33, 60, 52` (`5.36, 9.87, 8.5°/s`) | `75, 36, 37` | Tier-2 measured; wall-clock at 10, 20 (**TO VERIFY** game-clock). |
| `K-C7` | `5, 10, 20` | `29, 54, 52` (`4.82, 8.83, 8.54°/s`) | `63, 31, 53` | Tier-2 measured; wall-clock at 10, 20 (**TO VERIFY** game-clock). |
| `K-C8` | `5, 10, 20` | `22, 69, 47` (`3.65, 11.38, 7.73°/s`) | `88, 35, 35` | Tier-2 measured; wall-clock at 20 (**TO VERIFY** game-clock). |
| `R-SNA` | `5, 10, 20` | `47, 44, 46` (`7.67, 7.32, 7.66°/s`) | `81, 31, 36` | Tier-2 measured. |
| `R-BH` | `10, 20` | `56, 59` (`9.28, 9.69°/s`) | `34, 54` | Tier-2 measured; omitted (speed 5: null, null). |
| `R-SPA` | `5, 10, 20` | `54, 58, 58` (`8.88, 9.55, 9.5°/s`) | `73, 37, 38` | Tier-2 measured; wall-clock at 20 (**TO VERIFY** game-clock). |
| `R-KR` | `5` | `54` (`8.82°/s`) | `68` | Tier-2 measured; omitted (speed 10: null, null (already_facing); speed 20: null, null (already_facing)). |
| `R-KRC` | `5, 10, 20` | `54, 73, 63` (`8.84, 12.07, 10.33°/s`) | `64, 66, 71` | Tier-2 measured. |
| `R-CON` | `5, 10, 20` | `36, 57, 45` (`5.87, 9.34, 7.34°/s`) | `66, 43, 13` | Tier-2 measured. |
| `L-DD` | `5, 10, 20` | `33, 46, 60` (`5.47, 7.5, 9.9°/s`) | `74, 62, 46` | Tier-2 measured. |
| `L-CW` | `5, 20` | `32, 49` (`5.2, 8.0°/s`) | `62, 94` | Tier-2 measured; omitted (speed 10: null, null (already_facing)). |
| `L-CA` | `5, 10, 20` | `29, 50, 45` (`4.85, 8.18, 7.44°/s`) | `70, 41, 38` | Tier-2 measured. |
| `L-CC` | `5, 10, 20` | `30, 49, 51` (`4.93, 8.02, 8.33°/s`) | `68, 37, 32` | Tier-2 measured. |
| `L-DN` | `5, 10, 20` | `21, 8, 47` (`3.54, 1.27, 7.67°/s`) | `92, 89, 31` | Tier-2 measured. |
| `H-HN` | `10, 20` | `35, 59` (`5.85, 9.74°/s`) | `13, 15` | Tier-2 measured; omitted (speed 5: null, null (already_facing)). |
| `H-HR` | `5, 20` | `15, 42` (`2.39, 6.91°/s`) | `198, 29` | Tier-2 measured; omitted (speed 10: null, null (already_facing)). |
| `H-RN` | `5, 20` | `11, 55` (`1.81, 9.06°/s`) | `99, 38` | Tier-2 measured; omitted (speed 10: null, null (already_facing)). |
| `H-DG` | `5, 20` | `11, 49` (`1.8, 8.03°/s`) | `109, 38` | Tier-2 measured; omitted (speed 10: null, null (already_facing)). |
| `H-PAL` | `5, 20` | `11, 49` (`1.88, 8.07°/s`) | `89, 50` | Tier-2 measured; omitted (speed 10: null, null (already_facing)). |
| `G-FF` | `10, 20` | `83, 57` (`13.72, 9.37°/s`) | `105, 40` | Tier-2 measured; wall-clock at 20 (**TO VERIFY** game-clock); omitted (speed 5: suspect ~7 s delay and wall-clock rate (14.43w deg/s, 7.3 s)). |
| `G-DD` | `10, 20` | `52, 63` (`8.54, 10.36°/s`) | `48, 49` | Tier-2 measured; wall-clock at 10, 20 (**TO VERIFY** game-clock); omitted (speed 5: suspect ~7 s delay and wall-clock rate (10.92w deg/s, 7.28 s)). |
| `G-CL` | `5, 20` | `23, 50` (`3.77, 8.17°/s`) | `57, 65` | Tier-2 measured; wall-clock at 5, 20 (**TO VERIFY** game-clock); omitted (speed 10: null, null (already_facing)). |
| `G-CA` | `5, 20` | `22, 56` (`3.63, 9.27°/s`) | `51, 76` | Tier-2 measured; wall-clock at 5, 20 (**TO VERIFY** game-clock); omitted (speed 10: null, null (already_facing)). |
| `G-CC` | `5, 10, 20` | `28, 46, 44` (`4.58, 7.63, 7.24°/s`) | `68, 47, 15` | Tier-2 measured; wall-clock at 5, 10, 20 (**TO VERIFY** game-clock). |
| `G-DN` | `5, 10, 20` | `26, 45, 44` (`4.32, 7.38, 7.23°/s`) | `67, 47, 36` | Tier-2 measured; wall-clock at 5, 10, 20 (**TO VERIFY** game-clock). |
| `I-FF` | `5, 10` | `33, 92` (`5.37, 15.15°/s`) | `92, 74` | Tier-2 measured; omitted (speed 20: null, null (already_facing)). |
| `I-DD` | `5, 10` | `32, 56` (`5.25, 9.27°/s`) | `81, 26` | Tier-2 measured; omitted (speed 20: null, null (already_facing)). |
| `I-CL` | `5, 10, 20` | `30, 50, 18` (`5.0, 8.18, 3.02°/s`) | `71, 32, 357` | Tier-2 measured. |
| `I-CA` | `5, 10, 20` | `42, 45, 9` (`6.91, 7.39, 1.46°/s`) | `70, 49, 88` | Tier-2 measured. |
| `I-CC` | `5, 10, 20` | `26, 47, 49` (`4.23, 7.8, 8.01°/s`) | `70, 50, 39` | Tier-2 measured. |
| `I-DN` | `5, 10, 20` | `23, 43, 40` (`3.87, 7.16, 6.57°/s`) | `70, 42, 36` | Tier-2 measured. |
| `Z-FF` | `5, 10, 20` | `41, 94, 113` (`6.81, 15.5, 18.69°/s`) | `108, 52, 53` | Tier-2 measured; wall-clock at 5, 10, 20 (**TO VERIFY** game-clock). |
| `Z-DD` | `5` | `87` (`14.3°/s`) | `139` | Tier-2 measured; omitted (speed 10: bad wall-clock read (234.48w deg/s); speed 20: null, null (already_facing)). |
| `Z-CL` | `5` | `35` (`5.77°/s`) | `88` | Tier-2 measured; omitted (speed 10: bad wall-clock read (193.37w deg/s, 9.35 s delay); speed 20: null, null (already_facing)). |
| `Z-CA` | `5, 10, 20` | `31, 51, 50` (`5.16, 8.35, 8.18°/s`) | `83, 45, 43` | Tier-2 measured; wall-clock at 20 (**TO VERIFY** game-clock). |
| `Z-BC` | `5` | `32` (`5.23°/s`) | `80` | Tier-2 measured; omitted (speed 10: null, null (already_facing); speed 20: null, null (already_facing)). |
| `Z-DN` | `5` | `24` (`4.0°/s`) | `99` | Tier-2 measured; omitted (speed 10: null, null (already_facing); speed 20: null, null (already_facing)). |
| `L-FF`, `H-LN` | — | Uses `default` | Uses `default` | No usable Tier-2 normal points (`L-FF`: `n5`/`n10` `already_facing`, `n20` suspect; `H-LN`: all `already_facing`); stays on `default` (**TO VERIFY**). |
| Orion (`O-*`) | — | — | — | **Parked:** unreachable in the skirmish empire picker (**TO VERIFY**). |
| `default` | Same points as Tier-1 `F-CA` | Same rates as Tier-1 `F-CA` | `44` | Fallback **TO VERIFY**. The audit does not auto-score this hull. |

`F-CA` measured °/s, marked **measured**:

| Speed | °/s | `turnRate16PerTick` | Notes |
| --- | --- | --- | --- |
| `4` | `3.9` | `24` | measured (Tier 1) |
| `5` | `4.7` | `29` | measured (Tier 2 `4.70°/s`; matches Tier-1 interpolation `4.73°/s`) |
| `7` | `6.4` | `39` | measured |
| `8` | `6.9` | `42` | measured |
| `10` | `7.8` | `47` | measured |
| `13` | `7.5` | `46` | midpoint of measured band `7.2–7.8` |
| `14` | `7.5` | `46` | same band |
| `20` | `7.6` | `46` | measured; part of the `13–20` dip |
| `25` | `7.9` | `48` | measured |
| `29.5` | `8.0` | `49` | measured; stored as `speedHundredths` `2950` |

The integer rates for `13`, `14`, and `20` all become `46` after nearest-integer conversion (`7.5` and `7.6` both round to `46`). Audit expect keeps the measured °/s values, so the dip remains visible to the scorer. On `F-CA`, Tier-2 single-run 10–90% captures gave `4.70` @ `5`, `7.41` @ `10`, and `8.20` @ `20`: speed `5` agrees within `0.03°/s`, while `10` (`-0.39°/s`) and `20` (`+0.60°/s`) sit outside the `±0.3°/s` Tier-1 tolerance and are kept **TO VERIFY** rather than overwriting the denser multi-run, game-clock-normalized Tier-1 points.

Worked interpolation (`F-CA`, integer rates): speed `9` sits between `8` (`42`) and `10` (`47`) and yields `45` units/tick; speed `6` between `4` and `7` yields `34`; speed `0` clamps to `24`; speed `40` clamps to `49`. Fixture: [`tests/turning.json`](tests/turning.json).

## 4. Audit field mapping (`tools/ship-audit`)

`tools/ship-audit/harness.ts` scores normal-turn runs using speed-keyed fields:

- `turn.normal.<speed>.degPerSecond` (from `mean_rate_deg_per_game_s_10_90`)
- `turn.normal.<speed>.delayS` (from `order_delay_s`)

[`data/turn-normal.json`](data/turn-normal.json) stores per-hull `audit.expect` and `audit.tolerances` maps with those exact field names. A run may still override with its own `expect` / `tolerances`. When the run omits them, the audit looks up the table by hull key (resolved from `run.hull`, `spawnKey`, or the class name after the last `:`). Intermediate speeds interpolate the expect °/s values with the same `interpInt` rule. The `default` fallback is not auto-scored.

`F-CA` expect uses the measured °/s figures, delay `1.45 s`, and tolerance `0.3` °/s / `0.15 s` (the delay window covers `1.3–1.6 s`; the `13–14` rate window covers `7.2–7.8`). `F-FF`, `F-DD`, `F-CL`, `F-CC`, and `F-DN` expect the Tier-2 10–90% °/s values at speeds `5, 10, 20` with tolerance `0.5` °/s and no `delayS` expect until per-hull delays are measured. `K-D7` and the 39 other measured non-Federation hulls expect their Tier-2 10–90% `degPerSecond` values at each usable measured speed with tolerance `0.5` °/s and no `delayS` expect until multi-run normal delays are verified.

## 5. How the sim uses the curve

`engine/sim/turn-curve.ts` reads [`data/turn-normal.json`](data/turn-normal.json) and [`data/het.json`](data/het.json) at load, checks every point (integers only, strictly rising speed keys, a `default` row, interpolation inside `rulesDiv`'s range), and looks a point up with the §2 rule. There are no floats on the sim path.

- **Which hull row.** The shiplist binder sets `ShipSetup.turnHull` from the class name (the part of `race:className` after the last colon). A name in the table, in any letter case, keeps that row's key. Any other name is stored as `default`, so the curve stays on. At spawn the sim stores the row id for that key in the opt-in `turnCurve` table. Each file's `hullOrder` list fixes the row ids, so new hulls are appended there. Replacing a row's `speedPoints` (for example the Tier-2 `K-D7` points) is a data edit with no code change. The JSON files are not in `simSourceHash`. Romulan, Lyran, Hydran, Gorn, and ISC HET rates were refreshed from the 90-pad rerun (see [het.md](het.md) §4); that swap does not re-stamp the hash.
- **Which speed.** The cruise override when one is set. Otherwise the actual speed, when this hull has one, else the ordered speed. The lookup key is that speed in hundredths.
- **Curve and letter cap.** The curve supplies the rate. A measured letter cap, and the test-only `TEST-*` rows, stay an upper bound: the per-tick cap is the lower of the curve rate and that cap. The shared fallback is not a letter cap. It is the `default` curve's rate at speed 15 (46 units per tick) and it applies only when the hull has no curve, so it does not pull a faster hull down. If `measured.json` gives a letter its own cap, that cap bounds the curve. `H` stays immobile. A curve hull no longer turns at the fallback yaw, so spawn does not emit `turnModeUnverified` for it.
- **Who is on the curve.** Ships bound from a shiplist. The class code is the curve key when `turn-normal.json` has that key (letter case does not matter); any other code is stored as `default`, which still enables the curve. The no-files cruiser uses `F-CA` and the no-files D7 uses `K-D7`. That same key also selects the actual-speed ramp in [`data/accel.json`](data/accel.json) when the hull is listed there. `default` is not listed, so an unknown class turns on the default curve and still uses the per-order acceleration clamp. Synthetic `TEST-*` setups with no `turnHull`, fighters, and any sim that does not register the `turnCurve` table keep the letter cap. The six replays do not register the table, so their tick timelines stay put. Editing a sim source still restamps the file header.
- **Start delay.** A heading order to a hull that is not already turning starts a countdown of `delayTicks`. The order tick is the first delay tick, so with `44` the first heading step lands on the 45th tick. A new heading order while the ship is already turning keeps the current count and does not restart the delay. A manual yaw (`orderHelm`) is a one-tick nudge: it applies at once, capped by the curve rate, and clears any pending delay.
- **View.** `turnRateLimit16PerTick` in the view model reports the same capped rate. `turnTicksRemaining` includes delay ticks still to run.

Tests: `engine/sim/turn-curve.test.ts` (table checks, interpolation, clamping, default row, a data-only `K-D7` swap, agreement with `tools/turn-curve.mjs`, the [`tests/turning.json`](tests/turning.json) lookups, and determinism).

## 6. Pending playtest (TO VERIFY)

- Normal-turn curves below speed `5` and above speed `20` for `F-FF`, `F-DD`, `F-CL`, `F-CC`, `F-DN`, and the 40 Tier-2 non-Federation hulls (currently clamped to the endpoints), plus multi-run `delayTicks` confirmation for those hulls (`F-FF..F-DN` currently reuse `F-CA`'s `44` ticks; non-Federation hulls use single-run `round(order_delay_s × 30)`).
- `F-CA` Tier-2 single-run vs Tier-1 game-clock spread at speeds `10` (`7.41` vs `7.8°/s`) and `20` (`8.20` vs `7.6°/s`).
- Missing or omitted non-Federation normal cells (left out so the curve interpolates/clamps from remaining speeds, or falls back to `default`):
  - Suspect cells omitted: `Z-DD` n10 (`234.48w°/s`, bad wall read), `Z-CL` n10 (`193.37w°/s`, `9.35 s`, bad wall read), `L-FF` n20 (`29.08°/s`), `G-FF` n5 (`14.43w°/s`, `7.3 s` delay), `G-DD` n5 (`10.92w°/s`, `7.28 s` delay).
  - `already_facing` / null no-ops omitted: `K-E4` n10; `R-BH` n5; `R-KR` n10/n20; `L-FF` n5/n10 (leaves `L-FF` on `default`); `L-CW` n10; `H-HN` n5; `H-LN` n5/n10/n20 (leaves `H-LN` on `default`); `H-HR` n10; `H-RN` n10; `H-DG` n10; `H-PAL` n10; `G-CL` n10; `G-CA` n10; `I-FF` n20; `I-DD` n20; `Z-DD` n20; `Z-CL` n20; `Z-BC` n10/n20; `Z-DN` n10/n20.
  - Game-clock rate confirmation for wall-clock-fallback cells (`w` suffix in Tier-2 aggregates) and per-speed `delayTicks` outliers (e.g., `I-CL` n20 `11.9 s` / `3.02°/s`, `I-CA` n20 `2.93 s` / `1.46°/s`, `L-DN` n10 `1.27°/s`, `H-HR` n5 `6.6 s` / `2.39°/s`, `Z-DD` n5 `4.62 s` / `14.3°/s`, `K-E4` n5 `4.7 s`).
- **Orion hulls:** parked because Orion cannot be reached in the skirmish empire picker.
- The exact delay in the `39–48` tick window (the table uses midpoint `44`).
- Whether the `13–14` band should be two distinct rates rather than a shared midpoint, and whether delay varies with speed.
- How a new heading or helm order interacts with an in-progress normal turn and with its start delay. The sim's choice (§5: no restart while turning, manual yaw skips the delay) is provisional.
- Whether manual yaw has a start delay in CE.
- Per-letter caps for `AA` and `A`–`G`, which would bound the curve once measured.
