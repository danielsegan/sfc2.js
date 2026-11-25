#!/usr/bin/env python3
"""Build the combined harness envelope used by tools/ship-audit.

Published-audit rules (do not delete source files):
- Exclude het_pad_deg=135 rows.
- Do not re-import extras that match a canonical hull-file skipped cell
  (for example "s31-port:damaged"), by spawnKey+speed+button or by the
  skipped token's core (s31-port) appearing in the run label.
- Add an extra only when (spawnKey, label) is not already present.
  Canonical rows may keep multiple samples per label.

Prints a counts-only preamble to stdout.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

CANON = re.compile(r"^\d+-[A-Za-z0-9+]+\.json$")


def empire_of(run: dict) -> str:
    sk = run.get("spawnKey") or ""
    return sk.split(":")[0] if ":" in sk else "?"


def is_het_pad(run: dict, pad: int) -> bool:
    if run.get("kind") != "het":
        return False
    try:
        return int(run.get("het_pad_deg")) == pad
    except (TypeError, ValueError):
        return False


def fingerprint(run: dict) -> tuple:
    return (
        run.get("spawnKey"),
        run.get("label"),
        run.get("kind"),
        run.get("target_speed"),
        run.get("het_pad_deg"),
        bool(run.get("suspect_rerun")),
        run.get("total_turn_deg"),
        run.get("order_delay_s"),
        run.get("mean_rate_deg_per_game_s_10_90"),
        run.get("mean_rate_deg_per_wall_s_10_90"),
    )


def same_speed(a, b) -> bool:
    if a is None or b is None:
        return False
    try:
        return abs(float(a) - float(b)) < 1e-9
    except (TypeError, ValueError):
        return False


def parse_skipped_token(token) -> dict:
    """Parse a hull-file skipped entry such as 's31-port:damaged'."""
    if isinstance(token, dict):
        token = token.get("reason") or token.get("cell") or token.get("label") or ""
    text = str(token or "")
    core = text.split(":", 1)[0]
    parts = core.split("-")
    speed = None
    button = None
    if len(parts) >= 2 and parts[0].startswith("s"):
        try:
            speed = float(parts[0][1:])
        except ValueError:
            speed = None
        button = "-".join(parts[1:]) or None
    return {"token": text, "core": core, "speed": speed, "button": button}


def index_skipped(canonical_docs: list[dict]) -> dict[str, list[dict]]:
    by_key: dict[str, list[dict]] = defaultdict(list)
    for doc in canonical_docs:
        sk = doc.get("spawnKey")
        if not sk:
            continue
        for raw in doc.get("skipped") or []:
            by_key[sk].append(parse_skipped_token(raw))
    return by_key


def is_canonical_skipped(run: dict, skipped_index: dict[str, list[dict]]) -> bool:
    items = skipped_index.get(run.get("spawnKey") or "") or []
    label = str(run.get("label") or "")
    speed = run.get("target_speed")
    button = run.get("button")
    for item in items:
        if (
            item["speed"] is not None
            and item["button"]
            and button
            and same_speed(speed, item["speed"])
            and button == item["button"]
        ):
            return True
        if item["core"] and item["core"] in label:
            return True
    return False


def load_runs_from_extra(path: Path) -> list:
    doc = json.loads(path.read_text())
    items = doc.get("runs") if isinstance(doc, dict) else doc
    return [r for r in items if isinstance(r, dict)] if isinstance(items, list) else []


def build_envelope(
    canonical_dir: Path,
    extra_paths: list[Path],
    exclude_pad: int = 135,
) -> tuple[list[dict], dict]:
    runs: list[dict] = []
    seen: set = set()
    excluded_pad = 0
    files = 0
    skipped_files: list[str] = []
    status_c: Counter = Counter()
    damaged: dict[str, Counter] = defaultdict(Counter)
    canonical_docs: list[dict] = []

    for path in sorted(canonical_dir.glob("*.json")):
        if not CANON.match(path.name):
            skipped_files.append(path.name)
            continue
        doc = json.loads(path.read_text())
        status_c[doc.get("status")] += 1
        files += 1
        canonical_docs.append(doc)
        emp = "?"
        if doc.get("spawnKey") and ":" in doc["spawnKey"]:
            emp = doc["spawnKey"].split(":", 1)[0]
        for raw in doc.get("skipped") or []:
            token = raw.get("reason") if isinstance(raw, dict) else str(raw)
            token = token or "skipped"
            if "damaged" in str(token):
                damaged[emp][str(token)] += 1
        if doc.get("status") != "ok":
            continue
        for run in doc.get("runs") or []:
            if is_het_pad(run, exclude_pad):
                excluded_pad += 1
                continue
            key = fingerprint(run)
            if key in seen:
                continue
            seen.add(key)
            runs.append(run)

    skipped_index = index_skipped(canonical_docs)
    labels_seen = {(r.get("spawnKey"), r.get("label")) for r in runs}
    extra_added = 0
    extra_excl_pad = 0
    extra_skipped_canonical = 0
    for path in extra_paths:
        if not path.exists():
            continue
        for run in load_runs_from_extra(path):
            if is_het_pad(run, exclude_pad):
                extra_excl_pad += 1
                continue
            if is_canonical_skipped(run, skipped_index):
                extra_skipped_canonical += 1
                continue
            label_key = (run.get("spawnKey"), run.get("label"))
            if label_key in labels_seen:
                continue
            key = fingerprint(run)
            if key in seen:
                continue
            seen.add(key)
            labels_seen.add(label_key)
            runs.append(run)
            extra_added += 1

    noop: dict[str, Counter] = defaultdict(Counter)
    kind_c: dict[str, Counter] = defaultdict(Counter)
    pad_c: Counter = Counter()
    for run in runs:
        emp = empire_of(run)
        kind_c[run.get("kind") or run.get("turn") or "?"][emp] += 1
        if run.get("kind") == "het":
            pad_c[run.get("het_pad_deg")] += 1
        if run.get("noop"):
            noop[run.get("noop_reason") or "noop"][emp] += 1

    preamble = {
        "runs": len(runs),
        "from_canonical_files": files,
        "status": dict(status_c),
        "skipped_noncanon": skipped_files,
        "excluded_het_pad_deg": {str(exclude_pad): excluded_pad},
        "extra_excluded_pad": extra_excl_pad,
        "extra_tagged_added": extra_added,
        "extra_skipped_canonical": extra_skipped_canonical,
        "kind_by_empire": {k: dict(v) for k, v in kind_c.items()},
        "noop_by_reason_empire": {k: dict(v) for k, v in noop.items()},
        "skip_damaged_by_empire_reason": {e: dict(c) for e, c in damaged.items()},
        "skip_damaged_total": sum(sum(c.values()) for c in damaged.values()),
        "het_pad_deg_counts": {str(k): v for k, v in pad_c.items()},
    }
    return runs, preamble


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canonical", type=Path, required=True, help="Directory of canonical hull result JSON files")
    parser.add_argument("--extra", type=Path, action="append", default=[], help="Extra tagged results JSON (repeatable)")
    parser.add_argument("--out", type=Path, required=True, help="Envelope JSON to write")
    parser.add_argument("--preamble", type=Path, help="Optional counts-only preamble JSON")
    parser.add_argument("--exclude-pad", type=int, default=135, help="HET pad degrees to exclude (default 135)")
    args = parser.parse_args(argv)

    if not args.canonical.is_dir():
        print(f"canonical directory not found: {args.canonical}", file=sys.stderr)
        return 2

    runs, preamble = build_envelope(args.canonical, args.extra, exclude_pad=args.exclude_pad)
    envelope = {
        "source": "CE 2.670 observed on screen under Wine",
        "method": (
            "heading2 rotation-registration; rows tagged kind=normal (mouse) or "
            f"kind=het (helm buttons); het_pad_deg={args.exclude_pad} rows excluded (not deleted); "
            "extras that match a canonical skipped cell are not re-imported"
        ),
        "heading_convention": "degrees, negative = port",
        "runs": runs,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(envelope, indent=1) + "\n")
    preamble["wrote"] = str(args.out)
    if args.preamble:
        args.preamble.parent.mkdir(parents=True, exist_ok=True)
        args.preamble.write_text(json.dumps(preamble, indent=2) + "\n")
    print(json.dumps(preamble, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
