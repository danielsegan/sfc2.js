# tools/inventory

Private-runner inventory of the Community Edition 2.670 trees on `sfc2-ci`, plus shiplist/ftrlist verification.

Real install data is read **only** on the self-hosted runner (`runs-on: [self-hosted, sfc2-ci, private-data]`). In-repo tests use the synthetic fixtures under `tools/fixtures/inventory/`. Nothing in this folder commits original game file contents.

## What it does

`inventory.py` has two subcommands, matching the two jobs in `.github/workflows/private-inventory.yml`:

- `inventory` (Job A) reads `/srv/sfc2/extracted/2.670/manifest.json` and `/srv/sfc2/README.md`, walks notable paths, and writes:
  - `docs/formats/inventory/ce-2.670.json` — every file as `[path, size, sha256]`
  - `docs/formats/inventory/ce-2.670.md` — counts and bytes by extension and top-level folder; locations of spec tables, models, textures, audio, `sounds.txt`, string tables, fonts, `.scr` / `.mct` / `.gf`, FMSE/scenario paths, campaign/Conquest data; `*.q3` search of both trees; GUI/non-model BMP folders; self-illumination suffix patterns; extensionless weapon-group table headers (names/count only); `.gf` / `.mct` text-vs-binary probes (magic bytes, header names, and at most two coordinate figures)
  - `docs/formats/inventory/missions-ce-2.670.md` — `.scr`, `.mct` and `.gf` grouped by folder, with names, sizes and sha256
  - `docs/formats/inventory/observations-ce-2.670.json` — the same observations in machine-readable form
- `verify` (Job B) locates every `shiplist.txt` and `ftrlist.txt` (for example `Assets/Specs` and `MetaAssets`), uses the `Assets/Specs` copy as the source when both exist, and writes:
  - `docs/formats/inventory/shiplist-ftrlist-ce-2.670.json` and `.md` — full header names in column order (leading comment/instruction lines and preamble markers such as `<0` are skipped so the real header is found), column count, row count, encoding, line endings, delimiter, hashes of every copy, `duplicateClassKey` / `duplicateClassName` (keys and row numbers only), fighter/PF presence counts, distinct weapon and arc codes with row counts split by slot range 1–10 vs 11–25, per-column sources for numeric arc codes `1`/`2`/`3`, and per-slot arc counts for weapon slots 1–10 after Num/Arc pairing (`Heavy Weapon N` included), and numeric-arc-to-weapon pairings (including whether numeric arcs appear with anything other than `Dro*` / `ADD6` / `ADD12`, plus the converse letter-vs-numeric counts for those weapon slots), distinct race values with row counts, `.bft` / `*.q3` locations (and a ZIP/PACK directory listing of entry names and sizes when identifiable), and BMP `_<n>i` header-only pair comparisons (bit depth, compression, width/height)

Per-column numeric stats (`numericColumnStats`: min, max, max decimal places) are written to the private-run verify JSON/MD **artifacts only** and must not be committed to the repository. Distinct shiplist/ftrlist race values with row counts may be committed.

Logs and generated files contain **no data rows**. Allowed metadata: paths, sizes, sha256, counts, header/column names, encoding, line endings, booleans, format vocabulary (weapon/arc codes, race/hull tokens, suffix patterns), and aggregate numeric stats.

## Diagnostics

Uniqueness failures are reported with a flat camelCase `code` and a separate `source` naming the format, matching the engine loader. `duplicateClassKey` (race + class name) is an error; `duplicateClassName` (class name only) is a warning. Both carry keys and 1-based row numbers only:

```json
{
  "code": "duplicateClassKey",
  "source": "shiplist",
  "severity": "error",
  "details": { "race": "Federation", "className": "TEST-CA-01", "rows": [2, 3] }
}
```

`rows` are 1-based source line numbers. Only the key (`race`, `className`) and row numbers are listed, never the rest of the row.

## Running locally (synthetic fixtures)

```bash
python3 tools/inventory/test_inventory.py -v
```

Against a CE 2.670 tree that is already on the machine (do not copy it into the repo):

```bash
python3 tools/inventory/inventory.py inventory \
  --extracted /srv/sfc2/extracted/2.670 \
  --reference /srv/sfc2/reference/2.670 \
  --manifest /srv/sfc2/extracted/2.670/manifest.json \
  --readme /srv/sfc2/README.md \
  --output-dir docs/formats/inventory

python3 tools/inventory/inventory.py verify \
  --extracted /srv/sfc2/extracted/2.670 \
  --reference /srv/sfc2/reference/2.670 \
  --output-dir docs/formats/inventory
```

## Private workflow

`.github/workflows/private-inventory.yml` is `workflow_dispatch` only, with `permissions: contents: read`. It does **not** commit, and it never pushes to `main`. Each job prints the metadata summary to the log and uploads only the generated JSON/MD files as artifacts.

### How to commit the generated metadata

1. Dispatch the workflow against this branch (see below).
2. Download the `ce-2.670-inventory-metadata` and `ce-2.670-shiplist-ftrlist-metadata` artifacts.
3. Copy the JSON and Markdown files into `docs/formats/inventory/` on `formats/inventory-ce2670` (or a follow-up branch). Do not add any other files from the runner.
4. Run `bash tools/check-no-game-files.sh`. The no-game-files rules are not loosened for this work.
5. If `ce-2.670.json` is over 1 MiB, leave it as an artifact and do **not** add a blanket allowlist exception. Ask the Producer before adding a size-only allowlist entry for that one generated metadata file.
6. Commit only the metadata files, with a message that they were observed on CE 2.670 / `sfc2-ci`.

### Dispatching the workflow

GitHub only offers `workflow_dispatch` for a workflow file that already exists on the repository default branch. Until this workflow is merged to `main`, `gh workflow run` against the feature branch will likely be refused. After it is on `main`:

```bash
gh workflow run private-inventory.yml --ref formats/inventory-ce2670
gh run watch
gh run download --name ce-2.670-inventory-metadata
gh run download --name ce-2.670-shiplist-ftrlist-metadata
```

## Legal

See [docs/LEGAL.md](../../docs/LEGAL.md). Never commit original SFC2 assets. Never consult SFC2-decomp. Fixtures in this repository are hand-written with invented names and values.
