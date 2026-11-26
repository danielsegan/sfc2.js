#!/usr/bin/env python3
"""Aggregate duel_accel.py runs. Prints aggregates only (no frames, no per-sample rows).
Usage: p2_accel_agg.py <outdir> <label> [energy] [hud]"""
import json, os, statistics as st, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

outdir, label = sys.argv[1], sys.argv[2]
do_energy = len(sys.argv) > 3 and sys.argv[3] not in ("0", "none", "false")
R = json.load(open(os.path.join(outdir, "runs", f"{label}.accel.json")))
hud = sys.argv[4] if len(sys.argv) > 4 else R.get("hud", "federation")
S = R["samples"]

def clean(seq):
    pts = [(s["t"], s["speed"]) for s in seq if s["speed"] is not None]
    out = []
    for i, (t, v) in enumerate(pts):
        w = [x for _, x in pts[max(0, i - 3):i + 4]]
        if abs(v - st.median(w)) <= 0.6: out.append((t, v))
    return out

def linfit(pts):
    if len(pts) < 3: return None, None
    mt = sum(t for t, _ in pts) / len(pts); mv = sum(v for _, v in pts) / len(pts)
    den = sum((t - mt) ** 2 for t, _ in pts)
    if not den: return None, None
    b = sum((t - mt) * (v - mv) for t, v in pts) / den; return b, mv - b * mt

def clock_rate(pts):
    pts = [(t, c) for t, c in pts if c is not None]
    for _ in range(4):
        b, a = linfit(pts)
        if b is None: return None, 0, None
        res = [(t, c, c - (a + b * t)) for t, c in pts]
        keep = [(t, c) for t, c, r in res if abs(r) <= 1.6]
        if len(keep) == len(pts): break
        pts = keep
    span = pts[-1][0] - pts[0][0] if pts else 0
    return (round(b, 4) if b else None), len(pts), round(span, 1)

res = {"label": label, "hud": hud, "segments": []}
allclock = [(s["t"], s["clock"]) for s in S]
res["clock_all"] = dict(zip(("game_s_per_wall_s", "n", "span_wall_s"), clock_rate(allclock)))
for g in R["segments"]:
    k = g["k"]; seq = [s for s in S if s["seg"] == k]
    pts = clean(seq)
    tk = g["t_keys_start"]; tr = g["t_reached"]
    seg = {"k": k, "target": g["target"], "keys": g["keys"], "key_span_s": round(g["t_keys_end"] - tk, 2),
           "corrections": g.get("corrections"),
           "reach_wall_s_from_first_key": round(tr - tk, 2) if tr is not None else None}
    if pts:
        v0 = pts[0][1]
        seg["start_speed"] = v0
        if g["target"] > v0:
            th = {}
            for x in (1, 5, 10, 15, 20, 25, 30, 31):
                if v0 < x <= g["target"]:
                    t = next((t for t, v in pts if v >= x - 0.05), None)
                    th[str(x)] = round(t - tk, 2) if t is not None else None
            seg["t_cross_wall_s"] = th
        ramp = [(t, v) for t, v in pts if tk + 0.5 < t and (tr is None or t <= tr) and min(v0, g["target"]) + 0.3 < v < max(v0, g["target"]) - 0.3]
        b, _ = linfit(ramp); seg["ramp_rate_speed_per_wall_s"] = round(b, 3) if b is not None else None; seg["ramp_n"] = len(ramp)
    hold = [s for s in seq if tr is not None and s["t"] >= tr]
    cr = clock_rate([(s["t"], s["clock"]) for s in hold])
    seg["hold_clock"] = dict(zip(("game_s_per_wall_s", "n", "span_wall_s"), cr))
    hs = [s["speed"] for s in hold if s["speed"] is not None]
    seg["hold_speed_median"] = st.median(hs) if hs else None
    if do_energy and hold:
        from analyze_turn import energy
        rows = [energy(s["frame"], hud=hud) for s in hold if s.get("frame")][-8:]
        agg = {}
        for key in ("power", "systems", "other", "excess", "row1_a", "row1_b", "row2_a", "row2_b", "row3_a", "row3_b"):
            v = [r[key] for r in rows if r and r.get(key) is not None]
            if v: agg[key] = {"median": st.median(v), "n": len(v), "min": min(v), "max": max(v)}
        seg["energy"] = agg
    res["segments"].append(seg)
print(json.dumps(res, indent=1))
