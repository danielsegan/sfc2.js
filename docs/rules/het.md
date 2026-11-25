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

Current CE 2.670 summary (`CE in-battle audit`, Wintermute, 2026-11-24, including the 90-pad HET rerun finished 11:47 PM EST, 30/30). A hull's sim `turnAngle16` is the **90° preset baseline** (`16384`), not the captured heading change: the captured sweep depends on which helm arrow pad the harness clicked (90°/135°/45°, also **TO VERIFY**), which is a player preset, not a hull property. After #115 the harness records `het_pad_deg`. Romulan, Lyran, Hydran, Gorn, and ISC rates below are from the 90-pad rerun and replace the 135-pad rates that #114 had kept. Rows still tagged 135 are excluded, not deleted. Audit `turn.het.<speed>.deg` is scored on usable 90-pad captures (including overshoot/undershoot) and is omitted for excluded or 135-only cells.

| Hull key | Speeds | `delayTicks` | `turnAngle16` (16-bit) | `turnRate16PerTick` (30 Hz) | Status |
| --- | --- | --- | --- | --- | --- |
| `F-CA` | `5, 10, 15, 20, 31` | `171` (≈`5.7 s`) | `16384` (≈`90°`) | `283, 285, 251, 285, 291` (`46.7, 47, 41.4, 47, 48.0°/s`) | Tier-2 rates **measured** at `5, 15, 31`; `20` keeps `285` (Tier-1 `47.69°/s`); `10` and speed-15 Tier-1/Tier-2 spread **TO VERIFY** |
| `F-CL` | `5, 15` (clamped outside) | `171` | `16384` | `313, 296` (`51.5, 48.7°/s`) | Tier-2 rates **measured** at `5, 15`; speed `31` and per-hull sweep/delay **TO VERIFY** |
| `F-CC` | `5` (clamped) | `171` | `16384` | `283` (`46.6°/s`) | Tier-2 rate **measured** at `5`; speeds `15, 31` and per-hull sweep/delay **TO VERIFY** |
| `F-DN` | `5` (clamped) | `171` | `16384` | `253` (`41.7°/s`) | Tier-2 rate **measured** at `5`; speeds `15, 31` and per-hull sweep/delay **TO VERIFY** |
| `F-DD` | `31` (clamped) | `171` | `16384` | `335` (`55.2°/s`) | Tier-2 rate **measured** at `31`; speeds `5, 15` and per-hull sweep/delay **TO VERIFY** |
| `K-D7` | `5, 15, 31` | `171` | `16384` (90° baseline) | `278, 374, 325` (`45.77, 61.57, 53.62°/s`) | Tier-2 rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `82.9°, 98.3°, 97.3°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15` (**TO VERIFY** game-clock). |
| `K-E4` | `5, 15, 31` | `171` | `16384` (90° baseline) | `249, 268, 418` (`41.05, 44.12, 68.92°/s`) | Tier-2 rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `73.8°, 105.8°, 100.4°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5` (**TO VERIFY** game-clock). |
| `K-F5` | `5, 31` | `171` | `16384` (90° baseline) | `327, 559` (`53.85, 92.07°/s`) | Tier-2 rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `73.5°, 104.6°` at `5, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 31` (**TO VERIFY** game-clock); omitted (speed 15: null, -134.0, null (het_not_executed)). |
| `K-D5` | `5, 15, 31` | `171` | `16384` (90° baseline) | `309, 374, 348` (`50.98, 61.57, 57.38°/s`) | Tier-2 rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `82.1°, 98.7°, 93.9°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15` (**TO VERIFY** game-clock). |
| `K-C7` | `5, 15, 31` | `171` | `16384` (90° baseline) | `290, 364, 286` (`47.76, 59.91, 47.1°/s`) | Tier-2 rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `82.2°, 97.8°, 96.7°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15, 31` (**TO VERIFY** game-clock). |
| `K-C8` | `5, 15` | `171` | `16384` (90° baseline) | `247, 330` (`40.63, 54.44°/s`) | Tier-2 rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `82.6°, 98.3°` at `5, 15` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15` (**TO VERIFY** game-clock); omitted (speed 31: null, -0.7, null (het_not_executed)). |
| `R-SNA` | `5, 15, 31` | `171, 171, 183` | `16384` (90° baseline) | `248, 253, 296` (`40.93, 41.67, 48.76°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `90.1°, 88.6°, 91.5°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15` (**TO VERIFY** game-clock). Speed 31 is a confirmed 90-pad rerun at `48.76°/s` game-clock (gc `0.963`); delay `6.11 s` / `183` ticks (outside the `5.4–6.0 s` / `171`-tick band). |
| `R-BH` | `5, 31` | `171` | `16384` (90° baseline) | `285, 285` (default placeholder) | No usable 90-pad sample; row keeps its `hullOrder` id and reuses the `default` placeholder. Prior 135-pad rates removed. Omitted (**TO VERIFY**): speed 5 / 15 `het_not_executed`; speed 31 135-only sample excluded. |
| `R-SPA` | `5, 15` | `171` | `16384` (90° baseline) | `345, 376` (`56.83, 61.95°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `90.4°, 90.1°` at `5, 15` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5` (**TO VERIFY** game-clock); omitted (speed 31: `het_not_executed`). |
| `R-KRC` | `5, 15` | `171` | `16384` (90° baseline) | `329, 407` (`54.27, 67.05°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `83.6°, 97.3°` at `5, 15` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `15` (**TO VERIFY** game-clock); omitted (speed 31: `het_not_executed`). |
| `R-CON` | `5, 15` | `171` | `16384` (90° baseline) | `236, 310` (`38.81, 51.14°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `80.5°, 106.1°` at `5, 15` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5` (**TO VERIFY** game-clock); omitted (speed 31: `het_not_executed`). |
| `R-KR` | `5` | `171` | `16384` (90° baseline) | `350` (`57.76°/s`) | Tier-2 **90-pad** rate **measured** (confirmed rerun); sim sweep is the 90° preset baseline (`16384`); measured `82.5°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5` (`57.76°/s`, no usable game clock, **TO VERIFY** game-clock); omitted (speed 15 / 31: `het_not_executed`). Newly added to `hullOrder` (was on `default`). |
| `L-FF` | `15` | `171` | `16384` (90° baseline) | `258` (`42.47°/s`) | Tier-2 **90-pad** rate **measured** (clean ~40–55°/s Lyran sample); sim sweep is the 90° preset baseline (`16384`); measured `80.6°` at `15` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 5: suspect `9.37°/s`; speed 31: slow `14.14°/s`, bimodal). |
| `L-DD` | `5, 31` | `171` | `16384` (90° baseline) | `285, 285` (default placeholder) | No usable 90-pad sample; row keeps its `hullOrder` id and reuses the `default` placeholder. Prior 135-pad rates removed. Omitted (**TO VERIFY**): speed 5 high `97.9°/s`; speed 15 slow `11.77°/s`; speed 31 `het_not_executed`. |
| `L-CW` | `5, 31` | `171` | `16384` (90° baseline) | `285, 285` (default placeholder) | No usable 90-pad sample; row keeps its `hullOrder` id and reuses the `default` placeholder. Prior 135-pad rates removed. Omitted (**TO VERIFY**): speed 5 / 31 slow bimodal (`12.66` / `9.48°/s`); speed 15 `31.02°/s` outside the clean 40–55°/s band. |
| `L-CA` | `5` | `171` | `16384` (90° baseline) | `331` (`54.49°/s`) | Tier-2 **90-pad** rate **measured** (clean ~40–55°/s Lyran sample); sim sweep is the 90° preset baseline (`16384`); measured `88.6°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 15: `het_not_executed`; speed 31: 135-only sample excluded). |
| `L-CC` | `5` | `171` | `16384` (90° baseline) | `267` (`44.04°/s`) | Tier-2 **90-pad** rate **measured** (clean ~40–55°/s Lyran sample); sim sweep is the 90° preset baseline (`16384`); measured `88.6°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 15: `81.12°/s` outside the clean 40–55°/s band; speed 31: `het_not_executed`). |
| `L-DN` | `5, 31` | `171` | `16384` (90° baseline) | `285, 285` (default placeholder) | No usable 90-pad sample; row keeps its `hullOrder` id and reuses the `default` placeholder. Prior 135-pad rates removed. Omitted (**TO VERIFY**): speed 5 slow `17.26°/s`; speed 15 `het_not_executed`; speed 31 135-only sample excluded. |
| `H-HN` | `5, 15, 31` | `184, 171, 171` | `16384` (90° baseline) | `402, 363, 440` (`66.2, 59.75, 72.54°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `87.2°, 90.9°, 91.2°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**). Delay at speed 5 is `6.12 s` / `184` ticks (outside the `5.4–6.0 s` / `171`-tick band). |
| `H-LN` | `31` | `171` | `16384` (90° baseline) | `271` (`44.69°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `80.8°` at `31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 5: suspect `-59.5°`, `7.05 s`, `150.63°/s`; speed 15: suspect `10.45°/s`). |
| `H-HR` | `5, 15, 31` | `171` | `16384` (90° baseline) | `311, 306, 184` (`51.2, 50.43, 30.37°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `88.2°, 88.9°, 87.5°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**). |
| `H-RN` | `5, 15` | `171` | `16384` (90° baseline) | `281, 305` (`46.36, 50.26°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `86.6°, 89.0°` at `5, 15` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 31: `het_not_executed`). |
| `H-DG` | `5` | `162` | `16384` (90° baseline) | `283` (`46.67°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `86.6°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); delay `5.39 s` / `162` ticks (outside the `5.4–6.0 s` band); omitted (speed 15: `het_not_executed`; speed 31: 135-only / `het_not_executed`). |
| `H-PAL` | `5` | `171` | `16384` (90° baseline) | `284` (`46.85°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `89.3°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 15: `het_not_executed`; speed 31: `skip:damaged`). |
| `G-FF` | `15` | `186` | `16384` (90° baseline) | `196` (`32.37°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `80.3°` at `15` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); delay `6.19 s` / `186` ticks (outside the `5.4–6.0 s` band); omitted (speed 5: `het_not_executed`; speed 31: suspect `109.7°`). Newly added to `hullOrder` (was on `default`). |
| `G-CL` | `5` | `171` | `16384` (90° baseline) | `288` (`47.54°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `89.3°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5` (**TO VERIFY** game-clock); omitted (speed 15: `het_not_executed`; speed 31: 135-only / `het_not_executed`). |
| `G-CA` | `5, 15, 31` | `171, 180, 171` | `16384` (90° baseline) | `270, 356, 307` (`44.55, 58.59, 50.51°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `89.2°, 92.1°, 89.1°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15, 31` (**TO VERIFY** game-clock). Delay at speed 15 is `6.01 s` / `180` ticks (just outside the `5.4–6.0 s` / `171`-tick band). |
| `G-CC` | `5, 15, 31` | `171` | `16384` (90° baseline) | `300, 317, 251` (`49.37, 52.24, 41.4°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `89.5°, 90.1°, 89.2°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15, 31` (**TO VERIFY** game-clock). |
| `I-FF` | `5, 15, 31` | `171` | `16384` (90° baseline) | `370, 312, 406` (`60.97, 51.4, 66.88°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `83.2°, 99.5°, 91.6°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**). |
| `I-DD` | `5` | `171` | `16384` (90° baseline) | `248` (`40.8°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `81.7°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 15 / 31: `het_not_executed`). |
| `I-CL` | `5` | `171` | `16384` (90° baseline) | `333` (`54.85°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `87.7°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 15 / 31: `het_not_executed`). |
| `I-CA` | `5, 15, 31` | `171` | `16384` (90° baseline) | `284, 136, 147` (`46.76, 22.46, 24.15°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `79.9°, 99.4°, 97.2°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**). Speeds 15 and 31 are well below the ISC median (`40.6°/s`) and stay in the table as measured 90-pad samples. |
| `I-CC` | `5` | `171` | `16384` (90° baseline) | `243` (`40.02°/s`) | Tier-2 **90-pad** rate **measured**; sim sweep is the 90° preset baseline (`16384`); measured `80.1°` at `5` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); omitted (speed 15: `het_not_executed`; speed 31: `skip:damaged`). |
| `I-DN` | `5, 15, 31` | `171` | `16384` (90° baseline) | `240, 240, 245` (`39.6, 39.6, 40.4°/s`) | Tier-2 **90-pad** rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `86.6°, 93.2°, 89.6°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**). Newly added to `hullOrder` (was on `default`). |
| `Z-CA` | `5, 15, 31` | `171` | `16384` (90° baseline) | `318, 296, 284` (`52.39, 48.85, 46.86°/s`) | Tier-2 rates **measured**; sim sweep is the 90° preset baseline (`16384`); measured `90.3°, 89.7°, 89.7°` at `5, 15, 31` kept in audit as 90° overshoot/undershoot (**TO VERIFY**); wall-clock rate at `5, 15, 31` (**TO VERIFY** game-clock). |
| `G-DD`, `G-DN`, `Z-FF`, `Z-DD`, `Z-CL`, `Z-BC`, `Z-DN` | — | Uses `default` | Uses `default` | Uses `default` | No usable 90-pad (or earlier) HET sample (`het_not_executed`, `skip:damaged`, or all-speed noop); stays on `default` (**TO VERIFY**). |

| Orion (`O-*`) | — | — | — | — | **Parked:** unreachable in the skirmish empire picker (**TO VERIFY**). |
| `default` | `5, 31` | `171` | `16384` | `285` | Fallback **TO VERIFY** for unmeasured hulls |

`energyCost` remains placeholder `0` (**TO VERIFY**).

### Audit field mapping (`tools/ship-audit`)

`tools/ship-audit/harness.ts` scores HET runs using speed-keyed fields:

- `turn.het.<speed>.deg` (from `total_turn_deg`)
- `turn.het.<speed>.degPerSecond` (from `mean_rate_deg_per_game_s_10_90`)
- `turn.het.<speed>.delayS` (from `order_delay_s`)

[`data/het.json`](data/het.json) stores per-hull `audit.expect` and `audit.tolerances` maps matching those exact field names (`F-CA`: `deg = 90 ± 6`, `delayS = 5.7 ± 0.3`, `degPerSecond` at `5/10/15/20/31` = `46.7/47/41.4/47/48.0 ± 6`; `F-CL`/`F-CC`/`F-DN`/`F-DD`: `deg = 90 ± 6`, `delayS = 5.7 ± 0.3`, `degPerSecond ± 5` at measured speeds; `K-D7` and the other measured non-Federation hulls: `delayS ± 0.3` and `degPerSecond ± 6` at each usable measured speed; `deg ± 6` is scored for 90° preset captures, using the measured sweep — Klingon overshoot/undershoot, `Z-CA`, and the usable 90-pad `R`/`L`/`H`/`G`/`I` cells). Excluded, 135-only, noop, and placeholder hulls omit the audit expect. `tools/ship-audit` compares `|total_turn_deg|` against table `deg` expectations because captures record port turns negatively. Tagged `noop` runs are skipped.

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
  - 90-pad suspect / out-of-band cells omitted (no audit expect; 135-pad rates were not kept as live sim data): the slow Lyran set (`L-FF` `s5`/`s31`, `L-CW` `s5`/`s31`, `L-DD` `s15`, `L-DN` `s5`); `L-DD` `s5` (`97.9°/s`); `L-CW` `s15` (`31.02°/s`) and `L-CC` `s15` (`81.12°/s`) outside the clean ~40–55°/s Lyran band; `H-LN` `s5` (`-59.5°`, `7.05 s`, `150.63°/s`) and `s15` (`10.45°/s`); `G-DD` at all three speeds (noop); `G-FF` `s31` (`109.7°`). Every row still tagged 135 was also excluded.
  - Placeholder rows (kept in `hullOrder` so later ids stay stable, speed points reuse `default` 285/171): `R-BH`, `L-DD`, `L-CW`, `L-DN`.
  - Other omitted non-Federation cells (`het_not_executed` or `skip:damaged`, including hulls left on `default`): `K-F5` (s15); `K-C8` (s31); `R-KR` (s15, s31: `het_not_executed`); `R-KRC` (s31); `R-SPA` (s31); `R-CON` (s31); `L-CA` (s15); `L-CC` (s31); `H-RN` (s31); `H-DG` (s15, s31); `H-PAL` (s15, s31); `G-FF` (s5); `G-DD` (all speeds, uses `default`); `G-CL` (s15, s31); `G-DN` (all speeds, uses `default`); `I-DD` (s15, s31); `I-CL` (s15, s31); `I-CC` (s15, s31); `Z-FF` (all speeds, uses `default`); `Z-DD` (all speeds, uses `default`); `Z-CL` (all speeds, uses `default`); `Z-BC` (all speeds, uses `default`); `Z-DN` (all speeds, uses `default`).
  - **HET sweep is a helm preset, not a hull property.** The 3×3 arrow pads command distinct sweeps (90°/135°, also 45°, **TO VERIFY**). After #115 the harness logs `het_pad_deg` (90 for port/stbd, 135 for hard_port/hard_stbd). Sim `turnAngle16` is the 90° baseline (`16384`) on every measured row. Audit `deg` keeps the measured 90-pad sweep (overshoot/undershoot, **TO VERIFY**). Klingon cells that sit 7–16° off 90° (`K-D7` `s15`/`s31` `98.3°`/`97.3°`, `K-E4`/`K-F5` `~100–106°`, and the matching `s5` undershoot of `~73–83°`) are unchanged. Outlier 90-pad `delayTicks` cells outside `5.4–6.0 s`: `H-HN` `s5` (`6.12 s` / `184`), `H-DG` `s5` (`5.39 s` / `162`), `G-CA` `s15` (`6.01 s` / `180`), `G-FF` `s15` (`6.19 s` / `186`), `R-SNA` `s31` (`6.11 s` / `183`).
  - **Orion hulls:** parked because Orion cannot be reached in the skirmish empire picker.
- Whether any Federation hull varies `delayTicks` within `5.4–6.0 s` (`162–180` ticks) or `turnAngle16` within `~84–96°`, and the Tier-1 vs Tier-2 `F-CA` speed-15 spread (`50.6` vs `41.4°/s`).
- Whether 3×3 helm arrows trigger distinct sweep angles (45°/90°/135°/180° or another set) and whether `Go` executes a queued angle. The HET sweep depends on the preset (arrow pads 90°/135° etc., also **TO VERIFY**). The capture harness now records `het_pad_deg` (#115); later audits score `turn.het.<speed>.deg` against the commanded 90° preset rather than treating the heading change as a hull property. A named 45° pad is still **TO VERIFY**.
- Wall-clock (`w`) HET rate cells (where `game_s_per_wall_s` was outside `0.5–1.5`) remain **TO VERIFY** against a game-clock read; they are listed on the hull rows above.
- Energy cost, `hetChance` / `hetBreakdown` shiplist columns, breakdown effects, cooldowns, and whether `orderHeading` / `orderHelm` / a second `orderHet` can cancel an in-flight HET (the sim refuses all three for now).
- Whether a crew-disabled or tractored ship finishes an HET already in flight (the sim lets it finish).
