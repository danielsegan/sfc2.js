# web/

Browser application. Two pages, two Vite configs:

| Page | Command | Port | What it is |
| --- | --- | --- | --- |
| Tactical duel | `pnpm dev:web` | 5174 | Phase 2 one-ship-against-one view |
| Ship viewer | `pnpm dev:viewer` | 4174 | Phase 1 catalog. Every shiplist row, spun with its texture |

The install picker is `@sfc2js/platform`: `preferredDirectoryPicker()` uses the File System Access API when the browser has it, and a `webkitdirectory` input otherwise. `importZipArchive` reads a zip the player supplies. `pickAndImport` indexes the result. Textures are loaded with `@sfc2js/render`'s `loadShipTexture`. Nothing is uploaded. See [docs/formats/bmp.md](../docs/formats/bmp.md).

## Ship viewer

`web/ship-viewer/` reads the Assets/Specs shiplist when that copy is present, builds a mesh for every row, and spins the current ship with its texture and self-illumination. A row that fails is listed with a `source.code` reason.

`?demo=1` loads an invented install built in memory. Real Community Edition files stay on the player's machine. Keys use `KeyboardEvent.code` (Modern profile).

## Tactical duel

The duel is not the full skirmish HUD. The console follows the SFC2 layout: target and sensor above a 3D view, energy, six shields, weapons, and helm along the bottom. Chrome uses the project's own plates and accent colours. It is not an Orion Pirates skin. Art under `art/` is original placeholder art.

`pnpm build:web` writes `web/dist/`.

### Synthetic fixture

Path: [`engine/duel/fixture.ts`](../engine/duel/fixture.ts).

Two original hulls, `Fixture Alpha` and `Fixture Beta`, with the placeholder phaser and photon. They spawn 16 range units apart, facing each other. The hull bytes are built in memory by `engine/duel/placeholder-mod.ts` and loaded with `parseMod` and `buildShipMesh`. No game file is required.

Orders go through the session. The payload does not carry a tick. `W`/`S` change speed, `A`/`D` yaw, `X` stops, `Space` fires the selected mount, and `1`–`6` pick a mount. The time-scale control only changes how many 30 Hz ticks the driver runs per second. A photon launch is the combat verb; the shot then flies on its own.

A headless harness is `createSyntheticDuel()` in `engine/duel/match.ts`. Call `frame(dt)`, then `setSpeed`, `orderYaw`, `orderFire`, or `issue(kind, payload)`, then `view()`. Building the view does not change the sim hash.

### Player files

**Load install folder** uses the platform directory picker. **Zip** reads an archive the player supplies. Both stay in the browser. The duel takes the first two ship rows of `shiplist.txt`. Models load through `parseMod` and `buildShipMesh` when the geometry file is in the folder. A missing model keeps the placeholder hull. Stats, including turn mode, come from the file: a letter with no playtest rate refuses speed and yaw, and the log shows the reason.
