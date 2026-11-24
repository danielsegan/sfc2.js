# tools/

Parsers, extractors, asset-inventory scripts, and repository checks.

- `check-no-game-files.sh` — fails if original-looking game files or large binaries are tracked (see also `allowed-fixtures.txt`)
- `check-rules-fixtures.mjs` — runs the synthetic Phase 2 rules fixtures under `docs/rules/tests/` (`node tools/check-rules-fixtures.mjs`)
- `formats/` — `parseShiplist` and `parseFtrlist` (pure, browser-safe; synthetic fixtures only)

Never place original SFC2 assets in this tree. Use synthetic fixtures, and run real-data checks only on the private CI VM.
