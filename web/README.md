# web/

Browser application. Two pages, two Vite configs:

| Page | Command | Port | What it is |
| --- | --- | --- | --- |
| Tactical duel | `pnpm dev:web` | 5174 | Phase 2 one-ship-against-one view |
| Ship viewer | `pnpm dev:viewer` | 4174 | Phase 1 catalog. Every shiplist row, spun with its texture |

The install picker is `@sfc2js/platform`: `preferredDirectoryPicker()` uses the File System Access API when the browser has it, and a `webkitdirectory` input otherwise. `importZipArchive` reads a zip the player supplies. `pickAndImport` indexes the result. Textures are loaded with `@sfc2js/render`'s `loadShipTexture`. Nothing is uploaded. See [docs/formats/bmp.md](../docs/formats/bmp.md).

## Pointing the dev server at an install

`pnpm dev:web` and `pnpm dev:viewer` can read a folder without the picker. Set `SFC2_INSTALL` to an absolute path, or open the page with `?install=` set to that path. The dev server lists and reads the files in place under `/__dev/install/`. It does not copy them into the repo or into `web/dist`. The route is serve-only, so `pnpm build:web` does not embed an install.

```
SFC2_INSTALL=/path/to/install pnpm dev:web
SFC2_INSTALL=/path/to/install pnpm dev:viewer
```

A headless browser can open `http://127.0.0.1:5174/?install=/path/to/install` (viewer port 4174) and skip the folder button.

## Ship viewer

`web/ship-viewer/` reads the Assets/Specs shiplist when that copy is present, builds a mesh for every row, and spins the current ship with its texture and self-illumination. A row that fails is listed with a `source.code` reason.

`?demo=1` loads an invented install built in memory. Real Community Edition files stay on the player's machine. Keys use `KeyboardEvent.code` (Modern profile).

## Tactical duel

The duel is not the full skirmish HUD. The console follows the SFC2 layout: target and sensor above a 3D view, energy, six shields, weapons, and helm along the bottom. Chrome uses the project's own plates and accent colours. It is not an Orion Pirates skin. Art under `art/` is original placeholder art.

`pnpm build:web` writes `web/dist/`.

### Synthetic fixture

Path: [`engine/duel/fixture.ts`](../engine/duel/fixture.ts).

Two original hulls, `Test CA` and `Test D7`, with the placeholder phaser and photon. The first is a saucer cruiser and the second is a long-boom cruiser. The coordinates are invented. They spawn 16 range units apart, facing each other. The hull bytes are built in memory by `engine/duel/placeholder-mod.ts` and loaded with `parseMod` and `buildShipMesh`. No game file is required.

Orders go through the session. The payload does not carry a tick. `W`/`S` change speed, `A`/`D` yaw, `X` stops, `Space` fires the selected mount, and `1`–`6` pick a mount. The time-scale control only changes how many 30 Hz ticks the driver runs per second. A photon launch is the combat verb; the shot then flies on its own.

A headless harness is `createSyntheticDuel()` in `engine/duel/match.ts`. Call `frame(dt)`, then `setSpeed`, `orderYaw`, `orderFire`, or `issue(kind, payload)`, then `view()`. Building the view does not change the sim hash.

### Player files

**Load install folder** uses the platform directory picker. **Zip** reads an archive the player supplies. Both stay in the browser. The default pair is the Federation heavy cruiser (race Federation, hull CA, class `F-CA` when that row exists) against the Klingon D7 (class `K-D7`, or the closest Klingon cruiser hull). If either row is missing, the duel takes the first two ships of different empires that have a phaser or photon, and the log names the rows. The two ship menus can pick any other pair. Models load through `parseMod` and `buildShipMesh` when the geometry file is in the folder. A missing model keeps the placeholder hull. A turn letter with no playtest rate uses the documented fallback yaw, warns once, and keeps the ordered speed.
