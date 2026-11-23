# Starfleet Command 2: Browser Edition

A clean-room browser engine for *Star Trek: Starfleet Command 2* (Taldren/Interplay, 2000). The goal is full-game parity — skirmish, empire campaigns, the Conquest map, multiplayer, and mod support — as a web app and a Tauri desktop shell.

Players bring their own legally obtained game files. This repository never commits or ships original assets. It is a **non-commercial fan project**. *Star Trek* is Paramount's intellectual property.

## Legal

Read [docs/LEGAL.md](docs/LEGAL.md) and [CONTRIBUTING.md](CONTRIBUTING.md) before you add files or open a pull request.

- Bring your own game files.
- Never commit or ship original SFC2 assets.
- Clean-room only: do not derive work from, or consult, the SFC2-decomp project.

CI runs `tools/check-no-game-files.sh` on every push and pull request.

## Documentation

- [docs/plan.md](docs/plan.md) — studio and project plan, roadmap, and risks
- [docs/LEGAL.md](docs/LEGAL.md) — legal posture and clean-room rules

## Layout

| Path | Purpose |
| --- | --- |
| `docs/` | Plan, legal notes, format specs, rules, ADRs |
| `engine/` | Simulation core, renderer, mission runtime, AI, audio, netcode |
| `tools/` | Parsers, extractors, inventory scripts, repo checks |
| `web/` | Browser app and HUD |
| `desktop/` | Tauri desktop shell |
| `server/` | Lobby and Conquest server |
| `.github/` | Workflows and GitHub project files |

## License

[GPL-3.0](LICENSE).
