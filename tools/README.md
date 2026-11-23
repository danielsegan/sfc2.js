# tools/

Parsers, extractors, asset-inventory scripts, and repository checks.

- `check-no-game-files.sh` — fails if original-looking game files or large binaries are tracked (see also `allowed-fixtures.txt`)
- Format parsers and importers will land here as Phase 1 work starts

Never place original SFC2 assets in this tree. Use synthetic fixtures, and run real-data checks only on the private CI VM.
