#!/usr/bin/env python3
"""Collect per-run JSON into results.json + results.csv (measured numbers only).
Usage: summarize.py <runs_dir> <out_prefix> [label-glob]"""
import csv, glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from turn_tags import apply_noop, turn_kind
runs_dir, prefix = sys.argv[1], sys.argv[2]
pat = sys.argv[3] if len(sys.argv) > 3 else "*"
FIELDS = ["label", "button", "kind", "spawnKey", "target_speed", "settled_speed", "speed_key",
          "noop", "noop_reason", "speed_during_run", "fps", "game_s_per_wall_s",
          "total_turn_deg", "order_delay_s", "t10_s", "t50_s", "t90_s",
          "mean_rate_deg_per_wall_s_10_90", "mean_rate_deg_per_game_s_10_90"]
rows = []
for f in sorted(glob.glob(os.path.join(runs_dir, pat + ".json"))):
    if f.endswith(".r2.json"):
        continue
    d = json.load(open(f))
    d["kind"] = d.get("kind") or turn_kind(d.get("button"))
    if "noop" not in d:
        apply_noop(d)
    r = {k: d.get(k) for k in FIELDS}
    r["energy_panel"] = d.get("energy_panel")
    rows.append(r)
meta = {"source": "Star Trek: Starfleet Command II Community Edition 2.670, observed on screen under Wine",
        "method": "overhead camera, ship heading from screen-pixel principal axis, HUD OCR; no game files read",
        "heading_convention": "degrees, negative = port (counter-clockwise on the north-up overhead view)",
        "runs": rows}
json.dump(meta, open(prefix + ".json", "w"), indent=1)
with open(prefix + ".csv", "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(FIELDS + ["energy_power", "energy_systems", "energy_other", "energy_excess"])
    for r in rows:
        e = r["energy_panel"] or {}
        w.writerow([json.dumps(r[k]) if isinstance(r[k], list) else r[k] for k in FIELDS] +
                   [e.get("power"), e.get("systems"), e.get("other"), e.get("excess")])
by_kind, by_reason = {}, {}
noop = 0
for r in rows:
    kind = str(r.get("kind") or "unknown")
    by_kind[kind] = by_kind.get(kind, 0) + 1
    if r.get("noop"):
        noop += 1
        reason = str(r.get("noop_reason") or "unspecified")
        by_reason[reason] = by_reason.get(reason, 0) + 1
summary = {"result": "pass", "runs": len(rows), "noop": noop, "measured": len(rows) - noop,
           "byKind": by_kind, "byNoopReason": by_reason}
json.dump(summary, open(prefix + "-summary.json", "w"), indent=1)
print(f"summarize result=pass runs={summary['runs']} noop={noop} measured={summary['measured']}")
for reason, count in sorted(by_reason.items()):
    print(f"summarize class={reason} count={count}")
