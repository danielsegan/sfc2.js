# Rules fixtures

Synthetic cases for the Phase 2 duel slice. Ships are `test-*` only. Numbers are the placeholder tables in [`../data/`](../data/), not CE 2.670 stats.

Run from the repo root:

```bash
node tools/check-rules-fixtures.mjs
```

There is no engine test runner yet. `tools/check-rules-fixtures.mjs` is the harness: it checks each file's shape, executes the duel rules, and compares `expect`. [`schema.json`](schema.json) documents the file shape for a later runner. The harness is a spec double and is not imported by the sim.

## File shape

| Field | Role |
| --- | --- |
| `id`, `mode` | Required. Mode is `pure`, `scale`, `load`, `resolve`, `ticks`, or `bounds`. |
| `constants` | Optional overrides of [`../data/constants.json`](../data/constants.json) for this file. |
| `seed` | `combat` stream seed when a chart draw is not scripted. Default 1. |
| `ships` | Engine-model ships. `className` must start with `test-`. |
| `cases` | `pure` inputs (`facing` or `inArc`). |
| `raw` | `scale` input, four shield cells plus power fields, before fan-out and ×2. |
| `commands` | `resolve` commands, applied in order as if each were already due. |
| `timeline`, `endTick` | `ticks` commands by input-phase tick. The loop runs tick 0 through `endTick`. |
| `expect` | `ruleResult` list and a partial state. Extra state fields are ignored. Rejected commands use `appliedValue: null`. |

Command `entry` is one of `setShields`, `damageShield`, `repairSystem`, `damageSystem`, `setEnergy`, `orderHelm`, `fire`.

`damageSystem` and `fire` may carry `scriptedDraws` and `warheadRolls`. Those arrays are a harness feature so a chart expectation does not depend on the production RNG. The sim always uses the `combat` stream.

Tokens start at 1 in the order commands run. Tick mode also records `tick` on each result.

Within a tick the harness applies due commands, drips reinforcement and charge, then flies projectiles. A photon launched on tick T moves on tick T.
