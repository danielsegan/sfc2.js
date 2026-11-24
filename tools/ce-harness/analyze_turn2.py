#!/usr/bin/env python3
"""Turn analysis v2: heading from rotation registration (heading2.track), no 180-degree ambiguity.
Usage: analyze_turn2.py <label> ... -> /out/runs/<label>.r2.json (same summary fields as analyze_turn.py)"""
import json, os, sys, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from heading2 import track
from analyze_turn import clock
from turn_tags import apply_noop, turn_kind
for label in sys.argv[1:]:
    cap = json.load(open(f"/out/frames/{label}/capture.json")); a0 = cap["action_wall"]
    fr = cap["frames"]; tr = track([p for _, p in fr])
    raw = [(t - a0, h, s) for (t, _), (h, s) in zip(fr, tr) if h is not None]
    sm = [(raw[i][0], statistics.median(v for _, v, _ in raw[max(0, i - 2):i + 3])) for i in range(len(raw))]
    pre = [v for t, v in sm if t < 0]; base = statistics.median(pre) if pre else 0.0
    sm = [(t, v - base) for t, v in sm]
    total = statistics.median(v for t, v in sm[-10:])
    def first(frac): return next((t for t, v in sm if t > 0 and abs(v) >= frac * abs(total)), None)
    t10, t50, t90 = first(0.1), first(0.5), first(0.9)
    rate = 0.8 * abs(total) / (t90 - t10) if t10 is not None and t90 and t90 > t10 else None
    # steady rate: slope between 20% and 80% of the turn
    seg = [(t, v) for t, v in sm if t > 0 and 0.2 * abs(total) <= abs(v) <= 0.8 * abs(total)]
    slope = None
    if len(seg) > 4:
        mt = sum(t for t, _ in seg) / len(seg); mv = sum(v for _, v in seg) / len(seg)
        den = sum((t - mt) ** 2 for t, _ in seg); slope = sum((t - mt) * (v - mv) for t, v in seg) / den if den else None
    scores = [s for _, _, s in raw[1:] if s is not None]
    # Game-clock rate so heading2 results match analyze_turn / tier-1 fields.
    cl = []
    for k, (t, path) in enumerate(fr):
        if k % 4 != 0:
            continue
        c = clock(path)
        if c is not None:
            cl.append((t - a0, c))
    gr = (cl[-1][1] - cl[0][1]) / (cl[-1][0] - cl[0][0]) if len(cl) > 3 and cl[-1][0] > cl[0][0] else None
    res = {"label": label, "button": cap["button"], "kind": turn_kind(cap["button"]), "target_speed": cap["target_speed"],
           "settled_speed": cap["speed_history"][-1] if cap["speed_history"] else None,
           "frames": len(fr), "frames_tracked": len(raw), "match_score_median": round(statistics.median(scores), 3) if scores else None,
           "match_score_min": round(min(scores), 3) if scores else None,
           "game_s_per_wall_s": round(gr, 3) if gr else None,
           "total_turn_deg": round(total, 1), "order_delay_s": round(t10, 2) if t10 is not None else None,
           "t10_s": t10, "t50_s": t50, "t90_s": t90,
           "mean_rate_deg_per_wall_s_10_90": round(rate, 2) if rate else None,
           "mean_rate_deg_per_game_s_10_90": round(rate / gr, 2) if rate and gr else None,
           "slope_deg_per_wall_s_20_80": round(slope, 2) if slope is not None else None,
           "series": [[round(t, 3), round(v, 2)] for t, v in sm]}
    if os.environ.get("SPAWN_KEY"):
        res["spawnKey"] = os.environ["SPAWN_KEY"]
    apply_noop(res)
    json.dump(res, open(f"/out/runs/{label}.r2.json", "w"), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != "series"}), flush=True)
