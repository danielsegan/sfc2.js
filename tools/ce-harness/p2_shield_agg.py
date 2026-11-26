#!/usr/bin/env python3
"""Shield-facing proxy (Federation HUD). Observation only.
Own-ship schematic (HUD panel 2, nose to the right) shows six dotted shield facings; dot pixels drop when that
facing loses strength, and a white arc marks one facing. The selected enemy's overhead label (pure blue
0,48,255 text) gives its screen bearing from our ship (screen centre 612,384, overhead view is north-up).
With our ship parked at speed 0 heading east, relative bearing = screen bearing - 90 (0 = dead ahead, +90 = right
of the nose on screen). Prints aggregates only: per 30-deg bearing sector -> modal white-arc facet, and per facet
-> bearings at detected dot drops. Usage: p2_shield_agg.py <weapons json> [heading_deg_screen=90]"""
import json, math, os, sys, collections
from PIL import Image

OUT = os.environ.get("CE_OUT_DIR", "/out")
R = json.load(open(sys.argv[1])); HEAD = float(sys.argv[2]) if len(sys.argv) > 2 else 90.0
FACETS = {"F": (172, 268, 186, 318), "TR": (113, 250, 152, 264), "TL": (53, 248, 99, 262),
          "R": (27, 270, 39, 318), "BL": (53, 328, 99, 340), "BR": (113, 325, 156, 342)}
def gval(px):
    r, g, b = px
    return g if (r < 60 and g > 60 and b < 0.6 * g) else 0
def white(px): r, g, b = px; return r > 150 and g > 190 and b > 190

rows = []
for s in R["samples"]:
    p = os.path.join(OUT, "frames", R["label"], f"{s['i']:05d}.png")
    try: im = Image.open(p).convert("RGB")
    except Exception: continue
    gc, wc = {}, {}
    for k, (x0, y0, x1, y1) in FACETS.items():
        pix = [im.getpixel((x, y)) for x in range(x0, x1) for y in range(y0, y1)]
        gc[k] = sum(gval(q) for q in pix); wc[k] = sum(1 for q in pix if white(q))
    xs = ys = n = 0
    for y in range(32, 740, 2):
        for x in range(200, 1024, 2):
            if im.getpixel((x, y)) == (0, 48, 255): xs += x; ys += y; n += 1
    brg = None
    if n >= 15:
        cx, cy = xs / n, ys / n
        if math.hypot(cx - 612, cy - 384) > 25:
            brg = (math.degrees(math.atan2(cx - 612, -(cy - 384))) - HEAD + 360) % 360
    rows.append({"t": s["t"], "g": gc, "w": wc, "brg": brg})

def sector(b): return int(((b + 15) % 360) // 30) * 30
wmap = collections.defaultdict(collections.Counter)
for r in rows:
    if r["brg"] is None: continue
    k = max(r["w"], key=r["w"].get)
    if r["w"][k] >= 6: wmap[sector(r["brg"])][k] += 1
print("== white arc facet by enemy relative bearing sector (deg, 0=ahead, +=clockwise on screen):")
for sct in sorted(wmap): print(f"  {sct:3d}: {dict(wmap[sct].most_common())}")

hits = collections.defaultdict(list)
for i in range(3, len(rows)):
    for k in FACETS:
        prev = max(rows[j]["g"][k] for j in range(i - 3, i))
        if prev > 0 and prev - rows[i]["g"][k] >= max(300, 0.15 * prev) and rows[i]["brg"] is not None:
            hits[k].append(round(rows[i]["brg"]))
print("== dot-brightness drops (>=15% and >=300 G-sum) per facet: n, bearings by sector")
for k in FACETS:
    v = hits[k]
    print(f"  {k:2s} n={len(v):3d} sectors={dict(collections.Counter(sector(b) for b in v).most_common())}")
print("frames", len(rows), "with bearing", sum(1 for r in rows if r["brg"] is not None))
print("green px start", rows[0]["g"] if rows else None, "end", rows[-1]["g"] if rows else None)
