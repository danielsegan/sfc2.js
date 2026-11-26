#!/usr/bin/env python3
"""Hit-confirmed shield-facing analyzer (Federation HUD). Observation only.
Tracks own ship's heading across frames with heading_clean.py (skipping zoomed-out frames),
maps enemy overhead label (0,48,255) relative bearing (0=ahead, +90=starboard/right of nose, 180=astern, 270=port),
and logs BOTH white-arc facet AND shield dot-brightness drops per 30-deg bearing sector.
Usage: p2_shield_hit_agg.py <frames_dir> [head_at_ref_deg=90.0]"""
import glob, math, os, sys, collections
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import heading_clean as hc

fdir = sys.argv[1]
head0 = float(sys.argv[2]) if len(sys.argv) > 2 else 90.0
frames = sorted(p for p in glob.glob(os.path.join(fdir, "*.png")) if os.path.basename(p)[0].isdigit() and "post" not in p)

FACETS = {"F": (170, 266, 188, 320), "TR": (110, 248, 155, 266), "TL": (50, 248, 102, 265),
          "R": (25, 268, 42, 320), "BL": (50, 325, 102, 344), "BR": (110, 323, 158, 343)}

ref = None; hist = []; rows = []; ref_idx = None
for idx, p in enumerate(frames):
    im = Image.open(p).convert("RGB")
    arr = np.asarray(im).astype(np.int16)
    c = arr[hc.CY-hc.R:hc.CY+hc.R, hc.CX-hc.R:hc.CX+hc.R]
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    m_raw = (g >= 20) & (g * 10 >= r * 8) & (g * 10 >= b * 8) & ~((r * 4 >= g * 3) & (b * 2 < g))
    area = int(m_raw.sum())
    dh, score = None, None
    if area >= 600:
        m = hc.mask(p)
        if m is not None:
            if ref is None:
                ref = m; hist = [0.0]; dh = 0.0; score = 1.0; ref_idx = idx
            else:
                pred = hist[-1] + (max(-12.0, min(12.0, hist[-1] - hist[-2])) if len(hist) > 1 else 0.0)
                a, sc = hc.best(ref, m, pred, 15.0, 1.0)
                a, sc = hc.best(ref, m, a, 1.0, 0.25)
                if sc >= 0.70:
                    hist.append(a); dh = -a; score = sc
    # Enemy label centroid (0,48,255)
    ys, xs = np.nonzero((arr[32:740, 200:1024, 0] == 0) & (arr[32:740, 200:1024, 1] == 48) & (arr[32:740, 200:1024, 2] == 255))
    ebrg = None
    if len(xs) >= 30:
        cx, cy = float(xs.mean()) + 200.0, float(ys.mean()) + 32.0
        if math.hypot(cx - 612, cy - 384) > 25:
            ebrg = math.degrees(math.atan2(cx - 612, -(cy - 384))) % 360
    gc, wc = {}, {}
    for k, (x0, y0, x1, y1) in FACETS.items():
        sub = arr[y0:y1, x0:x1]
        rr, gg, bb = sub[..., 0], sub[..., 1], sub[..., 2]
        gm = (rr < 60) & (gg > 60) & (bb < 0.65 * gg)
        wm = (rr > 150) & (gg > 190) & (bb > 190)
        gc[k] = int(gg[gm].sum()); wc[k] = int(wm.sum())
    rows.append({"idx": idx, "file": os.path.basename(p), "area": area, "dh": dh, "score": score, "ebrg": ebrg, "g": gc, "w": wc})

print(f"total frames={len(rows)}, ref_idx={ref_idx} ({rows[ref_idx]['file'] if ref_idx is not None else None}), tracked={sum(1 for r in rows if r['dh'] is not None)}")
for r in rows:
    r["rel"] = (r["ebrg"] - (head0 + r["dh"])) % 360 if (r["ebrg"] is not None and r["dh"] is not None) else None

def sector(b): return int(((b + 15) % 360) // 30) * 30
wmap = collections.defaultdict(collections.Counter)
for r in rows:
    if r["rel"] is None: continue
    k = max(r["w"], key=r["w"].get)
    if r["w"][k] >= 6: wmap[sector(r["rel"])][k] += 1
print("== white-arc facet by enemy relative bearing (0=ahead, +90=starboard, 180=astern, 270=port):")
for sct in range(0, 360, 30):
    print(f"  {sct:3d}: {dict(wmap[sct].most_common()) if sct in wmap else {}}")

hits = collections.defaultdict(list)
last_hit = {k: -99 for k in FACETS}
for i in range(3, len(rows)):
    r = rows[i]
    if r["rel"] is None: continue
    for k in FACETS:
        prev = max(rows[j]["g"][k] for j in range(i - 3, i))
        drop = prev - r["g"][k]
        if prev >= 1000 and drop >= max(250, 0.12 * prev) and i - last_hit[k] >= 3:
            last_hit[k] = i
            hits[k].append((round(r["rel"], 1), drop, prev, r["file"], round(r["ebrg"], 1), round((head0 + r["dh"]) % 360, 1)))
print("== hit-confirmed dot drops per facet:")
for k in FACETS:
    v = hits[k]
    scts = dict(collections.Counter(sector(x[0]) for x in v).most_common())
    print(f"  {k:2s} n={len(v):2d} sectors={scts} samples={v[:4]}")
print("g start (tracked):", next((r["g"] for r in rows if r["dh"] is not None), None), "end:", rows[-1]["g"] if rows else None)
