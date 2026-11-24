#!/usr/bin/env python3
"""Read CHANCE FOR HET and a crude damage flag from a helm-panel crop or a full frame.
Usage: helm_status.py [image.png]
Prints a JSON object: {chance, damaged, raw, confident}.

Chance is only set when a number sits right after a CHANCE/HET label and is
trustworthy. The stylized 100.0 often OCRs as 1000 (accepted as 100) or as
000 / 00.0 (left null so a later HET is still attempted). Garbage like a
stray '7' after '1000) | 7.' is ignored.
"""
import json, re, subprocess, sys
from PIL import Image

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout

def ocr(img, crop, psm="7", scale="600%"):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", scale,
                    "-separate", "-evaluate-sequence", "max", "-negate",
                    "-bordercolor", "white", "-border", "8x8", "/tmp/hetocr.png"])
    return sh("tesseract", "/tmp/hetocr.png", "-", "--psm", psm).strip()

def normalize_token(s):
    s = s.upper().replace("O", "0").replace("U", "0").replace("J", "0").replace("I", "1")
    s = re.sub(r"[^0-9.]", "", s)
    # collapse multiple dots
    if s.count(".") > 1:
        a, *rest = s.split(".")
        s = a + "." + "".join(rest)
    return s

path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/helm.png"
im = Image.open(path)
if im.size[0] >= 400:
    subprocess.run(["convert", path, "-crop", "200x232+0+0", "+repage", "/tmp/helmstrip.png"], check=True)
    strip = "/tmp/helmstrip.png"
    full = path
else:
    strip = path
    full = None

blobs = []
for crop in ("200x28+0+132", "200x24+0+135", "200x20+0+134"):
    for psm in ("6", "7", "11"):
        blobs.append(ocr(strip, crop, psm))
blob = " | ".join(blobs)

labeled = bool(re.search(r"CHANCE|HET|FORHET", blob, re.I))
chance = None
confident = False
vals = []
# Number must sit immediately after the HET/CHANCE label, not later garbage.
pat = re.compile(r"(?:CHANCE\s*FOR\s*HET|FOR\s*HET|FORHET|HET)\s*:?\s*([^\s|]{1,16})", re.I)
for m in pat.finditer(blob):
    tok = normalize_token(m.group(1))
    if not tok:
        continue
    try:
        v = float(tok)
    except ValueError:
        continue
    if v == 1000:
        v = 100.0
    if 0 <= v <= 100:
        vals.append(v)

# 100.0 (including 1000→100) beats a collapsed 0; mid-range underway readings win if present.
nonzero = [v for v in vals if v != 0.0]
mid = [v for v in nonzero if 1 <= v < 100]
hundred = [v for v in nonzero if v == 100.0]
if mid:
    chance = mid[0]
    confident = True
elif hundred:
    chance = 100.0
    confident = True
else:
    chance = None
    confident = False

damaged = False
raw_full = ""
if full:
    raw_full = ocr(full, "700x80+200+80", "6") + " " + ocr(full, "400x20+200+0", "6")
    if re.search(r"BROKEN\s+DOWN|HULL\s+INTEGRITY\s+HAS\s+BROKEN", raw_full, re.I):
        damaged = True

print(json.dumps({
    "chance": chance,
    "damaged": damaged,
    "confident": confident,
    "raw": blob[:400],
    "raw_full": raw_full[:200],
}))
