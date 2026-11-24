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
| `id`, `mode` | Required. Mode is `pure`, `scale`, `load`, `resolve`, `ticks`, `bounds`, or `turning`. |
| `constants` | Optional overrides of [`../data/constants.json`](../data/constants.json) for this file. |
| `seed` | `combat` stream seed when a chart draw is not scripted. Default 1. |
| `ships` | Engine-model ships. `className` must start with `test-`. |
| `cases` | `pure` inputs (`facing` or `inArc`). |
| `raw` | `scale` input, four shield cells (1:1 after fan-out) plus power fields (`warpSide` ×2), before loader scaling. |
| `commands` | `resolve` commands, applied in order as if each were already due. |
| `timeline`, `endTick` | `ticks` commands by input-phase tick. The loop runs tick 0 through `endTick`. |
| `expect` | `ruleResult` list and a partial state. Extra state fields are ignored. Rejected commands use `appliedValue: null`. |

Command `entry` is one of `setShields`, `damageShield`, `repairSystem`, `damageSystem`, `setEnergy`, `orderHelm`, `orderHet`, `fire`. `orderHet` takes `dir` (`-1` port or `+1` starboard); sweep, rate, and delay come from [`../data/het.json`](../data/het.json). Mode `turning` runs unit-conversion, interpolation, and clamp cases against [`../data/turn-normal.json`](../data/turn-normal.json).

`damageSystem` and `fire` may carry `scriptedDraws` and `warheadRolls`. Those arrays are a harness feature so a chart expectation does not depend on the production RNG. The sim always uses the `combat` stream.

Tokens start at 1 in the order commands run. Tick mode also records `tick` on each result.

Within a tick the harness applies due commands, drips reinforcement and charge, then flies projectiles. A photon launched on tick T moves on tick T.

`engine/sim/het.test.ts` also runs [`het.json`](het.json) through the engine's real `orderHet` handler, and `engine/sim/turn-curve.test.ts` runs the [`turning.json`](turning.json) lookups through the engine's curve. Headless vitest cases in `engine/sim/combat.test.ts` cover a phaser firing, an out-of-arc or out-of-range miss, damage to one chosen shield facing, and a photon that flies before it hits. Phase 3 ECM, overload arming, tractors, and cloaks are stepped in `engine/sim/phase3.test.ts`. Fighter launch, PF launch, mines, and raids are `engine/sim/smallcraft.test.ts`. Those cases use `TEST-*` ships. This checker stays the spec double and is not imported by the sim.
