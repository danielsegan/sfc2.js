#!/usr/bin/env python3
"""Weapons probe (Federation HUD): arm weapons NORMAL, fire repeatedly, OCR the game's own volley readout
(vollyinfo lines, bottom-left of the tactical view) and the target range tag. Usage: weapons_probe.py <label> <shots>"""
import json, os, subprocess, sys, time
label, shots = sys.argv[1], int(sys.argv[2])
d = f"/out/frames/{label}"; os.makedirs(d, exist_ok=True)
def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def ocr(img, crop, psm="6", wl=None):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", "300%", "-separate", "-evaluate-sequence", "max", "-negate", "/tmp/w.png"])
    args = ["tesseract", "/tmp/w.png", "-", "--psm", psm] + (["-c", "tessedit_char_whitelist=" + wl] if wl else [])
    return sh(*args).strip()
sh("xdotool", "mousemove", "63", "431", "click", "1", "mousemove", "100", "700")   # NORMAL arming
out = []
for i in range(shots):
    time.sleep(4)
    p0 = f"{d}/pre-{i:02d}.png"; subprocess.run(["import", "-window", "root", p0])
    sh("xdotool", "mousemove", "57", "380", "click", "1", "mousemove", "100", "700")    # FIRE
    time.sleep(1.2)
    p = f"{d}/post-{i:02d}.png"; subprocess.run(["import", "-window", "root", p])
    rec = {"shot": i, "t": time.time(), "volley_text": ocr(p, "300x70+203+560"),
           "range_text_right": ocr(p, "120x18+900+360", "7", "0123456789.k"),
           "target_tag_full": None}
    out.append(rec); print(json.dumps(rec), flush=True)
json.dump(out, open(f"/out/runs/{label}.json", "w"), indent=1)
