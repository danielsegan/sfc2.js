# .github/

GitHub project automation.

- `workflows/no-game-files.yml` — blocks commits that track likely original SFC2 assets or large binaries
- `workflows/inventory-tools.yml` — synthetic tests for `tools/inventory` (no private game data)
- `workflows/private-inventory.yml` — dispatch-only CE 2.670 metadata inventory on `sfc2-ci`
- `workflows/replay.yml` — replays the synthetic corpus in Node and compares the same hash timelines in Chromium, Firefox, and WebKit
- CODEOWNERS and a pull-request template can be added as part of repository security hardening
