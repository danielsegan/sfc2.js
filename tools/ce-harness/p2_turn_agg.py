#!/usr/bin/env python3
"""Phase-2 turn summary. For each label: fields from <label>.r2.json (analyze_turn2) plus a robust
game-clock ratio: clock OCR on every 2nd frame, freeze detection (clock unchanged for >=3 wall s while
frames continue = battle ended / disengage), linear fit with outlier rejection on the pre-freeze window only.
Prints one JSON line per run (no series). Usage: p2_turn_agg.py <label> ..."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_turn import clock

OUT = os.environ.get("CE_OUT_DIR", "/out")

def fit(pts):
    b = None
    for _ in range(4):
        if len(pts) < 4: return None
        mt = sum(t for t, _ in pts) / len(pts); mc = sum(c for _, c in pts) / len(pts)
        den = sum((t - mt) ** 2 for t, _ in pts)
        if not den: return None
        b = sum((t - mt) * (c - mc) for t, c in pts) / den; a = mc - b * mt
        keep = [(t, c) for t, c in pts if abs(c - (a + b * t)) <= 1.6]
        if len(keep) == len(pts): return b
        pts = keep
    return b

for lab in sys.argv[1:]:
    try:
        r2 = json.load(open(os.path.join(OUT, "runs", f"{lab}.r2.json")))
        cap = json.load(open(os.path.join(OUT, "frames", lab, "capture.json")))
    except Exception as e:
        print(json.dumps({"label": lab, "error": str(e)})); continue
    a0 = cap["action_wall"]
    pts = [(t - a0, clock(p)) for k, (t, p) in enumerate(cap["frames"]) if k % 2 == 0]
    pts = [(t, c) for t, c in pts if c is not None]
    freeze = None
    for i in range(len(pts)):
        j = i
        while j + 1 < len(pts) and pts[j + 1][1] == pts[i][1]: j += 1
        if pts[j][0] - pts[i][0] >= 3.0 and j == len(pts) - 1:
            freeze = round(pts[i][0], 2); break
    pre = [(t, c) for t, c in pts if freeze is None or t <= freeze]
    gc = fit(pre)
    out = {k: r2.get(k) for k in ("label", "kind", "button", "target_speed", "settled_speed", "total_turn_deg", "order_delay_s",
                                  "mean_rate_deg_per_wall_s_10_90", "mean_rate_deg_per_game_s_10_90", "slope_deg_per_wall_s_20_80",
                                  "game_s_per_wall_s", "match_score_median", "noop", "noop_reason", "t90_s")}
    out["gc_robust"] = round(gc, 3) if gc else None
    out["clock_freeze_at_s"] = freeze
    w = out["mean_rate_deg_per_wall_s_10_90"]
    out["rate_game_robust"] = round(w / gc, 2) if w and gc else None
    out["turn_done_before_freeze"] = (freeze is None) or (r2.get("t90_s") is not None and r2["t90_s"] < freeze)
    print(json.dumps(out))
