#!/usr/bin/env python3
"""Star-free rotation registration (drop-in upgrade of heading2.py using only numpy + PIL).
Removes isolated background stars via connected-component filtering on a 2x-downsampled dilated mask,
and lowers the green floor (g>=15) so shadowed Klingon wings stay intact."""
import numpy as np
from PIL import Image, ImageFilter

CX, CY, R, W, S = 612, 384, 190, 320, 2

def _largest_components(m_bool):
    # Dilate slightly so thin booms/nacelles stay connected to the hull, then keep large components via BFS on 4x-downsampled grid.
    dil = np.asarray(Image.fromarray((m_bool * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    # Downsample 4x4 blocks (any pixel True -> block True) for fast BFS (<1 ms)
    h, w = dil.shape
    bh, bw = h // 4, w // 4
    blk = dil[:bh*4, :bw*4].reshape(bh, 4, bw, 4).any(axis=(1, 3))
    vis = np.zeros_like(blk, dtype=bool)
    comps = []
    for y0, x0 in zip(*np.nonzero(blk)):
        if vis[y0, x0]: continue
        stack = [(int(y0), int(x0))]; vis[y0, x0] = True; pts = []
        while stack:
            y, x = stack.pop(); pts.append((y, x))
            for dy, dx in ((-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < bh and 0 <= nx < bw and blk[ny, nx] and not vis[ny, nx]:
                    vis[ny, nx] = True; stack.append((ny, nx))
        comps.append(pts)
    if not comps: return None
    comps.sort(key=len, reverse=True)
    thr = max(12, int(0.25 * len(comps[0])))
    keep_blk = np.zeros_like(blk, dtype=bool)
    for c in comps:
        if len(c) < thr: break
        for y, x in c: keep_blk[y, x] = True
    keep = np.repeat(np.repeat(keep_blk, 4, axis=0), 4, axis=1)
    out = np.zeros_like(dil, dtype=bool)
    out[:bh*4, :bw*4] = dil[:bh*4, :bw*4] & keep
    return out

def mask(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    c = im[CY-R:CY+R, CX-R:CX+R]
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    grey_green = (g >= 15) & (g * 10 >= r * 8) & (g * 10 >= b * 8)
    grey_green &= ~((r * 4 >= g * 3) & (b * 2 < g))
    gold = (r >= 55) & (g >= 20) & (r > g + 8) & (g >= b) & (r + g + b >= 90) & (g >= 25)
    gold &= ~((r >= 80) & (r > g * 2) & (r > b * 2) & (g < 80))
    m = grey_green | gold
    yy, xx = np.mgrid[-R:R, -R:R]
    m &= (xx * xx + yy * yy) < R * R
    m2 = _largest_components(m)
    if m2 is None: return None
    ys, xs = np.nonzero(m2)
    if len(xs) < 150: return None
    cy, cx = int(ys.mean()), int(xs.mean())
    big = np.zeros((2 * R + W, 2 * R + W), np.uint8); big[W//2:W//2+2*R, W//2:W//2+2*R] = m2 * 255
    win = big[cy:cy + W, cx:cx + W]
    img = Image.fromarray(win).filter(ImageFilter.MinFilter(3))
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

def track(paths, span=14.0):
    out, ref, hist = [], None, []
    for p in paths:
        m = mask(p)
        if m is None: out.append((None, None)); continue
        if ref is None: ref = m; hist = [0.0]; out.append((0.0, 1.0)); continue
        pred = hist[-1] + (max(-12.0, min(12.0, hist[-1] - hist[-2])) if len(hist) > 1 else 0.0)
        a, s = best(ref, m, pred, span, 1.0)
        a, s = best(ref, m, a, 1.0, 0.25)
        hist.append(a)
        out.append((-a, s))
    return out
