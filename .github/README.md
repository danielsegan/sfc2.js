# .github/

GitHub project automation.

- `workflows/no-game-files.yml` — blocks commits that track likely original SFC2 assets or large binaries
- `workflows/inventory-tools.yml` — unit tests for the inventory scripts, against synthetic fixtures only
- `workflows/private-inventory.yml` — `workflow_dispatch` only, on `[self-hosted, sfc2-ci, private-data]`; writes metadata artifacts, never commits
- CODEOWNERS and a pull-request template can be added as part of repository security hardening
