#!/usr/bin/env python3
"""Phase-2 duel weapons probe. Observation only: the game's own on-screen outputs.
Usage: duel_weapons.py <label> <secs> <fire_bands> [arm_clicks=auto] [hud=federation]
  fire_bands: comma list of ranges (k); fire once (Z) when readout range is within +-0.8 of each band
              (and Federation arm bar is full, unless ARM_THRESHOLD overrides). Use 'none' to never fire.
  arm_clicks: ';'-separated x,y clicks done once at start, 'auto' (default) for per-HUD Alert/Arm clicks
              (federation: 63,431;63,431; klingon: 75,436), or 'none' to skip clicking.
Opens the energy tab first (182,196), selects nearest enemy (y), follows (keypad *).
Every ~1 s: keeps frame under $CE_OUT_DIR/frames/<label>/, OCRs volleyinfo with contrast boost,
parses Range + multi-word weapon names (Photon, Phaser 1/2/3, Disruptor 3, Missile Rack F),
game clock, and per-skin arming readout (Fed arm bar + phaser cap, Klingon circular gauge).
Writes $CE_OUT_DIR/runs/<label>.weapons.json (default /out)."""
import json, os, re, subprocess, sys, time
import numpy as np
from PIL import Image

HUD_CFG = {
    "federation": {
        "energy_tab": (182, 196),
        "volley_crop": "340x135+200+550",
        "arm_clicks": "63,431;63,431",
        "arm_bar": (88, 154, 380),
        "cap_bar": (510, 649, 566, 604, 14),
        "gauge": None,
        "arm_threshold": 0.97,
    },
    "klingon": {
        "energy_tab": (182, 196),
        "volley_crop": "340x135+200+550",
        "arm_clicks": "75,436",
        "arm_bar": None,
        "cap_bar": None,
        "gauge": (167, 391, 5, 15),
        "arm_threshold": None,
    },
}

WEAPON_RE = re.compile(
    r"(\d+)\s*[xX][\s.]+(Photon|Phaser\s?[123I|l]|Disruptor\s?3|Missile\s?Rack[\s.-]?F)\s*(\d+)\s*-\s*(\d+)\s*\(\s*(\d+)\s*[)}]"
)

def norm_weapon(raw):
    s = re.sub(r"[\s.-]+", " ", raw).strip()
    if s.startswith("Phaser"):
        tail = s[6:].strip()
        if tail in ("I", "|", "l"):
            tail = "1"
        return f"Phaser {tail}" if tail else "Phaser"
    if s.startswith("Disruptor"):
        return "Disruptor 3"
    if s.startswith("Missile"):
        return "Missile Rack F"
    return s

label = sys.argv[1]
secs = float(sys.argv[2])
bands_arg = sys.argv[3]
arm_arg = sys.argv[4] if len(sys.argv) > 4 else "auto"
hud = (sys.argv[5] if len(sys.argv) > 5 else os.environ.get("HUD", "federation")).strip().lower()
cfg = HUD_CFG.get(hud, HUD_CFG["federation"])
if arm_arg in ("auto", "default"):
    arm = cfg["arm_clicks"]
elif arm_arg == "none":
    arm = ""
else:
    arm = arm_arg
bands = [] if bands_arg == "none" else [float(b) for b in bands_arg.split(",")]
arm_thr_env = os.environ.get("ARM_THRESHOLD")
arm_thr = float(arm_thr_env) if arm_thr_env else cfg["arm_threshold"]

OUT = os.environ.get("CE_OUT_DIR", "/out")
d = os.path.join(OUT, "frames", label)
os.makedirs(d, exist_ok=True)
os.makedirs(os.path.join(OUT, "runs"), exist_ok=True)

def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def grab(p): subprocess.run(["import", "-window", "root", p], check=True)
def ocr(img, crop, psm="6", wl=None, scale="300%", level="15%,85%"):
    cmd = ["convert", img, "-crop", crop, "+repage", "-resize", scale, "-separate", "-evaluate-sequence", "max"]
    if level:
        cmd += ["-level", level]
    cmd += ["-negate", "/tmp/w.png"]
    subprocess.run(cmd, check=True)
    return sh(*(["tesseract", "/tmp/w.png", "-", "--psm", psm] + (["-c", "tessedit_char_whitelist=" + wl] if wl else []))).strip()

def clock(img):
    p = ocr(img, "50x14+973+1", "7", "0123456789:", "400%", level=None).split(":")
    try:
        h, m, s = int(p[0]), int(p[1]), int(p[2])
        return h * 3600 + m * 60 + s if h < 10 and m < 60 and s < 60 else None
    except (ValueError, IndexError):
        return None

def bars(img):
    im = Image.open(img).convert("RGB")
    arm_val, cap_val = None, None
    if cfg["arm_bar"]:
        x0, x1, y = cfg["arm_bar"]
        arm_val = round(sum(1 for x in range(x0, x1) if im.getpixel((x, y))[1] > 200) / (x1 - x0), 3)
    elif cfg["gauge"]:
        cx, cy, r_lo, r_hi = cfg["gauge"]
        arr = np.asarray(im)
        y0, y1 = cy - r_hi - 3, cy + r_hi + 4
        x0, x1 = cx - r_hi - 3, cx + r_hi + 4
        sub = arr[y0:y1, x0:x1]
        yy, xx = np.mgrid[y0:y1, x0:x1]
        rr = np.hypot(xx - cx, yy - cy)
        ring = (rr >= r_lo) & (rr <= r_hi)
        r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
        yellow = (r > 150) & (g > 130) & (b < 90)
        arm_val = round(float((yellow & ring).sum()) / float(ring.sum()), 3)
    if cfg["cap_bar"]:
        x0, x1, ex0, ex1, y = cfg["cap_bar"]
        xs = [x for x in range(x0, x1) if not ex0 <= x <= ex1]
        cap_val = round(sum(1 for x in xs if im.getpixel((x, y))[0] > 200) / len(xs), 3)
    return arm_val, cap_val

def parse(lines):
    r = {"range": None, "weapons": []}
    for l in lines:
        m = re.search(r"Range:\s*([\d.,]+)", l)
        if m:
            v = m.group(1).rstrip(".,").replace(",", ".")
            if "." not in v and len(v) >= 2:
                v = v[:-1] + "." + v[-1]
            try:
                fv = float(v)
                r["range"] = fv / 10 if fv > 99 else fv  # lost decimal point ("304" = 30.4)
            except ValueError:
                pass
        m = WEAPON_RE.search(l)
        if m:
            n, a, b, p = int(m.group(1)), int(m.group(3)), int(m.group(4)), int(m.group(5))
            if 0 < n <= 12 and a <= b and p <= b:
                r["weapons"].append({"n": n, "type": norm_weapon(m.group(2)), "min": a, "max": b, "paren": p})
    return r

etx, ety = cfg["energy_tab"]
sh("xdotool", "mousemove", str(etx), str(ety), "click", "1", "mousemove", "612", "740"); time.sleep(0.8)
sh("xdotool", "key", "y"); time.sleep(0.8)
t0 = time.time()
for c in [c for c in arm.split(";") if c]:
    x, y = c.split(",")
    sh("xdotool", "mousemove", x.strip(), y.strip(), "click", "1", "mousemove", "612", "740"); time.sleep(1.2)
arm_t = round(time.time() - t0, 2)
if not os.environ.get("NOFOLLOW"):
    sh("xdotool", "key", "KP_Multiply"); time.sleep(0.3)
grab(os.path.join(d, "setup.png"))

out, i, done = [], 0, set()
vcrop = cfg["volley_crop"]
while time.time() - t0 < secs:
    ts = time.time(); f = os.path.join(d, f"{i:05d}.png"); grab(f)
    lines = [l for l in ocr(f, vcrop).splitlines() if l.strip()]
    a, c = bars(f)
    rec = {"i": i, "t": round(ts - t0, 2), "clock": clock(f), "arm": a, "cap": c, "lines": lines, **parse(lines), "fired": False}
    rg = rec["range"]
    if rg is not None:
        for b in bands:
            ready = (arm_thr is None) or (a is None) or (a >= arm_thr)
            if b not in done and abs(rg - b) <= 0.8 and ready:
                sh("xdotool", "key", "z"); done.add(b); rec["fired"] = b
                time.sleep(1.5); g = os.path.join(d, f"{i:05d}-post.png"); grab(g)
                pl = [l for l in ocr(g, vcrop).splitlines() if l.strip()]
                a2, c2 = bars(g)
                rec["post"] = {"lines": pl, **parse(pl), "arm": a2, "cap": c2}
                break
    out.append(rec)
    print(json.dumps({k: rec[k] for k in ("i", "t", "clock", "range", "arm", "cap", "fired", "weapons")}), flush=True)
    i += 1
    if i % 20 == 0:
        json.dump({"label": label, "hud": hud, "arm_t": arm_t, "samples": out},
                  open(os.path.join(OUT, "runs", f"{label}.weapons.json"), "w"))
    time.sleep(max(0, float(os.environ.get("PERIOD", "1.0")) - (time.time() - ts)))

json.dump({"label": label, "arm_t": arm_t, "hud": hud, "arm_clicks": arm, "bands": bands, "samples": out},
          open(os.path.join(OUT, "runs", f"{label}.weapons.json"), "w"), indent=1)
print("DONE", label, len(out))
