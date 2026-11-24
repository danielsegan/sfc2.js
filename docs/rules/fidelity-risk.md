# Fidelity risk: SFB / SFC2 rules versus Community Edition 2.670

Issue: [#34](https://github.com/danielsegan/sfc2.js/issues/34). Baseline: Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)), Daniel's installer, Wine on the private `sfc2-ci` VM. This note is the Combat write-up for that risk. It does not close #34. Side-by-side notes from the running game are still to come.

Clean-room: observations of the installed game are black-box. Published manuals may be read in private and then described in our own words. Nothing from a decompilation is used. No game rows, stats, or manual tables are copied into the repo.

## What is uncertain

The duel slice in [`duel-slice.md`](duel-slice.md) is a mechanism spec with synthetic numbers. The loader can apply it to `test-*` fixtures. It is not a claim that Community Edition 2.670 uses those numbers.

Uncertain, and marked pending playtest in the spec:

- How many seconds one CE rules-turn lasts. The unit is seconds, and sim-core converts at 30 ticks per second into a whole number of ticks. The placeholder is 30 seconds.
- Whether shield file values and side-warp ratings are doubled in CE 2.670. The scale table follows the SFC1-lineage note in [`docs/formats/shiplist.md`](../formats/shiplist.md) and is unverified on our baseline. The side-column factor, the front/rear factor, and the side-column pairing are the null overrides in [`data/measured.json`](data/measured.json); today's fallbacks stay in force, and `turnModeUnverified` still fires for a letter with no measured yaw.
- Pay order when the ship asks for more energy than it has, and whether batteries dump freely or on a delay.
- Whether specific (per-facing) reinforcement exists in CE, or only a general pool. The HUD asks the same question.
- Shield facing edges. The duel slice bins the uint16 circle into six facings. CE may use model-specific cones.
- Phaser capacitor amounts. The rule is settled: a phaser feeds the capacitor because of its code, in any slot. The energy each real phaser code stores is still empty.
- Phaser hold cost, photon arming time, overload risk, proximity distance, and whether phasers are instantaneous. Until those are measured, `Ph1`–`Ph4`, `PhG`, `Phot` and `PhoF` arm on `costFallback` (the same integers as `TEST-PH` and `TEST-PHOT`).
- Turn-mode rates for letters `AA` and `A`–`G`. Movement uses one documented fallback yaw and warns once with `turnModeUnverified`. The per-letter rates are still unverified.
- Damage-chart contents, armor-before-chart, and which hull section a facing feeds.
- Fighter arc widths and the F / G / roman suffixes on the ftrlist weapon codes. The code strings themselves are from the metadata inventory ([#6](https://github.com/danielsegan/sfc2.js/issues/6)); the angles are a working geometry.
- Shiplist weapon codes, arc codes, and header detection. Still pending #6. The ship section of the mapping table is synthetic `TEST-*` codes only.
- Whether ftrlist `Shots` is a loaded magazine or a reload stock, and whether `ADD_6` does anything on a fighter.

[phase3-systems.md](phase3-systems.md) now resolves electronic warfare, overload arming cost, tractors, and cloaks with synthetic numbers. Those numbers are **not yet verified** against the original. Still unspecified as resolution rules: hit-and-run, boarding, mines, seeking weapons, plasma, hellbores, fighters as flying entities, PF small-craft modifiers, high-energy turns, and breakdown.

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
