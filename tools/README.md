# tools/

Parsers, extractors, asset-inventory scripts, and repository checks.

- `check-no-game-files.sh` — fails if original-looking game files or large binaries are tracked (see also `allowed-fixtures.txt`)
- Replay corpus check — `pnpm replay:check` (`engine/replay/cli.ts`). Synthetic `.s2replay` files only; see `docs/engine/replay.md`
- `check-rules-fixtures.mjs` — runs the synthetic Phase 2 rules fixtures under `docs/rules/tests/` (`node tools/check-rules-fixtures.mjs`)
- `formats/` — browser-safe parsers (`@sfc2js/formats`): `parseShiplist`, `parseFtrlist`, and the BMP plus self-illumination pipeline. Synthetic fixtures only. The install index that feeds them is `engine/platform`. `verify-install.ts` is the metadata-only check against a local install; the private runner job is `.github/workflows/private-bmp-verify.yml`
- `inventory/` — CE 2.670 metadata inventory (`inventory.py inventory` and `verify`). Public CI runs `python3 tools/inventory/test_inventory.py` against synthetic fixtures. The private runner job is `.github/workflows/private-inventory.yml`
- `ce-harness/` — private observation capture on `sfc2-ci`. It writes `results-*.json` on that VM and does not commit game data
- `ship-audit/` — `pnpm ship-audit`. Maps every shiplist row through the rules loader and diffs an optional harness capture. Stdout is counts only. See `tools/ship-audit/README.md`
- `duel-metrics/` — `pnpm duel:metrics`. Headless Phase 2 measurements on synthetic F-CA-like and K-D7-like hulls (turn rate, delay, energy, phasers, heavy weapons, shield facings, weapon power). JSON and a markdown table. See `tools/duel-metrics/README.md`
- `viewer-check/` — `pnpm viewer-check`. Loads every shiplist row through the model, texture, and viewer-stage code and renders a few frames in headless Chromium. Public tests use the synthetic install. `pnpm viewer-check --synthetic` prints counts, pass/fail, error classes, skip reasons, and texture-miss classes. It does not print hull ids, texture names, or paths. The private runner job is `.github/workflows/private-viewer-check.yml`

Never place original SFC2 assets in this tree. Use synthetic fixtures, and run real-data checks only on the private CI VM.
