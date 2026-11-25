# CE 2.670 inventory outputs

Metadata-only observations of the Community Edition 2.670 install, taken on the private `sfc2-ci` runner (issue [#6](https://github.com/danielsegan/sfc2.js/issues/6), baseline [#37](https://github.com/danielsegan/sfc2.js/issues/37)). Latest source run: [45274217981](https://github.com/danielsegan/sfc2.js/actions/runs/45274217981) at `9b238c5`, observed 23 November 2026 (America/New_York). Earlier runs [45270940650](https://github.com/danielsegan/sfc2.js/actions/runs/45270940650) (`b53379e`) and [45269125770](https://github.com/danielsegan/sfc2.js/actions/runs/45269125770) (`2ef5fa2`) covered the same extracted tree.

| File | Produced by | Contents |
| --- | --- | --- |
| `ce-2.670.json` | Job A | `[path, size, sha256]` for every extracted file (5,555 files, 865,706,682 bytes; exact manifest match) |
| `ce-2.670.md` | Job A | Counts and locations, `*.q3` / BMP / `.bft` / weapon-group / `.gf` / `.mct` observations |
| `observations-ce-2.670.json` | Job A | Machine-readable form of the same observations |
| `missions-ce-2.670.md` | Job A | `.scr`, `.mct`, `.gf` grouped by folder, with names, sizes and sha256 |
| `shiplist-ftrlist-ce-2.670.json` | Job B | Encoding, headers, uniqueness, race row counts, weapon/arc codes (including per-column sources for numeric arc codes, per-slot arc counts for Heavy Weapon slots 1–10, and numeric-arc-to-weapon pairings), fighter/PF presence |
| `shiplist-ftrlist-ce-2.670.md` | Job B | Human-readable form of the Job B report |

Nothing in these files is a game data row or a binary payload. Per-column numeric stats (min, max, max decimal places) from a private run are **not** committed here; they stay on the `sfc2-ci` runner and are not uploaded. Distinct race values with row counts are included. How the private workflow is dispatched is documented in [tools/inventory/README.md](../../../tools/inventory/README.md).
