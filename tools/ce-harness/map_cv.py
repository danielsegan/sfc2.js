#!/usr/bin/env python3
"""From the skirmish Customize screen, open CHOOSE VESSEL for each of 9 races,
save a full screenshot, and leave with Escape. Observation only."""
import os, subprocess, time
RACES = ["federation", "klingon", "romulan", "lyran", "hydran", "gorn", "isc", "mirak", "orion"]
RACE, SELECT = (306, 242), (344, 291)
OUT = "/out/cvmap"
os.makedirs(OUT, exist_ok=True)

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout

def click(xy, wait=1.0):
    sh("xdotool", "mousemove", str(xy[0]), str(xy[1]), "click", "1", "mousemove", "900", "700")
    time.sleep(wait)

def grab(p):
    subprocess.run(["import", "-window", "root", p], check=True)

def ocr(img, crop, psm="6"):
    subprocess.run(["convert", img, "-crop", crop, "+repage", "-resize", "250%",
                    "-separate", "-evaluate-sequence", "max", "-negate", "/tmp/mapocr.png"])
    return sh("tesseract", "/tmp/mapocr.png", "-", "--psm", psm).strip()

for i, race in enumerate(RACES):
    if i:
        click(RACE, 1.0)
    grab(f"{OUT}/customize-r{i}-{race}.png")
    click(SELECT, 2.2)
    path = f"{OUT}/cv-r{i}-{race}.png"
    grab(path)
    right = ocr(path, "200x450+640+150")
    left = ocr(path, "200x450+200+150")
    title = ocr(path, "400x50+220+190", "6")
    print(f"RACE {i} {race}", flush=True)
    print(" TITLE:", " ".join(title.split())[:120], flush=True)
    print(" RIGHT:", " ".join(right.split())[:200], flush=True)
    print(" LEFT:", " ".join(left.split())[:200], flush=True)
    # leave CHOOSE VESSEL without relying on DONE
    sh("xdotool", "key", "Escape")
    time.sleep(1.2)
    grab(f"{OUT}/after-esc-r{i}-{race}.png")
    after = ocr(f"{OUT}/after-esc-r{i}-{race}.png", "400x80+300+150", "6")
    if "CHOOSE VESSEL" in after.upper() or "CHOOSE" in after.upper():
        print(" WARN still on vessel after Escape; trying second Escape", flush=True)
        sh("xdotool", "key", "Escape")
        time.sleep(1.0)
        grab(f"{OUT}/after-esc2-r{i}-{race}.png")
print("done map_cv", flush=True)
