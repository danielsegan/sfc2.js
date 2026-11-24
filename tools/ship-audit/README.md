# Ship audit

Correlates every shiplist row with the rules mapping in this repo. It is a clean-room tool. It does not embed Community Edition rows, and it does not change shield factors or `simSourceHash`.

The column map is [docs/formats/shiplist-field-map.md](../../docs/formats/shiplist-field-map.md). Shield facings are measured 1:1 (Shield 1 front, Shield 2 _ 6 on each front-side facing, Shield 3 _ 5 on each rear-side facing, Shield 4 rear, total = S1 + 2×S2_6 + 2×S3_5 + S4). The loader now applies the measured 1:1 factors from `docs/rules/data/measured.json`, so `shieldScale.engineNotOneToOne` is 0 on matching rows.

## What it writes

Given `SFC2_INSTALL`, it parses `Assets/Specs/shiplist.txt` and, when `MetaAssets/shiplist.txt` is also present, compares the two copies. `copiesDiffer` is 1 when those tables are not the same file. The following lines are counts only: row counts, column counts, spawn keys that exist in only one copy (`copies.onlyInOne`), shared keys whose cells differ (`copies.rowsDiffer`), header cells that differ (`copies.headerNamesDiffer`), and column indexes that differ on a shared key (`copies.columnsDiffer`). `copies.note` says which pair was compared. A single file, or a run with `--shiplist`, prints `copies.note not compared (one file)`.

For each hull it records shields per facing (engine and measured 1:1), turn letter and yaw, spawn speed and cruise speed, power (warp, impulse, APR, battery, capacity, generation), weapons and arcs, and hull, armor, and crew. Cruise speed is the whole generation spent on movement.

Checks:

| Check | Passes when |
| --- | --- |
| `shieldTotal` | Shield Total equals Shield 1 + 2×Shield 2 _ 6 + 2×Shield 3 _ 5 + Shield 4 |
| `powerSum` | Plants are whole and non-negative, warp = 2×R_L_Warp + C_Warp, and battery capacity equals the battery cell |
| `weaponCount` | Each filled hardpoint is a known code whose Num matches the mount boxes. `W1`–`W25` are not mounts |

`--harness` reads a `tools/ce-harness` `results-*.json` file (`summarize.py`: `source`, `method`, `heading_convention`, `runs[]`). `energy_panel.power` is compared to `power.generation`. A run may also set `spawnKey` and `fields` (`shields.0` … `shields.5` are the engine facings, `shieldsMeasured.0` … are the 1:1 readings). Null measurements are skips.

Turn captures are two different measurements, keyed by `target_speed` (or `settled_speed` when the target is absent). Set `turn` to `normal` or `het` (`turnKind` and `kind` are accepted too):

| Kind | Fields |
| --- | --- |
| `normal` | `turn.normal.<speed>.degPerSecond` from `mean_rate_deg_per_game_s_10_90`, and `turn.normal.<speed>.delayS` from `order_delay_s` |
| `het` | `turn.het.<speed>.deg` from `total_turn_deg`, `turn.het.<speed>.degPerSecond`, and `turn.het.<speed>.delayS` |

A normal rate is not a High-Energy Turn, and a HET snap is not the hull's yaw cap. A tagged sample is scored against the run's `expect` object when present. If the run omits `expect`, the audit looks up `audit.expect` and `audit.tolerances` from [`docs/rules/data/turn-normal.json`](../../docs/rules/data/turn-normal.json) or [`docs/rules/data/het.json`](../../docs/rules/data/het.json) by hull key (`F-CA`, `K-D7`) and field name (`turn.normal.<speed>.degPerSecond`, `turn.normal.<speed>.delayS`, `turn.het.<speed>.*`). Intermediate speeds interpolate those expect values. The `default` fallback hull is not auto-scored, and a hull with no table expect is still a skip. Run-level `tolerances`, then the table tolerance, then `--turn-tolerance` (default 1) apply to `turn.*` fields. For table expectations on `turn.het.<speed>.deg`, the scorer compares `Math.abs(total_turn_deg)` because captures record port turns with negative degrees. A run marked `noop: true`, `status: "noop"`, or `turn`/`kind`/`turnKind: "noop"` is counted in `harness.turnNoop` and its turn metrics are skipped rather than failed. A sample that has a rate, a delay, or a swept angle and no `normal` or `het` kind is legacy: `harness.turnUntagged` counts it and the audit does not fail the run for it. A tagged sample with no speed is `harness.turnNoSpeed`, also a skip.

Stdout is counts only: pass, fail, and skip per check and per harness field, plus column-status totals. Per-hull JSON and CSV go to `--out` (default `out/ship-audit`, gitignored). Do not commit, upload, or paste that directory. Only the printed summary may leave `sfc2-ci`.

Exit 0 when every check passes and every scored harness field matches. Exit 1 when a check fails, a harness field fails, or a run does not match a hull. Exit 2 when the install or the JSON cannot be read. A `shieldScale.engineNotOneToOne` divergence, a `noop` turn, an untagged turn, and a tagged turn with no speed do not by themselves fail the run. `copiesDiffer` does not either.

## Wintermute on sfc2-ci

The licensed tree is `/srv/sfc2/reference/2.670`. The harness and this audit both stay on that VM. Run the harness first when you want a diff (`tools/ce-harness/README.md`), then point the audit at the same install and at the capture it just wrote.

```sh
# capture, on the VM (see tools/ce-harness/README.md)
tools/ce-harness/prepare_workcopy.sh /srv/sfc2/reference/2.670 /srv/sfc2/work/ce-2.670
docker build -t sfc2-ce-harness:dev tools/ce-harness/docker
tools/ce-harness/run_scenario.sh fed ca 5 10 15 20 31
python3 tools/ce-harness/summarize.py ~/harness/out/runs ~/harness/out/results-ca 'ca-*'

# correlate. The hull map stays on the VM. It pairs a harness label prefix
# with a spawn key from the install. Do not commit the map or the results.
printf '%s\n' '{ "ca": "<race>:<class from the fed scenario>" }' > ~/harness/out/hull-map.json
SFC2_INSTALL=/srv/sfc2/reference/2.670 pnpm ship-audit \
  --harness ~/harness/out/results-ca.json \
  --hull-map ~/harness/out/hull-map.json \
  --out ~/harness/out/ship-audit
```

A run label such as `ca-5` uses the map key `ca` (the text before the trailing speed). `spawnKey` on a run overrides the map. Measured 1:1 facings belong in `fields["shieldsMeasured.N"]` and `fields["shields.N"]` (the CE Vessel Library screen is unreliable on some rear values, e.g. D7/POL/E4 rows).

Helm-button captures are High-Energy Turns. Mouse-heading captures are normal turns. Put `"turn": "het"` or `"turn": "normal"` on each run. A `results-*.json` from the current `summarize.py`, which has no kind field, counts as `harness.turnUntagged` and is not scored against yaw.

Copy the stdout summary into the job log if you need a record. Leave `~/harness/out/ship-audit/hulls.json` and `hulls.csv` on the VM.

Synthetic coverage is `tools/fixtures/ship-audit/` (`pnpm test:ship-audit`). Those rows are invented `TEST-*` hulls, including one whose shield total does not match the identity.
