# engine/

Deterministic game engine: simulation core, renderer, mission runtime, AI, audio, and netcode.

The sim core should be independent of the wall clock and of unsourced random numbers (seeded RNG, fixed timestep) so it stays replayable and lockstep-ready. Rendering, UI, and audio read sim state; they do not drive it.
