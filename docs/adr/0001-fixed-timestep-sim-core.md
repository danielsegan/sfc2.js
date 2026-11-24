# ADR 0001: Deterministic fixed-timestep sim core

Status: accepted for the Phase 2 sim core ([#21](https://github.com/danielsegan/sfc2.js/issues/21)).
Normative detail stays in [determinism.md](../engine/determinism.md) and [sim-core.md](../engine/sim-core.md).

## Decision

The sim advances only by `step(commands)`. It does not read the wall clock or an unseeded RNG.

- Tick rate is 30 Hz. One second is 30 ticks. `step` has no `dt`.
- The frame driver lives in `engine/driver` and is the only place that turns frame time into ticks. Speed multiplies how many ticks run; pause is speed 0 and runs none. At most 8 ticks run per frame.
- Positions and other fixed-point values are Q16.16 (`FX_SHIFT = 16`). Map axes must be whole range units inside ±8,192 or the mission diagnostic is `badMapBounds`.
- `fx.delta` is an i32 difference. `fx.distSq`, `fx.cross`, and `fx.dot` are exact i64 values from a 16-bit split multiply (`Math.imul`). Range checks use `fx.cmpI64` on `d²` and `r²`. A distance is `fx.isqrt64`, floored. BigInt appears only in tests.
- RNG streams are xoshiro128** (`combat`, `ai`, `mission`), seeded from the match seed and the stream name. State is part of the snapshot and the xxHash32 state hash.
- The same seed and command log produce the same hash sequence headless, including from a worker. Render, UI, and audio are not in this change; they are expected to read snapshots and events only.

## Assumptions recorded with the code

These are the calls the specs leave open. They are pinned by tests so a later change is visible.

- SplitMix32 is the MurmurHash3 fmix32 mixer. xxHash32 uses seed 0. `matchSeed` is a little-endian u32.
- An all-zero xoshiro state is replaced with `0x9E3779B9, 0x243F6A88, 0xB7E15162, 0x6A09E667`.
- Streams are hashed in sorted name order: `ai`, `combat`, `mission`.
- Divide-by-zero uses int32 max and int32 min. `0/0` is 0.
- The driver counts time in 1/30000 s units (1000 units per tick). A sub-tick remainder is kept for `alpha`. Whole ticks past the 8-step cap, and time that arrives while the session cannot advance, are dropped.
- Input delay 0 stamps the next tick. Delay 2, 3, or 4 stamps `lastCompleted + delay`.
- Live entities are visited in ascending index. The packed id is still written into the hash. Pending AI/mission commands are part of the hash.
- The first generation is 1. An index whose next generation would not fit in 16 bits is retired.
- The sine LUT is a 4096-step Q16.16 quarter wave plus the exact 90° sample, rounded to nearest. `atan2_16` is 16-step CORDIC, exact on axes and equal-magnitude diagonals.
- One package at the repo root, not a workspace per folder, until the layout PR for #8.
