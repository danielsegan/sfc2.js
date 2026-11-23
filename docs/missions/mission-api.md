# SFC2.js Mission API design (draft)

Status: **draft for review**. Owner: Mission & Campaign Designer. Milestone: Phase 4 (Missions).
This is a design doc only. No runtime code lands before Phase 4.

> **Clean-room note.** This doc was written from Taldren's publicly released SFC2:EAW Mission API
> (API Release 1.3) and its publicly released EAW mission sources, the FMSE 1.0 manual, `docs/plan.md`,
> `docs/LEGAL.md`, and community sites (listed in [Sources](#sources)). It was **not** written from, and
> does not cite, the SFC2-decomp project or any other decompilation. Taldren identifiers appear only as
> short names in mapping tables. No Taldren code is copied here, and no game files are committed.

> **Decisions this doc follows (made by Daniel):** the project is named **SFC2.js** (the repo name and
> paths now use `sfc2.js`; the repo was renamed from `sfc2-browser-edition`); the language is **TypeScript**; the reference game for mission and
> campaign content is **SFC2 Community Edition (CE) 2.670** ([#37](https://github.com/danielsegan/sfc2.js/issues/37)) (this replaced an earlier EAW 2.036 + 2.037
> baseline); the HUD models the SFC2 HUD. **Still open:** whether studio bots use Cursor
> cloud agents (nothing here depends on it). **Out of scope:** the standalone *Orion Pirates* game (2001)
> and its content, which sits in [Possible later](#16-possible-later-backlog).

> **Data verification status: unverified.** CE 2.670 ([#37](https://github.com/danielsegan/sfc2.js/issues/37)) is now installed on the `sfc2-ci` VM
> (without the 2.679 patch), but the mission roster hasn't been checked against it yet; that waits on a
> manifest-based check. Every claim in this doc about the mission list, the empire
> roster, Orion content, or any game behaviour that depends on installed data is **unverified** until it
> has been checked against the CE 2.670 install on `sfc2-ci`. Taldren's released EAW Scripting API R1.3 and
> EAW mission sources remain valid **API and design references**; claims about them are verified against
> those archives only, which are not the same thing as the CE 2.670 install.

---

## 1. Goals and non-goals

### Goals

1. **Run every original campaign and mission type (as CE 2.670 ships them) in SFC2.js** (campaign, unique campaign, tutorial,
   historical, skirmish and multiplayer scripts) on a new, sandboxed, deterministic mission runtime.
2. **Mirror Taldren's Mission API concepts closely enough that porting is mechanical.** The risk register
   entry is "Mission API shim that mirrors Taldren's, port one campaign end to end before scaling". The
   port of one mission should be a near line-by-line translation of *behaviour*, not a redesign.
3. **Deterministic by construction.** Missions run on sim ticks, read only sim state, draw randomness only
   from a named seeded stream, and never see wall-clock time. A mission plus a seed plus an input log must
   replay bit-identically, which is what lockstep multiplayer (Phase 7) and replay tests need.
4. **Safe to load third-party missions.** The mission API is the modding surface (Phase 8). A mission is
   untrusted code with no DOM, network, storage or clock access.
5. **Authorable without code** for the common cases: a data-first scenario format that an FMSE-style
   editor can read and write, with script hooks for the cases data can't express.
6. **A clean handoff to campaigns and Conquest.** Missions report a result (victory level, prestige, flags,
   fleet state) and never own persistence themselves.

### Non-goals

- Running original `.scr` binaries. They are Win32 DLLs built with MSVC 6 and can't run in a browser
  (see section 2). We don't emulate them.
- Shipping Taldren's mission text, maps or scripts. Ported missions read the player's own files where
  the content lives in game data, and any script we write is original code (see section 8, legal).
- Designing combat rules, AI captain behaviour or the HUD. Those belong to Combat, Engine and UI. This API
  only issues orders and reads state through their interfaces.
- Defining the engine's internal hook points. Those belong to the Engine Lead (section 5.1).
- Orion Pirates (the standalone 2001 game): its campaigns, missions, factions and API are out of scope
  (see section 16, Possible later). This is separate from the Orion faction inside EAW (section 10).

---

## 2. How SFC2 missions worked originally

What follows is **observed** in Taldren's public SFC2:EAW API Release 1.3 (readme dated 2 July 2002) and
the public EAW mission sources. They are used as API and design references. Our reference build is
**CE 2.670** ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). **Not verified:** how closely CE 2.670's missions, campaigns and behaviour still match what
API R1.3 and the released EAW sources describe. That gets checked against the CE 2.670 install on
`sfc2-ci` before porting starts. Where something is inferred rather than read directly, it says so.

### 2.1 Build and packaging

- Each mission is a C++ project built with **Microsoft Visual C++ 6.0 SP5** against Taldren's headers and
  static libraries. The API readme requires VC6 SP5; the community build guide on klingon.lostexiles.net
  warns that SP6 and newer compilers break builds.
- The output is a `.scr` file in the game's scripts folder: a Win32 module the game loads at mission start.
  The API ships an entry interface (`tScriptEntry`) with pure virtual methods such as create, initialize,
  begin mission, entity events, map reading and briefing text. Callbacks into the host for ship creation,
  messages and random numbers are passed in as function pointers.
- The API ships three templates: a bare-bones script, a single-player campaign script and a multiplayer
  script (`Tem_Standard`, `Tem_Single`, `Tem_Multi`), plus two Visual Studio add-ins for generating script
  and object boilerplate.
- A separate SFC:OP API (R2.2) exists for Orion Pirates. Orion Pirates is out of scope, so we have
  **not** reviewed it.

**Why that can't run in the browser:** the `.scr` is native x86 code compiled against the game's own
memory layout and host callbacks. A browser can't load it, and emulating it would mean emulating the host,
which is exactly what clean-room rules keep us away from. So we port the *behaviour* to a new runtime.

### 2.2 Object model (observed)

Taldren's API is an **actor/state-machine** design:

| Concept | Observed identifier(s) | What it does |
| --- | --- | --- |
| Script root | `tScript` (an actor) | Mission entry: specs, initialize, create ships, briefings, start mission |
| Mission spec | `tMissionSpec`, `mScriptSpecs` | Static metadata: title, file name, mission type, player/enemy race masks, team slots, maps, terrain |
| Mission type | `eMissionTypes` | Campaign, unique campaign, tutorial, technical, historical, multiplayer, skirmish (and variants) |
| Start info | `tDynaverseScriptInfo`, `mInitializeStart` | What the campaign/meta layer passes in: player race and team, allied and enemy races, date, sector, player fleet, previous victory level |
| Actor | `tActor` | Base for script, teams, ships and victory conditions; owns states and timers; receives ship events |
| State | `tState`, `mGotoState`, `mBeginState`, `mEndState` | One state of an actor's state machine; event handlers are virtual methods on the state |
| Team | `tTeamInfo`, `mSetupTeam`, `mCreateShipsForTeam` | Team id, race, human or AI, tag; creates its ships; schedules the next mission |
| Ship | `tShipInfo` | Per-ship handle with AI orders, status, systems, stores, comm buttons |
| Mission services | `tMissionInfo` | Team relations, goal indicators, map queries, messages, debriefing, map objects, sounds, career totals, scheduling, Dynaverse adjustments |
| Events | `tEventMgr`, `iNotifyEvents` bitmask | Ships opt into callbacks (death, capture, disengage, at distance, at destination, timer, comm button, damage, scan, orbit, tractor, transport, stores, systems, player leaving, host changed, ...) |
| Timers | `mSetTimedInterval`, `eTimerIntervalTypes` | Timers in **game turns** or **seconds** (float), plus on-screen countdowns and end-of-game pause |
| Victory | `tVictoryCondition`, `tVictoryState`, `mCalcVictoryStatus` | Per-team victory evaluation into `eVictoryLevels` |
| Victory levels | `eVictoryLevels` | Astounding victory, victory, draw, defeat, devastating defeat (plus bonus prestige) |
| Prestige | `mGetPrestigePoints`, `mGetBonusPrestige` | Prestige awarded per victory level |
| Campaign handoff | `tMissionScheduler`, `mScheduleNextMission` | Victory level, prestige, bonus prestige, next mission title and score, medal, campaign event (retire / lost) |
| Relations | `eTeamRelationship`, `eTargetGoals` | Allied, friendly, neutral, hostile, at war; goals ignore, cripple, capture, destroy |
| Races | `eRaceName` | In the API R1.3 headers, Federation, Klingon, Romulan, Lyran, Hydran, Gorn, ISC, Mirak are playable races; Orion and Monster are NPC races. How this shows up in CE 2.670 data is **unverified** |
| Map objects | `eMapObjectType`, `mCreateMapObject`, `mAddMapIcon` | Nebula, black hole, fissure, Organian, pulsar, wormhole, sun, planet, asteroid, dust cloud, bases, ship start and end points |
| Maps | `MissionMaps.cpp`, `mGetNextMapLine`, `mASCIIOverrides` | Maps defined as ASCII grids with a character legend (start points, end points, planet types, asteroids, black holes, ...) |
| Text | `MissionText.cpp`, `mDefineBriefings`, `mDisplayMessage`, `mAddToDebriefingList` | Briefings per race, in-mission messages, debriefings |
| Dynaverse | `mAdjustDynaverse`, `eDynaverseTableType` | Missions can nudge strategic tables (economy, government stability, ...) |
| Randomness | `cbRandom(lo, hi)` callback, `mGetRandomBitValue` | Random numbers come from the **host**, not from the C runtime (observed in the entry callbacks) |

### 2.3 How a mission is laid out (observed)

A typical campaign mission folder (for example the Mirak campaign mission `Mir_2Dance`) has one root
script class, then a team class and a ship class per side, each with its own base state class, plus a
victory class and victory state, a `MissionMaps.cpp` with the ASCII map and legend, and a `MissionText.cpp`
with briefings and messages. Map-object behaviour (a pulsar, a minefield team) is modelled as teams or
ships with their own states.

The public EAW source tree has folders for `ISC`, `Mirak`, `Meta` (generic missions like patrol, convoy
raid and escort, base assault and defense, monster, scan), `Unique`, `Bonus`, `Historical`, `Multiplayer`,
`Skirmish`, `Tutorial`, `Template` and a few others. **Inferred, not verified:** the Federation, Klingon,
Romulan, Lyran, Hydran and Gorn campaigns appear to be mostly built from the generic `Meta` missions plus
`Unique` story missions, while the expansion empires (ISC, Mirak) have their own folders. This whole
inventory is **unverified**: it comes from the released EAW source archive, not from the CE 2.670 install,
and has to be checked against CE 2.670 on `sfc2-ci` before Phase 5 is estimated.

### 2.4 FMSE (observed from its manual)

FMSE is the community **Fleet Mission Script Editor** (v1.0302, patch 1.0303) by Remus and Heavens Eagle.
(The task brief called it "Fantasy Mission Scripting Engine"; the manual and download sites call it Fleet
Mission Script Editor.) From the FMSE 1.0 manual:

- No C++ needed. The author fills in a main window: mission title (which is also the file name), which
  races can play it, up to 6 teams of up to 6 ships, team relations and AI goals, maps, mission text,
  multiplayer settings and victory conditions.
- **Build Script** writes both a compiled `.scr` into the scripts folder and an editable `.fms` project file.
- Maps are grids of 10 km cells (20x20 small, 30x30 medium, 40x40 large; FMSE 1.0 tops out at 30x30). It
  warns about "planet crash" when a planet is placed too close to another object.
- Victory conditions are preset types built on destroyed / captured / disengaged, from "To The Death" up to
  "Calculated" (BPV-based). In the non-calculated types the player is always team 1 and a capture target is
  always team 2.
- Mission text covers random chatter, briefing, start message, victory messages and race-flavoured
  debriefings.
- Ships can be picked from the ship list or by BPV budget.

FMSE shows what most community missions need: teams, relations, a map, text and a preset victory rule.
That's the shape of our data-first format (section 9).

---

## 3. What we replace it with

```
Scenario (JSON + schema)    ─┐
                             ├─► Mission runtime (sandbox) ──commands──► Sim core (fixed tick)
Mission script (TypeScript) ─┘          ▲                                      │
                                        └───────── events + read-only queries ◄─┘
                                                       │
Campaign layer ◄── MissionResult (victory, prestige, flags, fleet) ──┘
```

- A **scenario** is data: teams, races, ships by shiplist id, map, text keys, victory preset. Most FMSE-era
  missions should fit entirely in data.
- A **mission script** is optional code that handles events and issues commands for anything data can't
  express. It mirrors Taldren's actor/state model so a port reads like the original.
- The **mission runtime** hosts both in a sandbox on the sim thread, feeds it events once per tick, and
  turns its calls into **commands** the sim applies in the next tick's input phase (4.3). That matches the plan's architecture:
  "Mission runtime ──events──► Sim core".
- The **campaign layer** (outside the mission) owns persistence, picks the next mission and passes in a
  start context, the equivalent of `tDynaverseScriptInfo`.

---

## 4. Runtime model

### 4.1 Determinism contract (provisional)

These are the Engine Lead's working answers, **provisional until `docs/engine/sim-core.md` (planned) lands**.
This doc will be updated to match whatever that contract finally says.

| Rule | Working answer | What it means for missions |
| --- | --- | --- |
| Tick rate | Fixed **30 Hz** | Mission time is a tick count. 1 second = 30 ticks |
| Numbers | Fixed-point everywhere in the sim, **no floats** | Positions, distances, damage and timers are fixed-point or integer values; the API never hands a mission a float |
| Distance | One swappable unit constant (scale to be fixed in `docs/engine/sim-core.md`, planned) | Missions use named helpers (`km(10)`, `cells(3)`) rather than raw numbers, so the unit can change |
| Headings | `uint16`, 65536 per full circle | Facing values are integers; helpers like `deg(90)` convert at authoring time |
| Randomness | Named seeded streams, e.g. `ctx.rng("combat").int(min, max)`; never `Math.random` | Missions get their **own stream**, `ctx.rng("mission")`, so mission rolls never shift combat rolls |

Taldren timers took a float number of seconds or game turns. We convert at port time: a 30-second timer
becomes 900 ticks. Taldren's "game turn" unit needs an exact tick length, which is an open question for
Combat (section 15).

Missions must not:

- read `Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame` or any clock;
- call `Math.random`, or use any other unseeded randomness;
- iterate over anything whose order isn't defined (object keys from untrusted sources, `Set`/`Map` built in
  nondeterministic order). The API returns arrays in a stable order (by entity id);
- do floating-point maths that feeds back into commands. The API helpers stay in fixed-point. If missions
  are allowed floats for local scratch work, the result must be quantized before it reaches a command.
  (Whether to forbid floats in mission code outright is an open question.)

### 4.2 Sandbox

Mission code runs **on the sim thread, synchronously inside the AI/mission phase of each tick**, with
SES-style isolation (a locked-down realm and a Compartment whose only globals are the ones we pass in).
There is **no Web Worker** (Engine Lead, pending the mission-runtime contract in `docs/engine/`). The earlier Worker proposal is dropped. The same setup runs in the
browser, the Tauri shell and on headless servers.

- No DOM, network (`fetch`, `WebSocket`), storage (`localStorage`, IndexedDB), dynamic `import`, `eval` of
  strings, or clocks. Lockdown also freezes intrinsics, so a mission can't patch `Array.prototype` behind
  other code's back.
- Each tick the runtime calls the mission's handlers for that tick's events, then `tick` if the mission
  asked for it. Handlers read through the query API (6.2) and write by queuing commands (4.3). Nothing
  crosses a thread or message channel.
- **Budget.** The per-tick budget counts **operations or API calls, never wall-clock time**, so it is the
  same on every machine (Engine Lead, pending the mission-runtime contract in `docs/engine/`). Going over it is an **error in dev builds, never a silent skip**: the dev
  build stops the mission with a report naming the tick and handler. **Release builds:** the only engine
  requirement is that the budget counts operations, so every peer hits the limit at the same point (Engine
  Lead). The release behaviour (for example, abort that handler for the tick and log it) is the Audio &
  Netcode QA Lead's call, but it must be deterministic and nothing may vary by machine (open question,
  section 15).
- How operations are counted (instrumented API calls only, or a transform that also counts loop
  iterations) is part of the Engine Lead's contract.

### 4.3 Commands, not mutations

Missions never mutate sim state directly. Every API call that changes the world queues a command, for
example `{ t: "spawnShip", team, ship: { race, className }, at, facing, tag, token }`. The ordering rule (Engine Lead, pending the mission-runtime contract in `docs/engine/`):

- Commands a script issues during tick **T** apply in tick **T+1's input phase**.
- Mission commands use **command slot 255** and are sorted by **(tick, slot, seq)**, so they apply **after
  all player slots** for that tick. `seq` is the order the mission issued them in.

That gives:

- a single, loggable stream that replays exactly;
- the same path for single player, lockstep multiplayer (every peer runs the mission and must produce the
  same commands) and host-authoritative servers;
- an easy place to validate and reject bad commands (unknown ship class, off-map position).

**Combat state goes through the rules module** (Combat Systems Designer, pending the rules spec in `docs/rules/`, backlog #24). Missions call the **same rules entry points as
weapons and the player**, queued like any command and applied in the next tick's input phase. They never
edit ship state directly, and the mission runtime owns no combat logic.

| Command | Rules behaviour |
| --- | --- |
| `damageSystem(ship, system, boxes)` | Goes through normal damage allocation, so armor and the damage chart apply |
| `damageShield(ship, facing, points)` | Takes points off one shield facing (`facing` is an index 0 to 5, see 6.5) |
| `repairSystem(ship, system, boxes)` | Capped at the ship's original box count |
| `setShields(ship, facing, value)` | Clamped to the ship data |
| `setEnergy(ship, allocation)` | Clamped to the ship data |
| AI orders (6.6) | Go through the AI captain's order queue, not straight into movement |

**Every command returns a token, and results come back as events.** That covers every call that changes
the sim (ships, AI orders, teams, map objects, objectives, text and UI output). Mission-local bookkeeping
that never reaches the sim (timers, triggers, campaign variables, the state-machine layer) returns plain
ids or nothing. Nothing comes back to the script right
away. On the next tick after a command is applied, the sim emits a `ruleResult` event with the command
token, a status of `applied`, `clamped` or `rejected`, a reason code (for example `noSuchSystem`,
`shipDestroyed`, `outOfRange`) and the value actually applied, in `appliedValue`. **Rejection never throws.** Reason codes
are stable strings so they can double as localization keys (6.12).

**Spawning is token-based** (Engine Lead, pending the mission-runtime contract in `docs/engine/`). `ships.requestSpawn(...)` returns a **spawn token**, not an entity id.
When the sim applies the spawn (in T+1's input phase) it takes the **lowest free entity index with a
bumped generation**. On the following tick the mission receives a `spawned { token, entityId }` event and
can use the ship from then on. Entity ids never depend on script timing. In short: request in T, applied
in T+1, `spawned` delivered in T+2.

**Map objects use the same allocator** (Engine Lead, pending the mission-runtime contract in
`docs/engine/`). `map.place(...)` also returns a token. When the sim applies it, the object takes the
lowest free index with a generation bump from the **same allocator as ships**, and the `placed { token,
objectId }` event is emitted in the **same tick-ordered event stream** as `spawned`, so replays stay
identical.

---

## 5. Lifecycle

```
load ─► validate ─► setup ─► briefing ─► start ─► running (per-tick + events) ─► end ─► scoring ─► teardown
```

| Stage | What happens | Taldren analogue (observed) |
| --- | --- | --- |
| **load** | Read scenario data and script module; check API version | `tScriptEntry`, `mValidateVersion` |
| **validate** | Check shiplist ids, races, map bounds, text keys against the player's imported data; fail early with a readable report | (no direct analogue) |
| **setup** | `onSetup(ctx, start)`: build teams, relations, map objects and ships from the start context | `mScriptSpecs`, `mInitializeStart`, `mSetupTeam`, `mCreateShipsForTeam` |
| **briefing** | Show briefing text by player race; nothing ticks yet | `mDefineBriefings`, `mBriefingText` |
| **start** | `onStart(ctx)` at tick 0 of the battle | `mStartMission`, `mBeginMission` |
| **running** | Inside the AI/mission phase of each tick: events dispatched in deterministic order, then `onTick(ctx)` if the mission asked for it | `tState` handlers, `mOnTimedInterval` |
| **end** | Mission calls `ctx.end(...)` or the victory preset fires; the end pause runs in ticks | `mCheckForMissionEnd`, `kTimerEndGamePause` |
| **scoring** | Victory level per team, prestige, bonus prestige, debriefing lines, campaign flags | `mCalcVictoryStatus`, `mGetPrestigePoints`, `tMissionScheduler` |
| **teardown** | Drop timers and handlers, freeze the result, destroy the sandbox | `mCleanUpActors` |

### 5.1 Engine hook points

These wait on the Engine Lead's mission-runtime contract in `docs/engine/`, which isn't on `main` yet
(sim core work is backlog #21; architecture changes go through decision issue #8). Four
now have working answers from the Engine Lead, pending that contract; the rest are still placeholders. When
the contract lands, this section gets replaced by a link and the names change to match.

| Hook | Status | Answer or what's needed |
| --- | --- | --- |
| `ENGINE_HOOK: tickPhase` | Answered (Engine Lead, pending the mission-runtime contract in `docs/engine/`) | Script runs in the AI/mission phase of tick T; its commands apply in T+1's input phase, slot 255, sorted by (tick, slot, seq) after all player slots (4.3) |
| `ENGINE_HOOK: sandbox` | Answered (Engine Lead, pending the mission-runtime contract in `docs/engine/`) | Same thread, synchronous, SES-style isolation, no Worker; budget counts operations or calls, never wall-clock time; overrun is an error in dev builds (4.2) |
| `ENGINE_HOOK: entityIds` | Answered (Engine Lead, pending the mission-runtime contract in `docs/engine/`) | `requestSpawn` and `map.place` return tokens; ships and map objects share one allocator (lowest free index with a bumped generation); `spawned {token, entityId}` and `placed {token, objectId}` arrive the next tick in the same tick-ordered event stream (4.3) |
| `ENGINE_HOOK: missionView` | Answered (Engine Lead, pending the mission-runtime contract in `docs/engine/`) | Read-only query API over the current tick's state, iterated in entity-id order; no copied snapshot (6.2) |
| `ENGINE_HOOK: eventSource` | Placeholder | How sim events (death, damage, capture, disengage, proximity, orbit, tractor, transport, system and stores changes) reach the mission, and in what order |
| `ENGINE_HOOK: rulesEntryPoints` | Answered (Combat Systems Designer, pending the rules spec in `docs/rules/`, backlog #24) | Same entry points as weapons and the player; `damageSystem`, `damageShield`, `repairSystem`, `setShields`, `setEnergy`, AI orders via the captain's order queue; results arrive as `ruleResult` events (4.3) |
| `ENGINE_HOOK: rngStreams` | Placeholder | How `ctx.rng("mission")` is seeded and isolated from other streams |
| `ENGINE_HOOK: frameEvents` | Placeholder (with UI) | The engine's per-frame event list that carries typed UI events such as `objectiveUpdated`, `missionTimer` and `hail` (6.10) |
| `ENGINE_HOOK: audioCue` | Placeholder | How a mission requests a sound or voice line (with Audio) |

---

## 6. API surface sketches (our proposal)

Everything in this section is **our proposal**, not Taldren's API. Names are illustrative and will change
to match the engine contract. SFC2.js is written in TypeScript, so these are TypeScript interfaces.

### 6.1 Module shape

```ts
// One mission = one module with a default export.
export default defineMission({
  apiVersion: 1,
  id: "example.patrol-ambush",          // stable id, used by campaigns and saves
  scenario: "./patrol-ambush.scenario.json",
  setup(ctx, start) { /* teams, ships, map, objectives */ },
  start(ctx) { /* timers, opening message */ },
  on: {
    shipDestroyed(ctx, e) {},
    timer(ctx, e) {},
  },
  tick: undefined,                       // opt-in per-tick hook; most missions use events and timers
  score(ctx, outcome) { /* prestige, flags, debrief */ },
});
```

### 6.2 Context

```ts
interface MissionContext {
  readonly tick: Tick;                    // integer tick count since start; 30 per second (provisional)
  readonly start: StartContext;           // what the campaign layer passed in (read-only)
  rng(stream: "mission"): Rng;            // the only randomness a mission gets
  teams: TeamApi;
  ships: ShipApi;
  map: MapApi;
  ai: AiApi;
  timers: TimerApi;
  triggers: TriggerApi;
  objectives: ObjectiveApi;
  text: TextApi;
  vars: CampaignVarsApi;
  state: StateMachineApi;                 // Taldren-style actor states (6.11)
  end(result: EndRequest): void;
  log(msg: string): void;                 // debug log; never affects sim state
}

interface Rng { int(min: number, max: number): number; chance(numerator: number, denominator: number): boolean; pick<T>(xs: readonly T[]): T; }
type Tick = number;                       // integer
```

**Reads** (Engine Lead, pending the mission-runtime contract in `docs/engine/`): every getter (`ships.get`, `teams.ships`, `map.distance`, ...) is a **read-only query over
the current tick's state**, not a copied snapshot. Anything that returns several entities iterates in
**entity-id order**. A mission sees state as of the start of its phase in the current tick, and its own
queued commands don't show up in reads until they've been applied.

### 6.3 Start context (campaign → mission)

```ts
interface StartContext {
  missionType: "campaign" | "uniqueCampaign" | "tutorial" | "historical" | "skirmish" | "multiplayer";
  playerEmpire: EmpireId;
  playerTeam: TeamId;
  alliedEmpires: EmpireId[];
  enemyEmpires: EmpireId[];
  playerFleet: FleetEntry[];              // ships the player brings, with damage/crew/stores state
  previousOutcome?: VictoryLevel;
  date?: { year: number; month?: number };
  location?: { sectorKey: string; systemKey?: string };
  difficulty: number;
  playerRank: number;
  vars: Readonly<Record<string, CampaignValue>>;   // campaign variables (6.10)
  seed: string;                            // for logging only; the mission never seeds anything itself
}
```

### 6.4 Teams and empires

```ts
type EmpireId = "federation" | "klingon" | "romulan" | "lyran" | "hydran" | "gorn" | "isc" | "mirak"
              | "orion" | "monster" | (string & {});   // open for mods; roster still to confirm (section 10)

interface TeamApi {
  create(def: { id: TeamId; empire: EmpireId; control: "human" | "ai"; tag?: string; name?: TextRef }): CommandToken;
  setRelation(a: TeamId, b: TeamId, rel: "allied" | "friendly" | "neutral" | "hostile" | "war",
              opts?: { goal?: "ignore" | "cripple" | "capture" | "destroy"; mutual?: boolean }): CommandToken;
  relation(a: TeamId, b: TeamId): Relation;
  ships(team: TeamId, filter?: ShipFilter): ShipHandle[];   // stable order by entity id
  status(team: TeamId): "active" | "defeated" | "disengaged" | "left";
}
```

### 6.5 Ships

Ships are spawned by a **ship key: race + short class name** from the CE 2.670 shiplist, written
`{ race, className }` (Asset & Formats decision, [PR #38](https://github.com/danielsegan/sfc2.js/pull/38)). The key comes from the player's own
`shiplist.txt` as parsed by the Asset & Formats parser and is validated at load. **Unverified:** that race +
short class name is unique across the whole CE 2.670 shiplist. The PR #38 checklist confirms this, and the
parser flags any duplicates as `duplicateClassKey` diagnostics. Spawning is token-based (4.3).

**Strings in files, integers in the sim** (Engine Lead, pending the `docs/engine/` contracts, #21 and
#37). At load, the loader converts each `{ race, className }` key to a **small integer class id**, assigned
in **sorted string order** so every peer gets the same mapping. The sim and replays store **only the
integer**; mission files and `requestSpawn` keep the string key. **Duplicate keys** are reported in the
load diagnostics and **block multiplayer sessions**. The diagnostic is `{ code: "duplicateClassKey",
source: "shiplist" }`, severity `error`, with the race, className and shiplist row numbers involved as
details. A related warning, `duplicateClassName` (same class name under different races, [PR #42](https://github.com/danielsegan/sfc2.js/pull/42)), is reported as
a warning only. Both are emitted by the shiplist parser (`source: "shiplist"`, rules V15 and V4 in
`docs/formats/shiplist.md`). Codes are stable camelCase and add-only; the single registry is the planned
`docs/engine/diagnostics.md` (Engine Lead).

**Shield facings** (studio convention, matching `docs/ui/hud-spec.md` in PR #39 and Combat's rules): the
engine model's `shields` is an array indexed **0 to 5, where 0 is the front facing and the indices go
clockwise**. Every mission API call that names a facing uses that index. (Star Fleet Battles numbers the
same facings #1 to #6; that numbering appears only in prose, never in the API.)

```ts
interface ShipApi {
  requestSpawn(def: {
    team: TeamId;
    ship: ShipKey;                         // { race, className } from the CE 2.670 shiplist (PR #38); validated at load
    at: MapPoint;                          // grid cell or fixed-point position
    facing?: Heading;                      // uint16, 65536 per circle (provisional)
    name?: TextRef;
    tag?: string;                          // mission-local id, like Taldren's custom ID
    crew?: CrewQuality;
    damage?: Partial<Record<SystemKey, Percent>>;   // integer percent
    stores?: Partial<StoresLoadout>;
    targetable?: boolean;
    playerControlled?: boolean;
  }): SpawnToken;                          // ship id arrives later in a `spawned { token, entityId }` event
  pickByBudget(def: { empire: EmpireId; bpv: number; roles?: ShipRole[] }): ShipKey[];  // FMSE "ships by BPV"
  byTag(tag: string): ShipHandle | undefined;   // resolves once the ship has spawned
  get(h: ShipHandle): ShipView;            // read-only query over this tick's state
  // Every command is queued (applied in T+1's input phase) and returns a token; the outcome arrives as a
  // `ruleResult` event on the following tick. Nothing throws on rejection.
  destroy(h: ShipHandle, opts?: { silent?: boolean }): CommandToken;
  setTeam(h: ShipHandle, team: TeamId): CommandToken;
  // Combat-state changes go through the rules module's entry points (4.3)
  damageSystem(h: ShipHandle, system: SystemKey, boxes: number): CommandToken;   // normal damage allocation
  damageShield(h: ShipHandle, facing: ShieldFacing, points: number): CommandToken; // facing 0-5, 0 = front, clockwise
  repairSystem(h: ShipHandle, system: SystemKey, boxes: number): CommandToken;   // capped at original boxes
  setShields(h: ShipHandle, facing: ShieldFacing, value: number): CommandToken;  // facing 0-5; clamped to ship data
  setEnergy(h: ShipHandle, allocation: Partial<EnergyAllocation>): CommandToken; // clamped to ship data
  addStores(h: ShipHandle, item: StoresItem, amount: number): CommandToken;
  setTargetable(h: ShipHandle, on: boolean): CommandToken;
}
type ShipKey = { race: string; className: string };   // race + short class name, CE 2.670 shiplist (PR #38)
type ShieldFacing = 0 | 1 | 2 | 3 | 4 | 5;               // index into the engine's shields array; 0 = front, clockwise
type CommandToken = number;                // unique per mission run, assigned in issue order
type SpawnToken = CommandToken;            // spawns use the same token sequence

interface ShipView {
  readonly id: ShipHandle; readonly team: TeamId; readonly originalTeam: TeamId; readonly empire: EmpireId;
  readonly ship: ShipKey; readonly bpv: number; readonly inPlay: boolean;
  readonly status: "active" | "destroyed" | "captured" | "disengaged";
  readonly position: MapPoint; readonly heading: Heading; readonly damagePercent: Percent;
  readonly alert: "green" | "yellow" | "red"; readonly cloaked: boolean;
}
```

### 6.6 AI orders

Missions give **orders**; how a captain carries them out is Combat's AI. Orders go through the rules
module's entry points like every other combat-state change (4.3). Priorities mirror the observed
`eAIPriority` idea.

```ts
interface AiApi {
  target(ship: ShipHandle, target: ShipHandle, priority?: Priority): CommandToken;
  clear(ship: ShipHandle): CommandToken;
  moveTo(ship: ShipHandle, at: MapPoint, priority?: Priority): CommandToken;
  patrol(ship: ShipHandle, points: MapPoint[], detectRange: Distance, priority?: Priority): CommandToken;
  defend(ship: ShipHandle, protectee: ShipHandle, threatRadius: Distance, followRadius: Distance, priority?: Priority): CommandToken;
  follow(ship: ShipHandle, leader: ShipHandle, priority?: Priority): CommandToken;
  disengage(ship: ShipHandle, method: "warp" | "mapEdge" | "any", priority?: Priority): CommandToken;
  tractor(ship: ShipHandle, target: ShipHandle, to: MapPoint, priority?: Priority): CommandToken;
  cloak(ship: ShipHandle, on: boolean): CommandToken;
  probe(ship: ShipHandle, target: ShipHandle): CommandToken;
  setControl(ship: ShipHandle, mode: "ai" | "player"): CommandToken;
  officer(ship: ShipHandle, officer: OfficerKey, aiEnabled: boolean): CommandToken;
}
type Priority = "low" | "normal" | "high" | "override";
// Orders are queued into the AI captain's order queue, not applied straight to movement (4.3).
```

### 6.7 Triggers and timers

Timers count **ticks**. Helpers convert seconds at authoring time, so `seconds(30)` is 900 ticks at 30 Hz.

```ts
interface TimerApi {
  after(ticks: Tick, id: string): TimerId;          // fires once -> on.timer({ id })
  every(ticks: Tick, id: string): TimerId;          // repeating
  cancel(id: TimerId): void;
  countdown(ticks: Tick, opts?: { label?: TextRef; team?: TeamId }): CommandToken;   // emits `missionTimer` UI events (6.10)
}

interface TriggerApi {
  // Proximity: fires on.proximity when a ship enters (or leaves) range of a point or entity.
  proximity(def: { id: string; ship: ShipHandle | ShipFilter; of: MapPoint | ShipHandle; range: Distance; edge?: "enter" | "leave" | "both" }): void;
  arrive(def: { id: string; ship: ShipHandle; at: MapPoint }): void;      // like Taldren's at-destination
  when(def: { id: string; every: Tick; test: (ctx: MissionContext) => boolean; once?: boolean }): void;  // polled predicate
  remove(id: string): void;
}

type MissionEvent =
  | { kind: "spawned"; token: SpawnToken; entityId: ShipHandle }
  | { kind: "placed"; token: CommandToken; objectId: MapObjectHandle }
  | { kind: "ruleResult"; token: CommandToken; status: "applied" | "clamped" | "rejected";
      reason?: RuleReason; appliedValue?: number }  // value actually applied (e.g. boxes, points)
  | { kind: "shipDestroyed"; ship: ShipHandle; by?: ShipHandle }
  | { kind: "shipCaptured"; ship: ShipHandle; by: TeamId }
  | { kind: "shipDisengaged"; ship: ShipHandle }
  | { kind: "shipDamaged"; ship: ShipHandle; by?: ShipHandle; severity: "light" | "heavy" | "critical" }
  | { kind: "proximity"; id: string; ship: ShipHandle; edge: "enter" | "leave" }
  | { kind: "arrived"; id: string; ship: ShipHandle }
  | { kind: "timer"; id: string }
  | { kind: "commButton"; ship: ShipHandle; button: string; target?: ShipHandle }
  | { kind: "scanned"; ship: ShipHandle; by: ShipHandle }
  | { kind: "orbit"; ship: ShipHandle; body: MapObjectHandle; edge: "begin" | "end" }
  | { kind: "tractor"; target: ShipHandle; by: ShipHandle; edge: "begin" | "end" }
  | { kind: "transported"; to: ShipHandle | MapObjectHandle; from: ShipHandle; item: StoresItem }
  | { kind: "systemChanged"; ship: ShipHandle; system: SystemKey; percent: Percent }
  | { kind: "storesChanged"; ship: ShipHandle; item: StoresItem; amount: number }
  | { kind: "playerLeft"; team: TeamId }
  | { kind: "objective"; id: string; state: ObjectiveState };
```

type RuleReason = "noSuchSystem" | "shipDestroyed" | "outOfRange" | (string & {});  // stable strings; full list in docs/rules/ (#24)

Event ordering within a tick (proposal): by event kind in a fixed table order, then by entity id, then by
issue order. The final rule belongs in the engine contract (`ENGINE_HOOK: eventSource`).

### 6.8 Map objects

```ts
interface MapApi {
  size(): { cols: number; rows: number };                   // grid cells
  cellSize(): Distance;                                      // FMSE documents 10 km per cell
  place(def:
    | { kind: "planet"; at: MapPoint; style: PlanetStyleKey; name?: TextRef }
    | { kind: "base"; at: MapPoint; team: TeamId; base: ShipKey }             // bases are shiplist entries
    | { kind: "asteroid"; at: MapPoint; size: "small" | "medium" | "large" }
    | { kind: "asteroidField"; area: MapArea; density: number }
    | { kind: "nebula"; area: MapArea }
    | { kind: "dustCloud"; area: MapArea }
    | { kind: "blackHole"; at: MapPoint; size: "small" | "large" }
    | { kind: "pulsar" | "sun" | "wormhole" | "fissure"; at: MapPoint }
    | { kind: "minefield"; area: MapArea; team: TeamId; mineType: MineKey; count: number }
    | { kind: "beacon"; at: MapPoint; label?: TextRef; visibleTo?: TeamId[] }
  ): CommandToken;                                   // id from the shared ship allocator; arrives in `placed { token, objectId }`
  remove(h: MapObjectHandle): CommandToken;
  distance(a: MapPoint | ShipHandle | MapObjectHandle, b: MapPoint | ShipHandle | MapObjectHandle): Distance;
  marker(team: TeamId, at: MapPoint | ShipHandle | null): CommandToken;   // goal indicator; null clears
  icon(kind: string, at: MapPoint): CommandToken;                          // map-screen icon
}
type MapPoint = { cell: [col: number, row: number] } | { pos: [x: Fixed, y: Fixed] };
```

Grid cells are 1-based in Taldren's API (noted in its headers). Proposal: **0-based** in ours, with the
porting guide calling out the off-by-one.

Static map layout should normally live in the scenario data, not in code (section 9).

### 6.9 Objectives, victory and scoring

```ts
interface ObjectiveApi {
  add(def: { id: string; team: TeamId; text: TextRef; kind: "primary" | "secondary" | "hidden" }): CommandToken;
  set(id: string, state: "active" | "complete" | "failed"): CommandToken;   // emits an `objectiveUpdated` UI event
  get(id: string): ObjectiveState;
}

type VictoryLevel = "astounding" | "victory" | "draw" | "defeat" | "devastating";   // mirrors eVictoryLevels

interface EndRequest {
  levels: Partial<Record<TeamId, VictoryLevel>>;   // usually just the player team in single player
  reason?: string;
  pauseTicks?: Tick;                                // end-of-battle pause before leaving tactical
}

interface MissionResult {                          // produced by the runtime after score()
  missionId: string; seed: string; ticks: Tick;
  levels: Record<TeamId, VictoryLevel>;
  prestige: number; bonusPrestige: number;
  medals: string[];
  debrief: TextRef[];
  varsOut: Record<string, CampaignValue>;          // campaign variables to write back
  fleetOut: FleetEntry[];                          // surviving player ships with damage and stores
  career: Partial<Record<string, number>>;         // kills, captures, ...
  dynaverse?: DynaverseDelta[];                    // for Conquest (section 11)
  campaignEvent?: "none" | "retire" | "lost";
  hash: string;                                    // final sim state hash for replay checks
}
```

Victory presets (data-driven, FMSE-style): `toTheDeath`, `destroyTeam`, `captureTarget`, `survive`,
`escort`, `calculatedBpv`. A script can override `score()` for anything else. Prestige tables per victory
level live in the scenario so they can be ported exactly.

### 6.10 Dialogue, briefings and campaign variables

```ts
interface TextApi {
  say(def: { to: TeamId | "all"; text: TextRef; from?: ShipHandle; channel?: "mission" | "comm" | "chatter";
             speakerKey?: string; portraitKey?: string }): CommandToken;  // emits `hail`
  commButton(def: { ship: ShipHandle; team: TeamId; id: string; label: TextRef }): CommandToken;
  clearCommButton(ship: ShipHandle, id: string): CommandToken;
  debrief(team: TeamId, text: TextRef): CommandToken;
  voice(cue: AudioCueKey): CommandToken;                   // through the audio hook
}
type TextRef = { key: string; args?: Record<string, string | number> };  // never raw game strings in code

interface CampaignVarsApi {
  get(key: string): CampaignValue | undefined;
  set(key: string, v: CampaignValue): void;        // buffered into MissionResult.varsOut
}
type CampaignValue = number | string | boolean;    // integers only for numbers
```

**UI events** (UI & Art Director). Objective changes, timers and in-mission hails go out on the engine's
**per-frame event list as typed events**, for example:

```ts
type MissionUiEvent =
  | { type: "objectiveUpdated"; id: string; team: TeamId; state: ObjectiveState; text: TextRef }
  | { type: "missionTimer"; id: string; team?: TeamId; remainingTicks: Tick; label?: TextRef }
  | { type: "hail"; to: TeamId | "all"; from?: ShipHandle; channel: "mission" | "comm" | "chatter"; text: TextRef; speakerKey?: string; portraitKey?: string }
  | { type: "briefing"; empire: EmpireId; text: TextRef; speakerKey?: string; portraitKey?: string }
  | { type: "debrief"; team: TeamId; text: TextRef; speakerKey?: string; portraitKey?: string };
```

They carry **string keys** (`TextRef`), never baked-in text. Briefings and hails render in **localizable
HTML**, not on the HUD canvas, per the Engine Lead's HUD contract; the HTML layer owns layout, styling
(following the SFC2 HUD look), escaping and localization. Missions can't inject markup. UI events are
outputs only: they never feed back into the sim, so they aren't part of the determinism hash. How keys
resolve to text is in 6.12.

**Objectives and timer display** (UI & Art Director; details in `docs/ui/hud-spec.md`):

- **Objectives** are a compact HTML list, collapsed by default. On `objectiveUpdated` it expands for about
  4 seconds with the changed line highlighted. Each line is a string key plus a state of `active`,
  `complete` or `failed`, and every state has both a colour and an icon (never colour alone).
- **`missionTimer`** counts in ticks; the HUD shows it as mm:ss on the overlay canvas. Only one timer is
  pinned at a time; any others appear in the objectives list. In the last 10 seconds the pinned timer
  pulses and plays a sound cue (cue id from the Audio & Netcode QA Lead).
- Both also go through the **message log for screen readers**.
- Where the original game placed these on screen is **TO VERIFY** against CE 2.670.

**Panels** (UI & Art Director). The briefing, debrief and hail panels are HTML components owned by the
UI & Art Director and specced in `docs/ui/hud-spec.md`. Each takes a string key plus two optional fields
([PR #40](https://github.com/danielsegan/sfc2.js/pull/40), `hud-spec.md` §14):

- **`speakerKey?: string`**: the speaker's name or string key.
- **`portraitKey?: string`**: a portrait asset key.

Both are resolved **at runtime against the player's own install**. The key naming is **unverified** until
checked against CE 2.670. If a field is absent or doesn't resolve, the panel shows **no portrait** and the
**default speaker label**; that fallback is owned by UI & Art in `docs/ui/hud-spec.md` §14. Missions only
pass keys; layout and styling follow the HUD spec, not this doc.

Persistence handoff: the mission never writes saves. It returns `MissionResult`; the campaign layer
validates it and decides what to persist.

### 6.11 State machines (Taldren-shaped porting layer)

To make ports mechanical, a thin layer mirrors the observed actor/state pattern:

```ts
interface StateMachineApi {
  actor(id: string, states: Record<string, StateHandlers>, initial: string): ActorRef;
  goto(actor: ActorRef, state: string): void;      // runs exit of old state, enter of new
  current(actor: ActorRef): string;
}
interface StateHandlers {
  enter?(ctx: MissionContext): void;
  exit?(ctx: MissionContext): void;
  on?: Partial<{ [K in MissionEvent["kind"]]: (ctx: MissionContext, e: Extract<MissionEvent, { kind: K }>) => void }>;
}
```

A Taldren team class with its base state becomes one `actor` with a state map; a ship class with states
becomes another; the victory condition becomes an actor too. Events go to the current state of each actor
that subscribed, in actor-registration order.

### 6.12 String tables and localization

- **Stable strings.** Mission string keys and rule reason codes are stable strings that never get
  renamed casually, so they can double as localization keys (for example a `ruleResult` reason
  `outOfRange` can map to `common.rule.outOfRange`).
- **Keys, not text.** Every player-visible string a mission uses is a `TextRef { key, args }`. Keys are
  namespaced by mission id, for example `mission.example-patrol.briefing.federation` or
  `mission.example-patrol.hail.ambush`. Shared strings (empire names, ship roles, victory levels) live
  under `common.*`.
- **String tables are JSON**, one file per locale per mission (or campaign): `strings/<locale>.json`,
  mapping key → ICU-style message with named arguments (`{shipName}`, plural rules).
- **Locales** (UI & Art Director): **English only at launch.** Every key falls back to English; if English
  is missing too, the key itself shows, so gaps are visible in testing. The table format already allows
  more locales later.
- **Validation.** The importer (9.1) checks that every key a scenario or script references exists in the
  reference locale and that arguments match. Missing keys are diagnostics, not crashes.
- **Rendering.** The HTML layer resolves keys at display time using the player's chosen locale, escapes
  arguments, and applies the SFC2 HUD styling. Missions never see resolved text, so changing locale
  can't change sim behaviour or replays.
- **Original text** (UI & Art Director). Keys that point at original game strings are **read from the
  player's own string tables at runtime**, and that text is **never committed**. Where the originals keep
  mission text in game data is unverified until checked against CE 2.670 on `sfc2-ci`. Everything else resolves to
  original string tables we write. We don't paste Taldren mission text into the repo.
- **Per-race briefings** (as in Taldren's per-race briefing arrays) become separate keys per empire.
- Which i18n library formats messages is an implementation choice for Phase 4, kept out of this doc.

---

## 7. Mapping: Taldren concepts → our API

Only rows verified against the public SFC2:EAW API R1.3 headers are listed. "Observed" is Taldren's;
"Ours" is the proposal above.

| Observed (Taldren EAW API R1.3) | Ours (proposal) | Notes |
| --- | --- | --- |
| `tScript::mScriptSpecs`, `tMissionSpec` | scenario `meta` block + `defineMission` | Static metadata moves to data |
| `eMissionTypes` | `StartContext.missionType` | Same categories, minus debug/technical |
| `tScript::mInitializeStart(tDynaverseScriptInfo&)` | `setup(ctx, start: StartContext)` | Start context is read-only |
| `tDynaverseScriptInfo` fields (player race, team, allies, enemies, date, sector, fleet, previous victory) | `StartContext` | Fleet state passes in and out explicitly |
| `tMissionInfo::mSetupTeam` / `tTeamInfo::mSetTeamInfoData` | `teams.create` | |
| `tMissionInfo::mSetTeamRelations`, `eTeamRelationship`, `eTargetGoals` | `teams.setRelation(..., { goal, mutual })` | Same five relations and four goals |
| `tTeamInfo::mCreateShipsForTeam`, `mCreateNewShip` | `ships.requestSpawn` + `spawned` event | By `{ race, className }` ship key (PR #38); token-based |
| `tShipInfo::mSetCustomID` / `mGetCustomID` | `tag` + `ships.byTag` | String tags instead of ints |
| `tShipInfo::mSetShipTarget`, `mRemoveTargets`, `mClearCommands` | `ai.target`, `ai.clear` | |
| `tShipInfo::mPatrol`, `mDefendEntity`, `mFollowEntity`, `mDisengage`, `mTractorEntity`, `mCloak`, `mFireProbe` | `ai.patrol`, `ai.defend`, `ai.follow`, `ai.disengage`, `ai.tractor`, `ai.cloak`, `ai.probe` | Priority enum mirrors `eAIPriority` |
| `tShipInfo::mSetShipAIControlled`, `mSetShipPlayerControlled` | `ai.setControl` | |
| `tShipInfo::mChangeAIOfficerState` | `ai.officer` | |
| `tShipInfo::mSetSystemHealthFromOrig` / `FromCurr` | `ships.damageSystem` / `ships.repairSystem` | Through the rules module in boxes; outcome via `ruleResult`. Taldren set percentages, so ports convert to boxes |
| `tShipInfo::mAddItemToStores` etc. | `ships.addStores` | |
| `tShipInfo::mSetTargetable` | `ships.setTargetable` | |
| `tShipInfo::mDestroyShip`, `mDestroyShipSilently` | `ships.destroy(h, { silent })` | |
| `tShipInfo::mSetFinalDestination` | `ai.moveTo` + `triggers.arrive` | |
| `tShipInfo::mTrackTacticalDistance` | `triggers.proximity` | Distances become fixed-point |
| `iNotifyEvents` bits (`kNotifyAtDeath`, `kNotifyOnCapture`, `kNotifyDisengaged`, `kNotifyAtDistance`, `kNotifyAtDestination`, `kNotifyCommButtonPress`, `kNotifyDamage`, `kNotifyDeepScan`, `kNotifyBeginOrbit`/`EndOrbit`, `kNotifyBeginTractor`/`EndTractor`, `kNotifyTransportedItem`, `kNotifyShipSystemUpdate`, `kNotifyShipStoresUpdate`, `kNotifyPlayerLeaving`) | `MissionEvent` kinds | Subscription by handler presence rather than bitmask |
| `tState::mOnDeath`, `mOnCapture`, `mOnDisengaged`, `mOnDamage`, ... | `StateHandlers.on.*` | |
| `tActor::mGotoState`, `tState::mBeginState` / `mEndState` | `state.goto`, `enter` / `exit` | |
| `mSetTimedInterval` (`kTimerSecondsSet`, `kTimerTurnsSet`) | `timers.after` / `timers.every` in ticks | Seconds × 30; turns need a tick length |
| `kTimerCountdownSet` / `kTimerCountdownAdjust` | `timers.countdown` → `missionTimer` UI event | |
| `kTimerEndGamePause` | `EndRequest.pauseTicks` | |
| `tMissionInfo::mDisplayMessage` | `text.say` → `hail` UI event | String key, rendered in localizable HTML |
| `tShipInfo::mSetCommButton` / `mClearCommButton` | `text.commButton` / `text.clearCommButton` | |
| `tMissionInfo::mAddToDebriefingList` | `text.debrief` | |
| `tScript::mDefineBriefings` | scenario `briefings` by empire | |
| `tMissionInfo::mSetGoalIndicator` | `map.marker` | |
| `tMissionInfo::mCreateMapObject`, `eMapObjectType` | `map.place` | Taldren grid is 1-based |
| `tMissionInfo::mAddMapIcon` | `map.icon` | |
| `MissionMaps.cpp` ASCII grid + legend | scenario `map` block (and an ASCII import tool) | See section 8 |
| `tMissionInfo::mPlaySound`, `mPlayVoiceSample` | `text.voice` / audio hook | |
| `tVictoryCondition::mCalcVictoryStatus`, `eVictoryLevels` | victory preset or `score()`, `VictoryLevel` | Same five levels |
| `tVictoryCondition::mGetPrestigePoints`, `mGetBonusPrestige` | `MissionResult.prestige` / `bonusPrestige` | Tables in scenario data |
| `tTeamInfo::tMissionScheduler` (victory, prestige, next mission, medal, campaign event) | `MissionResult` | Campaign layer picks the next mission |
| `tMissionInfo::mScheduleMission` | `vars.set` + campaign graph | Missions request; campaign decides |
| `tMissionInfo::mAddToCareerTotals` | `MissionResult.career` | |
| `tMissionInfo::mAdjustDynaverse`, `eDynaverseTableType` | `MissionResult.dynaverse` | Conquest only (section 11) |
| `cbRandom(lo, hi)` host callback, `mGetRandomBitValue` | `ctx.rng("mission").int(min, max)` | Taldren already routed randomness through the host; we make it a named seeded stream |
| `mGetDifficultyLevel`, `mGetPlayerRank` | `StartContext.difficulty`, `playerRank` | |

Not mapped yet (seen but not analysed): multiplayer host migration (`mSetNewHost`, `mOnHostChanged`), the
draw canvas and 3D primitive callbacks, deep-scan tracking, and the ShipList API helper that ships with
R1.3. The OP API R2.2 is not reviewed at all.

---

## 8. Port path for one mission, end to end

Proposal for the Phase 4 pilot. The pilot mission is TBD (section 15); a small unique campaign mission
with a scripted twist, such as one from the Mirak folder, exercises most of the API.

1. **Pick and inventory.** On `sfc2-ci` (against the CE 2.670 install), list the mission's script folder from the public sources and
   find which game data it depends on (ship classes, text, map). Record it in a short port note under
   `docs/missions/ports/<mission-id>.md` (behaviour summary only; no code or text pasted).
2. **Write a behaviour spec.** In plain language: teams and relations, starting ships, map, each state and
   what moves it on, timers, victory rules and prestige. This is the clean-room boundary: the port is
   written from the spec and from running the original under Wine, not by transliterating C++.
3. **Author the scenario data.** Teams, relations, ships by shiplist key, map (an ASCII-grid import tool
   can convert a legend-based map description into our map block; the tool reads the player's files on
   the VM, not files committed to the repo), briefings by key, victory preset, prestige table.
4. **Write the script** for what data can't express, using the state-machine layer so each original state
   has a clear counterpart.
5. **Validate against the player's data** with the loader's validation step (unknown ship keys, `duplicateClassKey` errors and `duplicateClassName` warnings, bad cells).
6. **Black-box comparison.** Play the original under Wine on the VM and record observable outcomes:
   which events happen, rough timings, victory level for a handful of scripted playthroughs. Compare with
   ours. Exact tick timings won't match; outcomes and ordering should.
7. **Replay tests.** Record an input log for each playthrough and commit only the log and expected result
   hash (synthetic, no game data), with the scenario referring to ship classes by key. Real-data replays
   run only on the VM.
8. **Review.** Combat checks AI orders, UI checks HUD messages and comm buttons, Producer signs off.

Exit for the pilot: the mission plays start to finish, the result feeds the campaign layer, and the replay
test is green twice in a row on two machines.

---

## 9. FMSE-style authoring and the future scenario editor

- **Data-first scenario format** (our own JSON format with a schema; see 9.1). It covers what FMSE covers: title, playable empires, up to N teams with ships, relations and AI goals,
  map grid with objects, text keys (briefing, start message, chatter, victory and debriefing lines),
  multiplayer flags, victory preset and prestige. A scenario with no script is a complete mission.
- **Script hooks** attach to a scenario for anything beyond presets.
- **Scenario editor (Phase 8 or later):** an in-app editor that reads and writes the same format, with a
  map grid painter, team and relation editor, ship picker by class or BPV budget fed from the player's
  shiplist, text editor, and a "play from here" button. It should warn about overlaps the way FMSE warns
  about planet crash.
- **`.fms` import:** a later tool to convert FMSE project files into our format (9.1, format b).

### 9.1 Two mission file formats

These are kept strictly apart (Asset & Formats Engineer):

**(a) Our own mission files: JSON with a schema.**
- The Mission & Campaign Designer owns the schema (planned at `docs/missions/mission.schema.json`, JSON
  Schema, versioned with `schemaVersion`). It covers scenario metadata, teams, relations, ships by
  ship key (`{ "race": ..., "className": ... }`, [PR #38](https://github.com/danielsegan/sfc2.js/pull/38)), map, objectives, victory preset, prestige table, string-table references and the optional
  script entry. Briefing and debrief entries can carry the same optional `speakerKey` and `portraitKey`
  as the UI events ([PR #40](https://github.com/danielsegan/sfc2.js/pull/40)), for example:

  ```json
  { "briefings": { "federation": { "text": "mission.example-patrol.briefing.federation",
                                  "speakerKey": "...", "portraitKey": "..." } } }
  ```

  (Key values are placeholders; real speaker and portrait key naming is unverified until checked against
  CE 2.670.)

  **Map bounds (provisional).** The map block gets an optional `mapBounds` field. The Engine Lead's
  proposal, **provisional until `docs/engine/sim-core.md` (planned) commits the scale and pending Combat's
  maximum weapon range**: sim positions are **16.16 fixed point** (`FX_SHIFT = 16`), and one whole unit is
  one range unit. Authors write `mapBounds` in **whole range units**; the loader converts them to 16.16 at
  load:

  ```json
  { "map": { "mapBounds": { "minX": 0, "minY": 0, "maxX": 100, "maxY": 100 }, "objects": [] } }
  ```

  (Field names and numbers are illustrative.)

  **Range rule (Engine Lead; to be committed in `docs/engine/sim-core.md`):** each `mapBounds` axis value
  must satisfy **|v| <= 8192 range units**. Position differences can reach twice the bound and the sim
  computes differences in i64, which leaves about a 4x margin on the 2D squared distance. A value outside
  that range, or a non-integer, emits `{ code: "badMapBounds", source: "mission", severity: "error" }`, with
  `location.field` pointing at the offending value. (This supersedes an earlier 32767 proposal.)

  Test-fixture context only, not a limit on bounds: the provisional longest weapon range is **75 range
  units** (the Star Fleet Battles long-range phaser band), pending playtest.

  Positions (ships, map objects, bounds) come **only from our own mission files**. They are never
  extracted from CE `.scr` modules.
- The Asset & Formats importer validates these files and returns **`{ data, diagnostics }`**: `data` is
  the typed scenario (or `null` if it can't be used), and `diagnostics` is a list of
  diagnostics in the studio shape already used by `docs/formats/` (#42, #45): exactly
  **`{ code, source, severity, details?, location? }`**. There is **no `path` and no `message` field**; the
  HUD looks up human-readable text by the locale key `source.code` (`docs/ui/hud-spec.md` §14d).
  - `code`: flat, stable camelCase, add-only, never renamed.
  - `source`: **who emits it**. Our own mission files use `source: "mission"` (for example an unknown ship
    key, an off-map cell or a missing string key). `duplicateClassKey` (error) and `duplicateClassName`
    (warning) come from the shiplist parser, `source: "shiplist"`, as `docs/formats/shiplist.md` defines
    them. `unknownWeapon` and `unknownArc` come from the engine loader, `source: "loader"`. `"mission"` is
    not yet in the shared `DiagnosticSource` list in `docs/formats/README.md`; it gets added there
    (add-only) when the mission importer lands.
  - `severity`: `"error" | "warning" | "info"`.
  - `details?`: structured context, e.g. `{ race, className, rows }`.
  - `location?` (optional): a 1-based `line` and `column` for text files, or, **for our JSON mission files,
    a JSON-pointer-style field path** in `location.field` (for example `/teams/1/ships/0/ship`).

  The single registry of codes is the planned `docs/engine/diagnostics.md` (Engine Lead). The loader
  refuses to start a mission with any `error` diagnostic and shows the list to the author.
- Test fixtures in the repo are synthetic files we write ourselves.

**(b) Original community FMSE `.fms` files: a separate reverse-engineering job.**
- Owned by Asset & Formats, done clean-room, and **not yet reviewed**: nobody has looked inside a `.fms`
  file yet. All we know comes from the FMSE manual (the editor saves a `.fms` project next to the compiled
  `.scr`).
- Once the format is documented in `docs/formats/`, its fields get mapped onto schema (a) and a converter
  produces our JSON plus diagnostics. Until then nothing in the schema depends on `.fms`.
- `.fms` files are community files the player owns; they're loaded from the player's disk and never
  committed.

---

## 10. Campaign structure

Proposal: one **campaign graph** per empire, as data. Nodes are missions (unique story missions and
generic mission templates); edges are conditions on the previous `MissionResult` and campaign variables.
The campaign layer owns the player's fleet, prestige, rank, date and variables between missions.

Empires (from `docs/plan.md` and the API R1.3 race enum). **Every row is unverified** until checked
against the CE 2.670 install on `sfc2-ci`:

| Empire | Campaign (unverified) | Notes |
| --- | --- | --- |
| Federation | expected | Inferred to be mostly generic `Meta` missions plus unique missions |
| Klingon | expected | As above |
| Romulan | expected | As above |
| Lyran | expected | As above |
| Hydran | expected | As above |
| Gorn | expected | As above |
| ISC | expected | Has its own source folder in the public EAW scripts |
| Mirak | expected | Has its own source folder in the public EAW scripts |
| Orion (EAW faction) | **not yet verified** | The plan lists an Orion campaign. In the EAW API R1.3 headers Orion is an NPC race. Whether CE 2.670 has an Orion campaign or only Orion ships and races is not yet verified |

**The roster still has to be confirmed against the CE 2.670 install on `sfc2-ci`** (installed, without the
2.679 patch; the check will be manifest-based), including which
campaigns ship, how many missions each has, and the Orion question above. Until that's done, the Phase 5
estimate stays provisional.

The standalone *Orion Pirates* game (2001), with its playable Orion cartels and OP-era content, is **out of
scope** (section 16). The empire id stays an open string so that later work, or mods, can add empires
without API changes.

---

## 11. Hooks for Conquest / Dynaverse (Phase 6)

- **Same missions, different caller.** In Conquest, the strategic layer (not a campaign graph) picks a
  generic mission template from the hex, empires and fleets involved, and passes a `StartContext` with
  `missionType` set accordingly. Taldren's `tDynaverseScriptInfo` already carried this (sector, date,
  allied and enemy races, player fleet), which is why the start context is shaped that way.
- **Results flow back** through `MissionResult.dynaverse` (economy, stability and similar adjustments,
  mirroring `mAdjustDynaverse`) and `fleetOut`. The Conquest server applies them; missions never write
  strategic state.
- **Server-side runs.** Because the runtime is deterministic and headless, the Conquest server can re-run
  a battle from its input log to check a reported result.
- **Match location filters.** Taldren's mission specs carried location requirements (`tMetaLocationSpec`).
  Our scenario meta should carry the same kind of filter (terrain, empire space, hex type) so the
  strategic layer can pick suitable missions. Field list TBD with the Phase 6 design.

---

## 12. Mod safety

- Missions run in the same-thread SES-style sandbox (4.2) with no ambient authority: no network, storage,
  DOM or clock.
- Capabilities are explicit: a mission manifest lists the API areas it uses; the loader refuses unknown
  capabilities and shows them to the player before loading a third-party mission.
- **Data validation** at load: every ship class, empire, text key and audio cue must resolve against the
  player's data or the mod's own declared data.
- **Resource caps:** max entities spawned, max timers and triggers, max commands per tick, max message
  length, and the per-tick operation budget. Hitting a cap is deterministic: an error in dev builds, and
  the release-build policy is an open question (section 15).
- **Combat integrity:** mission commands can only change combat state through the rules module's entry
  points (4.3), so a mod can't bypass damage allocation or energy rules.
- **Integrity for multiplayer:** all peers hash the mission bundle and scenario; mismatches block the
  match. Lockstep peers must run byte-identical mission code.
- **No game files in mods we ship.** Community packs the player owns are loaded from the player's disk,
  same rule as the base game.
- **API versioning:** `apiVersion` in every mission; the runtime keeps old versions working or refuses
  with a clear message.

---

## 13. Determinism and replay testing

- **Replay harness** (with the Audio & Netcode QA Lead; backlog #25, replay and hash checks): run scenario + seed + input log headless, compare
  the final state hash and a per-N-tick hash trail with the expected values.
- **Mission-specific checks:** the slot-255 command stream the mission produced is part of the hash, so a mission
  that behaves differently on another machine fails fast and points at the tick.
- **Cross-environment runs:** CI runs replays in at least two JS engines (for example V8 via Node and
  SpiderMonkey or JavaScriptCore) to catch engine-dependent behaviour, once the Engine Lead confirms the
  sim itself is engine-independent.
- **Rule-result checks:** a mission that issues rejected or clamped commands gets the same `ruleResult`
  events on every peer, and never throws.
- **Spawn-id checks:** tests that run the same scenario with different amounts of script work per tick
  and assert identical entity ids, since ids must never depend on script timing.
- **Budget checks:** dev-build tests that a mission over its operation budget fails loudly.
- **Importer tests:** synthetic mission JSON files, valid and broken, with expected diagnostics.
- **Fuzzing:** random input logs against each scenario to check that missions never throw, never exceed
  caps, and always reach an end state or a timeout.
- **Lint rules** for mission code: ban `Date`, `Math.random`, timers, `for...in` over untrusted objects,
  and (if decided) float arithmetic.
- **Synthetic fixtures only in the repo.** Test scenarios use invented `{ race, className }` ship keys backed by a tiny
  synthetic shiplist fixture listed in `tools/allowed-fixtures.txt` if needed. Real-data replays stay on
  `sfc2-ci`.

---

## 14. Legal and clean-room checklist for mission work

- Never open, cite or borrow from SFC2-decomp or any decompilation.
- Taldren's publicly released API and mission sources may be read as references. Don't copy their code;
  write a behaviour spec, then write new code from the spec. Identifier names may appear in mapping tables.
- Don't commit Taldren mission text, map files, `.scr` binaries or the API archives. They stay on the VM.
- All new mission content (text, maps, scenarios) we write must be original.

---

## 15. Open questions, by owner

### Engine Lead

Answered, pending the mission-runtime contract in `docs/engine/`: when commands apply (T+1 input phase,
slot 255), the sandbox (same thread, SES-style, no Worker, operation budget), spawn ids (token, lowest free
index with bumped generation, `spawned` next tick), and reads (query API in entity-id order, no snapshot).
Still open:

1. **The contract itself** in `docs/engine/`, so the answers above and the remaining hooks in 5.1 can be
   linked instead of restated.
2. **Event source and ordering** within a tick (`ENGINE_HOOK: eventSource`).
3. **How operations are counted** for the budget (API calls only, or also loop iterations through a code
   transform), and the default budget per tick.
4. **Fixed-point types exposed to missions:** one `Fixed` type with helpers, or plain integers in the
   swappable distance unit? Can mission code use floats at all?
5. **RNG stream API:** is `ctx.rng("mission")` per mission instance, and how is it derived from the match
   seed?
6. **Per-frame event list:** the exact shape of `objectiveUpdated`, `missionTimer` and `hail` (with UI).

### Combat Systems Designer

1. Tick length of a Taldren **"game turn"** for porting `kTimerTurnsSet` timers.
2. The AI order set and priorities missions can rely on (6.6), and which orders are hard overrides.
3. Damage event severity buckets for `shipDamaged`, and which system/stores changes should raise events.
4. Capture and disengage semantics that victory presets depend on.
Answered (pending the rules spec in `docs/rules/`, #24): the rules entry points missions call
(`damageSystem`, `damageShield`, `repairSystem`, `setShields`, `setEnergy`, AI orders via the captain's
order queue) and the `ruleResult` event (token, applied/clamped/rejected, reason code, `appliedValue`; never
throws). Still open: items 1 to 4 above, plus the full reason-code list in `docs/rules/`.

### Asset & Formats Engineer

Answered: the ship key is race + short class name from the CE 2.670 shiplist ([PR #38](https://github.com/danielsegan/sfc2.js/pull/38)); uniqueness is
unverified until the PR #38 checklist confirms it, and the parser flags duplicates as `duplicateClassKey`. Still open:

1. Where mission text lives in the installed data (if anywhere outside compiled `.scr` files), and the
   string-table format.
2. Once CE 2.670 is installed on `sfc2-ci`: whether it contains mission metadata we can read (mission lists,
   campaign tables), and where CE 2.670 differs from what API R1.3 and the released EAW sources describe.
3. The `{ data, diagnostics }` importer contract for our mission JSON (9.1a): diagnostic codes and
   severities.
4. The `.fms` reverse-engineering job (9.1b): not yet reviewed; when it can be scheduled.

### Producer

1. **The manifest-based roster check** against CE 2.670 on `sfc2-ci` (installed, without the 2.679
   patch). Until it's done, every roster and mission-inventory claim stays unverified and the pilot choice
   is provisional.
2. Which **pilot mission** for Phase 4, and which empire's campaign is the "first campaign" exit target.
3. Whether a `docs/missions/` folder and `ports/` notes need a CODEOWNERS entry.
4. Phase placement of the scenario editor (Phase 8 or a later stretch).
5. **There is no Phase 4 issue yet.** File the Phase 4 issues for: runtime sandbox, scenario format,
   state-machine layer, victory presets, campaign graph, mission replay tests, pilot port. Related existing
   backlog: #21 sim core, #24 rules spec, #25 replay and hash checks, #8 decision issue for architecture
   changes.

### UI & Art Director

Answered: objectives and timer display (6.10, details in `docs/ui/hud-spec.md`; original placement TO
VERIFY). Also answered: the briefing, debrief and hail panels are UI-owned HTML components specced in
`docs/ui/hud-spec.md`; each takes a string key plus optional `speakerKey` and `portraitKey` (#40, §14),
resolved at runtime against the player's install, with no portrait and a default speaker label when absent
or unresolved; English only at launch with English fallback
for every key; original game strings are read from the player's string tables at runtime and never
committed. Nothing left open for UI & Art in this doc beyond verifying original placement.

### Audio & Netcode QA Lead

1. **Open item (not blocking review): release-build budget overrun.** Dev builds error out; the
   release-build behaviour is still TBD (for example, abort that handler for the tick and log it). It's
   your call, with the Engine Lead's constraint: the budget counts operations so every peer hits the limit
   at the same point, and the behaviour must be deterministic and machine-independent. This doc gets
   updated when you answer.
2. The sound cue id for the pinned timer's last 10 seconds.
3. Whether slot-255 mission commands go in the replay log or are regenerated (proposal: regenerated and
   hashed).

### Daniel

1. Whether third-party missions should be allowed in multiplayer at all, or only in single player at first.
2. Cursor cloud agents are still open; nothing in this doc depends on that decision.
   (Decided and reflected here: name SFC2.js, TypeScript, CE 2.670 reference build, SFC2 HUD;
   Orion Pirates out of scope per the Producer's scope update.)

---

## 16. Possible later (backlog)

Not in scope. Listed so the API doesn't paint us into a corner, not as a commitment.

- **Orion Pirates (standalone 2001 game) content:** its campaigns, missions, playable Orion cartels and
  OP-era empires, and the OP Mission API R2.2. The open-ended empire id, the capability manifest and
  `apiVersion` are meant to make this addable later without breaking EAW missions.
- **`.fms` (FMSE project) import**, if a clean-room format description becomes feasible.
- **Community mission packs** (EAW-era) as a mod-loading test bed, loaded from the player's own disk.

---

## Sources

Used for this draft (all public):

- Taldren, *SFC2: Empires at War Scripting API Release 1.3* (`SFC2_API_R1.3.zip`, readme dated 2 July
  2002), downloaded from
  <https://klingon.lostexiles.net/sources_and_utils/SFC2_API_R1.3.zip> via the index at
  <https://klingon.lostexiles.net/mediawiki/index.php?title=SFC-related_missions%2C_sources%2C_patches_and_misc_utilities>.
  Read: readme and the `ScriptInterface` and `Shared/Source/Include` headers, for identifier names only.
- Taldren, *SFC2: EAW official mission sources* (`SFC2_EAW_Scripts.zip`),
  <https://klingon.lostexiles.net/EAW_missions/SFC2_EAW_Scripts.zip>. Read: folder layout and the file
  structure of one mission (`Mirak/Mir_2Dance`); no code or text reproduced.
- Klingon.lostexiles.net, *How to compile/build SFC2 EAW or OP Missions*,
  <https://klingon.lostexiles.net/mediawiki/index.php?title=How_to_compile%2Fbuild_SFC2_EAW_or_OP_Missions>
  (VC6 SP5 requirement, OP API R2.2 exists).
- Starfleet Universe archive, Mission API downloads page,
  <https://archive.kontek.net/sfc.strategyplanet.gamespy.com/missionapi.shtml> (confirms the SFC2 API and
  official mission sources were publicly released).
- *Fleet Mission Script Editor Manual v1.0*, <https://gaming.trekcore.com/starfleetcommand2/downloads/fmsemanual.zip>
  (listed on <https://gaming.trekcore.com/starfleetcommand2/downloads.html> and
  <https://archive.kontek.net/sfc.strategyplanet.gamespy.com/editing.shtml>).
- `docs/plan.md` and `docs/LEGAL.md` in this repo.

Known but **not** used yet: the SFC:OP API R2.2 (`SFCOP_API_R2.zip`) and OP mission sources
(`OP_Scripts.zip`), community mission packs, and the game manuals.
