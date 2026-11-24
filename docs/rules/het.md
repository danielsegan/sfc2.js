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

- **Proposed verb:** `orderHet` (next free Phase 3 verb id `13`; payload: `entity: i32`, `delta16: i32` in signed 16-bit angle units, or default hull sweep when signed direction is supplied).
- **UI trigger:** the helm panel's 3×3 arrow buttons ([`docs/ui/hud-layout.md`](../ui/hud-layout.md) §5). Left/right helm arrow buttons issue `orderHet` with the hull's signed `turnAngle16` (e.g., `∓16384` for `F-CA`; exact button set and `Go` behavior **TO VERIFY**).

## 3. Acceptance checks and no speed cutoff

When `orderHet(entity, delta16)` arrives in the input phase:

1. Reject if the entity is missing (`noSuchShip`), a fighter (`notAShip`), destroyed (`shipDestroyed`), or crew-disabled (`crewDisabled`).
2. Clamp/refuse if the ship's turn mode is immobile `H` (`immobile`).
3. Reject if `delta16 === 0` (`negativeValue`, or a dedicated invalid-delta check — **TO VERIFY**).
4. Reject if an HET is already pending or executing (`hetActive`, **provisional / TO VERIFY**; whether a second press cancels or is ignored is **TO VERIFY**).
5. **No speed cutoff:** CE in-battle capture (2026-11-24) confirmed HET works at speeds `15`, `20`, and `31` as well as lower speeds (`5`, `10`). The earlier "no HET at speed 15+" observation was wrong and has been removed; there is no speed-cutoff rejection.

Accepted `orderHet` supersedes any active `orderHeading` for that ship. Whether `orderHeading` or manual `orderHelm` can cancel an active HET during its delay or turn phase is **TO VERIFY** (provisional: rejected/locked until the HET finishes).

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
| `F-CA` | `5, 10, 15, 20, 31` | `171` (≈`5.7 s`) | `16384` (≈`90°`) | `285` (`47°/s`, band `261–309` = `43–51°/s`) | **Measured** (CE capture 2026-11-24); per-speed curve **TO VERIFY** |
| `K-D7` | `5, 10, 15, 20, 31` | `171` (≈`5.7 s`) | `15110` (`83°`, range `14928–15292` = `82–84°`) | `285` (**TO VERIFY**) | Angle & delay **measured** (CE capture 2026-11-24); rate **TO VERIFY** |
| `default` | `5, 31` | `171` | `16384` | `285` | Fallback **TO VERIFY** for unmeasured hulls |

`energyCost` remains placeholder `0` (**TO VERIFY**).

### Audit field mapping (`tools/ship-audit`)

`tools/ship-audit/harness.ts` scores HET runs using speed-keyed fields:

- `turn.het.<speed>.deg` (from `total_turn_deg`)
- `turn.het.<speed>.degPerSecond` (from `mean_rate_deg_per_game_s_10_90`)
- `turn.het.<speed>.delayS` (from `order_delay_s`)

[`data/het.json`](data/het.json) stores per-hull `audit.expect` and `audit.tolerances` maps matching those exact field names for speeds `5`, `10`, `15`, `20`, and `31` (`F-CA`: `deg = 90 ± 2`, `degPerSecond = 47 ± 4`, `delayS = 5.7 ± 0.2`; `K-D7`: `deg = 83 ± 1`, `delayS = 5.7 ± 0.2`, `degPerSecond` **TO VERIFY**).

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

Consistent with Engine Lead's `engine/sim` heading/helm move PR (this spec does not edit engine code):

| Field | Type / units | Meaning |
| --- | --- | --- |
| `mode` | `"none" \| "heading" \| "het"` | Active helm mode. `"none"` when idle or holding; `"heading"` while steering an `orderHeading`; `"het"` while an HET delay or turn is running. |
| `remainingTurn16` | signed `i32` (16-bit angle units, `65536 = full turn`, **not** Q16.16) | Signed angle remaining from the current heading to the ordered target (`0` when `"none"`). |
| `hetDelayTicksLeft` | integer tick count (`>= 0`) | Ticks remaining before a pending HET begins rotating (`0` when `mode !== "het"` or once rotation has started). |

## 7. Pending playtest (TO VERIFY)

- `K-D7` turn rate (`turn.het.<speed>.degPerSecond` / `turnRate16PerTick`) and HET sweep/rate for remaining empire hulls.
- Exact per-speed variation within the `F-CA` `43–51°/s` band (and whether any hull varies `delayTicks`, `turnAngle16`, or `turnRate16PerTick` across speed points).
- Whether 3×3 helm arrows trigger distinct sweep angles (45°/90°/180° or hull-fixed sweep) and whether `Go` executes a queued angle.
- Energy cost, `hetChance` / `hetBreakdown` shiplist columns, breakdown effects, cooldowns, and whether `orderHeading` / `orderHelm` / a second `orderHet` can cancel an in-flight HET.
