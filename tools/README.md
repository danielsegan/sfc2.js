# tools/

Parsers, extractors, asset-inventory scripts, and repository checks.

- `check-no-game-files.sh` — fails if original-looking game files or large binaries are tracked (see also `allowed-fixtures.txt`)
- `check-rules-fixtures.mjs` — runs the synthetic Phase 2 rules fixtures under `docs/rules/tests/` (`node tools/check-rules-fixtures.mjs`)
- `formats/` — browser-safe parsers (`@sfc2js/formats`): `parseShiplist`, `parseFtrlist`, and the BMP plus self-illumination pipeline. Synthetic fixtures only. The install index that feeds them is `engine/platform`

Never place original SFC2 assets in this tree. Use synthetic fixtures, and run real-data checks only on the private CI VM.
