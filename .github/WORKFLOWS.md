# .github/

GitHub project automation.

- `workflows/no-game-files.yml` — blocks commits that track likely original SFC2 assets or large binaries
- `workflows/inventory-tools.yml` — synthetic tests for `tools/inventory` (no private game data)
- `workflows/private-inventory.yml` — dispatch-only CE 2.670 metadata inventory on `sfc2-ci`
- `workflows/private-bmp-verify.yml` — dispatch-only BMP metadata check on `sfc2-ci`
- `workflows/private-viewer-check.yml` — dispatch-only every-ship viewer check on `sfc2-ci` (JSON summary only; no screenshots). Input `stages` defaults to `load` (Node only, no Chromium). `full` also renders in headless Chromium
- `workflows/private-ce-harness.yml` — dispatch-only CE behaviour capture on `sfc2-ci`
- `workflows/replay.yml` — replays the synthetic corpus in Node and compares the same hash timelines in Chromium, Firefox, and WebKit
- `workflows/release.yml` — tag `v*` and manual web build (`web/dist` zip plus SHA-256). Desktop jobs skip until a Tauri config exists. Unsigned artifacts only; no GitHub Release
- CODEOWNERS and a pull-request template can be added as part of repository security hardening
