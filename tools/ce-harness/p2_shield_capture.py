#!/usr/bin/env python3
"""Hit-confirmed shield capture. Observation only.
Arms weapons (Alert -> shields UP), clicks speed=3 and turns slowly in a circle (clicking
N/W/S/E every ~22 s) so the enemy bearing sweeps 360 deg. Records frames at ~1 Hz
until secs elapsed or battle ends (detected via game clock freeze >=12 s). Never fires weapons.
Usage: p2_shield_capture.py <label> [secs=360] [hud=federation]"""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_turn import clock, speed

ARM_CLICKS = {
    "federation": [(63, 431), (63, 431)],
    "klingon": [(75, 436)],
}

label = sys.argv[1]
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 360.0
hud = (sys.argv[3] if len(sys.argv) > 3 else os.environ.get("HUD", "federation")).strip().lower()
OUT = os.environ.get("CE_OUT_DIR", "/out")
d = os.path.join(OUT, "frames", label)
os.makedirs(d, exist_ok=True)
os.makedirs(os.path.join(OUT, "runs"), exist_ok=True)

def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def grab(p): subprocess.run(["import", "-window", "root", p], check=True)

sh("xdotool", "mousemove", "612", "740", "key", "y"); time.sleep(0.8)
for x, y in ARM_CLICKS.get(hud, ARM_CLICKS["federation"]):
    sh("xdotool", "mousemove", str(x), str(y), "click", "1", "mousemove", "612", "740"); time.sleep(1.0)
for _ in range(3): sh("xdotool", "key", "s"); time.sleep(0.25)

BEAR = [(612, 150), (330, 384), (612, 650), (900, 384)]  # N, W, S, E
bi = 0; last_b = -999
T0 = time.time(); out = []; i = 0; last_c = None; same_c_since = None
while time.time() - T0 < secs:
    ts = time.time(); t = ts - T0
    if t >= 15 and t - last_b >= 22:
        x, y = BEAR[bi % 4]
        sh("xdotool", "mousemove", str(x), str(y), "click", "1", "mousemove", "612", "740")
        bi += 1; last_b = t
    f = os.path.join(d, f"{i:05d}.png"); grab(f)
    c = clock(f); sp = speed(f)
    if c is not None:
        if c == last_c:
            if same_c_since is None: same_c_since = t
            elif t - same_c_since >= 12.0:
                print(f"clock froze at {c} for 12s -> stopping", flush=True); break
        else:
            last_c = c; same_c_since = t
    out.append({"i": i, "t": round(t, 2), "clock": c, "speed": sp})
    if i % 20 == 0:
        print(json.dumps({"i": i, "t": round(t, 2), "clock": c, "speed": sp}), flush=True)
    i += 1
    time.sleep(max(0, 1.0 - (time.time() - ts)))

json.dump({"label": label, "hud": hud, "samples": out},
          open(os.path.join(OUT, "runs", f"{label}.shield.json"), "w"), indent=1)
print("DONE", label, len(out))
