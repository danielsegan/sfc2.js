#!/usr/bin/env python3
"""Vessel Library / CHOOSE VESSEL capture (observation only).
Assumes the container is already on the skirmish Customize (fleet) screen.
Clicks SELECT, pages every hull in every size-class for N races starting after
`race_clicks` presses of the fleet race arrow, and writes on-screen readings
(designation, turning class, power, shield numbers with screen positions, etc.)
to /out/library/<label>.json. Screenshots stay on the VM under /out/library/frames/.
Usage: library_sweep.py <label> <race_clicks> <n_races>"""
import json, os, re, subprocess, sys, time
from collections import Counter
import choose_vessel
label, race_clicks, n_races = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
start_hud = sys.argv[4] if len(sys.argv) > 4 else None
root = f"/out/library/{label}"; os.makedirs(f"{root}/frames", exist_ok=True)
SELECT, RACE = (344, 291), (306, 242)

def race_name(i):
    # i is 0-based within this sweep, added to race_clicks
    # RACE_ORDER names Orion as index 8, but the Your Fleet arrow wraps
    # after Mirak, so a sweep that asks for a 9th race is Federation again.
    idx = (race_clicks + i) % len(choose_vessel.RACE_ORDER)
    return choose_vessel.RACE_ORDER[idx]

def skin_clicks(i):
    s = choose_vessel.skin(start_hud or race_name(i))
    return s
def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def click(xy, wait=1.2):
    sh("xdotool", "mousemove", str(xy[0]), str(xy[1]), "click", "1", "mousemove", "900", "700")
    time.sleep(wait)
def grab(p): subprocess.run(["import", "-window", "root", p], check=True)
def ocr(img, crop, psm="6"):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", "250%",
                    "-separate", "-evaluate-sequence", "max", "-negate", "/tmp/libocr.png"])
    return sh("tesseract", "/tmp/libocr.png", "-", "--psm", psm).strip()
def parse_stats(text):
    d = {}
    def g(name, pat):
        m = re.search(pat, text, re.I)
        if m:
            try: d[name] = float(m.group(1)) if "." in m.group(1) else int(m.group(1))
            except ValueError: d[name] = m.group(1)
    g("bpv", r"BPV\s*:\s*([\d.]+)")
    g("movement_ratio", r"MOVEMENT\s+RATIO\s*:\s*([\d.]+)")
    g("turning_class", r"TURNING\s+CLASS\s*:\s*([\d.]+)")
    g("crew", r"CREW\s*:\s*([\d.]+)")
    g("marines", r"MARINES\s*:\s*([\d.]+)")
    g("warp_power", r"TOTAL\s+WARP\s+POWER\s*:\s*([\d.]+)")
    g("impulse_power", r"IMPULSE\s+POWER\s*:\s*([\d.]+)")
    g("aux_power", r"AUXILIARY\s+POWER\s*:\s*([\d.]+)")
    g("engine_power", r"TOTAL\s+ENGINE\s+POWER\s*:\s*([\d.]+)")
    g("battery", r"BATTERY\s*:\s*([\d.]+)")
    m = re.search(r"DESIGNATION\s*:\s*([A-Z0-9+\-]+)", text, re.I)
    if m: d["designation"] = m.group(1).strip()
    d["weapons"] = re.findall(r"(\d+)\s*[xX]\s+([A-Za-z][A-Za-z0-9 ]{0,20})", text)
    d["raw"] = text
    return d
def shield_numbers(img):
    # isolated numbers in the diagram (psm 11), with x,y from a scaled crop
    # crop: ship diagram region inside the 640x480 panel
    subprocess.run(["convert", img, "-crop", "480x300+210+200", "+repage", "-resize", "200%",
                    "-separate", "-evaluate-sequence", "max", "-negate", "/tmp/libsh.png"])
    # tsv with positions
    tsv = sh("tesseract", "/tmp/libsh.png", "-", "--psm", "11", "tsv")
    out = []
    for line in tsv.splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) < 12: continue
        text = parts[11].strip()
        if re.fullmatch(r"\d{1,3}", text):
            x, y, w, h = map(int, parts[6:10])
            out.append({"n": int(text), "x": x, "y": y, "w": w, "h": h})
    return out
def signature(rec):
    shn = tuple(sorted((s["n"], s["x"]//20, s["y"]//20) for s in rec.get("shields") or []))
    return (rec.get("designation"), rec.get("bpv"), rec.get("turning_class"), rec.get("engine_power"), shn)
def read_ship(tag):
    p = f"{root}/frames/{tag}.png"; grab(p)
    # Try the skin's stats crop first, then both sides, so left-panel empires work.
    crops = ["180x430+650+155", "200x400+200+175"]
    stats = {}
    for crop in crops:
        cand = parse_stats(ocr(p, crop))
        if cand.get("designation") or cand.get("bpv"):
            stats = cand
            break
        if not stats:
            stats = cand
    title = ocr(p, "320x50+220+200", "6")
    rec = {**stats, "title": title, "shields": shield_numbers(p), "tag": tag}
    return rec
# From the fleet customize screen
for _ in range(race_clicks):
    click(RACE, 0.8)
all_rows = []
for ri in range(n_races):
    click(SELECT, 2.0)
    class_seen = set()
    for ci in range(16):
        rec0 = read_ship(f"r{ri}-c{ci}-s000")
        sig0 = signature(rec0)
        if sig0 in class_seen and ci > 0:
            break
        class_seen.add(sig0)
        class_rows = [rec0]
        print(json.dumps({"race_i": ri, "class_i": ci, "title": rec0.get("title"), "designation": rec0.get("designation"), "bpv": rec0.get("bpv")}), flush=True)
        for si in range(1, 80):
            click(skin_clicks(ri)['ship_next'], 1.0)
            rec = read_ship(f"r{ri}-c{ci}-s{si:03d}")
            if signature(rec) == sig0:
                break
            class_rows.append(rec)
            if si % 5 == 0:
                print(json.dumps({"race_i": ri, "class_i": ci, "ship_i": si, "designation": rec.get("designation"), "bpv": rec.get("bpv")}), flush=True)
        all_rows.append({"race_i": ri, "class_i": ci, "n": len(class_rows), "ships": class_rows})
        click(skin_clicks(ri)['class_next'], 1.2)
    click(skin_clicks(ri)['done'], 1.5)
    # If DONE missed, Escape so the race arrow is reachable.
    time.sleep(0.4)
    sh("xdotool", "key", "Escape"); time.sleep(0.8)
    if ri + 1 < n_races:
        click(RACE, 1.0)
json.dump(all_rows, open(f"{root}/library.json", "w"), indent=1)
print("done", label, "classes", len(all_rows), "ships", sum(c["n"] for c in all_rows), flush=True)
