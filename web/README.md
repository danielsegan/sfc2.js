# web/

Browser application. Two pages, two Vite configs:

| Page | Command | Port | What it is |
| --- | --- | --- | --- |
| Tactical duel | `pnpm dev:web` | 1701 | Skirmish of up to six ships |
| Ship viewer | `pnpm dev:viewer` | 4174 | Phase 1 catalog. Every shiplist row, spun with its texture |

The install picker is `@sfc2js/platform`: `preferredDirectoryPicker()` uses the File System Access API when the browser has it, and a `webkitdirectory` input otherwise. Inside the Tauri shell it uses the native folder dialog instead. Browser behavior is unchanged. `importZipArchive` reads a zip the player supplies. `pickAndImport` indexes the result. Textures are loaded with `@sfc2js/render`'s `loadShipTexture`. Nothing is uploaded. See [docs/formats/bmp.md](../docs/formats/bmp.md).

## Tests

`pnpm test` runs every vitest suite. The empire skin hit-map test (`web/src/skins/hit-map.test.ts`) renders `web/index.html` in headless Chromium through Playwright, so install the browser once per machine first:

```sh
pnpm exec playwright install chromium
```

CI installs it in the Unit tests workflow.

## Pointing the dev server at an install

`pnpm dev:web` and `pnpm dev:viewer` can read a folder without the picker. Set `SFC2_INSTALL` to an absolute path, or open the page with `?install=` set to that path. The dev server lists and reads the files in place under `/__dev/install/`. It does not copy them into the repo or into `web/dist`. The route is serve-only, so `pnpm build:web` does not embed an install.

```
SFC2_INSTALL=/path/to/install pnpm dev:web
SFC2_INSTALL=/path/to/install pnpm dev:viewer
```

A headless browser can open `http://127.0.0.1:1701/?install=/path/to/install` (viewer port 4174) and skip the folder button.

## Ship viewer

`web/ship-viewer/` reads the Assets/Specs shiplist when that copy is present, builds a mesh for every row, and spins the current ship with its texture and self-illumination. A row that fails is listed with a `source.code` reason.

`?demo=1` loads an invented install built in memory. Real Community Edition files stay on the player's machine. Keys use `KeyboardEvent.code` (Modern profile).

## Tactical duel

The tactical page is a skirmish of up to six ships on the duel console: target and sensor over the 3D view, then energy, six shields, weapons, and helm, plus slots for EW, tractor, cloak, fighters, and mines. A setup row for each slot picks side, empire, ship, and whether you or a captain drives it. **Synthetic 3v3** fills three a side from the placeholder catalog. Chrome uses the project's own plates and accent colours. It is not an Orion Pirates skin. Art under `art/` is original placeholder art.

`pnpm build:web` writes `web/dist/`.

### Synthetic fixture

Path: [`engine/duel/fixture.ts`](../engine/duel/fixture.ts).

The page boots a Federation fixture cruiser against a Klingon fixture cruiser, 24 range units apart. The second ship is an AI captain. The cruiser is the saucer placeholder and the frigate is the long-boom placeholder, both with invented coordinates. The hull bytes are built in memory by `engine/duel/placeholder-mod.ts` and loaded with `parseMod` and `buildShipMesh`. No game file is required. The one-on-one harness `createSyntheticDuel()` is still the inert pair used by the duel tests.

Orders go through the session. The payload does not carry a tick. The default keymap is the modern profile in [docs/ui/keymap.md](../docs/ui/keymap.md): `W`/`S` speed, `A`/`D` yaw, `X` stop, `Space` fires the selected group, `1`–`6` pick a group, `Tab` cycles hostile targets, and the **Keys** button rebinds any of them. Click a contact in the target list to select it. Ships on your side are not fired on. AI captains queue energy, helm, fire, EW, overload, tractor, cloak, fighter, PF, mine, and raid verbs from inside the sim. The time-scale control only changes how many 30 Hz ticks the driver runs per second. A photon launch is the combat verb; the shot then flies on its own.

The console follows the SFC2 arrangement: target and sensor above the 3D view, then energy allocation, six shields, weapons, and helm, with a second row of EW, tractor, cloak, fighter, and mine slots. Those slots are simulated. Their keys issue orders: ECM and ECCM, overload and proximity on a photon, tractor hold and repel, cloak, fighter and PF launch, recall, lay mine, boarding, and hit-and-run. A hull with no cloak says so and the cloak key does not send an order. Reverse, erratic maneuvers, and drones are still outside this duel. Art under `art/` is original placeholder art. Chrome uses the project's own plates.

### Play field

The 3D view opens nearly overhead, centred on your ship. The wheel zooms. Middle-drag and Alt-drag orbit and never steer. `V` switches to the chase camera and Home resets to overhead. A plain left-click in the view or on the sensor map stores a fixed heading toward that point. A ship under the cursor is only the bearing. Right-click under 4 logical pixels targets. A wedge from the current nose to the ordered heading is orange under about 150° and dark red from there up.

The field is black, with a sparse procedural star disk that follows the camera and a world-fixed grid. Grid colour is the `--field-grid` token (`#2A4C7A`). Minor lines sit on each range unit and major lines on every fifth. When minor lines would be closer than 16 CSS pixels they fade, and the next ×5 step takes over. Selected weapons draw translucent wedges out to the range on the view model. Reload-counted racks (`DroA`, `DroB`, `DroC`, `DroF`, `DroG`, `ADD6`, `ADD12`) draw none; `DroI` and `DroVI` keep theirs. A beam is drawn only when an event already names a shooter, a target, and a beam family. A hit event flashes the reported shield facing. Off-screen contacts get an edge tag with a hostility shape, an original empire mark and 3-letter code, the class or name, and the display range. The hull bars read hull boxes, not shield totals. A white heading tick beside your ship reads `headingOrdered16` when the view model has it, and the current heading otherwise. Off-screen tag marks stay on their own paths for now; reusing the empire skin marks is a later change. The helm panel is a 3×3 of disabled high-energy-turn arrows plus Orbit and Go.

Thin bars sit above the view and below the console: hull, phaser capacitor, mission clock, and target hull on top; speed, turn rate, power and systems, Fire, and the alert lamps below. They stay put when the console is open. Bar heights are 24 and 32 units times `--hud-scale`, including fractional scales such as `?hudScale=1.5`, and the WebGL canvas is sized in device pixels so the picture is not a stretched bitmap. Empire accent is only the bar edge. The grid, wedges, beams, and tags stay on the neutral state tokens. This page does not add a mini map; the sensor drawing already on the view is unchanged.

### Sound

`sounds.txt` is parsed by `parseSounds` (`docs/formats/sounds.md`). The page looks for `assets/sounds/sounds.txt` in the dev install (`SFC2_INSTALL`, or `?install=` passed through as the dev-server root) and in a folder or zip the player picks. Matching WAV files are read from that same place and decoded in the browser. Nothing is copied into the repo. Weapon fire, hits, shield loss, and alerts from the view's event list trigger cues. Master, effects, and alerts sliders set the Web Audio gains.

A headless harness is `createSyntheticDuel()` in `engine/duel/match.ts`. Call `frame(dt)`, then `setSpeed`, `orderYaw`, `orderFire`, or `issue(kind, payload)`, then `view()`. Building the view does not change the sim hash.

### Player files

**Load install folder** uses the platform directory picker. **Zip** reads an archive the player supplies. Both stay in the browser. The default pair is the Federation heavy cruiser (race Federation, hull CA, class `F-CA` when that row exists) against the Klingon D7 (class `K-D7`, or the closest Klingon cruiser hull). If either row is missing, the duel takes the first two ships of different empires that have a phaser or photon, and the log names the rows. The two ship menus can pick any other pair. That opponent is an AI captain. With an install loaded, the six skirmish slots list those ships by empire. Models load through `parseMod` and `buildShipMesh` when the geometry file is in the folder. A missing model keeps the placeholder hull. Ships from the install turn on the measured normal-turn curve (`docs/rules/turning.md`, unmeasured hulls on its `default` row). A hull with no curve and no playtest rate uses the documented fallback yaw, warns once, and keeps the ordered speed.
