#!/usr/bin/env python3
"""Heading change by rotation registration of the own-ship silhouette (screen pixels only, overhead camera).
Works for grey (Federation) and green (Klingon) hulls and has no 180-degree ambiguity.
track(paths) -> list of cumulative heading change (deg, clockwise positive) relative to paths[0], or None."""
import numpy as np
from PIL import Image, ImageFilter
CX, CY, R, W, S = 612, 384, 190, 320, 2   # window, crop size, downscale

def mask(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    c = im[CY-R:CY+R, CX-R:CX+R]
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    m = (g >= 25) & (g * 10 >= r * 8) & (g * 10 >= b * 8)      # hull: grey or green; drops red/blue grid lines
    m &= ~((r * 4 >= g * 3) & (b * 2 < g))                      # drop the olive/yellow HeadingDisplay wedge
    yy, xx = np.mgrid[-R:R, -R:R]
    m &= (xx * xx + yy * yy) < R * R
    ys, xs = np.nonzero(m)
    if len(xs) < 150: return None
    cy, cx = int(ys.mean()), int(xs.mean())
    big = np.zeros((2 * R + W, 2 * R + W), np.uint8); big[W//2:W//2+2*R, W//2:W//2+2*R] = m * 255
    win = big[cy:cy + W, cx:cx + W]
    # fill the silhouette so shading changes with orientation matter less
    img = Image.fromarray(win).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(3))
    img = img.resize((W // S, W // S), Image.BILINEAR).filter(ImageFilter.BoxBlur(1))
    return img

def score(ref, cur, ang):
    a = np.asarray(ref.rotate(ang, Image.BILINEAR), np.float32); b = np.asarray(cur, np.float32)
    return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-6))

def best(ref, cur, center, span, step):
    angs = np.arange(center - span, center + span + 1e-9, step)
    sc = [score(ref, cur, a) for a in angs]
    k = int(np.argmax(sc)); a = angs[k]
    if 0 < k < len(sc) - 1:
        d = sc[k-1] - 2 * sc[k] + sc[k+1]
        if d < 0: a += step * 0.5 * (sc[k-1] - sc[k+1]) / d
    return float(a), sc[k]

def track(paths, span=12.0):
    """Registers every frame against the first good frame. The search is centred on a constant-velocity
    prediction from the previous two estimates and limited to +-span degrees, which keeps the track
    continuous for near-square silhouettes (e.g. D7) that otherwise alias by ~90 degrees.
    Returns (cumulative_deg_clockwise or None, match score) per frame."""
    out, ref, hist = [], None, []
    for p in paths:
        m = mask(p)
        if m is None: out.append((None, None)); continue
        if ref is None: ref = m; hist = [0.0]; out.append((0.0, 1.0)); continue
        pred = hist[-1] + (max(-10.0, min(10.0, hist[-1] - hist[-2])) if len(hist) > 1 else 0.0)
        a, s = best(ref, m, pred, span, 1.0)
        a, s = best(ref, m, a, 1.0, 0.25)
        hist.append(a)
        out.append((-a, s))   # PIL rotate is counter-clockwise positive; heading is clockwise positive
    return out
