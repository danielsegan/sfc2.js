# tools/

Parsers, extractors, asset-inventory scripts, and repository checks.

- `check-no-game-files.sh` — fails if original-looking game files or large binaries are tracked (see also `allowed-fixtures.txt`)
- Replay corpus check — `pnpm replay:check` (`engine/replay/cli.ts`). Synthetic `.s2replay` files only; see `docs/engine/replay.md`
- `check-rules-fixtures.mjs` — runs the synthetic Phase 2 rules fixtures under `docs/rules/tests/` (`node tools/check-rules-fixtures.mjs`)
- `formats/` — browser-safe parsers (`@sfc2js/formats`): `parseShiplist`, `parseFtrlist`, and the BMP plus self-illumination pipeline. Synthetic fixtures only. The install index that feeds them is `engine/platform`. `verify-install.ts` is the metadata-only check against a local install; the private runner job is `.github/workflows/private-bmp-verify.yml`
- `inventory/` — CE 2.670 metadata inventory (`inventory.py inventory` and `verify`). Public CI runs `python3 tools/inventory/test_inventory.py` against synthetic fixtures. The private runner job is `.github/workflows/private-inventory.yml`
- `ce-harness/` — private observation capture on `sfc2-ci`. It writes `results-*.json` on that VM and does not commit game data
- `ship-audit/` — `pnpm ship-audit`. Maps every shiplist row through the rules loader and diffs an optional harness capture. Stdout is counts only. See `tools/ship-audit/README.md`

Never place original SFC2 assets in this tree. Use synthetic fixtures, and run real-data checks only on the private CI VM.
