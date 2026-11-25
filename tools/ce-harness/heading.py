#!/usr/bin/env python3
"""Estimate own-ship heading from overhead-camera screenshots (screen pixels only).
Heading convention: degrees clockwise from screen-up (north), 0..360."""
import sys, math, numpy as np
from PIL import Image
CX, CY, R = 612, 384, 190

def axis(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    c = im[CY-R:CY+R, CX-R:CX+R]
    mx = c.max(axis=2); mn = c.min(axis=2)
    mask = (mx > 70) & ((mx - mn) < 45)          # bright, low-saturation hull pixels
    yy, xx = np.mgrid[-R:R, -R:R]
    mask &= (xx * xx + yy * yy) < R * R            # circular window around camera centre
    ys, xs = np.nonzero(mask)
    if len(xs) < 200: return None
    x = xs - xs.mean(); y = ys - ys.mean()
    cov = np.cov(np.vstack([x, y]))
    w, v = np.linalg.eigh(cov)
    vx, vy = v[:, 1]
    elong = math.sqrt(w[1] / max(w[0], 1e-6))
    # project for skew (front/back hint)
    p = x * vx + y * vy
    skew = float((p**3).mean() / (p.std()**3 + 1e-9))
    ang = (math.degrees(math.atan2(vx, -vy))) % 360   # clockwise from up
    return ang, elong, skew, len(xs), float(xs.mean()+CX-R), float(ys.mean()+CY-R)

if __name__ == "__main__":
    for f in sys.argv[1:]:
        r = axis(f)
        print("heading result=pass" if r else "heading result=fail class=untracked")
