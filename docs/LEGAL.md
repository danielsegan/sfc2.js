# Legal posture

*Star Trek* and *Star Trek: Starfleet Command 2* are the intellectual property of Paramount (and their respective owners and licensees). This repository is a **non-commercial fan project**. It is an independent, clean-room engine. It is not affiliated with, endorsed by, or connected to Paramount, Interplay, Taldren, or any rights holder.

## Bring your own game files

Players must supply a legally obtained copy of *Star Trek: Starfleet Command 2*. This project loads assets from the player's own install (or an archive the player provides). It does **not** distribute, bundle, or replace those files.

## Never commit or ship original assets

Do not commit, push, upload, or otherwise add original SFC2 game files, installers, or rip-outs to this repository, to CI artifacts, or to any release. That includes (but is not limited to) models, textures, sound, music, video, missions, ship lists taken from the game, save files, and installer packages.

- `.gitignore` excludes common original-asset extensions and install paths.
- `tools/check-no-game-files.sh` (run in CI on every push and pull request) fails if forbidden file types, likely install paths, or large binaries are tracked.
- In-repo tests must use **synthetic fixtures** that we created ourselves. Those fixtures may be listed in `tools/allowed-fixtures.txt` if they would otherwise trip the check. Real-data tests run only on the private CI VM against a local install, and those assets stay on that machine.

If you discover an original asset in the tree, do not spread it. Tell the Producer, and remove it from git history if it was ever committed.

## Clean-room rule

This is a **clean-room** rewrite.

- Write original code and original documentation only.
- **Never** derive code, comments, structure, or documentation from the SFC2-decomp project, and **never** consult, open, clone, copy, or reference that project (or any other decompilation or disassembly of SFC2) while working on this engine.
- Allowed references include: the original game running under Wine as a black box, official or Taldren-released materials (for example published manuals, Taldren-released C++ mission sources, and the Mission API as published), community format documentation such as sfcmod notes, and Star Fleet Battles rules used as a design reference.
- When a format is undocumented, document what we observe in `docs/formats/` from clean-room analysis and community docs — not from decompiled source.

## Going public

The repository starts private. Making it public is a release-time decision. Before any public release or distribution, the project needs a takedown plan and a final legal review.

## Questions

If you are unsure whether a file, a reference, or a contribution is allowed, stop and ask the Producer before adding it.
