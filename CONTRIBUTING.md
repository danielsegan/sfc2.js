# Contributing

Thank you for helping build this clean-room, non-commercial fan engine for *Star Trek: Starfleet Command 2*.

## Legal rules (required reading)

Read [docs/LEGAL.md](docs/LEGAL.md) before you contribute. In short:

- Players bring their own legally obtained game files. We never commit or ship original SFC2 assets.
- This is a non-commercial fan project. *Star Trek* is Paramount's IP.
- Clean-room only: never derive work from, or consult, the SFC2-decomp project (or any other decompilation or disassembly of the game).

Pull requests that add likely original asset types, large binaries, or decomp-derived material will be rejected. CI runs `tools/check-no-game-files.sh` on every push and pull request.

## How to work

1. Prefer small, reviewable pull requests against `main` once branch protection is in place.
2. Follow the phase plan in [docs/plan.md](docs/plan.md). Stretch work waits until Phase 8 unless the Producer says otherwise.
3. Tests in the repo must use synthetic fixtures, not files copied from a game install. Real-data tests belong on the private CI VM.
4. Record architectural choices in short ADRs under `docs/adr/` when they affect more than one role.
5. Do not treat open decisions in the plan (project title, language, reference game version, cloud-agent workflow) as settled until Daniel records a choice.

## Reporting issues

Use the area and type labels, and attach the issue to the matching phase milestone. Flag legal or clean-room concerns immediately.
