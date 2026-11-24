# Combat rules

Owner: Combat Systems Designer. Baseline: *Star Trek: Starfleet Command II* Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). First slice: Phase 2 duel, issue [#24](https://github.com/danielsegan/sfc2.js/issues/24).

Clean-room. These docs describe mechanisms in our own words. Synthetic fixtures use `test-*` ships. Weapon and arc **names** are from the metadata-only CE 2.670 inventory ([#6](https://github.com/danielsegan/sfc2.js/issues/6)). Stat values are not.

| Doc | Contents |
| --- | --- |
| [duel-slice.md](duel-slice.md) | Energy, movement, six shields, phasers, photons, damage, and where the real-time slice differs from tabletop play. |
| [shiplist-mapping.md](shiplist-mapping.md) | Raw field → engine field, scale-factor table, weapon and arc table, ftrlist's 36-column header. |
| [reason-codes.md](reason-codes.md) | `source: "rules"` reason codes. Copied later into `docs/engine/diagnostics.md`. |
| [mission-entry-points.md](mission-entry-points.md) | `damageSystem`, `damageShield`, `repairSystem`, `setShields`, `setEnergy`, and `ruleResult`. |
| [fidelity-risk.md](fidelity-risk.md) | What #34 still has to verify, and how. |
| [tests/](tests/README.md) | Executable JSON cases. `node tools/check-rules-fixtures.mjs`. |

Machine tables live in [`data/`](data/). The checker loads those files, so the JSON is the source the tests execute. The markdown restates them.

## Answered

- `ruleResult.appliedValue` is the applied number for rules, the mission event ([#52](https://github.com/danielsegan/sfc2.js/pull/52)), and the HUD ([#51](https://github.com/danielsegan/sfc2.js/pull/51)).
- `damageSystem` applies armor, then forced hits on the named system, then the damage chart.
- Diagnostics stay `{ code, source, severity, details?, location? }`.
- The lab system key is `lab`.
- A rules-turn is a number of seconds. [`docs/engine/sim-core.md`](../engine/sim-core.md) converts it at 30 ticks per second and requires a whole number of ticks. That file is not on `main` yet.
- Fixed point is 16.16, `FX_SHIFT = 16`, one unit = one range unit. The `combat` stream is registered in sim-core.
- A phaser is a phaser by code. Every phaser feeds the capacitor, including a phaser in a heavy slot.
- The CE 2.670 shiplist and ftrlist code lists in the mapping are the inventory names. Match is case-sensitive. Any other spelling is `unknownWeapon`.
- Phaser damage is applied on the fire tick. A photon launches a seeker; the weapons phase flies it, including on the launch tick. A miss in this slice is `outOfArc` or `outOfRange`. The sim's chart draws use the `combat` xoshiro128** stream. The fixture checker still uses mulberry32, so its scripted and seeded draws are not the sim's draws.

## Open questions

1. How many seconds long is a CE rules-turn? The unit is settled; the duration is not. The placeholder is 30.
2. Is the pay order (life support, fire control, movement, shields, weapons) what CE starves first?
3. Does CE have per-facing reinforcement, or only a general pool?
4. Do shield edges, and each arc's facing set, match the ship model? Every arc set is TO VERIFY.
5. Does the numeric Arc on `Dro*` and `ADD6`/`ADD12` mean reloads or rack capacity? The pairing itself is confirmed. ADD only ever shows 1.
6. Does ftrlist `Shots` mean rounds loaded or reloads? Is fighter `ADD_6` live?
7. Are phaser hits instantaneous in CE, or do they have travel time?
8. Do plain player commands share `ruleResult` with mission commands? This spec says yes for every command the rules module resolves.
9. Whether the fixture checker should switch off mulberry32 onto the sim's xoshiro128** stream. The sim already uses the named stream.
