#!/usr/bin/env python3
"""Capture phase: set target speed with the speed hotkeys, wait to settle, click a helm turn button,
record timestamped screenshots. Usage: capture_turn.py <label> <target_speed> <button> <seconds>"""
import json, os, subprocess, sys, time
BUTTONS = {"port": (31, 82), "stbd": (139, 82), "hard_port": (31, 118), "hard_stbd": (139, 118), "u_turn": (84, 118)}
# Per-skin helm-panel HET buttons (1024x768). Federation is the default.
# Klingon coords were measured in battle. Others are from HUD screenshots and will be
# confirmed on the first hull of that empire.
HUD_BUTTONS = {
    "federation": {"port": (31, 82), "stbd": (139, 82), "hard_port": (31, 118), "hard_stbd": (139, 118), "u_turn": (84, 118)},
    "klingon":    {"port": (60, 80), "stbd": (117, 80), "hard_port": (60, 112), "hard_stbd": (117, 112), "u_turn": (84, 112)},
    "romulan":    {"port": (48, 113), "stbd": (132, 113), "hard_port": (42, 88), "hard_stbd": (132, 88), "u_turn": (90, 113)},
    "hydran":     {"port": (52, 116), "stbd": (118, 116), "hard_port": (52, 90), "hard_stbd": (118, 90), "u_turn": (86, 116)},
    "isc":        {"port": (52, 116), "stbd": (124, 116), "hard_port": (52, 86), "hard_stbd": (124, 86), "u_turn": (88, 118)},
    "lyran":      {"port": (50, 112), "stbd": (126, 112), "hard_port": (50, 90), "hard_stbd": (126, 90), "u_turn": (88, 112)},
    "gorn":       {"port": (50, 114), "stbd": (130, 114), "hard_port": (50, 82), "hard_stbd": (130, 82), "u_turn": (90, 114)},
    "mirak":      {"port": (44, 80), "stbd": (126, 80), "hard_port": (48, 108), "hard_stbd": (122, 108), "u_turn": (84, 108)},
    "orion":      {"port": (31, 82), "stbd": (139, 82), "hard_port": (31, 118), "hard_stbd": (139, 118), "u_turn": (84, 118)},
}
hud = (os.environ.get("HUD") or "federation").strip().lower()
if hud in HUD_BUTTONS:
    BUTTONS = HUD_BUTTONS[hud]
# Normal (mouse) turns: left-click a bearing in the overhead tactical view (camera centre ~612,384).
MOUSE = {"mouse_n": (612, 150), "mouse_s": (612, 650), "mouse_w": (330, 384), "mouse_e": (900, 384)}
PARK = ("100", "700")
def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def grab(p): subprocess.run(["import", "-window", "root", p], check=True)
def ocr(img, crop, wl):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", "400%", "-separate", "-evaluate-sequence", "max", "-negate", "/tmp/ocr.png"])
    return sh("tesseract", "/tmp/ocr.png", "-", "--psm", "7", "-c", "tessedit_char_whitelist=" + wl).strip()
def speed(img):
    s = ocr(img, "34x16+258+744", "0123456789.").strip(".")
    if s and "." not in s and len(s) >= 3: s = s[:-2] + "." + s[-2:]
    try: v = float(s)
    except ValueError: return None
    return v if 0 <= v <= 40 else None
label, target, button, secs = sys.argv[1], float(sys.argv[2]), sys.argv[3], float(sys.argv[4])
sh("xdotool", "mousemove", *PARK)
grab("/tmp/s.png"); cur = speed("/tmp/s.png") or 0.0
n = int(round(target - cur)); key = "s" if n > 0 else "a"
for _ in range(abs(n)): sh("xdotool", "key", key); time.sleep(0.12)
hist = []; t0 = time.time()
while time.time() - t0 < 120:
    grab("/tmp/s.png"); hist.append(speed("/tmp/s.png")); time.sleep(0.8)
    h = hist[-4:]
    if len(h) == 4 and None not in h and max(h) - min(h) < 0.05: break
fdir = f"/out/frames/{label}"; os.makedirs(fdir, exist_ok=True)
for f in os.listdir(fdir): os.remove(os.path.join(fdir, f))
# energy-allocation panel snapshot at the settled speed (HUD tab with the lightning icon), then back to helm
sh("xdotool", "mousemove", "182", "196", "click", "1", "mousemove", *PARK); time.sleep(0.6)
subprocess.run(["import", "-window", "root", "-crop", "200x232+0+0", "+repage", f"{fdir}/energy.png"])
sh("xdotool", "mousemove", "182", "15", "click", "1", "mousemove", *PARK); time.sleep(0.6)
idx = []; start = time.time(); acted = None; i = 0
while time.time() - start < secs:
    if acted is None and time.time() - start > 1.0:
        x, y = MOUSE[button] if button in MOUSE else BUTTONS[button]
        sh("xdotool", "mousemove", str(x), str(y), "click", "1", "mousemove", *PARK); acted = time.time()
    p = f"{fdir}/{i:04d}.png"; t = time.time(); grab(p); idx.append([round(t, 4), p]); i += 1
json.dump({"label": label, "target_speed": target, "button": button, "speed_history": hist,
           "action_wall": acted, "frames": idx}, open(f"{fdir}/capture.json", "w"), indent=1)
print(label, "settled", hist[-1], "frames", len(idx))
