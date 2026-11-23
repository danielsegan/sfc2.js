# Combat rules

Owner: Combat Systems Designer. Baseline: *Star Trek: Starfleet Command II* Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). First slice: Phase 2 duel, issue [#24](https://github.com/danielsegan/sfc2.js/issues/24).

Clean-room. These docs describe mechanisms in our own words. Synthetic fixtures use `test-*` ships. Fighter weapon and arc **names** in the mapping table are from the metadata-only CE 2.670 inventory ([#6](https://github.com/danielsegan/sfc2.js/issues/6)); occurrence counts are not included. Shiplist codes stay placeholders.

| Doc | Contents |
| --- | --- |
| [duel-slice.md](duel-slice.md) | Energy, movement, six shields, phasers, photons, damage, and where the real-time slice differs from tabletop play. |
| [shiplist-mapping.md](shiplist-mapping.md) | Raw field → engine field, scale-factor table, weapon and arc table, ftrlist's 36-column header. |
| [reason-codes.md](reason-codes.md) | `source: "rules"` reason codes. Copied later into `docs/engine/diagnostics.md`. |
| [mission-entry-points.md](mission-entry-points.md) | `damageSystem`, `damageShield`, `repairSystem`, `setShields`, `setEnergy`, and `ruleResult`. |
| [fidelity-risk.md](fidelity-risk.md) | What #34 still has to verify, and how. |
| [tests/](tests/README.md) | Executable JSON cases. `node tools/check-rules-fixtures.mjs`. |

Machine tables live in [`data/`](data/). The checker loads those files, so the JSON is the source the tests execute. The markdown restates them.

## Open questions

1. Is a CE rules-turn 900 ticks, or some other multiple of the 30 Hz clock?
2. Ship the phaser-capacitor hypothesis (`slotIndex` 10–24) on or off? It is off.
3. Is the pay order (life support, fire control, movement, shields, weapons) what CE starves first?
4. Does CE have per-facing reinforcement, or only a general pool?
5. Do shield edges match these six uint16 bins, or the ship's model?
6. Production fixed-point scale and `combat` RNG wait on `docs/engine/determinism.md`. Fixtures use milli-units and mulberry32 mixed with the stream name.
7. One field name for the applied number: rules `appliedValue`, mission event `applied`, HUD `value`.
8. Engine key `lab` or `labs`?
9. Shiplist headers and weapon/arc codes are still pending #6. The ship section is `TEST-*` only.
10. Fighter arc widths, and the F / G / roman suffixes, are pending verification. So is the exact spelling of repeated ftrlist headers (`Num` / `Arc` / `Shots` versus suffixed forms).
11. Does ftrlist `Shots` mean rounds loaded or reloads? Is fighter `ADD_6` live?
12. Should `damageSystem`'s named system take forced hits before the chart? This spec says yes, after armor.
13. Are phaser hits instantaneous in CE, or do they have travel time?
14. Do plain player commands share `ruleResult` with mission commands? This spec says yes for every command the rules module resolves.
