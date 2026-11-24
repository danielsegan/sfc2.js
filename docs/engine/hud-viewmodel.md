# HUD ViewModel contract

Status: **Draft, Engine Lead, Nov 23 2026.** Supports [#21](https://github.com/danielsegan/sfc2.js/issues/21) (determinism.md B3, T5). This is the engine side of [`docs/ui/hud-spec.md`](../ui/hud-spec.md) §0 (PR #39), and it supersedes that section's "pending docs/engine HUD contract". Baseline **CE 2.670** per [#37](https://github.com/danielsegan/sfc2.js/issues/37) (SFC2 HUD, not Orion Pirates). Package: `engine/view`, consumed by `web/`.

## 1. Rules

- The HUD gets **one read-only `ViewModel` per display frame**. The builder in `engine/view` makes it from the **previous and current snapshots plus `alpha`** (0–1, from the driver, sim-core.md §1).
- **Only positions and headings blend** (headings along the shortest arc in BAM). There is no extrapolation. **Gauges show the current tick's values** (energy, shields, charge, damage, counts).
- **One-off events:** the frame carries the `SimEvent`s of every tick stepped since the last frame (0–8 ticks), in tick order, converted to `HudEvent`s. Each event is delivered exactly once.
- Conversion from fixed point to display units happens **only** in the builder and `hud/units.ts` (`toDisplayRange`, `deg = h * 360 / 65536`). Floats are allowed here, since this is outside the sim.
- The HUD **never writes sim state**. Player actions go through `session.issue(kind, payload)`. The session stamps `tick`, `slot` and `seq` (sim-core.md §7). The HUD doesn't pick ticks.
- Sensor and EW visibility filtering is applied **in the builder** for the local slot, so the HUD can't leak hidden data. The rules for what is visible are Combat's (**UNVERIFIED**).

## 2. Surfaces

- **Tactical HUD:** its own **2D overlay canvas** above the three.js view, drawn from the player's own GUI art at whole-number scale steps. Original fallback art is used where needed. **`sprites.q3` was not in the extracted CE 2.670 set on `sfc2-ci`**, so the source of the GUI art is **UNVERIFIED**, and the fallback art may be the Phase 2 default.
- **HTML:** menus, options, briefings, debriefs, hails, and **accessibility mirrors** (text tables, live regions) that read the same `ViewModel`. The canvas is `aria-hidden`.

## 3. Shapes

```ts
type Facing = 0 | 1 | 2 | 3 | 4 | 5;   // 0 = front, clockwise; same index as engine shields[0..5]
interface ViewModel {
  readonly tick: Tick;                  // current snapshot's tick
  readonly alpha: number;               // positions/headings only
  readonly self: SelfView | null;       // local slot's ship; gauges at `tick`
  readonly contacts: readonly ContactView[];   // ascending entity id; pos/heading blended
  readonly mission: { objectives: readonly ObjectiveView[]; timers: readonly TimerView[] };
  readonly events: readonly HudEvent[]; // since last frame, tick order, once only
}
interface SelfView {
  id: EntityId; classId: ClassId;
  energy: EnergyView;                   // power{warp,impulse,apr,battery} in display units
  shields: { facings: readonly { current: number; max: number; reinforced: number }[] /* len 6 */; facingBoundaries16: readonly number[] };
  weapons: readonly WeaponView[];       // one per WeaponMount, keyed by slotIndex
  systems: Readonly<Record<string, { current: number; max: number }>>;
  speed: number; heading16: number;
}
type HudEvent =
  | { kind: 'hit'; tick: Tick; ship: EntityId; facing: Facing; amount: number }
  | { kind: 'systemDamaged'; tick: Tick; ship: EntityId; system: string }
  | { kind: 'alert'; tick: Tick; id: string; severity: 'info' | 'warn' | 'crit' }
  | { kind: 'objectiveUpdated' | 'missionTimer' | 'hail'; tick: Tick; [k: string]: unknown }; // payloads: Missions + UI, OPEN
```

EW, tractor, and cloak readouts now follow [docs/rules/phase3-systems.md](../rules/phase3-systems.md). The duel `SelfView` carries `ecm`, `eccm`, `stealth`, `cloakState`, `cloakTicks`, `cloakFitted`, `tractorMode`, `tractorPaid`, `tractorLink`, and `netShift`. A contact carries `cloaked` and `detected`. Transporters, boarding, and craft stay on the hud-spec proposals.

## 4. Self-illumination maps

The three.js renderer samples `_i` self-illumination (glow) maps **by UV**. A glow map may differ in size from its base texture; never assume equal dimensions. One `_i` map is 4-bit; expand palettes to 8-bit at load. The loader that does this is [docs/formats/bmp.md](../formats/bmp.md).

## 5. Unverified / open

- The full `HudEvent` list and its payloads (hud-spec.md open Q1, mission-api.md §15 Engine Q6).
- Whether per-facing specific reinforcement exists in SFC2. Shield lettering on screen.
- The GUI art source, now that `sprites.q3` is absent from the extracted set.

## Deviations from plan.md (#8)

- The plan puts "HUD" in `web/`. Here the **builder** is in `engine/view` (headless-testable) and the drawing stays in `web/`. Proposal under #8.
- hud-spec.md's sketch `Command { kind, ship, issuedAtTick, payload }` is replaced by `session.issue(kind, payload)`. The session stamps the envelope, and `issuedAtTick` doesn't exist.
