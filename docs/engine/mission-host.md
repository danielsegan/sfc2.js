# Mission host contract

Status: **Draft, Engine Lead, Nov 23 2026.** Supports [#21](https://github.com/danielsegan/sfc2.js/issues/21). This is the engine side of [`docs/missions/mission-api.md`](../missions/mission-api.md) (PR #1), and it replaces that doc's "pending the mission-runtime contract in `docs/engine/`" notes. Baseline **CE 2.670** per [#37](https://github.com/danielsegan/sfc2.js/issues/37). Package: `engine/mission`.

The Mission & Campaign Designer owns the API surface (ships, teams, AI orders, objectives, text). This doc fixes how that API touches the sim. Clean room: the API is modelled on Taldren's *published* Mission API and released mission sources only.

## 1. Emit-only

Missions **never mutate sim state**. Every call that changes the world queues a command on **slot 255** and returns a token. Results come back as events. The plan's "Mission runtime ──events──► Sim core" arrow is implemented as commands (determinism.md C4, §10 Q3).

| Tick | What happens |
| --- | --- |
| T (AI/mission phase) | Handlers run and call `requestSpawn(...)`, which returns `SpawnToken`. A slot-255 command is queued with `seq` in issue order |
| T+1 (input phase) | The command applies after all player and AI slots (order (tick, slot, seq)). The ship takes the **lowest free index with a bumped generation** from the shared allocator (sim-core.md §5). The sim emits `spawned { token, entityId }` or `ruleResult { status: 'rejected' }` |
| T+2 (AI/mission phase) | The mission receives tick T+1's events in emission order and can use the entity from now on |

Mission handlers always see the **previous tick's events**. The same delay applies to every command, so `requestSpawn` → `spawned` is T → T+2, matching mission-api.md §4.3.

- `map.place(...)` works the same way and yields `placed { token, objectId }`. **Ships, fighters, PFs and map objects share one allocator**, and `placed` is in the **same tick-ordered event stream** as `spawned`.
- Mission `mapBounds` are whole range units, and each axis must lie within **±8,192** range units (sim-core.md §2). Otherwise the host emits `badMapBounds` with `source: "mission"` and severity `error` (diagnostics.md; same rule as merged PR #52).
- `requestObjective(...)` (the `objectives.add/set` family) is a slot-255 command. Its outcome is a `ruleResult` plus the UI event `objectiveUpdated`.
- **`ruleResult { token, status: 'applied' | 'clamped' | 'rejected', reason, appliedValue }`** is emitted in the tick the command is applied, for every token-returning call that doesn't have its own result event. Rejection never throws. Reason codes are stable strings from Combat's list in `docs/rules/`.
- Slot-255 commands are **regenerated on replay, not logged** (determinism.md C4). This answers mission-api.md §15 QA Q3.

```ts
type CommandToken = number;                 // per mission run, issue order, part of mission state
type MissionEvent =
  | { kind: 'spawned'; token: CommandToken; entityId: EntityId }
  | { kind: 'placed'; token: CommandToken; objectId: EntityId }
  | { kind: 'ruleResult'; token: CommandToken; status: 'applied' | 'clamped' | 'rejected'; reason: string; appliedValue?: number }
  | SimEvent;                               // destroyed, damaged, timers, … (shared SimEvent union)

interface MissionHost {
  load(module: MissionModule, start: StartContext): void;     // runs in the sandbox
  runTick(ctx: TickContext, prevEvents: readonly MissionEvent[]): void; // AI/mission phase; queues via ctx.queue
  serialize(): Uint8Array;                                    // tokens, timers, triggers, vars (S4)
}
```

## 2. Sandbox

- The mission runs **on the sim thread, synchronously, inside the AI/mission phase**. There is no Worker and nothing async.
- **SES-style isolation:** `lockdown()` hardens the intrinsics, and each mission runs in a `Compartment` whose only endowments are the API objects. No DOM, network, storage, clocks, `Math.random`, dynamic `import` or string `eval`.
- **Determinism:** mission randomness only comes from `ctx.rng('mission')`. Mission timers count in ticks. Mission state lives in host-owned serializable storage, never in closures (determinism.md S4). Whether one `mission` stream is shared or forked per mission instance (`mission:<missionId>`, registered per R8) is **OPEN**. The proposal is one stream per running mission.
- Fixed-point types exposed to scripts (`Fx` helpers such as `km()` and `deg()` vs plain ints), and whether floats are forbidden in mission code, are **OPEN** (mission-api.md §15 Engine Q4).

## 3. Operation budget

- The budget counts **operations, never time**, so every peer hits the limit at exactly the same point.
- Proposal: count **instrumented API calls** (each read or command = 1) plus **loop back-edges and function entries** via a source transform applied once at load, so the count is identical everywhere. The default budget per tick is **TBD by benchmark** (**OPEN**).
- **Dev builds:** an overrun stops the mission with a report (tick, handler, count).
- **Release builds: TBD by the Audio & Netcode QA Lead.** The engine's only constraint is that the behaviour is deterministic and identical on every peer.
- Resource caps (entities spawned, timers, commands per tick, message length) are counted the same way.

## 4. Read-only query API

- Every getter (`ships.get`, `teams.ships`, `map.distance`, …) is a **read-only query over the current tick's live state**. There is no copied snapshot. Values reflect the state after the input phase of the current tick.
- Results that are lists come back in **ascending entity-id order**. Views are frozen, and mutating one throws in dev builds.
- Queries cost budget like any other operation.

```ts
interface MissionQuery {
  ship(id: EntityId): ShipView | undefined;          // undefined if the id is dead or its generation is stale
  shipsOfTeam(team: TeamId): readonly EntityId[];    // ascending id
  distance(a: EntityId, b: EntityId): Fx;
  classIdOf(spawnKey: string): ClassId | undefined;  // data-loader.md §5
}
```

## 5. Unverified / open

- Event ordering inside one tick (proposal: emission order, which follows phase order and then entity id; mission-api.md §15 Engine Q2).
- How operations are counted, the default budget, and release-build overrun behaviour (QA Lead).
- The "game turn" tick length for porting Taldren turn timers (Combat). `TICKS_PER_TURN = seconds * 30` must be integral once Combat gives the length in seconds (sim-core.md §1).
- Which build the Taldren-released mission sources match (EAW-era vs CE-era). CE 2.670 is now on `sfc2-ci`, but nobody has compared the two yet (**UNVERIFIED**).

## Deviations from plan.md (#8)

- The plan's arrow says missions send *events* to the sim. Here they send **commands** on slot 255 and receive events (agreed, see §1).
- The plan says "sandboxed JS". This doc specifies TypeScript-authored missions, compiled with erasable-only stripping, running in an SES Compartment (TS decided).
