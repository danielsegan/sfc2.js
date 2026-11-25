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

## Why this is lockstep-safe

Lockstep means every peer applies the same tick only after it has that tick's command bundle, and every peer that does so must land on the same state. This policy is lockstep-safe because the hash of that state is a pure function of the match seed, the scenario, and the canonical command log:

- `step` takes commands and no `dt`. The wall clock never enters the sim. Game speed only changes how many ticks the driver runs between frames, and pause runs none, so two peers that have applied the same ticks match even when their frame rates do not.
- The only randomness is the named xoshiro128** streams, seeded from the match seed and the stream name. Stream state is inside the snapshot and the xxHash32 state hash. A draw on one stream does not move another.
- Every sim quantity is an integer: Q16.16, or an exact i64 for distance-squared, cross, and dot. Division floors, overflow saturates, and both the hash and the command codec are explicit little-endian bytes. A later WASM port has to reproduce those bits. There is no floating-point rounding for JS and WASM to disagree on, and no host endianness in the hashed bytes.
- Entity visits, system order, and command order are total orders: ascending entity index, then phase, priority, and system id, and commands by `(tick, slot, seq)`. Arrival order, object-key order, and locale do not change state.
- Input delay is a count of sim ticks (`current + delay`, or the next tick when delay is 0). It is not a wall-clock stamp, so a command applies on the same tick on every peer.

The known hazards, the guard for each one, and the gaps that are still open are tracked in [determinism-hazards.md](../engine/determinism-hazards.md).

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
