# Fidelity risk: SFB / SFC2 rules versus Community Edition 2.670

Issue: [#34](https://github.com/danielsegan/sfc2.js/issues/34). Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)), Daniel's installer, Wine on the private `sfc2-ci` VM. This note is the Combat write-up for that risk. It does not close #34. Side-by-side notes from the running game are still to come.

Clean-room: observations of the installed game are black-box. Published manuals may be read in private and then described in our own words. Nothing from a decompilation is used. No game rows, stats, or manual tables are copied into the repo.

## What is uncertain

The duel slice in [`duel-slice.md`](duel-slice.md) is a mechanism spec with synthetic numbers. The loader can apply it to `test-*` fixtures. It is not a claim that Community Edition 2.670 uses those numbers.

Uncertain, and marked pending playtest in the spec:

- The rules-turn length is the observed 33 seconds (`RULES_TURN_SECONDS`). Sim-core converts it at 30 ticks per second into 990 ticks. A photon is ready after two turns and a disruptor after one.
- Shield 1:1 mapping and pairing are verified on CE 2.670 (CE in-battle capture 2026-11-24): [`data/measured.json`](data/measured.json) sets `sideColumnFactor = 1`, `endFactor = 1`, and the 4-to-6 pairing (`Shield 1` → 0, `Shield 2 _ 6` / `shieldForwardSide` → 1 and 5, `Shield 3 _ 5` / `shieldAftSide` → 2 and 4, `Shield 4` → 3), and `Shield Total = S1 + 2·S2_6 + 2·S3_5 + S4` held on all 1,157 CE rows. Note: the CE Vessel Library screen is unreliable for shields (some rear values, e.g. on D7/POL/E4 rows, disagree with the table), whereas the in-battle six-segment ring and the table agree.
- Whether side-warp ratings (`warpSide` ×2) are doubled in CE 2.670 remains unverified, and `turnModeUnverified` still fires for a letter with no measured yaw.
- Pay order when the ship asks for more energy than it has, and whether batteries dump freely or on a delay.
- Whether specific (per-facing) reinforcement exists in CE, or only a general pool. The HUD asks the same question.
- Shield facing edges. The duel slice bins the uint16 circle into six facings. CE may use model-specific cones.
- Phaser capacitor amounts. The rule is settled: a phaser feeds the capacitor because of its code, in any slot. The energy each real phaser code stores is still empty.
- Phaser hold cost, photon overload risk, proximity distance, and whether phasers are instantaneous. Normal photon arming is two rules-turns (66 s) and a disruptor is one (33 s). `Ph1`–`Ph4` and `PhG` still take the phaser `costFallback`. `PhoF` still takes the short photon fallback when it omits `armCost`. `Phot` names its own arm cost and `armTurns`.
- Turn-mode rates for letters `AA` and `A`–`G`. Ships bound from a shiplist now turn on the measured speed-keyed **normal** curve ([turning.md](turning.md) §5), with the letter cap kept as an upper bound. The fallback yaw and its `turnModeUnverified` warning remain only for hulls with no turn hull. `F-CA` is measured; `K-D7` is a flat rate band (Tier-2 points pending); per-speed `K-D7` points, its delay, and every other hull (on `default`) remain **TO VERIFY**.
- Damage-chart contents, armor-before-chart, and which hull section a facing feeds.
- Fighter arc widths and the F / G / roman suffixes on the ftrlist weapon codes. The code strings themselves are from the metadata inventory ([#6](https://github.com/danielsegan/sfc2.js/issues/6)); the angles are a working geometry.
- Shiplist weapon codes, arc codes, and header detection. Still pending #6. The ship section of the mapping table is synthetic `TEST-*` codes only.
- Whether ftrlist `Shots` is a loaded magazine or a reload stock, and whether `ADD_6` does anything on a fighter.

[phase3-systems.md](phase3-systems.md) now resolves electronic warfare, overload arming cost, tractors, and cloaks with synthetic numbers. Those numbers are **not yet verified** against the original. [het.md](het.md) specifies High-Energy Turns with CE 2.670 measurements (171-tick / 5.7 s delay, no speed cutoff — works at speeds 15, 20, and 31, F-CA ≈90° at 43–51°/s, K-D7 ≈82–84°) and remaining **TO VERIFY** items (K-D7 and other hulls' rates, per-speed curve variation, energy cost, and breakdown). `orderHet` is `{ entity, dir }` with `dir` ∈ `{ -1, +1 }`; sweep, rate, and delay come from the hull table, with no `delta16` override. Still unspecified as resolution rules: seeking weapons, plasma, hellbores, and HET breakdown rolls.

## How we verify

1. **Playtest on `sfc2-ci`.** Run CE 2.670 under Wine. For one question at a time, fly a short duel (one attacker, one target, one weapon family) and record only metadata: tick-equivalent times, shield points remaining, which facing broke, which system boxes were marked, and a hash of any capture that stays on the VM. Do not commit screenshots, rows, or text from the game.
2. **Same scenario in the engine**, once the sim exists, using a synthetic ship whose ratings were typed in by the tester from what they saw. Compare the ruleResult and the end state to the notes. A mismatch becomes a combat issue that cites the spec section. It does not get "fixed" by pasting the game's numbers silently into `docs/rules/data/`.
3. **Manuals**, read privately, used to decide which mechanism we are looking for (arming over time, six facings, a chart). The spec is rewritten in our own words. Tables in a book stay in the book.
4. **Community knowledge** (modding threads, the format specs already in `docs/formats/`) to name columns and codes. Frequency counts from the inventory stay in the private artifact. This repo keeps names, the column count the inventory summary already stated (36 ftrlist columns), and hashes when a format spec needs them.
5. **Fixtures in this repo** lock the mechanism (clamps, arcs, chart order) so implementation cannot drift from the spec. They do not lock CE's real balance.

## What #34 still needs

- A short note per Phase 3 system after a Wine session, or an explicit line that the session has not been run.
- Mismatches filed as combat tasks.
- No original assets in the notes.

The duel slice is the document those sessions test against.
