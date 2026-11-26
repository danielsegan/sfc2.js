#!/usr/bin/env python3
"""Aggregate duel_weapons.py runs. Prints per weapon type x range band stats of the game's own volley
readout (NX Type min-max (paren)), and arming-bar timing. Aggregates only.
Usage: p2_wpn_agg.py <runs json> [...]"""
import json, re, statistics as st, sys, collections

BANDS = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 8), (8, 10), (10, 12), (12, 15), (15, 20), (20, 25), (25, 30), (30, 40), (40, 99)]
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

def prange(lines):
    for l in lines:
        m = re.search(r"Range:\s*([\d.,]+)", l)
        if m:
            v = m.group(1).rstrip(".,").replace(",", ".")
            if "." not in v and len(v) >= 2: v = v[:-1] + "." + v[-1]
            try:
                fv = float(v); return fv / 10 if fv > 99 else fv
            except ValueError: return None

def pweap(lines):
    out = []
    for l in lines:
        m = WEAPON_RE.search(l)
        if m:
            n, typ, a, b, p = int(m.group(1)), norm_weapon(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))
            if 0 < n <= 12 and a <= b and p <= b: out.append((n, typ, a, b, p))
    return out

FLAGS = [a for a in sys.argv[1:] if a.startswith("-")]
for path in [a for a in sys.argv[1:] if not a.startswith("-")]:
    R = json.load(open(path)); S = R["samples"]
    print("==", R["label"], "samples", len(S), "fires", [s["fired"] for s in S if s.get("fired")])
    g = collections.defaultdict(list)
    for s in S:
        rg = prange(s["lines"])
        if rg is None: continue
        for n, typ, a, b, p in pweap(s["lines"]):
            for lo, hi in BANDS:
                if lo <= rg < hi: g[(typ, lo, hi)].append((n, a, b, p, rg)); break
    for (typ, lo, hi) in sorted(g):
        v = g[(typ, lo, hi)]
        nz = [x for x in v if x[2] > 0]
        pm = lambda i: [x[i] / x[0] for x in nz]
        if nz:
            print(f"{typ:14s} {lo:>2}-{hi:<2}k n={len(v):3d} nonzero={len(nz):3d} mounts(median)={st.median([x[0] for x in nz])} "
                  f"per-mount min {min(pm(1)):.1f}..{max(pm(1)):.1f} max {min(pm(2)):.1f}..{max(pm(2)):.1f} (med {st.median(pm(2)):.1f}) "
                  f"paren {min(pm(3)):.1f}..{max(pm(3)):.1f} (med {st.median(pm(3)):.2f})")
        else:
            print(f"{typ:14s} {lo:>2}-{hi:<2}k n={len(v):3d} all zero")
        if "-v" in FLAGS: print("     raw", collections.Counter((x[0], x[1], x[2], x[3]) for x in v).most_common(8))
    arm = [(s["t"], s["arm"]) for s in S if s.get("arm") is not None]
    if arm:
        a0 = R.get("arm_t") or 0
        full = next((t for t, a in arm if a >= 0.97), None)
        print("arm bar: start", arm[0], "first full at t", full, "(arm clicks done at t", a0, ")")
        for s in S:
            if s.get("fired") and s.get("post"):
                tf = s["t"]; after = [(t, a) for t, a in arm if t > tf + 2]
                lo = s["post"].get("arm"); back = next((t for t, a in after if a >= 0.97), None)
                print(f"  fire at band {s['fired']} t={tf} arm post={lo} refull at t={back} (dt={None if back is None else round(back - tf, 1)})")
