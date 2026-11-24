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

Hull keys are the CE skirmish identifiers already used by the in-battle harness: `F-CA`, `K-D7`, and `default` for unmeasured hulls.

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
   Delay is a per-hull constant in the current capture (the same `delayTicks` on every point of a hull). Lookup interpolates it with the same rule, which returns that constant; if later data varies it by speed, it interpolates like the rate.

A start-of-turn delay of `delayTicks` applies before the ship begins rotating on a new normal-turn order, in the same two-phase sense as a HET delay (count the delay down, then step heading). Exact interaction with an already-turning ship is **TO VERIFY**.

## 3. Measured hulls (CE in-battle capture, 2026-11-24)

| Hull key | Speed points | `turnRate16PerTick` (from measured °/s) | `delayTicks` | Status |
| --- | --- | --- | --- | --- |
| `F-CA` | `4, 7, 8, 10, 13, 14, 20, 25`, and `29.5` (`speedHundredths` `2950`) | `24, 39, 42, 47, 46, 46, 46, 48, 49` | `44` (range `39–48`) | **Measured**. The `13–14` band is a midpoint. The dip around `13–20` is real data and is kept. |
| `K-D7` | `7, 31` | `52` at both ends (flat midpoint of `7.5–9.7°/s`) | `44` placeholder | Rate band **measured** (medium confidence); **per-speed points and delay TO VERIFY**. |
| `default` | Same points as `F-CA` | Same rates as `F-CA` | `44` | Fallback **TO VERIFY**. The audit does not auto-score this hull. |

`F-CA` measured °/s, marked **measured**:

| Speed | °/s | `turnRate16PerTick` | Notes |
| --- | --- | --- | --- |
| `4` | `3.9` | `24` | measured |
| `7` | `6.4` | `39` | measured |
| `8` | `6.9` | `42` | measured |
| `10` | `7.8` | `47` | measured |
| `13` | `7.5` | `46` | midpoint of measured band `7.2–7.8` |
| `14` | `7.5` | `46` | same band |
| `20` | `7.6` | `46` | measured; part of the `13–20` dip |
| `25` | `7.9` | `48` | measured |
| `29.5` | `8.0` | `49` | measured; stored as `speedHundredths` `2950` |

The integer rates for `13`, `14`, and `20` all become `46` after nearest-integer conversion (`7.5` and `7.6` both round to `46`). Audit expect keeps the measured °/s values, so the dip remains visible to the scorer.

Worked interpolation (`F-CA`, integer rates): speed `9` sits between `8` (`42`) and `10` (`47`) and yields `45` units/tick; speed `6` between `4` and `7` yields `34`; speed `0` clamps to `24`; speed `40` clamps to `49`. Fixture: [`tests/turning.json`](tests/turning.json).

## 4. Audit field mapping (`tools/ship-audit`)

`tools/ship-audit/harness.ts` scores normal-turn runs using speed-keyed fields:

- `turn.normal.<speed>.degPerSecond` (from `mean_rate_deg_per_game_s_10_90`)
- `turn.normal.<speed>.delayS` (from `order_delay_s`)

[`data/turn-normal.json`](data/turn-normal.json) stores per-hull `audit.expect` and `audit.tolerances` maps with those exact field names. A run may still override with its own `expect` / `tolerances`. When the run omits them, the audit looks up the table by hull key (`F-CA` or `K-D7`, resolved from `run.hull`, `spawnKey`, or the class name after the last `:`). Intermediate speeds interpolate the expect °/s values with the same `interpInt` rule. The `default` fallback is not auto-scored.

`F-CA` expect uses the measured °/s figures, delay `1.45 s`, and tolerance `0.3` °/s / `0.15 s` (the delay window covers `1.3–1.6 s`; the `13–14` rate window covers `7.2–7.8`). `K-D7` expect is `8.6 ± 1.2` °/s at speeds `7` and `31` (the observed band), with no delay expect until that hull is measured.

## 5. How the sim uses the curve

`engine/sim/turn-curve.ts` reads [`data/turn-normal.json`](data/turn-normal.json) and [`data/het.json`](data/het.json) at load, checks every point (integers only, strictly rising speed keys, a `default` row, interpolation inside `rulesDiv`'s range), and looks a point up with the §2 rule. There are no floats on the sim path.

- **Which hull row.** The shiplist binder sets `ShipSetup.turnHull` to the class name (the part of `race:className` after the last colon). At spawn the sim stores the row id for that key in the opt-in `turnCurve` table. A key with no row uses `default`. Each file's `hullOrder` list fixes the row ids, so new hulls are appended there. Replacing a row's `speedPoints` (for example the Tier-2 `K-D7` points) is a data edit with no code change. The JSON files are not in `simSourceHash`.
- **Which speed.** The cruise override when one is set, else the ordered speed, as `speed × 100`.
- **Curve and letter cap.** The curve supplies the rate and the turn letter's cap stays an upper bound: the per-tick cap is `min(curve rate, letter cap)`. Today no CE letter has a measured cap, so the bound is the `2000` placeholder and the curve always wins. If `measured.json` ever gives a letter a cap, that cap bounds the curve. `H` stays immobile. A curve hull no longer turns at the fallback yaw, so spawn does not emit `turnModeUnverified` for it.
- **Who is on the curve.** Ships bound from a shiplist (every CE letter). Synthetic `TEST-*` setups with no `turnHull`, fighters, and any sim that does not register the `turnCurve` table keep the letter cap. The six replays do not register it, so their state hashes are unchanged.
- **Start delay.** A heading order to a hull that is not already turning starts a countdown of `delayTicks`. The order tick is the first delay tick, so with `44` the first heading step lands on the 45th tick. A new heading order while the ship is already turning keeps the current count and does not restart the delay. A manual yaw (`orderHelm`) is a one-tick nudge: it applies at once, capped by the curve rate, and clears any pending delay.
- **View.** `turnRateLimit16PerTick` in the view model reports the same capped rate. `turnTicksRemaining` includes delay ticks still to run.

Tests: `engine/sim/turn-curve.test.ts` (table checks, interpolation, clamping, default row, a data-only `K-D7` swap, agreement with `tools/turn-curve.mjs`, the [`tests/turning.json`](tests/turning.json) lookups, and determinism).

## 6. Pending playtest (TO VERIFY)

- `K-D7` per-speed points (only a `7.5–9.7°/s` band across speeds `7–31` is recorded) and `K-D7` delay.
- Normal-turn curves for every other hull; they currently use the `default` fallback.
- The exact delay in the `39–48` tick window (the table uses midpoint `44`).
- Whether the `13–14` band should be two distinct rates rather than a shared midpoint, and whether delay varies with speed.
- How a new heading or helm order interacts with an in-progress normal turn and with its start delay. The sim's choice (§5: no restart while turning, manual yaw skips the delay) is provisional.
- Whether manual yaw has a start delay in CE.
- Per-letter caps for `AA` and `A`–`G`, which would bound the curve once measured.
