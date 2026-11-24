# engine/

Deterministic game engine: simulation core, renderer, mission runtime, AI, audio, and netcode.

The sim core should be independent of the wall clock and of unsourced random numbers (seeded RNG, fixed timestep) so it stays replayable and lockstep-ready. Rendering, UI, and audio read sim state; they do not drive it.

`platform/` is the user-install virtual file system (`@sfc2js/platform`). `render/` uploads BMP textures, including self-illumination, to three.js (`@sfc2js/render`). The byte decoder is `tools/formats` (`@sfc2js/formats`). See [docs/formats/bmp.md](../docs/formats/bmp.md).

`view/` builds the read-only HUD picture from snapshots. `duel/` runs a skirmish of up to six ships: session orders, the fixed-step driver, and the synthetic fixture in `duel/fixture.ts`. Captains live in `sim/captain.ts` and queue the same verbs. The web app is `web/`. Neither the view nor the page writes sim state except by issuing commands.
