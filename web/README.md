# web/

Browser application and HUD. Loads the player's own game files and presents the engine and UI in the browser.

The install picker is `@sfc2js/platform`: `preferredDirectoryPicker()` uses the File System Access API when the browser has it, and a `webkitdirectory` input otherwise. `importZipArchive` reads a zip the player supplies. `pickAndImport` indexes the result. Textures are loaded with `@sfc2js/render`'s `loadShipTexture`. Nothing is uploaded. See [docs/formats/bmp.md](../docs/formats/bmp.md).

## Ship viewer

`web/ship-viewer/` is the Phase 1 page (`pnpm dev:viewer`). It reads the Assets/Specs shiplist when that copy is present, builds a mesh for every row, and spins the current ship with its texture and self-illumination. A row that fails is listed with a `source.code` reason. The tactical presentation is a different page.

`?demo=1` loads an invented install built in memory. Real Community Edition files stay on the player's machine. Keys use `KeyboardEvent.code` (Modern profile).
