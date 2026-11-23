# CE 2.670 inventory outputs

This folder will hold **metadata-only** observations of the Community Edition 2.670 install on the private `sfc2-ci` runner (issue [#6](https://github.com/danielsegan/sfc2-browser-edition/issues/6), baseline [#37](https://github.com/danielsegan/sfc2-browser-edition/issues/37)).

Generated files (not in this pull request until the private job has run and the artifacts have been reviewed) are:

| File | Produced by | Contents |
| --- | --- | --- |
| `ce-2.670.json` | Job A | `[path, size, sha256]` for every extracted file |
| `ce-2.670.md` | Job A | Counts and locations, `*.q3` / BMP / `.bft` / weapon-group / `.gf` / `.mct` observations |
| `observations-ce-2.670.json` | Job A | Machine-readable form of the same observations |
| `missions-ce-2.670.md` | Job A | `.scr`, `.mct`, `.gf` grouped by folder, with names, sizes and sha256 |
| `shiplist-ftrlist-ce-2.670.json` | Job B | Encoding, headers, uniqueness, weapon/arc codes, fighter/PF presence |
| `shiplist-ftrlist-ce-2.670.md` | Job B | Human-readable form of the Job B report |

Nothing in these files is a game data row or a binary payload. Paths, sizes and hashes are safe to commit once reviewed (Producer's rule). How to dispatch the private workflow and copy the artifacts here is documented in [tools/inventory/README.md](../../../tools/inventory/README.md).

Claims about the real CE 2.670 files stay unmarked as verified until those artifacts are committed and the format specs are updated against them.
