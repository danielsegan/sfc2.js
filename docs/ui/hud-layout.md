# Tactical HUD layout: preserved arrangement, clean-up and empire skins

Status: draft v0.1 (2026-11-24). Owner: UI & Art Director. Baseline: Community Edition (CE) 2.670.

Why this exists: Daniel's playtest feedback was that the ship should be moved and turned with the mouse as in the original, that the original UI should be **cleaned up and preserved**, and that the main UI should **change with the selected empire**. This file sets the panel arrangement, the clean-up rules, the per-empire skin contract and the HUD side of mouse helm. It refines the "Layout overview" sketch in `hud-spec.md` and the regions in `style-guide.md` §1, which were drawn before this research.

Related files:

- `hud-spec.md`: what each component reads from the `ViewModel` and which `Command`s it sends. Unchanged by this file.
- `style-guide.md`: tokens, fonts, chrome and icons. §4.2 accent values are reused here.
- `modern-ux.md`: integer HUD scale, safe area, ultrawide, accessibility settings.
- `asset-pipeline.md`: sprite slots and the per-slot source fallback.
- `keymap.md`: the modern default bindings.
- `empire-skins.md` (being written in a separate PR alongside the mouse-helm and skin-layer code): how the skin layer is built. This file is the **spec** that the skin layer implements. Where the two disagree, raise it in review rather than silently diverging.

Rules that apply throughout:

- **Clean room.** The description of the original below is our own paraphrase of public manuals and community guides, cited by page or section. No screenshots, art or long text are reproduced. We never consult decompiled code.
- **TO VERIFY** marks every claim about where something sits on the original screen. Our main source is the original 2000 release manual, so the CE 2.670 layout may differ. Each item stays TO VERIFY until it has been checked against CE 2.670 notes (Wintermute's per-empire HUD reference notes; the screenshots themselves stay with Daniel).
- **HUD reads, never writes.** The HUD reads the per-frame read-only `ViewModel` and sends `Command`s to the input queue (`hud-spec.md` §0). Nothing in this file defines sim behaviour. Turn rates, acceleration and what a heading order does belong to Combat (`docs/rules`) and Engine (`docs/engine`).

---

## 1. Sources

| Id | Source | Used for |
| --- | --- | --- |
| M2 | *Starfleet Command 2* Gameplay Manual & Reference Guide (TrekCore mirror, [sfc2.pdf](https://gaming.trekcore.com/starfleetcommand2/downloads/sfc2.pdf)), "Take the Conn" pp. 108–117, Communication p. 131, Mini Map p. 138, Tactical Ship Schematic & System MFD pp. 150–153, Shuttle Conversion p. 169 | Screen components, what each shows, mouse movement and targeting |
| Q1 | *Starfleet Command* (SFC1) Installation & Quickstart Manual (TrekCore mirror, [SFCquick.pdf](http://gaming.trekcore.com/starfleetcommand/downloads/SFCquick.pdf)), tactical screen callout list | Ancestor layout; component list of the interface bar. SFC1, so a hint only. |
| G1 | GameFAQs strategy guide for *Empires at War* ([faqs/10875](https://gamefaqs.gamespot.com/pc/339659-starfleet-command-volume-ii-empires-at-war/faqs/10875)), §3.2.1 | Community note that the energy panel sits in the multi-function display at the top left |
| G2 | GameFAQs strategy guide by kschang77 ([faqs/17237](https://gamefaqs.gamespot.com/pc/339659-starfleet-command-volume-ii-empires-at-war/faqs/17237)), §3.8 | Tactical map contacts are colour-coded per race |

---

## 2. The original tactical screen, in our words

M2 splits the tactical screen into three parts: the **3D space view**, an **upper and a lower data display** that are always visible, and an **interface bar** that holds most of the controls and can be slid off screen with one button or key when not needed (M2 pp. 108–109).

### 2.1 Upper data display (always visible)

Your own hull-integrity bar, the phaser capacitor bar (clickable to set its recharge rate), the target's hull-integrity bar, and two mission timers (elapsed, and a countdown for critical events) (M2 pp. 112–114).

- Left-to-right order of these four items: **TO VERIFY**.

### 2.2 Lower data display (always visible)

- **Speed:** a number plus a bar showing current speed, with a separate marker for desired speed. Clicking the bar moves the marker (M2 p. 115).
- **Energy:** two bars on the same scale. The power bar is what warp, impulse and auxiliary reactors produce; the systems bar under it is what is being used and requested. Systems longer than power means overdraw (M2 p. 115).
- **Alert buttons:** green, yellow and red alert, plus the current alert state. The red alert control is in the **lower right** of the tactical screen (M2 "Red Alert", early chapter). **TO VERIFY** for CE 2.670.
- **Fire selected weapons** button (M2 p. 116).
- Left-to-right order of speed, energy, alerts and fire: **TO VERIFY**.

### 2.3 Interface bar (slide in/out)

Four sections (M2 p. 108):

1. **Officer MFD.** One page at a time, picked from an **officer icon strip on the right side** of the MFD (M2 p. 116). Pages, top to bottom: Helm, Repair, Science, Security/Marines, Weapons, Communication, Defense, Tactical Map, Fleet Orders, Energy Management, Preferences (M2 p. 117).
   - The **energy allocation panel** is the Energy Management page: sliders for movement, weapons, shields, tractors, sensors, other, plus excess energy and battery (M2 pp. 144–146).
   - The **message log** is the Communication page: four filter toggles at the top (engineering, mission, science, fleet), newest message at the bottom, scrollable, with reply buttons below (M2 p. 131).
   - The **tactical map / sensor view** is the Tactical Map page, a mini map with your ship as a dot in the centre, a heading tick and zoom buttons (M2 p. 138). Contacts are colour-coded per race (G2). In the original it is **one officer page among eleven, not a permanently visible radar**.
   - The **helm** page holds the special movement commands: emergency deceleration, erratic maneuvers and the high-energy turn buttons, including a free-angle HET set by clicking in the 3D view. Ordinary turns are made in the 3D view and ordinary speed on the lower speed bar (M2 pp. 117–119).
   - Placement: G1 places the MFD with the energy panel at the **top left** of the screen, and M2 p. 169 says the shuttle conversion panel appears in the **upper portion of the screen along with the officer panels**. Officer MFD in the upper left: **TO VERIFY**.
2. **Ship schematic.** Your ship's schematic, with the **six shield indicators around it**, a highlight on the arc facing your target, and the **weapon hardpoint icons on top of the schematic**. Each icon shows weapon type, sub-type and a dot per weapon at the hardpoint, plus charge bars. Clicking icons selects weapons (M2 pp. 150–152). This is the **shield display**, the **weapon status** and the visible half of the **ship systems display**.
3. **System MFD.** Opened from **six system buttons on the left side of the schematic**: Shields, Electronic Warfare, Transporters, Tractors, Shuttles, Shuttle Conversion (M2 p. 150). The Shields page has raise, lower and normal, a reinforcement slider, reinforce and reinforce-all, and the six arcs to select (M2 pp. 153–155).
4. **Target schematic.** The target's schematic and the status of its weapons, at a detail level that depends on range and scan (M2 pp. 111–112).

- Where the interface bar sits (bottom edge, or split between upper and lower), and the left-to-right order of sections 2–4: **TO VERIFY**.

### 2.4 3D space view

- **Turn by left-clicking** where you want to head. Left-clicking an enemy ship sets a course straight at it (M2 pp. 109–110).
- While turning, an **arc is drawn between the current and the desired heading**, colour-coded in four bands by how long the turn will take, from a quick correction to a turn of more than 90° (M2 p. 110).
- **Right-click** a unit or its tag to target it. A reticle appears on the target and the target schematic updates (M2 p. 111).
- Floating **unit tags** show class or name, range, speed and damage per volley, depending on the HUD information level set by three keys (M2 pp. 111–112).
- Off-screen targets get an edge icon (Q1, SFC1; **TO VERIFY** in SFC2).
- Camera views are on function keys and in Preferences (M2 p. 109).

### 2.5 Mapping to `hud-spec.md` components

| hud-spec component | Where the original puts it (all **TO VERIFY**) |
| --- | --- |
| 1 Energy allocation | Lower display power/systems bars (always) + Officer MFD Energy Management page |
| 2 Shields | Ring around the ship schematic (always) + System MFD Shields page |
| 3 Weapons | Hardpoint icons on the schematic (always) + Officer MFD Weapons page + fire button in the lower display |
| 4 Target info | Unit tag in 3D view + target hull bar (upper) + target schematic |
| 5 Damage / ship systems | Ship schematic + Officer MFD Repair page |
| 6 Sensor map | Officer MFD Tactical Map page |
| 7 Speed and helm | Lower display speed bar + 3D view clicks + Officer MFD Helm page |
| 8 EW, 9 tractor/transporter, 11 shuttles | System MFD pages |
| 12a Message log | Officer MFD Communication page |
| 12b Alerts | Alert buttons and status in the lower display |

---

## 3. Cleaned-up layout (proposal)

Same arrangement, same reading order, same panel identities. A player of the original should find every panel where they expect it.

```
+-----------------------------------------------------------------------------+
| UPPER DATA DISPLAY: [own hull][phaser cap]   [timers]   [target hull]       |
+-------------------------+                                                   |
| OFFICER MFD       |strip|                                                   |
| (one page: Energy,|  H  |                                                   |
|  Comms, Map, Helm,|  R  |              3D SPACE VIEW                        |
|  Repair, ...)     |  ...|   heading ghost + turn arc, unit tags, reticle    |
+-------------------------+                                                   |
|                                                                             |
+--------+-------------------------+--------------------+---------------------+
| SYSTEM | SHIP SCHEMATIC          | SYSTEM MFD         | TARGET SCHEMATIC    |
| BUTTONS| 6 shield arcs around,   | (Shields / EW /    | target arcs, weapons|
| (6)    | hardpoints on top       |  Transp / Tractor /| detail by scan      |
|        |                         |  Shuttles / Conv)  |                     |
+--------+-------------------------+--------------------+---------------------+
| LOWER DATA DISPLAY: [speed + desired marker][turn rate][power/systems] [FIRE][G Y R] |
+-----------------------------------------------------------------------------+
```

Our drawing, not a trace. Every position above is the working assumption from §2 and is **TO VERIFY**. If the CE 2.670 notes put the interface bar elsewhere, we move the blocks as wholes and keep the reading order.

### 3.1 Preserved (skins and clean-up must not change)

1. **Region set and placement:** upper display, officer MFD with its icon strip, interface bar sections in their order, lower display, 3D view in the middle.
2. **Officer MFD is paged.** One page at a time, chosen from the strip, in the original page order. The tactical map and message log are pages, as in the original.
3. **The interface bar can be hidden** with one action (`hud.toggleInterfaceBar`, binding to be added to `keymap.md`). The upper and lower displays stay.
4. **Shield arcs sit around the ship schematic** and hardpoint icons sit on it, with the facing-the-target highlight.
5. **Mouse grammar in the 3D view:** left-click sets heading, left-click on a hostile sets course at it, right-click targets (§5).
6. **The speed bar with a desired-speed marker**, and **power vs systems bars on one scale**.
7. **Panel names and icons stay recognisable.** Labels use the original wording paraphrased only where needed (strings come from the player's install where available, `hud-spec.md` §12a).

### 3.2 Cleaned up

| Area | Original problem (in general terms) | Clean-up |
| --- | --- | --- |
| Frames | Fixed-size bitmaps that blur or band when scaled | Fallback and placeholder frames are **vector or 9-slice** (`SpriteSlot.nineSlice`, `asset-pipeline.md` §2). Corners and trim stay crisp at every N; only the 9-slice centre and edges stretch. Install bitmaps keep the integer-scale rule. |
| Scaling grid | Authored for one low resolution | Layout on the existing **1024 × 768 logical canvas, 8-unit base grid** (`style-guide.md` §1). Every panel rect, gutter and hit target is a multiple of 8. Placeholder plates are authored at **2× and 4×** (16 and 32 px per unit) so HD screens never upscale them. |
| Spacing | Uneven gaps between panels | 8-unit gutters, 8-unit padding, panel headers 16 units, aligned baselines across the bottom row. |
| Type | Small bitmap text | Style-guide fonts and sizes; minimum 11 physical px; tabular figures for every number; numbers always beside bars. |
| Ultrawide / safe area | 4:3 only | Use `modern-ux.md` §2 modes. **Safe-area centred** keeps the whole arrangement inside a 4:3 box. **Wide** moves the officer MFD block to the left edge and the target schematic to the right edge, keeping the rows and order; the centre 3D view stays clear. All interactive HUD stays inside the platform safe area (CSS `env(safe-area-inset-*)` in the HTML layer; a 2% inset on the canvas in Tauri fullscreen on TVs/projectors, opt-in). |
| Discoverability | Icon-only buttons | **Hover tooltips** on every button, strip icon, hardpoint and bar: name, current value, bound key. 400 ms delay, instant once one is open, never over the 3D view's cursor point, dismissed on click. Tooltips are HTML (screen-reader readable) positioned from the canvas hit map. |
| States | Colour-only cues | State shape/pattern cues per `style-guide.md` §4.1. |
| Mini map | Only visible as one page | Stays a page by default (preserved). Optional **pinned mini map** in Wide mode only, off by default, in the right-hand margin outside the 4:3 box. |

---

## 4. Empire skin contract

The main UI changes with the empire the player commands. A skin changes **how** panels look, never **where** they are or **what** they say.

### 4.1 Roster

Repo evidence: `docs/plan.md` lists Federation, Klingon, Romulan, Lyran, Hydran, Gorn, ISC, Mirak plus Orion Pirates. `docs/missions/mission-roster.md` finds name tokens for all of these in CE 2.670 except Orion (no Orion-named file). `docs/formats/shiplist.md` row "Empire / race → empire colour scheme and HUD skin" is unverified.

| Skin id | Empire | Notes |
| --- | --- | --- |
| `fed` | Federation | |
| `kli` | Klingon | |
| `rom` | Romulan | |
| `lyr` | Lyran | |
| `hyd` | Hydran | |
| `gor` | Gorn | |
| `isc` | ISC | |
| `mir` | Mirak | |
| `ori` | Orion / Interceptor | **TO VERIFY.** Whether CE 2.670 has a playable Orion side with its own HUD is unverified. The only "Interceptor" in the repo is a mission module name (`Uni_X2M1Interceptor.scr`), so we don't yet know whether "Interceptor" is a separate side, an Orion variant or only a mission. Until checked, `ori` is one skin, with `interceptor` as an alias that resolves to it. |

The skin id is chosen from the **player's empire** (the shiplist `race` token of the ship under command in skirmish, or the campaign's empire), never from the target. Mapping `race` tokens to skin ids: **TO VERIFY** with Asset & Formats once CE tokens are confirmed. An unknown token gets the neutral default.

### 4.2 Tokens each empire supplies

```ts
// Proposal for the skin layer (names open to review in the empire-skins PR).
type EmpireSkinId = "fed"|"kli"|"rom"|"lyr"|"hyd"|"gor"|"isc"|"mir"|"ori"|"neutral";

interface EmpireSkin {
  id: EmpireSkinId;
  frame: {
    plate: string;                 // sprite slot id, e.g. "skin.frame.plate" (resolved per §4.4)
    nineSlice: [number, number, number, number]; // insets in logical units; trim lives only inside them
    trim?: string;                 // optional decorative slot drawn inside the insets
  };
  accent: {
    primary: string;               // style-guide §4.2 --emp-* accent
    secondary: string;             // style-guide §4.2 secondary
    cvd?: Partial<Record<"deut"|"prot"|"trit", { primary: string; secondary: string }>>; // §6
  };
  panelBg: { color: string; opacity: number; texture?: string }; // texture = optional low-contrast slot
  type: { headerWeight: 500|600|700; headerCase: "smallcaps"|"upper"; tracking: number }; // families stay fixed
  glyphs: {
    mark: string;                  // empire mark slot: our own abstract glyph
    code: string;                  // 3-letter text code, e.g. "FED", shown next to the mark
    iconJoin: "chamfer"|"notch"|"step"; // stroke treatment for the icon set; icon meaning never changes
  };
  sounds: { panelOpen: string; panelClose: string; click: string; alertTone: string }; // hook ids → audio cue mapper
}
```

- **Sounds hook:** ids only. The audio cue mapper (Audio & Netcode QA Lead, `style-guide.md` §7) resolves each id from the player's install, then neutral cues. The HUD never plays files directly.
- **Fonts:** families stay as in `style-guide.md` §3 for readability. Skins change weight, case and tracking only.

### 4.3 Layout invariants (skins must not change)

1. Panel rects, anchors, z-order and the reading order in §3.
2. Hit-target sizes (24 × 24 units minimum, 32 × 32 in large-targets mode) and focus ring.
3. Text sizes, numeric formats, tabular figures, and **all text colours** (`--text`, `--text-dim`).
4. **State tokens** (`--state-*`, `style-guide.md` §4.1) and their shape cues. Accent colours never carry state and never re-tint a state.
5. Icon meaning and silhouettes for weapons, systems and alerts (only the join treatment may vary).
6. Tooltip content and placement rules, accessibility mirror and live regions.
7. Frame art never draws outside its 9-slice insets into content, and never covers a number or bar.
8. Switching skin causes no layout reflow: a test renders every skin at the same N and compares the hit map (rects and ids), which must be identical.

### 4.4 Resolution order (per slot, per skin)

1. **Player's install bitmaps, at runtime.** Loaded from the player's own files via the importer once a `sprites.q3` reader exists (`asset-pipeline.md` §3a). Kept in browser storage, never uploaded, never committed, never in CI artefacts.
2. **Original placeholder plates** in `web/art` (proposed path `web/art/skins/<id>/`), drawn by the project.
3. **Neutral default**: the `style-guide.md` §2 chrome with `--panel-edge` in place of an accent.

Fallback is per slot, so a partly read install still shows. The `?hudDebug=1` overlay (`asset-pipeline.md` §2) reports the source of every skin slot. An opt-in HD pack (`asset-pipeline.md` §1) may sit above step 1 only when the user turns it on.

### 4.5 Legal guardrails (placeholders)

- **Never commit original art.** CI's No game files check stays strict; placeholder plates are SVG drawn by us.
- **No Paramount trade dress:** no delta or arrowhead insignia, no LCARS (no rounded elbows, pill blocks or colour-bar sweeps), no copying real empire logos or emblems from the shows, books or games.
- Placeholder motifs are **original abstract patterns** only. Starting points (all ours, all to be drawn in review, none tracing an existing emblem):

| Skin | Placeholder motif (abstract) |
| --- | --- |
| `fed` | Twin hairline rails along the top edge, even 45° chamfers |
| `kli` | Asymmetric notched corners, a single serrated edge on the outer side |
| `rom` | Stepped, overlapping chevron bands along one edge |
| `lyr` | Three short parallel diagonal slashes in one corner |
| `hyd` | Small hexagonal cell texture at low contrast in the plate |
| `gor` | Thick, heavy bevel with blocky corner caps |
| `isc` | Fine concentric arcs and a precise thin grid |
| `mir` | Terraced, staircase-stepped corners |
| `ori` | Mismatched riveted panels, offset seams |
| `neutral` | Style-guide chrome, no motif |

---

## 5. Mouse helm: HUD affordances

The HUD draws these from the `ViewModel` and sends `Command`s; it does not compute or predict sim movement. Field names are proposals for Engine and Combat.

| Affordance | Where in the preserved layout | Reads | Sends |
| --- | --- | --- | --- |
| **Heading cursor** | 3D view. When the pointer is over open space, the cursor becomes a helm reticle and a faint **target-heading ghost** (a line from own ship to the point, projected on the movement plane) previews the order. Over a hostile, the ghost snaps to it and the cursor shows "course to". Over any HUD panel the helm cursor is off. | `self` pose, contacts (blended) | left-click: `setHeading` (or `setCourseTo` a ship, **TO VERIFY** naming with Engine) |
| **Ordered heading ghost** | 3D view, anchored to own ship, until the heading is reached | `HelmView.headingOrdered16` | — |
| **Turn arc** | 3D view, between current and ordered heading, as the original does. Four bands by remaining turn time, each with **colour + dash pattern**, plus an optional numeric "s to heading" label | proposed `HelmView.turnTicksRemaining` (supplied by the sim, not derived by the HUD) and band thresholds from Combat | — |
| **Turn-rate indicator** | Lower display, right of the speed bar: a small horizontal gauge of current turn rate vs the limit at this speed, with the turn mode as text | `HelmView.turnRateLimit16PerTick`, proposed `turnRateNow16PerTick`, turn mode | — |
| **Speed control** | Lower display speed bar. Click or drag sets the desired-speed marker; wheel over the bar steps it; keys per `keymap.md`. A "max for power" tick shows on the bar. | `HelmView.speed`, `speedOrdered`, `speedMaxForPower` | `setSpeed` |
| **Helm page** | Officer MFD Helm page: emergency deceleration, erratic, HET buttons; HET free angle switches the 3D cursor to an "HET angle" mode until click or Esc | `HelmView` toggles | `helmToggle`, HET command (**TO VERIFY** with Combat) |

Pointer rules:

- **Hit testing order:** HUD canvas hit map → HTML tooltips/menus → 3D view. A click on a panel never reaches helm.
- **Click vs drag:** a press that moves less than 4 logical px before release is a click. Right **click** targets (original); right **drag** orbits the camera (`keymap.md`). Wheel over the 3D view zooms; over the speed bar it changes speed.
- **Pending state:** after a click, the ghost shows "ordered" style immediately (optimistic) and settles when the next snapshot confirms `headingOrdered16`; a rejected order clears it and logs the reason (`hud-spec.md` §14).
- **Keyboard parity:** every mouse helm action keeps a key path (`keymap.md`), and the HTML mirror announces the ordered heading on request.

---

## 6. Accessibility

- **Accents are decoration, never state.** Empires are always told apart by **mark glyph + 3-letter code**, never by colour alone, including on the mini map (where the original colour-codes races, G2) and on unit tags.
- **Colour-blind check of the current `style-guide.md` §4.2 accents** (our own simulation, Machado-style matrices, CIELAB distance below 15 flagged): deuteranopia confuses `fed`/`ori` (very close) and `gor`/`mir`; protanopia confuses `lyr`/`gor` and `fed`/`ori`; tritanopia confuses `rom`/`hyd`, `fed`/`rom` and `fed`/`hyd`. These pairs need a `cvd` override (§4.2) or a value change; this matters most in mixed-empire skirmish views. Proposed values: in the follow-up style-guide PR.
- **Contrast minimums:** text 4.5:1 against its plate (7:1 in high-contrast mode); accent strips, bars, frame edges and focus ring 3:1 against the adjacent plate (WCAG 1.4.11). Against `--panel-bg #0B1118`, all nine accents pass 3:1; `kli #B23A3A` is lowest at about 3.2:1, so it may not be lightened by any skin texture and is never used for text. Skin `panelBg` textures must keep text at 4.5:1 at their brightest pixel.
- **Klingon red vs damage red:** the `kli` accent is close in hue to `--state-damage` and `--state-hostile`. Because damage always carries cross-hatch and broken outline, this is acceptable, but a `kli` plate must never use hatch patterns.
- **UI scale range:** HUD canvas `N = 1 … Nmax` (whole steps, `modern-ux.md` §1), capped at 4. HTML text 100–200%. If Daniel approves the opt-in fractional scale (`modern-ux.md` Q1), vector and placeholder skins may scale 1.0–2.0 in 0.25 steps; install bitmaps stay integer.
- **Reduced motion:** no skin animates frames; the turn arc does not pulse under `prefers-reduced-motion`.

---

## 7. Open questions

**Wintermute (CE 2.670 per-empire HUD reference notes, written notes only)**

1. Where does the interface bar sit, and in what left-to-right order are the ship schematic, system MFD and target schematic? Is the officer MFD in the upper left?
2. Order of items in the upper and lower data displays; position of the alert buttons and fire button.
3. Per empire: does the frame art, the accent colour or the layout change? Does any empire move or add a panel? (Our assumption: art and colour change, layout does not.)
4. Is there a separate Orion or "Interceptor" HUD in CE 2.670?
5. Does the turn arc still use four time bands, and is there an on-screen message ticker besides the Communication page?
6. HUD information levels (three keys in M2): which tag fields show at each level?

**Asset & Formats**

7. Which `sprites.q3` entries hold per-empire frames, and how are they keyed to the `race` token? Exact CE `race` tokens.

**Engine / Combat**

8. `turnTicksRemaining`, `turnRateNow16PerTick` and turn-mode text in `HelmView`; band thresholds for the turn arc.
9. A `setCourseTo(ship)` command, or does left-click on a hostile send a plain `setHeading`?
10. HET command shape.

**Daniel**

11. Original mouse grammar (left-click helm, right-click target) as the default, with right-drag for camera orbit? This changes `keymap.md`'s left-click-on-map rule only for the 3D view.
12. Mini map as a page only (original) or the optional pinned map in Wide mode?

**Cloud agent / empire-skins PR**

13. Align `empire-skins.md` types and slot ids with §4.2 and the resolution order in §4.4 during review.
