#!/usr/bin/env python3
"""Analysis phase: heading per frame (screen pixels), game clock / speed OCR, turn timing.
Usage: analyze_turn.py <label> ...  -> /out/runs/<label>.json"""
import json, os, subprocess, sys, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from heading import axis
def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def ocr(img, crop, wl):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", "400%", "-separate", "-evaluate-sequence", "max", "-negate", "/tmp/ocr2.png"])
    return sh("tesseract", "/tmp/ocr2.png", "-", "--psm", "7", "-c", "tessedit_char_whitelist=" + wl).strip()
def clock(img):
    p = ocr(img, "50x14+973+1", "0123456789:").split(":")
    try:
        h, m, s = int(p[0]), int(p[1]), int(p[2])
        return h * 3600 + m * 60 + s if h < 10 and m < 60 and s < 60 else None
    except (ValueError, IndexError): return None
def speed(img):
    s = ocr(img, "34x16+258+744", "0123456789.").strip(".")
    if s and "." not in s and len(s) >= 3: s = s[:-2] + "." + s[-2:]
    try: v = float(s)
    except ValueError: return None
    return v if 0 <= v <= 40 else None
# Energy panel (Federation HUD skin): value boxes inside the 200x232 panel crop.
ENERGY_BOXES = {"power": "26x13+56+7", "systems": "26x13+56+19", "other": "26x13+56+173", "excess": "26x13+56+185"}
for i, y in enumerate((37, 64, 91, 118, 145)):
    ENERGY_BOXES[f"row{i+1}_level"] = f"18x14+14+{y}"
    ENERGY_BOXES[f"row{i+1}_a"] = f"32x14+85+{y}"
    ENERGY_BOXES[f"row{i+1}_b"] = f"32x14+126+{y}"
def energy(path):
    if not os.path.exists(path): return None
    out = {}
    for k, box in ENERGY_BOXES.items():
        v = ocr(path, box, "0123456789.")
        try: out[k] = float(v)
        except ValueError: out[k] = None
    return out
HET_BUTTONS = {"port", "stbd", "hard_port", "hard_stbd", "u_turn"}
def turn_kind(button):
    return "het" if button in HET_BUTTONS else "normal"
os.makedirs("/out/runs", exist_ok=True)
for label in sys.argv[1:]:
    cap = json.load(open(f"/out/frames/{label}/capture.json")); a0 = cap["action_wall"]
    rows = []
    for k, (t, p) in enumerate(cap["frames"]):
        a = axis(p)
        rows.append({"t": round(t - a0, 3), "axis": None if a is None else a[0],
                     "clock": clock(p) if k % 4 == 0 else None, "speed": speed(p) if k % 8 == 0 else None})
    # unwrap mod-180 axis, then 5-sample median filter
    prev = None; acc = 0.0; raw = []
    for r in rows:
        if r["axis"] is None: continue
        if prev is not None: acc += (r["axis"] - prev + 90) % 180 - 90
        prev = r["axis"]; raw.append((r["t"], acc))
    sm = [(raw[i][0], statistics.median(v for _, v in raw[max(0, i - 2):i + 3])) for i in range(len(raw))]
    pre = [v for t, v in sm if t < 0]; base = statistics.median(pre) if pre else 0.0
    sm = [(t, v - base) for t, v in sm]
    tail = [v for t, v in sm[-10:]]; total = statistics.median(tail)
    def first(frac): return next((t for t, v in sm if t > 0 and abs(v) >= frac * abs(total)), None)
    t10, t50, t90 = first(0.1), first(0.5), first(0.9)
    mean_rate = (0.8 * abs(total)) / (t90 - t10) if t10 is not None and t90 and t90 > t10 else None
    cl = [(r["t"], r["clock"]) for r in rows if r["clock"] is not None]
    gr = (cl[-1][1] - cl[0][1]) / (cl[-1][0] - cl[0][0]) if len(cl) > 3 and cl[-1][0] > cl[0][0] else None
    spd = [r["speed"] for r in rows if r["speed"] is not None]
    res = {"label": label, "energy_panel": energy(f"/out/frames/{label}/energy.png"), "button": cap["button"], "kind": turn_kind(cap["button"]), "target_speed": cap["target_speed"],
           "settled_speed": cap["speed_history"][-1] if cap["speed_history"] else None,
           "speed_during_run": [min(spd), max(spd)] if spd else None,
           "fps": round(len(rows) / (rows[-1]["t"] - rows[0]["t"]), 2),
           "game_s_per_wall_s": round(gr, 3) if gr else None,
           "total_turn_deg": round(total, 1), "order_delay_s": round(t10, 2) if t10 is not None else None,
           "t10_s": t10, "t50_s": t50, "t90_s": t90,
           "mean_rate_deg_per_wall_s_10_90": round(mean_rate, 2) if mean_rate else None,
           "mean_rate_deg_per_game_s_10_90": round(mean_rate / gr, 2) if mean_rate and gr else None,
           "series": [[round(t, 3), round(v, 2)] for t, v in sm]}
    json.dump(res, open(f"/out/runs/{label}.json", "w"), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != "series"}))
