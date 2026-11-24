# Ship audit

Correlates every shiplist row with the rules mapping in this repo. It is a clean-room tool. It does not embed Community Edition rows, and it does not change shield factors or `simSourceHash`.

The column map is [docs/formats/shiplist-field-map.md](../../docs/formats/shiplist-field-map.md). Shield facings are measured 1:1 (Shield 1 front, Shield 2 _ 6 on each front-side facing, Shield 3 _ 5 on each rear-side facing, Shield 4 rear, total = S1 + 2×S2_6 + 2×S3_5 + S4). The loader still applies the ×2 fallbacks. Combat removes that factor in a separate change. This tool only counts how many hulls still diverge.

## What it writes

Given `SFC2_INSTALL`, it parses `Assets/Specs/shiplist.txt` (MetaAssets is used only to set `copiesDiffer`) and runs each row through `bindShiplistRow`.

For each hull it records shields per facing (engine and measured 1:1), turn letter and yaw, spawn speed and cruise speed, power (warp, impulse, APR, battery, capacity, generation), weapons and arcs, and hull, armor, and crew. Cruise speed is the whole generation spent on movement.

Checks:

| Check | Passes when |
| --- | --- |
| `shieldTotal` | Shield Total equals Shield 1 + 2×Shield 2 _ 6 + 2×Shield 3 _ 5 + Shield 4 |
| `powerSum` | Plants are whole and non-negative, warp = 2×R_L_Warp + C_Warp, and battery capacity equals the battery cell |
| `weaponCount` | Each filled hardpoint is a known code whose Num matches the mount boxes. `W1`–`W25` are not mounts |

`--harness` reads a `tools/ce-harness` `results-*.json` file (`summarize.py`: `source`, `method`, `heading_convention`, `runs[]`). `energy_panel.power` is compared to `power.generation`. `mean_rate_deg_per_game_s_10_90` is compared to `turn.degPerGameSecond` (default tolerance 1 degree per game second). A run may also set `spawnKey` and `fields` using the derived names (`shields.0` … `shields.5` are the engine facings, `shieldsMeasured.0` … are the 1:1 readings). Null measurements are skips.

Stdout is counts only: pass, fail, and skip per check and per harness field, plus column-status totals. Per-hull JSON and CSV go to `--out` (default `out/ship-audit`, gitignored). Do not commit, upload, or paste that directory. Only the printed summary may leave `sfc2-ci`.

Exit 0 when every check passes and every harness run matches. Exit 1 when a check fails or a harness run does not match. Exit 2 when the install or the JSON cannot be read. The shield ×2 divergence does not by itself fail the run.

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

A run label such as `ca-5` uses the map key `ca` (the text before the trailing speed). `spawnKey` on a run overrides the map. Vessel Library facings belong in `fields["shieldsMeasured.N"]`. Engine facings, still doubled, belong in `fields["shields.N"]`.

Copy the stdout summary into the job log if you need a record. Leave `~/harness/out/ship-audit/hulls.json` and `hulls.csv` on the VM.

Synthetic coverage is `tools/fixtures/ship-audit/` (`pnpm test:ship-audit`). Those rows are invented `TEST-*` hulls, including one whose shield total does not match the identity.
