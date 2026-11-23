# SFC2.js Mission API design (draft)

Status: **draft for review**. Owner: Mission & Campaign Designer. Milestone: Phase 4 (Missions).
This is a design doc only. No runtime code lands before Phase 4.

> **Clean-room note.** This doc was written from Taldren's publicly released SFC2:EAW Mission API
> (API Release 1.3) and its publicly released EAW mission sources, the FMSE 1.0 manual, `docs/plan.md`,
> `docs/LEGAL.md`, and community sites (listed in [Sources](#sources)). It was **not** written from, and
> does not cite, the SFC2-decomp project or any other decompilation. Taldren identifiers appear only as
> short names in mapping tables. No Taldren code is copied here, and no game files are committed.

> **Decisions this doc follows (made by Daniel):** the project is named **SFC2.js** (the repo name and
> paths stay `sfc2-browser-edition`); the language is **TypeScript**; the reference game for mission and
> campaign content is **SFC2: Empires at War, official 2.036 plus the unofficial 2.037 patch** (not the
> Community Edition); the HUD follows SFC2's own EAW HUD. **Still open:** whether studio bots use Cursor
> cloud agents (nothing here depends on it). **Out of scope:** the standalone *Orion Pirates* game (2001)
> and its content, which sits in [Possible later](#16-possible-later-backlog).

> **Data verification status: unverified.** Nobody on the project has an EAW 2.036 + 2.037 copy yet. Every
> claim in this doc about the empire roster, the mission and campaign inventory, or anything else that
> depends on installed game data is **unverified** until that copy exists and has been checked on the
> private VM. Claims about Taldren's *public API headers and released sources* are verified against those
> archives only, which are not the same thing as the reference install.

---

## 1. Goals and non-goals

### Goals

1. **Run every original EAW campaign and mission type in SFC2.js** (campaign, unique campaign, tutorial,
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
the public EAW mission sources. Our reference build is EAW 2.036 plus the unofficial 2.037 patch. **Not
verified:** which game build API R1.3 and the released mission sources match exactly, and what the 2.037
patch changed in mission or campaign behaviour. Both get checked against the reference install on the
private VM before porting starts. Where something is inferred rather than read directly, it says so.

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
| Races | `eRaceName` | In the API R1.3 headers, Federation, Klingon, Romulan, Lyran, Hydran, Gorn, ISC, Mirak are playable races; Orion and Monster are NPC races. How this shows up in EAW 2.036 data is **unverified** |
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
inventory is **unverified**: it comes from the released source archive, not from an EAW 2.036 + 2.037
install, and has to be checked against that install on the private VM before Phase 5 is estimated.

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
Scenario (data, JSON-like)  ─┐
                             ├─► Mission runtime (sandbox) ──commands──► Sim core (fixed tick)
Mission script (JS/TS)      ─┘          ▲                                      │
                                        └───────── events + read-only views ◄──┘
                                                       │
Campaign layer ◄── MissionResult (victory, prestige, flags, fleet) ──┘
```

- A **scenario** is data: teams, races, ships by shiplist id, map, text keys, victory preset. Most FMSE-era
  missions should fit entirely in data.
- A **mission script** is optional code that handles events and issues commands for anything data can't
  express. It mirrors Taldren's actor/state model so a port reads like the original.
- The **mission runtime** hosts both in a sandbox, feeds it events once per tick, and turns its calls into
  **commands** the sim applies at a defined point in the next tick. That matches the plan's architecture:
  "Mission runtime ──events──► Sim core".
- The **campaign layer** (outside the mission) owns persistence, picks the next mission and passes in a
  start context, the equivalent of `tDynaverseScriptInfo`.

---

## 4. Runtime model

### 4.1 Determinism contract (provisional)

These are the Engine Lead's working answers, **provisional until `docs/engine/determinism.md` lands**.
This doc will be updated to match whatever that contract finally says.

| Rule | Working answer | What it means for missions |
| --- | --- | --- |
| Tick rate | Fixed **30 Hz** | Mission time is a tick count. 1 second = 30 ticks |
| Numbers | Fixed-point everywhere in the sim, **no floats** | Positions, distances, damage and timers are fixed-point or integer values; the API never hands a mission a float |
| Distance | One swappable unit constant | Missions use named helpers (`km(10)`, `cells(3)`) rather than raw numbers, so the unit can change |
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

Proposal: run mission code in a **dedicated Web Worker** with a frozen, minimal global scope, and evaluate
the mission module inside an **SES (Secure ECMAScript) Compartment** (`lockdown()` + `Compartment`) so the
only globals are the ones we pass in. In the Tauri shell and on headless servers the same bundle runs in a
worker thread.

- No DOM, network (`fetch`, `WebSocket`), storage (`localStorage`, IndexedDB), `importScripts`, `eval` of
  strings, or clocks. SES lockdown also freezes intrinsics, so a mission can't patch `Array.prototype`
  behind other code's back.
- The worker talks to the sim over a message channel. Each tick: the sim posts the tick number, the event
  batch and a read-only snapshot (or a cheap delta) of what the mission is allowed to see; the mission
  posts back a command list. The sim never waits on the mission beyond a budget.
- **Budget.** A per-tick instruction or time budget (the time budget is measured by the host, never visible
  to the mission). Overrunning it is a mission fault: the mission is suspended, the battle continues under
  normal AI, and the fault is logged. A time budget can't be part of the deterministic result, so the
  fault policy must be identical on every peer (open question for Audio & Netcode QA).
- **Alternative under consideration:** run the mission synchronously on the sim thread inside the same SES
  Compartment, no worker. This is simpler and has zero latency, at the cost of isolation from long-running
  loops. Engine Lead decides (section 15).

### 4.3 Commands, not mutations

Missions never mutate sim state directly. Every API call that changes the world appends a command to the
tick's command list, for example `{ t: "spawnShip", teamId, shipClass, at, facing, tag }`. The sim applies
mission commands at a fixed point in the tick (proposal: after input and AI orders, before movement), in
the order they were issued. That gives:

- a single, loggable stream that replays exactly;
- the same path for single player, lockstep multiplayer (every peer runs the mission and must produce the
  same commands) and host-authoritative servers;
- an easy place to validate and reject bad commands (unknown ship class, off-map position).

Spawned entities get ids the mission can use immediately: the runtime reserves ids deterministically when
the command is issued, so `spawnShip` can return a handle in the same tick.

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
| **running** | Events dispatched in deterministic order, then `onTick(ctx)` if the mission asked for it | `tState` handlers, `mOnTimedInterval` |
| **end** | Mission calls `ctx.end(...)` or the victory preset fires; the end pause runs in ticks | `mCheckForMissionEnd`, `kTimerEndGamePause` |
| **scoring** | Victory level per team, prestige, bonus prestige, debriefing lines, campaign flags | `mCalcVictoryStatus`, `mGetPrestigePoints`, `tMissionScheduler` |
| **teardown** | Drop timers and handlers, freeze the result, destroy the sandbox | `mCleanUpActors` |

### 5.1 Engine hook points: placeholders

The hooks below are **placeholders**. They wait on the Engine Lead's mission-runtime contract in
`docs/engine/` (not yet posted at the time of writing; there is no `docs/engine/` folder on `main`). When
that contract lands, this section gets replaced by a link and the names change to match.

| Placeholder | Needed from the engine |
| --- | --- |
| `ENGINE_HOOK: tickPhase` | Where in the tick mission commands are applied, and where events are collected |
| `ENGINE_HOOK: eventSource` | How sim events (death, damage, capture, disengage, proximity, orbit, tractor, transport, system and stores changes) reach the mission, and in what order |
| `ENGINE_HOOK: entityIds` | How spawned entity ids are allocated deterministically |
| `ENGINE_HOOK: missionView` | The read-only state the mission can query (positions, damage, systems, stores) and how it's snapshotted |
| `ENGINE_HOOK: aiOrders` | The AI order interface the mission calls into (owned with Combat) |
| `ENGINE_HOOK: rngStreams` | How `ctx.rng("mission")` is seeded and isolated from other streams |
| `ENGINE_HOOK: hudChannel` | How countdowns, goal markers and comm buttons reach the HUD canvas, and how briefing, dialogue and debriefing text reach the HTML text layer (per the HUD contract, with UI) |
| `ENGINE_HOOK: audioCue` | How a mission requests a sound or voice line (with Audio) |

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
  create(def: { id: TeamId; empire: EmpireId; control: "human" | "ai"; tag?: string; name?: TextRef }): TeamId;
  setRelation(a: TeamId, b: TeamId, rel: "allied" | "friendly" | "neutral" | "hostile" | "war",
              opts?: { goal?: "ignore" | "cripple" | "capture" | "destroy"; mutual?: boolean }): void;
  relation(a: TeamId, b: TeamId): Relation;
  ships(team: TeamId, filter?: ShipFilter): ShipHandle[];   // stable order by entity id
  status(team: TeamId): "active" | "defeated" | "disengaged" | "left";
}
```

### 6.5 Ships

Ships are spawned by **shiplist id**, i.e. the class key from the player's own `shiplist.txt` as parsed by
the Asset & Formats parser. The exact key (class name column, hull type, or both) is an open question for
Asset & Formats.

```ts
interface ShipApi {
  spawn(def: {
    team: TeamId;
    shipClass: ShipClassKey;               // from the player's shiplist; validated at load
    at: MapPoint;                          // grid cell or fixed-point position
    facing?: Heading;                      // uint16, 65536 per circle (provisional)
    name?: TextRef;
    tag?: string;                          // mission-local id, like Taldren's custom ID
    crew?: CrewQuality;
    damage?: Partial<Record<SystemKey, Percent>>;   // integer percent
    stores?: Partial<StoresLoadout>;
    targetable?: boolean;
    playerControlled?: boolean;
  }): ShipHandle;
  pickByBudget(def: { empire: EmpireId; bpv: number; roles?: ShipRole[] }): ShipClassKey[];  // FMSE "ships by BPV"
  byTag(tag: string): ShipHandle | undefined;
  get(h: ShipHandle): ShipView;            // read-only snapshot for this tick
  destroy(h: ShipHandle, opts?: { silent?: boolean }): void;
  setTeam(h: ShipHandle, team: TeamId): void;
  setSystemHealth(h: ShipHandle, system: SystemKey, percent: Percent): void;
  addStores(h: ShipHandle, item: StoresItem, amount: number): void;
  setTargetable(h: ShipHandle, on: boolean): void;
}

interface ShipView {
  readonly id: ShipHandle; readonly team: TeamId; readonly originalTeam: TeamId; readonly empire: EmpireId;
  readonly shipClass: ShipClassKey; readonly bpv: number; readonly inPlay: boolean;
  readonly status: "active" | "destroyed" | "captured" | "disengaged";
  readonly position: MapPoint; readonly heading: Heading; readonly damagePercent: Percent;
  readonly alert: "green" | "yellow" | "red"; readonly cloaked: boolean;
}
```

### 6.6 AI orders

Missions give **orders**; how a captain carries them out is Combat's AI. Priorities mirror the observed
`eAIPriority` idea.

```ts
interface AiApi {
  target(ship: ShipHandle, target: ShipHandle, priority?: Priority): void;
  clear(ship: ShipHandle): void;
  moveTo(ship: ShipHandle, at: MapPoint, priority?: Priority): void;
  patrol(ship: ShipHandle, points: MapPoint[], detectRange: Distance, priority?: Priority): void;
  defend(ship: ShipHandle, protectee: ShipHandle, threatRadius: Distance, followRadius: Distance, priority?: Priority): void;
  follow(ship: ShipHandle, leader: ShipHandle, priority?: Priority): void;
  disengage(ship: ShipHandle, method: "warp" | "mapEdge" | "any", priority?: Priority): void;
  tractor(ship: ShipHandle, target: ShipHandle, to: MapPoint, priority?: Priority): void;
  cloak(ship: ShipHandle, on: boolean): void;
  probe(ship: ShipHandle, target: ShipHandle): void;
  setControl(ship: ShipHandle, mode: "ai" | "player"): void;
  officer(ship: ShipHandle, officer: OfficerKey, aiEnabled: boolean): void;
}
type Priority = "low" | "normal" | "high" | "override";
```

### 6.7 Triggers and timers

Timers count **ticks**. Helpers convert seconds at authoring time, so `seconds(30)` is 900 ticks at 30 Hz.

```ts
interface TimerApi {
  after(ticks: Tick, id: string): TimerId;          // fires once -> on.timer({ id })
  every(ticks: Tick, id: string): TimerId;          // repeating
  cancel(id: TimerId): void;
  countdown(ticks: Tick, opts?: { label?: TextRef; team?: TeamId }): void;   // on-screen countdown (HUD)
}

interface TriggerApi {
  // Proximity: fires on.proximity when a ship enters (or leaves) range of a point or entity.
  proximity(def: { id: string; ship: ShipHandle | ShipFilter; of: MapPoint | ShipHandle; range: Distance; edge?: "enter" | "leave" | "both" }): void;
  arrive(def: { id: string; ship: ShipHandle; at: MapPoint }): void;      // like Taldren's at-destination
  when(def: { id: string; every: Tick; test: (ctx: MissionContext) => boolean; once?: boolean }): void;  // polled predicate
  remove(id: string): void;
}

type MissionEvent =
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

Event ordering within a tick (proposal): by event kind in a fixed table order, then by entity id, then by
issue order. The final rule belongs in the engine contract.

### 6.8 Map objects

```ts
interface MapApi {
  size(): { cols: number; rows: number };                   // grid cells
  cellSize(): Distance;                                      // FMSE documents 10 km per cell
  place(def:
    | { kind: "planet"; at: MapPoint; style: PlanetStyleKey; name?: TextRef }
    | { kind: "base"; at: MapPoint; team: TeamId; baseClass: ShipClassKey }    // bases are shiplist entries
    | { kind: "asteroid"; at: MapPoint; size: "small" | "medium" | "large" }
    | { kind: "asteroidField"; area: MapArea; density: number }
    | { kind: "nebula"; area: MapArea }
    | { kind: "dustCloud"; area: MapArea }
    | { kind: "blackHole"; at: MapPoint; size: "small" | "large" }
    | { kind: "pulsar" | "sun" | "wormhole" | "fissure"; at: MapPoint }
    | { kind: "minefield"; area: MapArea; team: TeamId; mineType: MineKey; count: number }
    | { kind: "beacon"; at: MapPoint; label?: TextRef; visibleTo?: TeamId[] }
  ): MapObjectHandle;
  remove(h: MapObjectHandle): void;
  distance(a: MapPoint | ShipHandle | MapObjectHandle, b: MapPoint | ShipHandle | MapObjectHandle): Distance;
  marker(team: TeamId, at: MapPoint | ShipHandle | null): void;   // goal indicator; null clears
  icon(kind: string, at: MapPoint): void;                          // map-screen icon
}
type MapPoint = { cell: [col: number, row: number] } | { pos: [x: Fixed, y: Fixed] };
```

Grid cells are 1-based in Taldren's API (noted in its headers). Proposal: **0-based** in ours, with the
porting guide calling out the off-by-one.

Static map layout should normally live in the scenario data, not in code (section 9).

### 6.9 Objectives, victory and scoring

```ts
interface ObjectiveApi {
  add(def: { id: string; team: TeamId; text: TextRef; kind: "primary" | "secondary" | "hidden" }): void;
  set(id: string, state: "active" | "complete" | "failed"): void;
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
  say(def: { to: TeamId | "all"; text: TextRef; from?: ShipHandle; channel?: "mission" | "comm" | "chatter" }): void;
  commButton(def: { ship: ShipHandle; team: TeamId; id: string; label: TextRef }): void;
  clearCommButton(ship: ShipHandle, id: string): void;
  debrief(team: TeamId, text: TextRef): void;
  voice(cue: AudioCueKey): void;                   // through the audio hook
}
type TextRef = { key: string; args?: Record<string, string | number> };  // never raw game strings in code

interface CampaignVarsApi {
  get(key: string): CampaignValue | undefined;
  set(key: string, v: CampaignValue): void;        // buffered into MissionResult.varsOut
}
type CampaignValue = number | string | boolean;    // integers only for numbers
```

Briefing, dialogue, comm and debriefing text **renders in HTML, not on the HUD canvas**, per the Engine
Lead's HUD contract. The mission only emits text keys and arguments; the HTML layer owns layout, styling
(following SFC2's EAW HUD look), escaping and localisation. Missions can't inject markup.

Text is always a key. For ported missions, the key resolves either to text in the player's installed game
data (if the original keeps it there) or to a string table we write ourselves. We don't paste Taldren
mission text into the repo.

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
| `tTeamInfo::mCreateShipsForTeam`, `mCreateNewShip` | `ships.spawn` | By shiplist class key |
| `tShipInfo::mSetCustomID` / `mGetCustomID` | `tag` + `ships.byTag` | String tags instead of ints |
| `tShipInfo::mSetShipTarget`, `mRemoveTargets`, `mClearCommands` | `ai.target`, `ai.clear` | |
| `tShipInfo::mPatrol`, `mDefendEntity`, `mFollowEntity`, `mDisengage`, `mTractorEntity`, `mCloak`, `mFireProbe` | `ai.patrol`, `ai.defend`, `ai.follow`, `ai.disengage`, `ai.tractor`, `ai.cloak`, `ai.probe` | Priority enum mirrors `eAIPriority` |
| `tShipInfo::mSetShipAIControlled`, `mSetShipPlayerControlled` | `ai.setControl` | |
| `tShipInfo::mChangeAIOfficerState` | `ai.officer` | |
| `tShipInfo::mSetSystemHealthFromOrig` / `FromCurr` | `ships.setSystemHealth` | Percent becomes integer |
| `tShipInfo::mAddItemToStores` etc. | `ships.addStores` | |
| `tShipInfo::mSetTargetable` | `ships.setTargetable` | |
| `tShipInfo::mDestroyShip`, `mDestroyShipSilently` | `ships.destroy(h, { silent })` | |
| `tShipInfo::mSetFinalDestination` | `ai.moveTo` + `triggers.arrive` | |
| `tShipInfo::mTrackTacticalDistance` | `triggers.proximity` | Distances become fixed-point |
| `iNotifyEvents` bits (`kNotifyAtDeath`, `kNotifyOnCapture`, `kNotifyDisengaged`, `kNotifyAtDistance`, `kNotifyAtDestination`, `kNotifyCommButtonPress`, `kNotifyDamage`, `kNotifyDeepScan`, `kNotifyBeginOrbit`/`EndOrbit`, `kNotifyBeginTractor`/`EndTractor`, `kNotifyTransportedItem`, `kNotifyShipSystemUpdate`, `kNotifyShipStoresUpdate`, `kNotifyPlayerLeaving`) | `MissionEvent` kinds | Subscription by handler presence rather than bitmask |
| `tState::mOnDeath`, `mOnCapture`, `mOnDisengaged`, `mOnDamage`, ... | `StateHandlers.on.*` | |
| `tActor::mGotoState`, `tState::mBeginState` / `mEndState` | `state.goto`, `enter` / `exit` | |
| `mSetTimedInterval` (`kTimerSecondsSet`, `kTimerTurnsSet`) | `timers.after` / `timers.every` in ticks | Seconds × 30; turns need a tick length |
| `kTimerCountdownSet` / `kTimerCountdownAdjust` | `timers.countdown` | |
| `kTimerEndGamePause` | `EndRequest.pauseTicks` | |
| `tMissionInfo::mDisplayMessage` | `text.say` | Text by key, rendered in the HTML text layer |
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

1. **Pick and inventory.** On the private VM (once an EAW 2.036 + 2.037 copy is there), list the mission's script folder from the public sources and
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
5. **Validate against the player's data** with the loader's validation step (unknown class keys, bad cells).
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

- **Data-first scenario format** (JSON or JSON5; schema in `docs/missions/scenario.schema.json` later).
  It covers what FMSE covers: title, playable empires, up to N teams with ships, relations and AI goals,
  map grid with objects, text keys (briefing, start message, chatter, victory and debriefing lines),
  multiplayer flags, victory preset and prestige. A scenario with no script is a complete mission.
- **Script hooks** attach to a scenario for anything beyond presets.
- **Scenario editor (Phase 8 or later):** an in-app editor that reads and writes the same format, with a
  map grid painter, team and relation editor, ship picker by class or BPV budget fed from the player's
  shiplist, text editor, and a "play from here" button. It should warn about overlaps the way FMSE warns
  about planet crash.
- **`.fms` import:** a later, optional tool to convert FMSE project files into our scenario format. This
  depends on the `.fms` format being documented clean-room by Asset & Formats; nothing about it is known
  yet beyond the manual saying the file exists.

---

## 10. Campaign structure

Proposal: one **campaign graph** per empire, as data. Nodes are missions (unique story missions and
generic mission templates); edges are conditions on the previous `MissionResult` and campaign variables.
The campaign layer owns the player's fleet, prestige, rank, date and variables between missions.

Empires (from `docs/plan.md` and the API R1.3 race enum). **Every row is unverified** until an EAW
2.036 + 2.037 copy has been checked:

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
| Orion (EAW faction) | **not yet verified** | The plan lists an Orion campaign. In the EAW API R1.3 headers Orion is an NPC race. Whether EAW 2.036 has an Orion campaign or only Orion ships and races is not yet verified |

**The roster still has to be confirmed against the reference EAW 2.036 + 2.037 install on the private VM**,
including which campaigns ship, how many missions each has, and the Orion question above. Nobody has that
copy yet, so the Phase 5 estimate stays provisional.

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

- Missions run in the sandbox (4.2) with no ambient authority: no network, storage, DOM or clock.
- Capabilities are explicit: a mission manifest lists the API areas it uses; the loader refuses unknown
  capabilities and shows them to the player before loading a third-party mission.
- **Data validation** at load: every ship class, empire, text key and audio cue must resolve against the
  player's data or the mod's own declared data.
- **Resource caps:** max entities spawned, max timers and triggers, max commands per tick, max message
  length, per-tick budget. Hitting a cap is a deterministic, logged fault.
- **Integrity for multiplayer:** all peers hash the mission bundle and scenario; mismatches block the
  match. Lockstep peers must run byte-identical mission code.
- **No game files in mods we ship.** Community packs the player owns are loaded from the player's disk,
  same rule as the base game.
- **API versioning:** `apiVersion` in every mission; the runtime keeps old versions working or refuses
  with a clear message.

---

## 13. Determinism and replay testing

- **Replay harness** (with the Audio & Netcode QA Lead): run scenario + seed + input log headless, compare
  the final state hash and a per-N-tick hash trail with the expected values.
- **Mission-specific checks:** the command stream the mission produced is part of the hash, so a mission
  that behaves differently on another machine fails fast and points at the tick.
- **Cross-environment runs:** CI runs replays in at least two JS engines (for example V8 via Node and
  SpiderMonkey or JavaScriptCore) to catch engine-dependent behaviour, once the Engine Lead confirms the
  sim itself is engine-independent.
- **Fuzzing:** random input logs against each scenario to check that missions never throw, never exceed
  caps, and always reach an end state or a timeout.
- **Lint rules** for mission code: ban `Date`, `Math.random`, timers, `for...in` over untrusted objects,
  and (if decided) float arithmetic.
- **Synthetic fixtures only in the repo.** Test scenarios use invented ship class keys backed by a tiny
  synthetic shiplist fixture listed in `tools/allowed-fixtures.txt` if needed. Real-data replays stay on
  the private VM.

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

1. **Mission-runtime contract in `docs/engine/`:** the hook points in 5.1 (tick phase, event source and
   ordering, entity ids, read-only view, AI order interface, RNG streams, HUD and audio channels).
2. **Worker vs same-thread SES Compartment** for the sandbox, and how the per-tick budget is enforced
   deterministically.
3. **Fixed-point types exposed to missions:** one `Fixed` type with helpers, or plain integers in the
   swappable distance unit? Can mission code use floats at all?
4. **Command application point** in the tick, and whether a spawned entity is visible to other systems in
   the same tick or the next.
5. **Snapshot vs query API** for mission reads (cost of snapshotting per tick vs synchronous queries).
6. **Confirm the RNG stream API:** is `ctx.rng("mission")` per mission instance, and how is it derived
   from the match seed?

### Combat Systems Designer

1. Tick length of a Taldren **"game turn"** for porting `kTimerTurnsSet` timers.
2. The AI order set and priorities missions can rely on (6.6), and which orders are hard overrides.
3. Damage event severity buckets for `shipDamaged`, and which system/stores changes should raise events.
4. Capture and disengage semantics that victory presets depend on.

### Asset & Formats Engineer

1. The **ship class key** missions should use from `shiplist.txt` (class name, hull type, or both), and how
   duplicate names across empires are handled.
2. Where mission text lives in the installed data (if anywhere outside compiled `.scr` files), and the
   string-table format.
3. Once a copy exists: whether the EAW 2.036 + 2.037 reference install contains mission metadata we can read (mission lists, campaign tables), and what the 2.037 patch changed.
4. Feasibility of a clean-room `.fms` (FMSE project) reader, later.

### Producer

1. **Getting an EAW 2.036 + 2.037 reference copy** onto the private VM (with Wintermute). Until then, every
   roster and mission-inventory claim stays unverified and the pilot choice is provisional.
2. Which **pilot mission** for Phase 4, and which empire's campaign is the "first campaign" exit target.
3. Whether a `docs/missions/` folder and `ports/` notes need a CODEOWNERS entry.
4. Phase placement of the scenario editor (Phase 8 or a later stretch).
5. File the Phase 4 issues for: runtime sandbox, scenario format, state-machine layer, victory presets,
   campaign graph, replay harness, pilot port.

### Audio & Netcode QA Lead

1. Fault policy for a mission that blows its budget, so all lockstep peers behave the same.
2. Whether mission commands go in the replay log or are regenerated (proposal: regenerated and hashed).

### Daniel

1. Whether third-party missions should be allowed in multiplayer at all, or only in single player at first.
2. Cursor cloud agents are still open; nothing in this doc depends on that decision.
   (Decided and reflected here: name SFC2.js, TypeScript, EAW 2.036 + 2.037 reference, EAW HUD;
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
