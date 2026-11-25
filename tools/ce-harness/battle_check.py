#!/usr/bin/env python3
"""Hard pre-capture check: the battle UI is up, the vessel menu is gone,
and we are not still on Customize. Usage: battle_check.py <designation> [screenshot.png]
Exit 0 only when the check passes. Prints a one-line reason on failure.
"""
import os, re, subprocess, sys
from PIL import Image

want = sys.argv[1] if len(sys.argv) > 1 else ""
shot = sys.argv[2] if len(sys.argv) > 2 else "/tmp/battle.png"

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout

def ocr(img, crop, psm="6"):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", "250%",
                    "-separate", "-evaluate-sequence", "max", "-negate", "/tmp/bcocr.png"])
    return sh("tesseract", "/tmp/bcocr.png", "-", "--psm", psm).strip()

if not os.path.exists(shot):
    subprocess.run(["import", "-window", "root", shot], check=True)

text_top = ocr(shot, "700x200+150+140")
text_helm = ocr(shot, "200x232+0+0")
text_bot = ocr(shot, "400x40+200+736")
blob = " ".join((text_top, text_helm, text_bot, ocr(shot, "600x80+200+250"))).upper()

if re.search(r"CHOOSE\s+VESSEL", blob):
    print("battle result=fail class=menu", flush=True)
    sys.exit(1)
if re.search(r"\b(CUSTOMIZE|SINGLE PLAYER|CHOOSE FLEET)\b", blob):
    print("battle result=fail class=setup-menu", flush=True)
    sys.exit(1)

# Helm / energy tab or the in-battle SPEED / CHANCE chrome.
helm_ok = bool(re.search(r"CHANCE\s+FOR\s+HET", blob) or re.search(r"\bSPEED\b", blob)
               or re.search(r"\bHET\b", blob))
# Pixel fallback: the left 200x232 panel should not be almost-black (menu offset is 192,144,
# so a real helm/energy strip has many mid/bright chrome pixels).
im = Image.open(shot).convert("RGB")
panel = [im.getpixel((x, y)) for y in range(0, 232) for x in range(0, 200)]
bright = sum(1 for r, g, b in panel if r + g + b > 180)
if not helm_ok and bright < 400:
    print("battle result=fail class=no-helm", flush=True)
    sys.exit(1)
if not helm_ok:
    # chrome is present but OCR missed the words — allow if the panel is clearly lit
    # and the centre of the screen looks like space (dark), not a filled menu.
    cx = [im.getpixel((x, y)) for y in range(250, 500) for x in range(350, 750)]
    mid_bright = sum(1 for r, g, b in cx if r + g + b > 250)
    if mid_bright > 40000:
        print("battle result=fail class=not-field", flush=True)
        sys.exit(1)
print("battle result=pass", flush=True)
sys.exit(0)
