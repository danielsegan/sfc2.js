#!/usr/bin/env python3
"""Phase-2 duel probe: speed changes, game clock, energy panel. Observation only (screen + OCR).
Usage: duel_accel.py <label> <schedule> [hud]
schedule = comma list of target:hold_s, e.g. 0:15,5:20,0:10,31:60
Energy tab is opened at start (tab coords 182,196 on 1024x768 Federation/Klingon HUDs).
Per sample (~2-3 Hz): wall t, game clock (OCR), SPEED (OCR). Every ~1 s a full frame is kept for
offline energy-panel OCR. Speed keys: s = +1 target, a = -1 target (pressed live, 0.25 s apart).
Writes $CE_OUT_DIR/runs/<label>.accel.json (default /out)."""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_turn import speed, clock

label, sched = sys.argv[1], sys.argv[2]
hud = (sys.argv[3] if len(sys.argv) > 3 else os.environ.get("HUD", "federation")).strip().lower()
OUT = os.environ.get("CE_OUT_DIR", "/out")
# CIRCLE=<s>: keep the ship near the map centre by clicking mouse bearings N,W,S,E in turn every <s> s while
# speed changes (normal port turns); once the target is reached, a final East click is made and the hold runs.
# A speed that stays flat for 12 s off-target (energy-limited top speed when target > cap) counts as reached.
CIRCLE = float(os.environ.get("CIRCLE", "0") or 0)
BEAR = [(612, 150), (330, 384), (612, 650), (900, 384)]  # N, W, S, E on the north-up overhead view

def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def grab(p): subprocess.run(["import", "-window", "root", p], check=True)
def click(xy): sh("xdotool", "mousemove", str(xy[0]), str(xy[1]), "click", "1", "mousemove", "612", "740")

d = os.path.join(OUT, "frames", label)
os.makedirs(d, exist_ok=True)
os.makedirs(os.path.join(OUT, "runs"), exist_ok=True)
sh("xdotool", "mousemove", "182", "196", "click", "1", "mousemove", "612", "740"); time.sleep(0.8)
T0 = time.time(); samples = []; segs = []; fi = 0; last_keep = -9

def sample(seg):
    global fi, last_keep
    t = time.time() - T0; f = "/tmp/a.png"; grab(f)
    s, c = speed(f), clock(f)
    rec = {"t": round(t, 3), "seg": seg, "speed": s, "clock": c}
    if t - last_keep >= 1.0:
        p = os.path.join(d, f"{fi:05d}.png"); subprocess.run(["cp", f, p], check=True); rec["frame"] = p; fi += 1; last_keep = t
    samples.append(rec); return rec

cur = None
for _ in range(3):
    r = sample(-1)
    if r["speed"] is not None: cur = r["speed"]
cur = round(cur or 0.0)
for k, item in enumerate(sched.split(",")):
    tgt, hold = item.split(":"); tgt = int(tgt); hold = float(hold)
    n = tgt - cur; key = "s" if n > 0 else "a"
    tk0 = time.time() - T0
    for _ in range(abs(n)): sh("xdotool", "key", key); time.sleep(0.25)
    tk1 = time.time() - T0; cur = tgt
    reached = None; ts = time.time(); ok = 0; corr = 0; last = []; capped = False
    lastc = time.time() - (CIRCLE or 0); ci = 0; flat_since = None; flat_v = None
    while time.time() - ts < 300:
        if CIRCLE and reached is None and time.time() - lastc >= CIRCLE:
            click(BEAR[ci % 4]); ci += 1; lastc = time.time()
        r = sample(k)
        if r["speed"] is not None:
            if flat_v is None or abs(r["speed"] - flat_v) > 0.06: flat_v, flat_since = r["speed"], r["t"]
            elif reached is None and r["t"] - flat_since >= 12 and r["t"] - tk0 > 15 and abs(flat_v - tgt) > 0.05 and abs(flat_v - round(flat_v)) > 0.02:
                reached = flat_since; capped = True
                if CIRCLE: click(BEAR[3])
        if r["speed"] is not None: last = (last + [r["speed"]])[-6:]
        ok = ok + 1 if (r["speed"] is not None and abs(r["speed"] - tgt) < 0.051) else 0
        if ok >= 3 and reached is None:
            reached = samples[-3]["t"]
            if CIRCLE: click(BEAR[3])
        if reached is not None and r["t"] - reached >= hold: break
        # closed loop: stable at a whole number that is not the target -> a key press was dropped
        if reached is None and len(last) == 6 and max(last) - min(last) < 0.02 and abs(last[-1] - round(last[-1])) < 0.02 and round(last[-1]) != tgt and corr < 3:
            m = tgt - round(last[-1]); kk = "s" if m > 0 else "a"
            for _ in range(abs(m)): sh("xdotool", "key", kk); time.sleep(0.25)
            corr += 1; last = []
    with open(os.path.join(OUT, "runs", f"{label}.accel.partial.json"), "w") as fh:
        json.dump(samples, fh)
    seg = {"k": k, "target": tgt, "keys": abs(n), "t_keys_start": round(tk0, 3), "t_keys_end": round(tk1, 3),
           "t_reached": reached, "corrections": corr, "capped": capped, "circle_clicks": ci, "t_end": round(time.time() - T0, 3)}
    segs.append(seg); print(json.dumps(seg), flush=True)

json.dump({"label": label, "hud": hud, "schedule": sched, "segments": segs, "samples": samples},
          open(os.path.join(OUT, "runs", f"{label}.accel.json"), "w"), indent=1)
print("DONE", label, len(samples))
