#!/usr/bin/env python3
"""Energy-panel timeline from kept frames. Prints run-length segments of (systems, row1, row2, other, excess)
values (aggregate timeline, no frames). Uses per-skin HUD coordinates (federation or klingon).
Usage: p2_energy_timeline.py <runs json> <frames key: weapons|accel> [hud]"""
import json, os, subprocess, sys, statistics as st

hud = (sys.argv[3] if len(sys.argv) > 3 else "federation").strip().lower()
OUT = os.environ.get("CE_OUT_DIR", "/out")
R = json.load(open(sys.argv[1])); S = R["samples"]
STEP = int(os.environ.get("STEP", "2"))

def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def ocr(p, box):
    subprocess.run(["convert", p, "-crop", box, "+repage", "-resize", "600%", "-separate", "-evaluate-sequence", "max",
                    "-negate", "-bordercolor", "white", "-border", "10x10", "/tmp/e.png"], check=True)
    s = sh("tesseract", "/tmp/e.png", "-", "--psm", "7", "-c", "tessedit_char_whitelist=0123456789.").strip()
    try:
        v = float(s)
        if "." not in s and v >= 10 and len(s) >= 2: v = v / 10  # lost decimal point
        return v if v < 80 else None
    except ValueError:
        return None

if hud == "federation":
    BOX = {"systems": "40x16+52+16", "row1": "32x14+85+37", "row2": "32x14+85+64", "row3": "32x14+85+91", "other": "40x16+52+170", "excess": "40x16+52+182"}
else:  # klingon skin
    BOX = {"systems": "34x14+58+22", "row1": "30x14+86+43", "row2": "30x14+86+69", "row3": "30x14+86+95", "other": "30x14+58+165", "excess": "30x14+58+184"}

rows = []
for i, s in enumerate(S):
    if i % STEP: continue
    p = s.get("frame") or (os.path.join(OUT, "frames", R["label"], f"{s['i']:05d}.png") if "i" in s else None)
    if not p or not os.path.exists(p): continue
    rows.append((s["t"], {k: ocr(p, b) for k, b in BOX.items()}))

# run-length on row2 (weapons) with systems/excess medians
segs = []
for t, r in rows:
    key = r["row2"]
    if segs and segs[-1]["row2"] == key:
        segs[-1]["t1"] = t; segs[-1]["n"] += 1
        for k in ("systems", "excess", "row1", "other", "row3"): segs[-1]["_" + k].append(r[k])
    else:
        segs.append({"row2": key, "t0": t, "t1": t, "n": 1, **{"_" + k: [r[k]] for k in ("systems", "excess", "row1", "other", "row3")}})

for g in segs:
    if g["n"] < 2: continue
    out = {k: g[k] for k in ("row2", "t0", "t1", "n")}
    for k in ("systems", "excess", "row1", "other", "row3"):
        v = [x for x in g["_" + k] if x is not None]; out[k] = st.median(v) if v else None
    print(json.dumps(out))
