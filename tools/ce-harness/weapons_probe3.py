#!/usr/bin/env python3
"""Weapons probe v3 (Federation HUD). Observation only: reads the game's own on-screen outputs.
Setup: select nearest enemy (Y), click the arming panel twice (1st click selects the weapon group,
2nd sets NORMAL), follow target (keypad *), optional speed presses.
Then samples at ~1 Hz for <secs>: volley readout lines (vollyinfo), photon arming bar fill, phaser capacitor
fill, own/target hull bar fill, game clock. Fires (Z) when the readout range <= fire_range and either the
arming bar is full or the phaser capacitor is >= 90%, at most every <min_gap> s. Fire events are flagged and
a frame is saved 1.5 s after each shot.
Usage: weapons_probe3.py <label> <secs> <fire_range> <min_gap> [speed_presses]"""
import json, os, re, subprocess, sys, time
from PIL import Image
label, secs, fr, gap = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
sp = int(sys.argv[5]) if len(sys.argv) > 5 else 0
d = f"/out/frames/{label}"; os.makedirs(d, exist_ok=True); os.makedirs("/out/runs", exist_ok=True)
def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def grab(p): subprocess.run(["import", "-window", "root", p])
def prep(img, crop, out, scale="300%"):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", scale, "-separate", "-evaluate-sequence", "max", "-negate", out])
def ocr(img, crop, psm="6", wl=None):
    prep(img, crop, "/tmp/w.png")
    return sh(*(["tesseract", "/tmp/w.png", "-", "--psm", psm] + (["-c", "tessedit_char_whitelist=" + wl] if wl else []))).strip()
def clock(img):
    p = ocr(img, "50x14+973+1", "7", "0123456789:").split(":")
    try: return int(p[0]) * 3600 + int(p[1]) * 60 + int(p[2])
    except (ValueError, IndexError): return None
def bars(img):
    im = Image.open(img).convert("RGB")
    arm = sum(1 for x in range(88, 154) if im.getpixel((x, 380))[1] > 200) / 66
    xs = [x for x in range(510, 649) if not 566 <= x <= 604]
    cap = sum(1 for x in xs if im.getpixel((x, 14))[0] > 200) / len(xs)
    def hb(x0, x1): return round(sum(1 for x in range(x0, x1) if im.getpixel((x, 14))[1] > 200) / (x1 - x0), 3)
    return round(arm, 3), round(cap, 3), hb(295, 379), hb(870, 954)
def parse(lines):
    r = {"range": None, "weapons": []}
    for l in lines:
        m = re.search(r"Range:\s*([\d.,]+)", l)
        if m:
            v = m.group(1).replace(",", ".")
            if "." not in v and len(v) >= 2: v = v[:-1] + "." + v[-1]
            try: r["range"] = float(v)
            except ValueError: pass
        m = re.search(r"(\d+)X\s+([A-Za-z]+(?:\s\d)?)\s+(\d+)\s*-\s*(\d+)\s*\(\s*(\d+)\s*[)}]", l)
        if m: r["weapons"].append({"n": int(m.group(1)), "type": m.group(2), "min": int(m.group(3)), "max": int(m.group(4)), "paren": int(m.group(5))})
    return r
sh("xdotool", "mousemove", "612", "740", "key", "y"); time.sleep(0.8)
for _ in range(2):
    sh("xdotool", "mousemove", "63", "431", "click", "1", "mousemove", "612", "740"); time.sleep(1.2)
sh("xdotool", "key", "KP_Multiply"); time.sleep(0.3)
for _ in range(sp): sh("xdotool", "key", "s"); time.sleep(0.1)
grab(f"{d}/setup.png")
out, t0, last_fire, i = [], time.time(), -1e9, 0
while time.time() - t0 < secs:
    ts = time.time(); f = "/tmp/s.png"; grab(f)
    lines = [l for l in ocr(f, "330x100+203+555").splitlines() if l.strip()]
    arm, cap, own, tgt = bars(f)
    rec = {"i": i, "t": round(ts - t0, 2), "clock": clock(f), "arm": arm, "cap": cap, "own_hull": own, "tgt_hull": tgt,
           "lines": lines, **parse(lines), "fired": False}
    if rec["range"] is not None and rec["range"] <= fr and (arm >= 0.97 or cap >= 0.9) and ts - last_fire >= gap:
        sh("xdotool", "key", "z"); last_fire = time.time(); rec["fired"] = True
        subprocess.run(["cp", f, f"{d}/pre-{i:03d}.png"])
        time.sleep(1.5); g = f"{d}/post-{i:03d}.png"; grab(g)
        pl = [l for l in ocr(g, "330x100+203+555").splitlines() if l.strip()]
        a2, c2, o2, t2 = bars(g)
        rec["post"] = {"lines": pl, **parse(pl), "arm": a2, "cap": c2, "own_hull": o2, "tgt_hull": t2}
    out.append(rec); i += 1
    time.sleep(max(0, 1.0 - (time.time() - ts)))
json.dump(out, open(f"/out/runs/{label}.json", "w"), indent=1)
print(f"weapons result=pass samples={len(out)}", flush=True)
