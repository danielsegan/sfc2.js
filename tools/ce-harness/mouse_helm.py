#!/usr/bin/env python3
"""Mouse-helm probe: capture frames while clicking a point in the overhead tactical view.
Usage: mouse_helm.py <label> <x> <y> <button 1|3> <seconds>"""
import json, os, subprocess, sys, time
sys.path.insert(0, "/h")
from heading import axis
label, x, y, b, secs = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5])
d = f"/out/frames/{label}"; os.makedirs(d, exist_ok=True)
fr = []; t0 = time.time(); act = None; i = 0
while time.time() - t0 < secs:
    if act is None and time.time() - t0 > 1.0:
        subprocess.run(["xdotool", "mousemove", x, y, "click", b]); act = time.time()
        subprocess.run(["xdotool", "mousemove", "100", "700"])
    p = f"{d}/{i:04d}.png"; t = time.time(); subprocess.run(["import", "-window", "root", p]); fr.append((t - act if act else t - t0 - 1.0, p)); i += 1
ser = []
for t, p in fr[::3]:
    a = axis(p); ser.append([round(t, 2), None if a is None else round(a[0], 1)])
json.dump({"label": label, "click": [x, y, b], "axis_series": ser}, open(f"{d}/probe.json", "w"))
print(label, ser)
