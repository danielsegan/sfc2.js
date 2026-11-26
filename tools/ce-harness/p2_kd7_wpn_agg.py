#!/usr/bin/env python3
"""Aggregate Klingon weapons frames: re-OCRs vollyinfo with contrast boost for dark-red Phaser-2 text,
measures yellow circular arming gauge fill (around x=167,y=391), and outputs per-range-band Phaser-2,
Disruptor-3 & Missile Rack F tables plus arm/re-arm timing. Usage: p2_kd7_wpn_agg.py <weapons_json> [step=2]"""
import collections, json, os, re, statistics as st, subprocess, sys
import numpy as np
from PIL import Image

R = json.load(open(sys.argv[1])); S = R["samples"]
step = int(sys.argv[2]) if len(sys.argv) > 2 else 2
OUT = os.environ.get("CE_OUT_DIR", "/out")
fdir = os.path.join(OUT, "frames", R["label"])
BANDS = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 8), (8, 10), (10, 12), (12, 15), (15, 20), (20, 25), (25, 30), (30, 40)]
WEAPON_RE = re.compile(
    r"(\d+)\s*[xX][\s.]+(Photon|Phaser\s?[123I|l]|Disruptor\s?3|Missile\s?Rack[\s.-]?F)\s*(\d+)\s*-\s*(\d+)\s*\(\s*(\d+)\s*[)}]"
)

def norm_weapon(raw):
    s = re.sub(r"[\s.-]+", " ", raw).strip()
    if s.startswith("Phaser"):
        tail = s[6:].strip()
        if tail in ("I", "|", "l"): tail = "1"
        return f"Phaser {tail}" if tail else "Phaser"
    if s.startswith("Disruptor"): return "Disruptor 3"
    if s.startswith("Missile"): return "Missile Rack F"
    return s

def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def ocr_volly(p):
    # Boost R,G,B max with level stretch so dark-red Phaser-2 text OCRs cleanly
    subprocess.run(["convert", p, "-crop", "340x135+200+550", "+repage", "-resize", "300%",
                    "-separate", "-evaluate-sequence", "max", "-level", "15%,85%", "-negate", "/tmp/kw.png"], check=True)
    return sh("tesseract", "/tmp/kw.png", "-", "--psm", "6").splitlines()

def gauge_fill(p):
    # Circular arming dial in Klingon weapon panel: center ~(167, 391), radius 5..15 px
    arr = np.asarray(Image.open(p).convert("RGB"))
    sub = arr[373:410, 149:186]
    yy, xx = np.mgrid[373:410, 149:186]
    rr = np.hypot(xx - 167, yy - 391)
    ring = (rr >= 5) & (rr <= 15)
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
    yellow = (r > 150) & (g > 130) & (b < 90)
    return round(float((yellow & ring).sum()) / float(ring.sum()), 3)

def prange(lines):
    for l in lines:
        m = re.search(r"Range:\s*([\d.,]+)", l)
        if m:
            v = m.group(1).rstrip(".,").replace(",", ".")
            if "." not in v and len(v) >= 2: v = v[:-1] + "." + v[-1]
            try:
                fv = float(v); return fv / 10 if fv > 99 else fv
            except ValueError: pass
    return None

def pweap(lines):
    out = []
    for l in lines:
        m = WEAPON_RE.search(l)
        if m:
            n = int(m.group(1))
            typ = norm_weapon(m.group(2))
            a, b, p = int(m.group(3)), int(m.group(4)), int(m.group(5))
            if 0 < n <= 12 and a <= b and p <= b: out.append((n, typ, a, b, p))
    return out

g = collections.defaultdict(list)
timeline = []
for idx, s in enumerate(S):
    p = os.path.join(fdir, f"{s['i']:05d}.png")
    if not os.path.exists(p): continue
    if idx % step != 0 and not s.get("fired"): continue
    lines = ocr_volly(p)
    rg = prange(lines) or s.get("range")
    wp = pweap(lines)
    gf = gauge_fill(p)
    timeline.append((s["t"], s.get("clock"), rg, gf, s.get("fired"), wp))
    if rg is not None:
        for n, typ, a, b, pr in wp:
            for lo, hi in BANDS:
                if lo <= rg < hi: g[(typ, lo, hi)].append((n, a, b, pr)); break

print("==", R["label"], "re-OCRed samples=", len(timeline), "fires=", [(t[0], t[2], t[4]) for t in timeline if t[4]])
for (typ, lo, hi) in sorted(g):
    v = g[(typ, lo, hi)]
    nz = [x for x in v if x[2] > 0]
    if nz:
        pm = lambda i: [x[i] / x[0] for x in nz]
        print(f"{typ:14s} {lo:>2}-{hi:<2}k n={len(v):3d} nonzero={len(nz):3d} mounts={st.median([x[0] for x in nz])} "
              f"per-mount min {min(pm(1)):.1f}..{max(pm(1)):.1f} max {min(pm(2)):.1f}..{max(pm(2)):.1f} (med {st.median(pm(2)):.1f}) "
              f"paren {min(pm(3)):.1f}..{max(pm(3)):.1f} (med {st.median(pm(3)):.2f}) raw={collections.Counter(nz).most_common(4)}")
    else:
        print(f"{typ:14s} {lo:>2}-{hi:<2}k n={len(v):3d} all zero")

print("== yellow circular gauge timeline (first 25 + around fires):")
for t in timeline[:25]:
    print(f"  t={t[0]:6.2f} clk={t[1]} rg={t[2]} gauge={t[3]} fired={t[4]} wp={t[5]}")
for idx, t in enumerate(timeline):
    if t[4]:
        print("  -- fire window --")
        for u in timeline[max(0, idx - 2):idx + 12]:
            print(f"  t={u[0]:6.2f} clk={u[1]} rg={u[2]} gauge={u[3]} fired={u[4]} wp={u[5]}")
