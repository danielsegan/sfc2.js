# High-Energy Turn (HET)

Status: **spec, provisional numbers, TO VERIFY.** Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Linked from [duel-slice.md](duel-slice.md) §4.

Clean-room. Mechanics are described in our own words. Provisional numbers live in [`data/het.json`](data/het.json) and are marked **placeholder / TO VERIFY**. No rulebook table is copied here.

## 1. Units and representation

All HET angles, durations, and rates follow [`docs/engine/sim-core.md`](../engine/sim-core.md) and `engine/sim/heading.ts`:

- **Angles:** 16-bit angle units (`65536 = full turn`), stored and transmitted as **signed `i32`**, **not** Q16.16. Positive deltas turn clockwise (starboard); negative deltas turn counter-clockwise (port). Ship heading wraps mod `65536` (`[0, 65535]`).
- **Durations:** integer tick counts at `TICK_HZ = 30` Hz.
- **Rates:** integer angle units per tick (`turnRate16PerTick`). Converted from ≈50°/s at 30 Hz by rounding to the nearest integer:
  `round(50 × 65536 / (360 × 30)) = round(303.407...) = 303` angle units per tick (≈49.93°/s).

## 2. Sim verb and trigger

HET uses its **own sim verb**, separate from `orderHeading` (verb `12` in `engine/sim/heading.ts`) and `orderHelm` (verb `6`):

- **Proposed verb:** `orderHet` (next free Phase 3 verb id `13`; payload: `entity: i32`, `delta16: i32` in signed 16-bit angle units).
- **UI trigger:** the helm panel's 3×3 arrow buttons ([`docs/ui/hud-layout.md`](../ui/hud-layout.md) §5). Left/right helm arrow buttons issue `orderHet` with `∓defaultTurnAngle16` (provisional `∓16384`, i.e. ∓90°, TO VERIFY against the observed ≈80–95° turn and exact button set).

## 3. Acceptance checks and speed cutoff

When `orderHet(entity, delta16)` arrives in the input phase:

1. Reject if the entity is missing (`noSuchShip`), a fighter (`notAShip`), destroyed (`shipDestroyed`), or crew-disabled (`crewDisabled`).
2. Clamp/refuse if the ship's turn mode is immobile `H` (`immobile`).
3. Reject if `delta16 === 0` (`negativeValue`, or a dedicated invalid-delta check — TO VERIFY).
4. Reject if an HET is already pending or executing (`hetActive`, **provisional / TO VERIFY**; whether a second press cancels or is ignored is TO VERIFY).
5. **Speed cutoff:** read `maxSpeed` from [`data/het.json`](data/het.json) (provisional `14`, **TO VERIFY**). No HET was observed at speed `15+` in CE 2.670 captures (observed working at speeds 5 and 10; exact cutoff between 10 and 15 is TO VERIFY). If `ship.speed > maxSpeed`, reject with `hetTooFast` (**provisional / TO VERIFY**).

Accepted `orderHet` supersedes any active `orderHeading` for that ship. Whether `orderHeading` or manual `orderHelm` can cancel an active HET during its delay or turn phase is **TO VERIFY** (provisional: rejected/locked until the HET finishes).

## 4. Two-phase timing (delay then turn)

All timings in [`data/het.json`](data/het.json) are **provisional / TO VERIFY**:

| Parameter | Provisional value | Meaning | Status |
| --- | --- | --- | --- |
| `delayTicks` | `162` ticks | Delay before rotation starts (≈5.4 s at 30 Hz) | **TO VERIFY** |
| `defaultTurnAngle16` | `16384` (90°) | Signed turn delta in 16-bit angle units (within observed ≈80–95°) | **TO VERIFY** |
| `turnRate16PerTick` | `303` units/tick | Integer yaw rate during the turn (`round(50 × 65536 / 10800)`) | **TO VERIFY** |
| `maxSpeed` | `14` | Inclusive speed cutoff (`15+` rejected; table field) | **TO VERIFY** |
| `energyCost` | `0` | HET energy spend (placeholder) | **TO VERIFY** |

Per-tick movement step while `mode === "het"`:

1. **Delay phase (`hetDelayTicksLeft > 0`):** decrement `hetDelayTicksLeft` by `1` each movement tick. The ship does not perform the HET rotation yet (`remainingTurn16` stays unchanged; normal forward cruise continues).
2. **Turn phase (`hetDelayTicksLeft === 0` and `remainingTurn16 !== 0`):** step heading by `step = sign(remainingTurn16) × min(|remainingTurn16|, turnRate16PerTick)` (`heading16 = (heading16 + step) mod 65536`), and subtract `step` from `remainingTurn16`.
3. **Completion:** when `remainingTurn16 === 0`, transition `mode` back to `"none"` (`hetDelayTicksLeft = 0`, `remainingTurn16 = 0`).

Worked provisional timing (`162`-tick delay, `+16384` turn at `303` units/tick):

- Ticks `0..161` (162 movement ticks): delay counts down `162 → 0`; `heading16` stays `0`.
- Ticks `162..215` (54 ticks): each tick adds `+303` (`54 × 303 = 16362`, `remainingTurn16 = 22`).
- Tick `216` (tick 55 of turn): adds the final `+22`; `heading16 = 16384`, `remainingTurn16 = 0`, `mode = "none"`. Total: `217` ticks (≈7.23 s at 30 Hz).

Fixture: [`tests/het.json`](tests/het.json).

## 5. `HelmView` contract

Consistent with Engine Lead's `engine/sim` heading/helm move PR (this spec does not edit engine code):

| Field | Type / units | Meaning |
| --- | --- | --- |
| `mode` | `"none" \| "heading" \| "het"` | Active helm mode. `"none"` when idle or holding; `"heading"` while steering an `orderHeading`; `"het"` while an HET delay or turn is running. |
| `remainingTurn16` | signed `i32` (16-bit angle units, `65536 = full turn`, **not** Q16.16) | Signed angle remaining from the current heading to the ordered target (`0` when `"none"`). |
| `hetDelayTicksLeft` | integer tick count (`>= 0`) | Ticks remaining before a pending HET begins rotating (`0` when `mode !== "het"` or once rotation has started). |

## 6. Pending playtest (all TO VERIFY)

- Exact delay duration (`delayTicks`, observed ≈5.4 s / ≈162 ticks).
- Exact turn sweep per helm arrow button (observed ≈80–95°; whether 3×3 arrows represent 45°/90°/180° or other presets, and whether `Go` executes a queued angle).
- Exact turn rate (`turnRate16PerTick`, observed ≈50°/s -> `303` units/tick) and whether turn rate varies with speed or turn mode.
- Exact speed cutoff between speed 10 and speed 15 (`maxSpeed`).
- Energy cost, `hetChance` / `hetBreakdown` shiplist columns, breakdown effects, cooldowns, and whether `orderHeading` / `orderHelm` can cancel an in-flight HET.
