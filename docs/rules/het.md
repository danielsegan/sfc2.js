# High-Energy Turn (HET)

Status: **spec with CE 2.670 measurements (2026-11-24) and provisional TO VERIFY items.** Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Linked from [duel-slice.md](duel-slice.md) §4.

Clean-room. Mechanics are described in our own words. Per-hull, speed-keyed integer table data and `tools/ship-audit` expectations live in [`data/het.json`](data/het.json). No rulebook table or raw capture row is copied here.

## 1. Units, rounding, and representation

All HET angles, durations, and rates follow [`docs/engine/sim-core.md`](../engine/sim-core.md) and `engine/sim/heading.ts`:

- **Angles:** 16-bit angle units (`65536 = full turn`), stored and transmitted as **signed `i32`**, **not** Q16.16. Positive deltas turn clockwise (starboard); negative deltas turn counter-clockwise (port). Ship heading wraps mod `65536` (`[0, 65535]`). Degree measurements convert to integers by nearest-integer rounding:
  `round(deg × 65536 / 360)` (e.g., `90° = 16384`; `82° ≈ 14928`; `83° ≈ 15110`; `84° ≈ 15292`).
- **Durations:** integer tick counts at `TICK_HZ = 30` Hz (`round(seconds × 30)`).
- **Rates:** integer angle units per tick (`turnRate16PerTick`), converted from `deg/s` at `30` Hz by nearest-integer rounding (`round(degPerSec × 65536 / (360 × 30)) = round(degPerSec × 65536 / 10800)`).
  Worked rounding example: `8°/s → 8 × 65536 / 10800 = 48.545... → 49` integer angle units per tick.
  For `F-CA` (`43–51°/s`): `43°/s → 261`, midpoint `47°/s → 285` (≈`46.97°/s`), `51°/s → 309` units/tick.

## 2. Sim verb and trigger

HET uses its **own sim verb**, separate from `orderHeading` (verb `12` in `engine/sim/heading.ts`) and `orderHelm` (verb `6`):

- **Verb:** `orderHet`, `VERB_ORDER_HET = 13` in `engine/sim/heading.ts`, next to `VERB_ORDER_HEADING`. The handler and the per-tick system are in `engine/sim/het.ts`. The duel and skirmish match registers them, with `DuelMatch.orderHet(dir)`. A sim that does not register `HET_TABLE` (the replay corpus) has no HET.
- **Payload:** a single shape `{ entity: i32, dir: i32 }`. `dir` is `-1` (port / left) or `+1` (starboard / right). Any other value is rejected with `hetInvalidDir`. Sweep, rate, and delay come from [`data/het.json`](data/het.json) by hull and speed. There is no `delta16` override in the payload.
- **UI trigger:** the helm panel's 3×3 arrow buttons ([`docs/ui/hud-layout.md`](../ui/hud-layout.md) §5). Left/right helm arrow buttons issue `orderHet` with `dir = ∓1`. The signed sweep is `dir × turnAngle16` from the table (e.g., `∓16384` for `F-CA`). Exact button set and `Go` behavior are **TO VERIFY**.

## 3. Acceptance checks and no speed cutoff

When `orderHet({ entity, dir })` arrives in the input phase:

1. Reject if the entity is missing (`noSuchShip`), a fighter (`notAShip`), destroyed (`shipDestroyed`), or crew-disabled (`crewDisabled`).
2. Reject if `dir` is not `-1` or `+1` (`hetInvalidDir`).
3. Clamp/refuse if the ship's turn mode is immobile `H` (`immobile`).
4. Reject if an HET is already pending or executing (`hetActive`, **provisional / TO VERIFY**; whether a second press cancels or is ignored is **TO VERIFY**).
5. **No speed cutoff:** CE in-battle capture (2026-11-24) confirmed HET works at speeds `15`, `20`, and `31` as well as lower speeds (`5`, `10`). The earlier "no HET at speed 15+" observation was wrong and has been removed; there is no speed-cutoff rejection.
6. Look up sweep (`turnAngle16`), rate (`turnRate16PerTick`), and delay (`delayTicks`) from [`data/het.json`](data/het.json) by hull and current speed (clamp or interpolate as in §4). The signed remaining turn is `dir × turnAngle16`. The command cannot override those table values.

Accepted `orderHet` supersedes any active `orderHeading` for that ship (the heading order is cleared and any normal-turn start delay is dropped). Whether `orderHeading` or manual `orderHelm` can cancel an active HET during its delay or turn phase is **TO VERIFY**. The sim's provisional choice: both are refused with `hetActive` until the HET finishes, and so is a second `orderHet`.

The sim's answer is event kind `20` (`EVENT_HET`): `a` is the code (`0` ordered, `2` immobile, `4` crew disabled, `5` no such ship, `6` not a ship, `7` destroyed, `8` `hetInvalidDir`, `9` `hetActive`, `10` finished), `b` is the signed sweep on an accepted order and the heading reached on finish. Heading and helm refusals during a HET use their own events with code `8` (`hetActive`).

**Hull row.** The sweep, rate, and delay come from the hull's `turnCurve` row ([turning.md](turning.md) §5). A ship with no turn hull, including the synthetic duel ships, uses the `default` HET row. The speed key is the cruise override when set, else the ordered speed. Values are locked when the order is accepted.

## 4. Per-hull speed-keyed integer table and interpolation

[`data/het.json`](data/het.json) stores **integer-only** speed points per hull key (`hulls.<key>.speedPoints`): each entry has integer `speed`, `delayTicks`, `turnAngle16`, and `turnRate16PerTick` (no floats in sim table data).

At lookup time for integer ship speed `s`:

1. **Clamping outside table range:** if `s <= speedPoints[0].speed`, use `speedPoints[0]`; if `s >= speedPoints[last].speed`, use `speedPoints[last]`.
2. **Linear interpolation in fixed-point integer math (no floats):** if `s` falls strictly between adjacent entries `(s0, y0)` and `(s1, y1)` (`dx = s1 - s0 > 0`, `t = s - s0`, `dy = y1 - y0`), interpolate each table field `y` using `rulesDiv` (integer floor division, symmetric nearest-integer rounding):
   ```
   num = dy * t
   half = dx >> 1
   y = num >= 0
     ? y0 + rulesDiv(num + half, dx)
     : y0 - rulesDiv(-num + half, dx)
   ```

Current CE 2.670 summary (`CE in-battle audit`, Wintermute, 2026-11-24):

| Hull key | Speeds | `delayTicks` | `turnAngle16` (16-bit) | `turnRate16PerTick` (30 Hz) | Status |
| --- | --- | --- | --- | --- | --- |
| `F-CA` | `5, 10, 15, 20, 31` | `171` (≈`5.7 s`) | `16384` (≈`90°`) | `283, 285, 251, 285, 291` (`46.7, 47, 41.4, 47, 48.0°/s`) | Tier-2 rates **measured** at `5, 15, 31`; `20` keeps `285` (Tier-1 `47.69°/s`); `10` and speed-15 Tier-1/Tier-2 spread **TO VERIFY** |
| `F-CL` | `5, 15` (clamped outside) | `171` | `16384` | `313, 296` (`51.5, 48.7°/s`) | Tier-2 rates **measured** at `5, 15`; speed `31` and per-hull sweep/delay **TO VERIFY** |
| `F-CC` | `5` (clamped) | `171` | `16384` | `283` (`46.6°/s`) | Tier-2 rate **measured** at `5`; speeds `15, 31` and per-hull sweep/delay **TO VERIFY** |
| `F-DN` | `5` (clamped) | `171` | `16384` | `253` (`41.7°/s`) | Tier-2 rate **measured** at `5`; speeds `15, 31` and per-hull sweep/delay **TO VERIFY** |
| `F-DD` | `31` (clamped) | `171` | `16384` | `335` (`55.2°/s`) | Tier-2 rate **measured** at `31`; speeds `5, 15` and per-hull sweep/delay **TO VERIFY** |
| `K-D7` | `5, 15, 31` | `171, 171, 171` | `15110, 17895, 17713` (`83, 98.3, 97.3°`) | `278, 374, 325` (`45.77, 61.57, 53.62°/s`) | Tier-2 measured; wall-clock at 5, 15. |
| `K-E4` | `5, 15, 31` | `171, 171, 171` | `13435, 19260, 18277` (`73.8, 105.8, 100.4°`) | `249, 268, 418` (`41.05, 44.12, 68.92°/s`) | Tier-2 measured; wall-clock at 5. |
| `K-F5` | `5, 31` | `171, 171` | `13380, 19042` (`73.5, 104.6°`) | `327, 559` (`53.85, 92.07°/s`) | Tier-2 measured; wall-clock at 5, 31; omitted (speed 15: null, -134.0, null (het_not_executed)). |
| `K-D5` | `5, 15, 31` | `171, 171, 171` | `14946, 17968, 16384` (`82.1, 98.7, 90°`) | `309, 374, 348` (`50.98, 61.57, 57.38°/s`) | Tier-2 measured; wall-clock at 5, 15. |
| `K-C7` | `5, 15, 31` | `171, 171, 171` | `14964, 17804, 17604` (`82.2, 97.8, 96.7°`) | `290, 364, 286` (`47.76, 59.91, 47.1°/s`) | Tier-2 measured; wall-clock at 5, 15, 31. |
| `K-C8` | `5, 15` | `171, 171` | `15037, 17895` (`82.6, 98.3°`) | `247, 330` (`40.63, 54.44°/s`) | Tier-2 measured; wall-clock at 5, 15; omitted (speed 31: null, -0.7, null (het_not_executed)). |
| `R-SNA` | `5, 15, 31` | `171, 171, 171` | `26142, 23393, 24995` (`143.6, 128.5, 137.3°`) | `272, 275, 315` (`44.89, 45.35, 51.99°/s`) | Tier-2 measured; wall-clock at 5, 15. |
| `R-BH` | `5, 15, 31` | `171, 171, 171` | `22847, 28381, 20462` (`125.5, 155.9, 112.4°`) | `280, 332, 231` (`46.07, 54.73, 38.05°/s`) | Tier-2 measured; wall-clock at 5, 15. |
| `R-SPA` | `5, 15` | `171, 171` | `16384, 16384` (`90, 90°`) | `330, 385` (`54.35, 63.49°/s`) | Tier-2 measured; omitted (speed 31: null, 0.8, null (het_not_executed)). |
| `R-KRC` | `5, 15` | `171, 171` | `23593, 26906` (`129.6, 147.8°`) | `327, 386` (`53.96, 63.56°/s`) | Tier-2 measured; omitted (speed 31: null, -0.8, null (het_not_executed)). |
| `R-CON` | `5` | `171` | `22555` (`123.9°`) | `285` (`46.95°/s`) | Tier-2 measured; omitted (speed 15: null, 0.1, null (het_not_executed); speed 31: null, null, null (skip:damaged)). |
| `L-FF` | `15, 31` | `171, 171` | `24576, 24576` (`135, 135°`) | `374, 313` (`61.64, 51.58°/s`) | Tier-2 measured; omitted (speed 5: null, -8.5, null (het_not_executed)). |
| `L-DD` | `5, 15, 31` | `171, 171, 171` | `23320, 23611, 24394` (`128.1, 129.7, 134.0°`) | `337, 282, 337` (`55.51, 46.43, 55.48°/s`) | Tier-2 measured. |
| `L-CW` | `15` | `171` | `24576` (`135°`) | `317` (`52.25°/s`) | Tier-2 measured; omitted (speed 5: suspect partial sweep (-48.1 deg, 18.96 deg/s); speed 31: suspect partial/reverse sweep (45.9 deg, 10.7 deg/s)). |
| `L-CA` | `5, 15, 31` | `171, 185, 186` | `24358, 16384, 23484` (`133.8, 90, 129.0°`) | `318, 226, 308` (`52.38, 37.31, 50.8°/s`) | Tier-2 measured; wall-clock at 5. |
| `L-CC` | `5, 15, 31` | `171, 171, 171` | `24576, 24576, 24576` (`135, 135, 135°`) | `318, 316, 290` (`52.36, 52.02, 47.72°/s`) | Tier-2 measured; wall-clock at 31. |
| `L-DN` | `5, 15, 31` | `171, 171, 171` | `24576, 24576, 24576` (`135, 135, 135°`) | `230, 290, 267` (`37.9, 47.79, 44.05°/s`) | Tier-2 measured. |
| `H-HN` | `5, 31` | `171, 171` | `16384, 16384` (`90, 90°`) | `331, 414` (`54.57, 68.3°/s`) | Tier-2 measured; omitted (speed 15: null, 18.9, null (het_not_executed)). |
| `H-LN` | `15` | `171` | `8392` (`46.1°`) | `264` (`43.44°/s`) | Tier-2 measured; omitted (speed 5: null, -30.1, null (het_not_executed); speed 31: null, -52.7, null (het_not_executed)). |
| `H-HR` | `15, 31` | `171, 171` | `24722, 26797` (`135.8, 147.2°`) | `263, 274` (`43.26, 45.12°/s`) | Tier-2 measured; wall-clock at 31; omitted (speed 5: null, -128.1, null (het_not_executed)). |
| `H-RN` | `5, 15, 31` | `171, 171, 171` | `25268, 18714, 24121` (`138.8, 102.8, 132.5°`) | `313, 304, 312` (`51.55, 50.03, 51.42°/s`) | Tier-2 measured. |
| `H-DG` | `5` | `181` | `26178` (`143.8°`) | `347` (`57.14°/s`) | Tier-2 measured; omitted (speed 15: null, -15.7, null (het_not_executed); speed 31: null, 2.2, null (het_not_executed)). |
| `H-PAL` | `5` | `171` | `24576` (`135°`) | `271` (`44.69°/s`) | Tier-2 measured; omitted (speed 15: null, 0.0, null (het_not_executed); speed 31: null, null, null (skip:damaged)). |
| `G-CL` | `5, 15` | `181, 171` | `24576, 24576` (`135, 135°`) | `285, 256` (`46.99, 42.17°/s`) | Tier-2 measured; wall-clock at 5, 15; omitted (speed 31: null, 0.1, null (het_not_executed)). |
| `G-CA` | `5, 15, 31` | `171, 171, 171` | `24576, 24576, 24576` (`135, 135, 135°`) | `282, 286, 247` (`46.53, 47.07, 40.74°/s`) | Tier-2 measured; wall-clock at 5, 15, 31. |
| `G-CC` | `5, 15, 31` | `195, 171, 171` | `24576, 24576, 24576` (`135, 135, 135°`) | `380, 256, 253` (`62.61, 42.23, 41.67°/s`) | Tier-2 measured; wall-clock at 5, 15, 31. |
| `I-FF` | `5, 15, 31` | `171, 171, 171` | `22610, 26233, 20280` (`124.2, 144.1, 111.4°`) | `282, 438, 323` (`46.42, 72.18, 53.23°/s`) | Tier-2 measured. |
| `I-DD` | `5` | `171` | `22137` (`121.6°`) | `310` (`51.16°/s`) | Tier-2 measured; omitted (speed 15: null, 0.7, null (het_not_executed); speed 31: null, null, null (skip:damaged)). |
| `I-CL` | `15, 31` | `171, 171` | `25140, 23466` (`138.1, 128.9°`) | `296, 298` (`48.86, 49.09°/s`) | Tier-2 measured; omitted (speed 5: null, -160.9, null (het_not_executed)). |
| `I-CA` | `5` | `171` | `24576` (`135°`) | `276` (`45.47°/s`) | Tier-2 measured; omitted (speed 15: null, 0.0, null (het_not_executed); speed 31: null, null, null (skip:damaged)). |
| `I-CC` | `5` | `171` | `24576` (`135°`) | `264` (`43.47°/s`) | Tier-2 measured; omitted (speed 15: null, -0.6, null (het_not_executed); speed 31: null, null, null (skip:damaged)). |
| `Z-CA` | `5, 15, 31` | `171, 171, 171` | `16384, 16384, 16384` (`90, 90, 90°`) | `318, 296, 284` (`52.39, 48.85, 46.86°/s`) | Tier-2 measured; wall-clock at 5, 15, 31. |
| `R-KR`, `G-FF`, `G-DD`, `G-DN`, `I-DN`, `Z-FF`, `Z-DD`, `Z-CL`, `Z-BC`, `Z-DN` | — | Uses `default` | Uses `default` | Uses `default` | All Tier-2 HET runs were `het_not_executed` or `skip:damaged`; stays on `default` (**TO VERIFY**). |
| Orion (`O-*`) | — | — | — | — | **Parked:** unreachable in the skirmish empire picker (**TO VERIFY**). |
| `default` | `5, 31` | `171` | `16384` | `285` | Fallback **TO VERIFY** for unmeasured hulls |

`energyCost` remains placeholder `0` (**TO VERIFY**).

### Audit field mapping (`tools/ship-audit`)

`tools/ship-audit/harness.ts` scores HET runs using speed-keyed fields:

- `turn.het.<speed>.deg` (from `total_turn_deg`)
- `turn.het.<speed>.degPerSecond` (from `mean_rate_deg_per_game_s_10_90`)
- `turn.het.<speed>.delayS` (from `order_delay_s`)

[`data/het.json`](data/het.json) stores per-hull `audit.expect` and `audit.tolerances` maps matching those exact field names (`F-CA`: `deg = 90 ± 6`, `delayS = 5.7 ± 0.3`, `degPerSecond` at `5/10/15/20/31` = `46.7/47/41.4/47/48.0 ± 6`; `F-CL`/`F-CC`/`F-DN`/`F-DD`: `deg = 90 ± 6`, `delayS = 5.7 ± 0.3`, `degPerSecond ± 5` at measured speeds; `K-D7` and the 31 other measured non-Federation hulls: `deg ± 6`, `delayS ± 0.3`, `degPerSecond ± 6` at each usable measured speed). `tools/ship-audit` compares `|total_turn_deg|` against table `deg` expectations because captures record port turns negatively.

## 5. Two-phase execution (delay then turn)

Per-tick movement step while `mode === "het"`:

1. **Delay phase (`hetDelayTicksLeft > 0`):** decrement `hetDelayTicksLeft` by `1` each movement tick. The ship does not perform the HET rotation yet (`remainingTurn16` stays unchanged; normal forward cruise continues).
2. **Turn phase (`hetDelayTicksLeft === 0` and `remainingTurn16 !== 0`):** step heading by `step = sign(remainingTurn16) × min(|remainingTurn16|, turnRate16PerTick)` (`heading16 = (heading16 + step) mod 65536`), and subtract `step` from `remainingTurn16`.
3. **Completion:** when `remainingTurn16 === 0`, transition `mode` back to `"none"` (`hetDelayTicksLeft = 0`, `remainingTurn16 = 0`).

Worked `F-CA` timing (`171`-tick delay, `+16384` turn at `285` units/tick):

- Ticks `0..170` (`171` movement ticks): delay counts down `171 → 0`; `heading16` stays `0`.
- Ticks `171..227` (`57` ticks): each tick adds `+285` (`57 × 285 = 16245`, `remainingTurn16 = 139`).
- Tick `228` (tick `58` of turn): adds the final `+139`; `heading16 = 16384`, `remainingTurn16 = 0`, `mode = "none"`. Total: `229` ticks (`≈7.63 s` at `30` Hz).

Fixture: [`tests/het.json`](tests/het.json).

## 6. `HelmView` contract

`readHelmView` in `engine/sim/helm.ts` reads the `het` table first, then the heading order:

| Field | Type / units | Meaning |
| --- | --- | --- |
| `mode` | `"none" \| "heading" \| "het"` | Active helm mode. `"none"` when idle or holding; `"heading"` while steering an `orderHeading`; `"het"` while an HET delay or turn is running. |
| `remainingTurn16` | signed `i32` (16-bit angle units, `65536 = full turn`, **not** Q16.16) | Signed angle remaining from the current heading to the ordered target (`0` when `"none"`). |
| `hetDelayTicks` | integer tick count (`>= 0`) | Ticks remaining before a pending HET begins rotating (`0` when `mode !== "het"` or once rotation has started). The fixture file calls this `hetDelayTicksLeft`. |

During the HET `remainingTurn16` is the signed sweep still to turn. When it finishes the ship holds the heading it reached, so the view goes to `"heading"` with `remainingTurn16 = 0` (the fixture's `"none"`). The order tick is the first delay tick: right after an accepted F-CA order the view reads `{ mode: "het", remainingTurn16: 16384, hetDelayTicks: 170 }`.

Tests: `engine/sim/het.test.ts` runs both directions, the §5 timing, `K-D7` and default rows, `hetInvalidDir`, `hetActive` for a second HET, a heading order and a manual yaw, immobile and missing ships, determinism with snapshot restore, and [`tests/het.json`](tests/het.json) through the engine. `engine/duel/heading.test.ts` drives `orderHet` from the match.

## 7. Pending playtest (TO VERIFY)

- `F-FF` HET rate (currently uses `default`), missing Federation speed points (`F-CA` `10`, `F-CL` `31`, `F-CC` `15/31`, `F-DN` `15/31`, `F-DD` `5/15`), and missing/omitted Tier-2 non-Federation HET cells:
  - Suspect cells omitted: `L-CW` `s5` (`-48.1°`, `18.96°/s`) and `s31` (`45.9°`, `10.7°/s`).
  - All other omitted non-Federation cells (`het_not_executed` or `skip:damaged`, including the 10 hulls left on `default`): `K-F5` (s15); `K-C8` (s31); `R-KR` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `R-KRC` (s31); `R-SPA` (s31); `R-CON` (s15, s31); `L-FF` (s5); `L-CW` (s5, s31); `H-HN` (s15); `H-LN` (s5, s31); `H-HR` (s5); `H-DG` (s15, s31); `H-PAL` (s15, s31); `G-FF` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `G-DD` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `G-CL` (s31); `G-DN` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `I-DD` (s15, s31); `I-CL` (s5); `I-CA` (s15, s31); `I-CC` (s15, s31); `I-DN` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `Z-FF` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `Z-DD` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `Z-CL` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `Z-BC` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`); `Z-DN` (all speeds: `het_not_executed` / `skip:damaged`, uses `default`).
  - Sweep variation across skins (`~135°` on most `R`/`L`/`H`/`G`/`I` runs vs `~90°` on `Z-CA`/`R-SPA`/`H-HN` vs Klingon `~74–83°` at `s5` and `~94–106°` at `s15`/`31`, plus `H-LN` `s15` `-46.1°` and `5` outlier `delayTicks` cells outside `5.4–6.0 s`: `L-CA` `s15`/`s31`, `G-CC` `s5`, `H-DG` `s5`, `G-CL` `s5`).
  - **Orion hulls:** parked because Orion cannot be reached in the skirmish empire picker.
- Whether any Federation hull varies `delayTicks` within `5.4–6.0 s` (`162–180` ticks) or `turnAngle16` within `~84–96°`, and the Tier-1 vs Tier-2 `F-CA` speed-15 spread (`50.6` vs `41.4°/s`).
- Whether 3×3 helm arrows trigger distinct sweep angles (45°/90°/180° or the hull-fixed table sweep already selected by `dir`) and whether `Go` executes a queued angle.
- Energy cost, `hetChance` / `hetBreakdown` shiplist columns, breakdown effects, cooldowns, and whether `orderHeading` / `orderHelm` / a second `orderHet` can cancel an in-flight HET (the sim refuses all three for now).
- Whether a crew-disabled or tractored ship finishes an HET already in flight (the sim lets it finish).
