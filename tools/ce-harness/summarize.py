#!/usr/bin/env python3
"""Collect per-run JSON into results.json + results.csv (measured numbers only).
Usage: summarize.py <runs_dir> <out_prefix> [label-glob]"""
import csv, glob, json, os, sys
runs_dir, prefix = sys.argv[1], sys.argv[2]
pat = sys.argv[3] if len(sys.argv) > 3 else "*"
HET_BUTTONS = {"port", "stbd", "hard_port", "hard_stbd", "u_turn"}
FIELDS = ["label", "button", "kind", "target_speed", "settled_speed", "speed_during_run", "fps", "game_s_per_wall_s",
          "total_turn_deg", "order_delay_s", "t10_s", "t50_s", "t90_s",
          "mean_rate_deg_per_wall_s_10_90", "mean_rate_deg_per_game_s_10_90"]
rows = []
for f in sorted(glob.glob(os.path.join(runs_dir, pat + ".json"))):
    if f.endswith(".r2.json"):
        continue
    d = json.load(open(f))
    r = {k: d.get(k) for k in FIELDS}
    r["kind"] = d.get("kind") or ("het" if d.get("button") in HET_BUTTONS else "normal")
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
print(f"{len(rows)} runs -> {prefix}.json, {prefix}.csv")
