# Sim core contract

Status: **Draft, Engine Lead, Nov 23 2026.** Implements [#21](https://github.com/danielsegan/sfc2.js/issues/21). Baseline CE 2.670 per [#37](https://github.com/danielsegan/sfc2.js/issues/37). This doc only touches the baseline through `dataHash`.

**[determinism.md](determinism.md) is normative.** Requirement IDs in brackets (e.g. [T4]) point there. This doc gives the engine-side shapes and fills the gaps that doc leaves to the Engine Lead. Packages: `engine/core`, `engine/sim`.

## 1. Tick and driver

- **30 Hz fixed tick** [T1]. `step()` takes no dt. Every rate is per tick, and 1 s = 30 ticks.
- The driver lives outside the sim and owns the only clock read: `acc += min(frameDt, 250 ms) * speed`. It then calls `step()` while `acc >= TICK_MS` and `session.canAdvance(tick+1)`, **at most 8 ticks per frame**. Leftover time is dropped, not banked. `alpha = acc / TICK_MS` goes to the view only [T4, T5].
- Game speed means more ticks per second, and pause means zero ticks [T2]. **No wall clock, timers, async or event loop inside sim packages** [T3].
- **Rules turn length** is given in seconds by Combat. `TICKS_PER_TURN = seconds * 30` and **must be integral**.

```ts
interface Sim {
  readonly tick: Tick;
  step(commands: readonly Command[]): StepResult; // commands already sorted (tick, slot, seq) for this.tick+1
  snapshot(): Snapshot;                            // frozen copy; render/view/audio read only
  restore(s: Snapshot): void;
  stateHash(): u32;                                // §8
}
interface StepResult { tick: Tick; events: readonly SimEvent[]; hash?: u32 }
```

## 2. Numbers (`engine/core/fx.ts`)

- **Fixed-point integers only** [N1–N8]. `type Fx = number & { readonly __fx: unique symbol }`.
- **Committed scale:** `FX_SHIFT = 16` (16.16). `1.0` in this format is **one range unit**. This matches [determinism.md](determinism.md) N1, settled on `main` by QA PR #56 (`d74ab2c`). The choice follows the CE 2.670 aggregate bounds: max speed 32, max shield 480, max per-facing shield 80; every numeric column is an integer except Move Cost, which has two decimal places. Those bounds fit 16.16 after the rules scale factors are applied. A single `FX_SHIFT` is used for positions and for other fixed-point quantities in this core.
- **Position differences and squared distances** follow [N1a](#n1a-distance-squared) below. They are never computed as int32 Q16.16 multiplies.
- **Map bounds.** A mission's `mapBounds` are whole range units. Each axis must lie within **±8,192** range units. A value outside that range, or a non-integer, is the mission diagnostic `badMapBounds` (`source: "mission"`; [diagnostics.md](diagnostics.md)). This is the same rule as merged PR #52. A range of 75 that appears in fixtures is test context only; it is not a weapon-range rule and not a map limit.
- **Decimal data columns** (Move Cost in hundredths; BPV at its per-column scale) are parsed from text to a scaled integer, never through a float. Overflow of the column scale is `badNumber`. Details live in [data-loader.md](data-loader.md).
- `mul`/`div` round with **floor** (toward −∞) [N2]. Wide products use a 16-bit hi/lo split, never BigInt in hot paths [N3].
- **Overflow saturates** to the format's min/max [N7].
- **Division by zero:** `x/0 = +MAX` if x > 0, `−MAX` if x < 0, and `0/0 = 0` [N7]. Dev builds assert and log op, operands and tick. Release builds only saturate, so results match.
- **Integer sqrt:** `isqrt` of a uint32 is floor. Distance uses a floored integer sqrt of the i64 `d²` ([N1a](#n1a-distance-squared)).

```ts
export const FX_SHIFT = 16;           // 16.16; 1.0 = one range unit
export function fx(i: number): Fx;        // integer -> Fx
export function mul(a: Fx, b: Fx): Fx;    // floor, saturating
export function div(a: Fx, b: Fx): Fx;    // floor, saturating, div-by-zero rule above
export function isqrt(x: number): number; // floor sqrt of a uint32
```

### N1a: distance squared

This records the Engine Lead's approach for [determinism.md](determinism.md) **N1** and **N1a** (QA PR #56, `d74ab2c` on `main`). N1a forbids computing distance-squared or a cross product as an int32 Q16.16 multiply; this section specifies the safe path. It is option (1) in N1a: a 64-bit result with no BigInt in hot paths, not a pre-shift to a coarser scale.

**Bounds.** Inside the settled map box (±8,192 range units per axis, N1 / §2), a Q16.16 raw coordinate satisfies `|raw| ≤ 2^29`. A per-axis difference is at most `2^30` (the corner-to-corner case) and still fits in signed i32 (`2^30 < 2^31`). Each square is at most `2^60`. The 2-axis sum is at most `2^61` and fits in signed i64; a 3-axis sum would too.

**Compute.** Form `dx` and `dy` in i32, then `d² = dx·dx + dy·dy` as an exact i64. No floats, no pre-shift, and no rounding.

**Paths.** The WASM sim-core hot path uses native i64. The TypeScript reference path uses a 32-bit split multiply (hi/lo limbs via `Math.imul`) and must be bit-identical to the WASM result. `d²` is not stored as a JS `number` (the value can exceed `2^53`). BigInt is allowed in tests only, as a check against the limb helper [N3].

**Range checks** compare `d²` to a precomputed i64 `r²`. They do not take a square root. Where a distance itself is needed, take the floored integer square root of that i64.

**Required fixtures:** corner-to-corner worst case (`±8,192` on both axes), zero, and off-by-one at a range boundary. The WASM and TypeScript paths must hash identically on these.

```ts
// d2 is a signed i64 in two limbs (hi is signed int32, lo is uint32): value = hi * 2^32 + lo
interface I64 { hi: number; lo: number }
function delta(a: Fx, b: Fx): number;          // i32 raw difference; defined for in-bounds coords
function distSq(dx: number, dy: number): I64;  // exact dx*dx + dy*dy
function cmpI64(a: I64, b: I64): number;       // -1 / 0 / 1; range checks use cmpI64(d2, r2)
function isqrt64(x: I64): number;              // floor sqrt of a non-negative i64
```

## 3. Angles (`engine/core/angle.ts`)

- `type Angle16 = number & { __a16 }`: uint16 BAM, 65536 per turn, wrapping with `& 0xffff` [N4].
- `sin16`/`cos16` come from a **committed integer LUT** generated offline. Its content hash is pinned in a test [N5]. LUT size and precision are **OPEN** (§10 Q6; proposal: a 4096-entry quarter wave).
- `atan2_16(y, x): Angle16` is integer (octant LUT or CORDIC). Shield facings and weapon arcs are ranges on this circle. The arc-code mapping is Combat's table in `docs/rules/` (**UNVERIFIED** until real CE codes are seen).

## 4. RNG (`engine/core/rng.ts`)

- **xoshiro128\*\*** over 4×u32 [R1]. Draws are integer only: `u32()`, `int(n)` (unbiased by rejection), `dice(k, sides)` and `chance(num, den)` [R6].
- **Named streams** [R2, R8]: `combat`, `ai` and `mission`, from the registry in determinism.md §3. Seeding [R3]:
  `state = SplitMix32_expand(xxHash32(matchSeed ‖ utf8(streamName)))`, which yields four words. An all-zero state is remapped to a fixed constant.
- Stream states belong to sim state, snapshots and the hash, in stream-name order [R4]. Cosmetic RNG lives outside sim packages [R5].

```ts
interface RngStreams { stream(name: RegisteredStream): StreamRng } // throws in dev/test on an unregistered name
interface StreamRng { u32(): number; int(n: number): number; dice(k: number, sides: number): number; chance(num: number, den: number): boolean }
```

## 5. State: SoA ECS (`engine/sim/world.ts`)

- In-house **structure-of-arrays ECS on typed arrays**, with component tables indexed by entity index [S1]. No Map/Set/object iteration affects state (determinism.md §4 hazards).
- **EntityId = index + generation**, packed as `index | (gen << 16)` (proposal: 16-bit index, 16-bit generation; **OPEN**: max generation and the retire rule, determinism.md §10 Q4).
- **Allocation: lowest free index**, with the generation bumped on reuse. This is neither FIFO nor LIFO, so it answers §10 Q4's free-list question and leaves only the generation cap open. **One allocator is shared by ships, fighters, PFs and map objects** (planets, bases, mines, markers that need ids), plus seeking weapons. The allocator (generations and free bitmap) is hashed state [S1].
- Spawned entities appear in the input phase of the tick that applies the spawn command. A despawn is deferred to `cleanup`, and the index becomes free from the next tick on, so an id never changes meaning mid-tick.
- **System keys** in sim state are lowercase singular (e.g. `lab`, not `labs`).

```ts
type EntityId = number & { __eid };
interface Allocator { alloc(): EntityId; free(id: EntityId): void; isLive(id: EntityId): boolean } // lowest free index
type EntityKind = 'ship' | 'fighter' | 'mapObject' | 'seeker'; // PFs are 'ship' with class 'pf' (data-loader.md)
```

## 6. Phase order

Fixed, engine-owned [S2]:

**input → AI/mission → energy → movement → weapons → damage → cleanup**

| Phase | Does | Owner |
| --- | --- | --- |
| input | Apply this tick's commands in (tick, slot, seq) order: player slots, AI 8–15, mission 255 | Engine (verbs: Combat) |
| AI/mission | AI captains and the mission host read state and emit commands for T+1 | Combat / Missions |
| energy | Allocation, batteries, charging | Combat |
| movement | Speed, turn modes, positions | Combat |
| weapons | Fire resolution in a canonical order (proposal: firing ship id, then slotIndex; **OPEN** with Combat) | Combat |
| damage | Shields, allocation, damage chart | Combat |
| cleanup | Despawns, free indices, event finalization, hash | Engine |

Within a phase, systems run by explicit priority, with ties broken by system id and never by import order.

```ts
type Phase = 'input' | 'aiMission' | 'energy' | 'movement' | 'weapons' | 'damage' | 'cleanup';
interface SimSystem { id: string; phase: Phase; priority: number; step(w: World, ctx: TickContext): void }
interface TickContext { tick: Tick; rng: RngStreams; db: GameDatabase; emit(e: SimEvent): void; queue(cmd: CommandBody): void /* AI/mission only, applies T+1 */ }
```

## 7. Commands and sessions (`engine/core/codec.ts`, `engine/net`)

Envelope, little-endian, versioned [C1–C3]:

| Field | Type | Notes |
| --- | --- | --- |
| tick | u32 | The tick it applies in |
| slot | u8 | 0–5 players. **8–15 AI captains. 255 mission.** Others reserved |
| seq | u16 | **Resets to 0 each tick, per slot.** (tick, slot, seq) is unique |
| kind | u8 | Verb id (Combat owns the verb table) |
| len | u16 | Payload byte length |
| payload | bytes | Verb-specific |

- **Canonical order is (tick, slot, seq)**, never arrival order [C2, C5]. The codec rejects duplicates.
- **AI (slots 8–15) and the mission (slot 255) run inside the sim.** Commands they emit in tick T apply in T+1's input phase. They are **regenerated on replay, not logged** [C4].
- **Input delay 3 ticks** by default, and the host may set 2–4. Local commands are stamped `current + delay` [C6].
- **Single-player uses the same session interface** (`LocalSession`, delay 0), so every game is a replay [C7].

```ts
interface Command { tick: Tick; slot: number; seq: number; kind: number; payload: Uint8Array }
interface Session {
  readonly localSlot: number; readonly inputDelay: number;
  issue(kind: number, payload: Uint8Array): void;  // session stamps tick/slot/seq
  canAdvance(tick: Tick): boolean;
  commandsFor(tick: Tick): readonly Command[];     // sorted (tick, slot, seq)
  reportHash(tick: Tick, hash: number): void;
}
```

## 8. Hashing, snapshots, versioning

- **State hash:** xxHash32 over the canonical serialization: tick, RNG streams in name order, the allocator, then each component table in registry order for live entities in **ascending entity id**, with fields as LE int32 [H1, H2].
- **Cadence:** every tick in tests and replays, and **every 10 ticks in MP** [H3]. Golden tests also hash the `SimEvent` stream [H6].
- **64-snapshot ring** (about 2.1 s) on every peer, used for desync bisection and reports [H4]. The same ring backs save/load [S3].
- **Version hash = sim-source hash + game-data hash**, always both: `versionHash = xxHash32("sfc2-ver\0" ‖ u32le(replayFormat) ‖ u32le(simSourceHash) ‖ u32le(dataHash))` [V1]. `dataHash` comes from the data loader (data-loader.md §6). A mismatch refuses MP and replay, and names which part differs [V2].

## 9. Unverified / open

- LUT size and precision. Max generation and the retire rule.
- Weapon fire order within a tick, and rule timings at 30 Hz (Combat, determinism.md §10).
- Worker transport (structured clone vs SAB). Snapshots are already copy-safe [B2].

## Deviations from plan.md (#8)

- None at the behaviour level. plan.md's "integer or WASM math" allows fixed-point. The `engine/core` and `engine/sim` split is the layout proposal under #8. The plan's "mission runtime ──events──►" arrow is implemented as commands on slot 255.
