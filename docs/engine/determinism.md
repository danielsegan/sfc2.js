# SFC2.js determinism contract (sim core)

Project: **SFC2.js** (repo [`danielsegan/sfc2.js`](https://github.com/danielsegan/sfc2.js)). Status: **Draft v1.2**, agreed by the Engine Lead and the Audio/Netcode/QA Lead on 2026-11-23. Owner: Audio & Netcode QA Lead. Co-owner: Engine Lead.
§9 is the exit criterion for [#21](https://github.com/danielsegan/sfc2.js/issues/21), the deterministic fixed-timestep sim core (Phase 2). This doc also supports #25 (deterministic replay + CI hash checks) and #27 (the determinism/math-policy risk). The tracked hazard list for #27 is [determinism-hazards.md](determinism-hazards.md).

Language: **TypeScript (strict)**. The rules below are enforced by ESLint (typescript-eslint) on the sim packages, not by the type system alone.

**Change log**
- **Draft v1.3 (2026-11-25):** Added the tracked hazard register as [determinism-hazards.md](determinism-hazards.md) and linked it from this contract and from ADR 0001. The register is the #27 list of known determinism hazards, each with a status, the guard that enforces it, and any gap. No sim-rule change.
- **Draft v1.2 (2026-11-24):** Settled N1a on the Engine Lead's exact-i64 approach recorded in [sim-core N1a](https://github.com/danielsegan/sfc2.js/blob/078f02e/docs/engine/sim-core.md#n1a-distance-squared) (#55, `078f02e`): i32 differences (per-axis |Δ| ≤ 2^30), `d² = dx·dx + dy·dy` as an exact i64 (≤ 2^61), no floats, no pre-shift, no rounding; WASM native i64; TypeScript a bit-identical 32-bit hi/lo split via `Math.imul`; BigInt in tests only; range checks compare `d²` with a precomputed i64 `r²` (no sqrt); a distance is `fx.isqrt64` (floor). Cross products and dot products use the same exact-i64 rule (MUST); the Engine Lead confirmed this. Combat arc checks use the cross-product sign. Helpers in `fx`: `delta`, `distSq`, `cross`, `dot`, `cmpI64`, `isqrt64`, returning `I64`. Added a golden-vector table with exact expected values. Closed the v1.1 request that the Engine Lead confirm the dist² approach (now recorded at `078f02e`, including cross and dot). Renamed "world units" to "range units" to match sim-core.md. Reference baseline updated to Community Edition 2.670 per [#37](https://github.com/danielsegan/sfc2.js/issues/37) and `docs/plan.md` (superseding EAW 2.036 + unofficial 2.037). Follows #55 and #56 (`d74ab2c`).
- **Draft v1.1 (2026-11-23):** Settled N1 on **Q16.16 positions** (signed 32-bit, 16.16). Map bounds are held to ±8,192 range units per axis, which fits Q16.16's ±32,768 integer range with 4× headroom; data outside is rejected as `badMapBounds`. Added N1a: distance-squared and cross products MUST NOT be computed in int32 Q16.16 (8,192² overflows); a documented safe approach is required (a coarser shift, or a two-limb 64-bit helper without BigInt), pinned by a golden-vector test. Asked the Engine Lead to confirm the dist² approach. **(Closed in v1.2:** the Engine Lead recorded the exact-i64 approach, including cross and dot products, in [sim-core N1a](https://github.com/danielsegan/sfc2.js/blob/078f02e/docs/engine/sim-core.md#n1a-distance-squared) at `078f02e`.) Removed the obsolete mixed Q24.8×Q16.16 helper wording; velocities stay Q16.16. Repo name and links updated to [`danielsegan/sfc2.js`](https://github.com/danielsegan/sfc2.js). Follows the #53 squash merge (`a4bb10a`).
- **Draft v1.0 (2026-11-23):** Initial contract, merged as [#53](https://github.com/danielsegan/sfc2.js/pull/53) (`a4bb10a`).

**Status tags used below**
- **AGREED** / **Agreed (Engine Lead, 2026-11-23)**: agreed with the Engine Lead. Daniel still has final say on anything the plan lists as open.
- **OPEN**: open question (see §10) or a pending Engine Lead architecture call.

Requirement keywords: **MUST** (CI fails or the PR is rejected) and **SHOULD** (a reviewer must approve any deviation). Each requirement ID ends with how it is **verified**.

## 0. Basis in the plan

These are quoted from `docs/plan.md` (main, blob 536ef9f) and `engine/README.md`:
- Architecture: "The sim core never reads the clock or random numbers directly: a seeded RNG and fixed ticks make it replayable and lockstep-ready from day one."
- "Rendering, UI and audio only read sim state, so the same sim runs headless for AI training, tests and servers."
- Inputs reach the sim from three sources: "Mission runtime ──events──► Sim core / AI ──orders──► Sim core / Netcode ──inputs──► Sim core".
- Risk register, *Determinism for multiplayer (High)*: "Fixed timestep, seeded RNG, integer or WASM math in the sim, replay hash checks in CI from Phase 2."
- Roadmap: the Phase 2 exit criteria include "deterministic replay passes". The Phase 7 exit is "Six-player match without desync".
- Repo rule: "Tests use synthetic fixtures, and real-data tests run only on the private CI VM against the local install."
- `plan.md` initially listed the language, reference game version and project name as open decisions for Daniel. Those are now decided: **TypeScript**; the reference build is *Star Fleet Command 2* **Community Edition 2.670** ([#37](https://github.com/danielsegan/sfc2.js/issues/37); also recorded in `docs/plan.md`), which supersedes the earlier Empires at War 2.036 + unofficial 2.037 baseline; and the project name is **SFC2.js**.

Clean-room: everything here is original design. Any behaviour reference comes only from the sources `docs/LEGAL.md` allows.

## 1. Scope and boundary

"Sim packages" means the sim core, the combat rules, AI, the mission runtime and the shared math/RNG/hash core. In the Engine Lead's architecture draft v0.2.1 (which follows the plan layout) that is `engine/{core,sim,combat,ai,mission,conquest}`. Lint globs follow the final layout (**AGREED** in substance). The exact sub-folders are **OPEN**: an Engine Lead architecture call that will land via a PR updating `docs/plan.md`.

| ID | Requirement | Verified by |
|---|---|---|
| B1 MUST | Sim packages import nothing from render, UI, audio, net transport, DOM, Web Audio, `fetch`/WebSocket/WebRTC or three.js. They may import only other sim packages and the read-only game database. | dependency-cruiser / `import/no-restricted-paths` in CI; the headless Node test run (no DOM globals) |
| B2 MUST | The sim can run in a Worker. Only command bytes go in and only snapshots and `SimEvent[]` come out, with no shared mutable references. **AGREED** | A test runs the golden replay inside a Worker and its hashes equal the main-thread run |
| B3 MUST | Render, UI and audio read snapshots and events only and never write sim state. Audio picks sound variants with a cosmetic RNG, never a sim stream. **AGREED** | Snapshots are frozen or copied at the boundary; a lint rule bans sim-internal imports in those packages |
| B4 MUST | The sim is 2D (x, y, heading). Height and bank are applied in render only. **AGREED** | Component schema review; no z field in any sim component |

## 2. Fixed timestep (AGREED unless tagged)

| ID | Requirement | Verified by |
|---|---|---|
| T1 MUST | Sim rate is **30 Hz**. `step()` takes no dt. All rates in sim units are per tick. | API shape; unit test that `step` has no time parameter |
| T2 MUST | Game speed means more ticks per real second, never a larger dt. Pause means zero ticks. A speed change never touches sim state. | Golden test: the same replay at 1x/2x/4x driver speed produces an identical hash sequence |
| T3 MUST | No `Date`, `performance.now`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `queueMicrotask`, `async`/`await`/Promises or event-loop dependence in sim packages. Mission timers count in sim ticks (see the stream table in §3). | Lint (§9.2) |
| T4 MUST | The driver (outside the sim) uses an accumulator: `acc += min(frameDt, 250 ms) * speed`, then steps while `acc >= TICK` and `session.canAdvance(tick+1)`, then `alpha = acc / TICK`. It caps the number of ticks per frame (at most 8; **Agreed (Engine Lead, 2026-11-23)**) to avoid a spiral of death. | Driver unit test with a fake clock |
| T5 MUST | Render interpolates `prev` to `curr` render snapshots by `alpha`, read-only, and never extrapolates. Angles interpolate along the shortest arc in BAM. | Render unit test; B3 |

## 3. Seeded RNG (AGREED unless tagged)

| ID | Requirement | Verified by |
|---|---|---|
| R1 MUST | The algorithm is **xoshiro128\*\*** on four uint32 words, using only `Math.imul`, shifts, `^`, `|` and `>>> 0`. | Golden vectors (below); a port test against the public-domain reference C implementation |
| R2 MUST | Named, forkable streams: `combat`, `ai` and `mission`. Adding a roll in one stream never shifts another. Further streams are added by name, and a new stream never changes the seeds of existing ones. | Test: inserting an extra `ai` draw leaves the `combat` draw sequence unchanged |
| R3 MUST | **Agreed (Engine Lead, 2026-11-23)**: stream seed = SplitMix32 expansion of `xxHash32(matchSeed ‖ utf8(streamName))`, with an all-zero state remapped to a fixed constant. | Golden vectors per stream |
| R4 MUST | All stream states are part of sim state, snapshots, saves and the state hash (§7), serialized in a fixed stream-name order. | Save/load round-trip test (S3) |
| R5 MUST | `Math.random` is banned in sim packages. Cosmetic randomness (particles, audio variants) uses a separate RNG that sim packages cannot import. | Lint; B1 |
| R6 MUST | Draws are integer-only: `u32()`, `int(n)` (unbiased by rejection), `dice(k, sides)` and `chance(numer, denom)`. No floats in [0,1). | Unit tests with golden outputs; an unbiasedness test for `int(n)` |
| R7 MUST | Draw order and draw count depend only on sim state and commands: fixed phase order, entity-id iteration, and no dependence on camera, LOD, frame rate or audio. | Golden replay; cross-speed test (T2) |

**Reserved stream names (registry)**

| Stream | Purpose |
|---|---|
| `combat` | To-hit, damage, damage allocation and every other combat-rules roll. Only combat systems draw from it. |
| `ai` | AI captain and fleet decisions (target choice, tactics tie-breaks). Only AI systems draw from it. |
| `mission` | Mission and campaign script randomness (spawn variants, event choices). Mission timers count in **sim ticks**, never wall time (requested by the Mission & Campaign Designer). |

| ID | Requirement | Verified by |
|---|---|---|
| R8 MUST | Any new stream name needs an entry in this table, added in the same PR, with its purpose and owning role. | A test that loads the registry and fails when `fork()` is called with an unregistered name (it throws in dev and test builds), plus a lint rule that requires `fork()` arguments to be string literals from the registry |

Golden vector (reference C and the JS `Math.imul` port agree; generated 2026-11-23): state `{1,2,3,4}` → `0x00002d00, 0x00000000, 0x005a7080, 0x04389d80, 0x79199d9b, 0x61963b24`.

## 4. Numeric policy (AGREED unless tagged)

**Decision: fixed-point integers. No fractional values anywhere in sim state or intermediates.** JS `number` is used only to carry integers. Every intermediate MUST be an exact integer with |x| ≤ 2^53 and is normalized to int32/uint32 at op boundaries.

*Why not restricted float64:* IEEE `+ - * /` and `Math.sqrt` are exactly specified, so "careful float" can work. But one stray transcendental call, a reordered reduction, or a WASM/Rust port that fuses or reorders operations causes desyncs that are hard to find. Integers make the rule mechanical and lintable, and they port bit-for-bit to WASM. SFC2 entity counts are small enough that the cost doesn't matter. The plan's risk line ("integer or WASM math") allows this choice.

| ID | Requirement | Verified by |
|---|---|---|
| N1 MUST | Formats: positions use **Q16.16 in signed int32** (16.16; representable range ±32,768 range units at 1/65536 resolution). Velocities and fractions stay **Q16.16**. The studio holds **map bounds to ±8,192 range units per axis**, which fits the Q16.16 integer range with **4× headroom** (8,192 × 4 = 32,768). Map data (and any authored position that enters the sim) outside that box is rejected as `badMapBounds`. This scale is **settled** (studio decision, reported by the Producer, 2026-11-23). | Type/brand checks in `fx`; property tests for range; a data-layer test that extents and positions outside ±8,192 fail with `badMapBounds` and in-range values are accepted |
| N1a MUST | Distance-squared, cross products (`dx1·dy2 − dy1·dx2`) and dot products (`dx1·dx2 + dy1·dy2`) MUST NOT be computed as int32 Q16.16 multiplies. The settled path is the Engine Lead's exact-i64 rule in [sim-core N1a](https://github.com/danielsegan/sfc2.js/blob/078f02e/docs/engine/sim-core.md#n1a-distance-squared) (`078f02e`, #55). Form `dx` and `dy` in i32 (a per-axis difference is at most 2^30 and still fits signed i32, since 2^30 < 2^31). Then `d² = dx·dx + dy·dy` is an exact i64 (at most 2^61). Cross and dot products use the same exact-i64 approach (Engine Lead confirmed): each product term is at most 2^60, and the exact i64 result is at most 2^61. No floats, no pre-shift, and no rounding. The WASM sim-core hot path uses native i64. The TypeScript reference path uses a bit-identical 32-bit hi/lo split multiply via `Math.imul`. The result is an `I64` two-limb value and MUST NOT be stored as a JS `number` (it can exceed 2^53). BigInt is allowed in tests only, as a check against the limb helper [N3]. Range checks compare `d²` with a precomputed i64 `r²` via `fx.cmpI64` and MUST NOT take a square root. Where a distance itself is needed, take the floored integer square root `fx.isqrt64`. Combat arc checks use the sign of the cross product. Helpers live in `engine/core/fx.ts` and are recorded below. | Golden-vector table below (zero delta; corner-to-corner; single-axis Δ=16,384; off-by-one at a range boundary; cross-product signs, collinear 0, and opposite-sign operands; representative dots). WASM and TypeScript paths MUST hash identically on these fixtures |
| N2 MUST | `mul` and `div` round toward **−∞** (floor). A right shift of int32 is floor. `div(a,b) = floor(a·2^F / b)` for all sign combinations. WASM ports must implement floor explicitly: AssemblyScript (and Rust) integer `/` truncates toward zero. | Property tests (fast-check) against a BigInt reference, run in tests only |
| N3 MUST | No BigInt in hot paths. Wide products use a 16-bit hi/lo split so every partial product is exact below 2^53. | Lint ban on `BigInt` outside `*.test.*`; perf bench |
| N4 MUST | Angles are **uint16 BAM** (65536 per turn). `sin`/`cos` come from a committed LUT. `atan2` is integer (CORDIC or an octant LUT) and returns BAM. `sqrt` is integer floor isqrt. | Golden-vector tests; the LUT content hash is pinned in a test |
| N5 MUST | The LUT is generated offline by a tool and committed as integer source, never built at runtime with `Math.sin`. | Lint (N6); pinned table hash |
| N6 MUST | Banned in sim packages: `Math.sin/cos/tan/asin/acos/atan/atan2/sinh/cosh/tanh/exp/expm1/log*/pow/sqrt/cbrt/hypot/fround/random`, the `**` operator, raw `/` (use `fx.div`/`idiv`), non-integer numeric literals, `Float32Array`/`Float64Array`, `parseFloat`, `Intl` and `toLocale*`/`localeCompare`. | Lint (§9.2) |
| N7 MUST | **Agreed (Engine Lead, 2026-11-23)**: overflow saturates to the format's min/max (deterministic on every peer). Division by zero returns ±MAX by the sign of the numerator, and 0/0 = 0. **Dev builds also assert** on every saturation and divide by zero, and log the op, operands and tick. Release builds only saturate, so results are identical either way. | Unit tests at boundaries; a test that the dev assert fires and the release result equals the saturated value |
| N8 MUST | Game data enters the sim as integers. Decimal text from data files is converted with integer parsing (no `parseFloat`) in the data layer, and the converted tables feed `dataHash` (§8). | Parser tests on synthetic fixtures |

**N1a helpers** (in `engine/core/fx.ts`; names and `I64` format as in [sim-core N1a](https://github.com/danielsegan/sfc2.js/blob/078f02e/docs/engine/sim-core.md#n1a-distance-squared)). `fx.cross` and `fx.dot` are recorded here in the same style; sim-core.md at `078f02e` specified `distSq` / `delta` / `cmpI64` / `isqrt64` and forbade int32 Q16.16 cross products, and the Engine Lead later confirmed that cross and dot follow this same exact-i64 path.

```ts
// I64 is a signed i64 in two limbs (hi is signed int32, lo is uint32): value = hi * 2^32 + lo
interface I64 { hi: number; lo: number }
function delta(a: Fx, b: Fx): number;          // i32 raw difference; defined for in-bounds coords
function distSq(dx: number, dy: number): I64;  // exact dx*dx + dy*dy
function cross(dx1: number, dy1: number, dx2: number, dy2: number): I64; // exact dx1*dy2 - dy1*dx2
function dot(dx1: number, dy1: number, dx2: number, dy2: number): I64;   // exact dx1*dx2 + dy1*dy2
function cmpI64(a: I64, b: I64): number;       // -1 / 0 / 1; range checks use cmpI64(d2, r2)
function isqrt64(x: I64): number;              // floor sqrt of a non-negative i64
```

**N1a golden vectors** (Q16.16 positions; 1 range unit = 65,536 raw. Values computed with Python arbitrary-precision ints. Map corners in range units: SW = (−8,192, −8,192), SE = (8,192, −8,192), NE = (8,192, 8,192), NW = (−8,192, 8,192). Raw corner magnitude C = 8,192 × 65,536 = 536,870,912 = 2^29. Full-map delta D = 16,384 × 65,536 = 1,073,741,824 = 2^30. `I64` is shown as `{hi, lo}` with value = hi·2^32 + lo. Hex is 64-bit two's complement.)

`fx.distSq` (raw Q16.16 inputs, exact i64 `d²`, floored `isqrt64`):

| Case | p0 raw (x, y) | p1 raw (x, y) | dx, dy | d² decimal | d² hex | I64 `{hi, lo}` | isqrt64 |
|---|---|---|---|---|---|---|---|
| Zero delta | (0, 0) | (0, 0) | (0, 0) | 0 | `0x0000000000000000` | {0, 0} | 0 |
| Corner-to-corner, SW→NE | (−536870912, −536870912) | (536870912, 536870912) | (1073741824, 1073741824) | 2305843009213693952 | `0x2000000000000000` | {536870912, 0} | 1518500249 |
| Single-axis Δ=16,384, (−8192, 0)→(8192, 0) | (−536870912, 0) | (536870912, 0) | (1073741824, 0) | 1152921504606846976 | `0x1000000000000000` | {268435456, 0} | 1073741824 |

Off-by-one at a range boundary, with precomputed `r²` for `r_raw = 3` (3/65,536 range units; `r² = 9`). Integer range-unit radii do not yield an `r² − 1` that is a sum of two squares (checked for 1…500), so this fixture uses a raw radius of 3. `fx.cmpI64(d², r²)` is −1, 0 or +1.

| Case | p0 raw (x, y) | p1 raw (x, y) | dx, dy | d² decimal | d² hex | I64 `{hi, lo}` | isqrt64 | cmpI64(d², r²) |
|---|---|---|---|---|---|---|---|---|
| d² = r² | (0, 0) | (3, 0) | (3, 0) | 9 | `0x0000000000000009` | {0, 9} | 3 | 0 |
| d² = r² − 1 | (0, 0) | (2, 2) | (2, 2) | 8 | `0x0000000000000008` | {0, 8} | 2 | −1 |
| d² = r² + 1 | (0, 0) | (3, 1) | (3, 1) | 10 | `0x000000000000000a` | {0, 10} | 3 | +1 |

`fx.cross` (combat arc checks use the sign). Operands are i32 differences of in-bounds corners.

| Case | u = (dx1, dy1), from → to | v = (dx2, dy2), from → to | cross decimal | cross hex | I64 `{hi, lo}` | sign |
|---|---|---|---|---|---|---|
| Positive, SW→SE × SW→NW | (1073741824, 0) | (0, 1073741824) | 1152921504606846976 | `0x1000000000000000` | {268435456, 0} | + |
| Negative, SW→NW × SW→SE | (0, 1073741824) | (1073741824, 0) | −1152921504606846976 | `0xf000000000000000` | {−268435456, 0} | − |
| Collinear, SW→NE × SW→origin | (1073741824, 1073741824) | (536870912, 536870912) | 0 | `0x0000000000000000` | {0, 0} | 0 |
| Collinear axis, SW→SE × SW→(0, −8192) | (1073741824, 0) | (536870912, 0) | 0 | `0x0000000000000000` | {0, 0} | 0 |
| Opposite signs, NW→SE × SW→NE | (1073741824, −1073741824) | (1073741824, 1073741824) | 2305843009213693952 | `0x2000000000000000` | {536870912, 0} | + |
| Opposite signs, NE→SW × SE→NW | (−1073741824, −1073741824) | (−1073741824, 1073741824) | −2305843009213693952 | `0xe000000000000000` | {−536870912, 0} | − |

`fx.dot` (same exact-i64 path and operands):

| Case | u = (dx1, dy1) | v = (dx2, dy2) | dot decimal | dot hex | I64 `{hi, lo}` |
|---|---|---|---|---|---|
| Perpendicular, SW→SE · SW→NW | (1073741824, 0) | (0, 1073741824) | 0 | `0x0000000000000000` | {0, 0} |
| Parallel, SW→SE · SW→SE | (1073741824, 0) | (1073741824, 0) | 1152921504606846976 | `0x1000000000000000` | {268435456, 0} |
| Opposite signs, NW→SE · SW→NE (also perpendicular) | (1073741824, −1073741824) | (1073741824, 1073741824) | 0 | `0x0000000000000000` | {0, 0} |
| Opposite signs, NW→SE · NW→SE | (1073741824, −1073741824) | (1073741824, −1073741824) | 2305843009213693952 | `0x2000000000000000` | {536870912, 0} |
| Opposite signs, NW→SE · SE→NW | (1073741824, −1073741824) | (−1073741824, 1073741824) | −2305843009213693952 | `0xe000000000000000` | {−536870912, 0} |

**Iteration-order hazards (MUST):** canonical state lives in typed-array ECS tables indexed by entity id (§5). `for…in`, `Object.keys/values/entries` iteration and integer-like object keys are banned in sim code. `Map`/`Set` may serve as transient lookup indexes but MUST NOT be iterated where the result affects state, and are never hashed. Every `sort` takes a total-order comparator that breaks ties on entity id (lint bans comparator-less `sort`). `WeakMap`, `WeakRef`, `FinalizationRegistry` and any GC or timing dependence are banned. *Verified by:* lint, plus an order-independence test (C5).

## 5. State model (AGREED)

| ID | Requirement | Verified by |
|---|---|---|
| S1 MUST | State lives in an in-house SoA ECS on typed arrays. Entity ids are dense, with generations (index + generation). The allocator (generations and free list) is part of the state and the hash. | Allocator unit tests; the hash includes the allocator |
| S2 MUST | Systems run in an engine-owned fixed phase order: **input → AI/mission → energy → movement → weapons → damage → cleanup**. Roles register systems into a phase. Order within a phase is an explicit priority with a tie-break on system id, never import order. | Phase registry test that snapshots the resolved order |
| S3 MUST | Save/load = snapshot + all RNG stream states (+ pending commands and mission state). Snapshot at tick k, restore, and continue: the hash sequence MUST equal the uninterrupted run. | Round-trip golden test in CI |
| S4 MUST | Mission and AI state lives in components or a blackboard, never in closures, so it is serializable and hashed. | S3 test with a mission timer active |

## 6. Command stream (AGREED unless tagged)

| ID | Requirement | Verified by |
|---|---|---|
| C1 MUST | Commands are the only external input. Each has an envelope `{tick, slot, seq, kind}` plus a payload. The Engine Lead owns the envelope; the Combat Systems Designer owns the verbs. | Codec tests |
| C2 MUST | Canonical order is **(tick, slot, seq)**, never arrival order. `seq` is monotonic **per slot within a tick** and resets to 0 at each tick. So (tick, slot, seq) stays unique, a u16 `seq` is ample within one tick, and it can never wrap in a long match. | C5 shuffle test; codec rejects a duplicate (tick, slot, seq) |
| C3 MUST | Binary encoding, little-endian, versioned. **Agreed (Engine Lead, 2026-11-23)** layout: `u32 tick, u8 slot, u16 seq, u8 kind, u16 len, payload`, where `seq` is the per-tick counter from C2. | Round-trip and fuzz tests on the codec; a test that `seq` restarts at 0 each tick |
| C4 MUST | AI and mission scripts run **inside** the sim, use only their own sim RNG streams, and only *emit* commands. **Agreed (Engine Lead, 2026-11-23)**: commands emitted during tick T apply in T+1's input phase, from reserved slots (AI captains 8–15, mission 255). They are **regenerated on replay**, not logged. Mission requests (e.g. `requestSpawn`, `requestObjective`) are commands on slot 255. | Replay with AI-vs-AI produces the same hashes from an empty player log |
| C5 MUST | Shuffling the arrival order of a tick's commands does not change the hash. | CI test |
| C6 MUST | Lockstep: local commands are stamped `tick = current + inputDelay`. A peer sends a (possibly empty) command bundle for every tick, and the sim advances only when all slots' bundles for that tick are present. **Agreed (Engine Lead, 2026-11-23)**: default delay of 3 ticks (100 ms), with a host setting of 2–4. | Net simulator tests with latency and loss injection |
| C7 MUST | Single-player uses the same session interface with delay 0, so **every game is a replay**. | SP game export → replay → identical final hash |
| C8 MUST | A replay is the header `{replayFormat, versionHash (§8), seed, settings, slots, initial scenario/snapshot}` plus the command log, with an optional hash track. | Replay golden test |

## 7. Checksums and desync detection

| ID | Requirement | Verified by |
|---|---|---|
| H1 MUST | The hash input is the **canonical serialization of full sim state**: tick, RNG streams in name order, allocator, and each component table in registry order for live entities in **ascending entity id**, with every field as LE int32. Never object or Map iteration order. **AGREED** | Test: two worlds built through different insertion paths with equal state have equal hashes |
| H2 MUST | **Agreed (Engine Lead, 2026-11-23)**: the hash function is **xxHash32** (imul-friendly, trivial to port), computed over the full serialization each hashed tick. That costs a few KB at Phase 3 counts, so it isn't incremental. | Golden vectors for the hash; perf bench ≤ 0.3 ms per hash |
| H3 MUST | Cadence: **every tick** in tests and replays. **Agreed (Engine Lead, 2026-11-23)**: in MP, peers exchange `(tick, hash)` every 10 ticks. | Config test |
| H4 MUST | On mismatch, each peer keeps a ring of the last 64 snapshots (about 2.1 s at 30 Hz; **Agreed (Engine Lead, 2026-11-23)**). Peers find the first divergent tick by exchanging per-tick hashes for the window, dump both states at that tick, and write a desync report (entity, component, field, both values) plus the replay file. Reports stay local; uploading them is a later decision. | Injected-fault test: a deliberate one-field divergence is reported at the correct tick and field |
| H5 MUST | Any WASM port (AssemblyScript per the plan, pending the Engine Lead's plan PR) reproduces the TS hashes bit for bit on the replay corpus. **AGREED** | CI gate once any WASM sim code exists |
| H6 MUST | **Agreed (Engine Lead, 2026-11-23)**: golden tests also hash the `SimEvent` stream, so audio- and render-visible divergence is caught. | Golden file includes the event hash track |

## 8. Versioning

| ID | Requirement | Verified by |
|---|---|---|
| V1 MUST | The version hash always combines **both** parts, never either one alone (**Agreed (Engine Lead, 2026-11-23)**). `simSourceHash` = xxHash32 over the sim-package sources, in sorted path order as `utf8(path) ‖ 0x00 ‖ fileBytes` per file, so doc-only commits don't break replays. The commit SHA is kept for diagnostics only. `dataHash` = xxHash32 over the canonical converted game database, so a modded shiplist changes it. Combined: `versionHash = xxHash32("sfc2-ver\0" ‖ u32le(replayFormat) ‖ u32le(simSourceHash) ‖ u32le(dataHash))`. Replays, saves and the lobby store the two parts as well as the combined value, so a mismatch can say which part differs. | Tests: changing one ship stat changes `dataHash` and `versionHash`; changing one sim source line changes `simSourceHash` and `versionHash`; a docs change changes neither; the combine function has golden vectors |
| V2 MUST | The lobby handshake compares `versionHash` and refuses to start a match on mismatch, naming the mismatching table. A replay plays only on a matching `versionHash`. | Lobby integration test; replay loader test |
| V3 MUST | The reference game build is **Community Edition 2.670** ([#37](https://github.com/danielsegan/sfc2.js/issues/37); Daniel). It affects only `dataHash` and the real-data hash runs, never this contract. | `dataHash` is recorded in every private real-data run log |
| V4 MUST | Re-baselining golden hashes requires a `determinism-change` label, an explanation in the PR, and review by the Netcode QA Lead and the Engine Lead. | CODEOWNERS on golden files |

A file that defines a `SimSystem`, a `CommandHandler`, or a `TableSpec` lives under `engine/sim` or `engine/core`. Those trees are what `simSourceHash` covers, tests excluded. A definition in `engine/duel`, `engine/view`, `engine/driver`, `engine/net`, or `web` would let two peers disagree on match behavior while still reporting the same `versionHash`. `tools/check-sim-home.mjs` fails the lint when one appears outside those trees. Synthetic scripts under `engine/replay/scenarios` are the exception: they are not the lockstep sim, and `scenarioHash` stamps them (replay.md).

## 9. Verification plan (exit criterion for #21)

#21 is done when all of the following pass on `main`:
1. **Unit/golden:** PRNG vectors, per-stream fork vectors, `fx` property tests (N1, N1a, N2, N7), N1a dist²/cross/dot golden vectors, LUT/atan2/isqrt vectors, hash vectors and codec round-trip/fuzz.
2. **Lint:** ESLint (typescript-eslint) on sim packages with `no-restricted-globals`, `no-restricted-properties` and `no-restricted-syntax` covering everything in T3, R5, N3, N6 and the iteration-order list, plus custom rules for non-integer literals, raw `/` and comparator-less `sort`. CI fails on violations, and a fixture file of known violations proves each rule fires.
3. **Isolation:** dependency rules (B1) and a headless Node run with no DOM.
4. **Replay golden:** a corpus of scripted scenarios using **synthetic, test-authored ships and data only** (no original game data in the repo, per the plan and the no-game-files CI check). Each runs N ticks, and the full per-tick hash sequence plus the event hash must match the committed golden.
5. **Cross-runtime:** the same corpus runs in Node (Vitest) and in Playwright **Chromium, Firefox and WebKit**, and all hash sequences are identical. Tooling: pnpm monorepo, Vite, Vitest, Playwright (**AGREED**).
6. **Invariance:** game-speed (T2), Worker vs main thread (B2), command shuffle (C5), save/load round-trip (S3) and SP export-as-replay (C7).
7. **Private real-data hash job (separate, supports #25):** the same harness runs on Wintermute's private runner **`sfc2-ci`** (`runs-on: [self-hosted, sfc2-ci]`) against the local install. Replays and dumps stay on the VM. Committing hash-only summaries is **OPEN** for Producer/legal review. It is not a public-CI gate.

## 10. Open questions

**Engine Lead**
1. *(N1 and N1a settled, 2026-11-24.)* Positions are Q16.16; map bounds are ±8,192 range units per axis, with `badMapBounds` outside. Dist², cross products and dot products use the Engine Lead's exact-i64 path in [sim-core N1a](https://github.com/danielsegan/sfc2.js/blob/078f02e/docs/engine/sim-core.md#n1a-distance-squared) (`078f02e`, #55): i32 differences (per-axis |Δ| ≤ 2^30), exact i64 result (≤ 2^61), no floats, no pre-shift, no rounding; WASM native i64; TypeScript a bit-identical `Math.imul` split; BigInt in tests only. Cross and dot products are included (Engine Lead confirmed). Helpers: `fx.delta`, `fx.distSq`, `fx.cross`, `fx.dot`, `fx.cmpI64`, `fx.isqrt64`.
2. 64-bit replay hashes: should replay files (and the final-state check) carry a 64-bit hash alongside the per-tick xxHash32? Not needed for Phase 2.
3. *(Resolved.)* Mission API: architecture draft v0.2.1 has an emit-only `MissionHost`, where `requestSpawn`/`requestObjective` are commands on slot 255 (C4). The plan's diagram arrow "Mission runtime ──events──► Sim core" should be read as commands.
4. Free-list policy (FIFO/LIFO) and the maximum generation before an id is retired.
5. Worker transport (structured clone vs SAB; COOP/COEP headers from day one).
6. LUT size and precision (e.g. a 4096-entry quarter wave in Q1.15 or Q16.16).

**Combat Systems Designer**
1. Which rule timings (recharge, energy allocation periods, seeking-weapon movement, any impulse-style subdivision) must be exact tick counts at 30 Hz, and are any of them non-integer at that rate?
2. Fractional rule quantities (for example fractional energy costs): is energy Q16.16 or integer sub-units?
3. Dice model: are all to-hit and damage rolls expressible as `dice`/`chance` with integer tables? Canonical resolution order when several weapons fire in one tick (proposed: by firing ship id, then mount index).
4. Confirm the 2D sim and continuous range/arcs (BAM) rather than hex-based ones.

**Daniel:** none open for this contract. TypeScript, Community Edition 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)) and SFC2.js are decided (§0).

**Engine Lead architecture calls (open here; they will land via a PR that updates `docs/plan.md`):** the WASM language (the plan says AssemblyScript; draft v0.2.1 adopts AssemblyScript and withdraws Rust) and the exact `engine/` sub-folder layout that the lint and dependency globs target.

## 11. Known hazard register

The single tracked list of known determinism hazards is [determinism-hazards.md](determinism-hazards.md). Each row has a status (`mitigated` or `open`), the guard (lint rule, test, or golden vector, with its path), and the gap that guard does not close. ADR 0001 states why the policy in this contract is lockstep-safe and links that register. Adding a hazard, or changing a status, is an edit to that file in the same PR as the guard.
