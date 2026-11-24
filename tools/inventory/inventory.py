#!/usr/bin/env python3
"""CE 2.670 private-runner inventory and shiplist/ftrlist verification.

This tool is meant to run on the sfc2-ci runner, where it may read the
Community Edition 2.670 reference and extracted trees. It may also be
run against synthetic fixtures in ordinary CI.

Clean-room output rules (enforced here, not just by convention):

- Never print or write original game *data rows* or binary payloads.
- Logs and generated files may contain only metadata: paths, sizes,
  sha256, counts, header/column names, encoding, line endings,
  booleans, format vocabulary (weapon/arc codes, race/hull tokens,
  suffix patterns), diagnostic records, and aggregate numeric stats
  (at most two coordinate figures, each with a source path).
- Never write into the reference or extracted trees.

Diagnostic records use a flat camelCase ``code`` plus a separate
``source`` naming the format, e.g.::

    {"code": "duplicateClassKey", "source": "shiplist", "severity": "error",
     "details": {"race": "...", "className": "...", "rows": [10, 25]}}

``rows`` are 1-based source line numbers, matching the engine loader.
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Sequence

BUILD_LABEL = "CE 2.670"
OBSERVED_ON = "sfc2-ci"
DEFAULT_EXTRACTED = Path("/srv/sfc2/extracted/2.670")
DEFAULT_REFERENCE = Path("/srv/sfc2/reference/2.670")
DEFAULT_README = Path("/srv/sfc2/README.md")

# Empire tokens from docs/plan.md, used only to label folders by path.
PLAN_EMPIRE_TOKENS = (
    "Federation",
    "Klingon",
    "Romulan",
    "Lyran",
    "Hydran",
    "Gorn",
    "ISC",
    "Mirak",
    "Orion",
)

# Filename suffixes (before extension) that may mark self-illumination maps.
ILLUM_SUFFIX_RE = re.compile(
    r"(?:^|[_-])("
    r"i|illum|ilum|ill|illumination|selfillum|selfillumination|"
    r"glow|glowmap|light|lite|emissive|emis|em|si|in"
    r")$",
    re.IGNORECASE,
)

GUI_FOLDER_HINTS = (
    "sprites",
    "sprite",
    "gui",
    "ui",
    "interface",
    "menu",
    "menus",
    "hud",
    "graphics",
    "bitmaps",
    "2d",
    "art",
    "images",
    "portraits",
    "icons",
    "cursors",
)

INTERESTING_NAMES = {
    "shiplist.txt": "shiplist",
    "ftrlist.txt": "ftrlist",
    "sounds.txt": "sounds-index",
    "strings.txt": "string-table",
    "aastrings.txt": "string-table",
    "quicktips.txt": "string-table",
    "shipnames.txt": "string-table",
}

WEAPON_HEADER_RE = re.compile(
    r"(^((heavy|light)\s+)?(wpn|weapon|weap|special|hardpoint|hp)(\s*|#|_|-)?\d+$)|"
    r"((wpn|weapon|weap|special)\s*(code|type|name)?(\s*|#|_|-)?\d+$)|"
    r"(^(wpn|weapon|weap)$)",
    re.IGNORECASE,
)
# Digit-only arc cell values that may be either a mis-paired Num column
# or a legitimate reload count written in an Arc cell (drone racks).
NUMERIC_ARC_CODES = ("1", "2", "3")
INTEGER_ARC_RE = re.compile(r"^[+-]?\d+$")
DRONE_OR_ADD_WEAPON_RE = re.compile(r"^(dro.*|add[_-]?6|add[_-]?12)$", re.IGNORECASE)


def _is_integer_arc(value: str) -> bool:
    """True when an Arc cell is a base-10 integer (1, 2, 3 or any other)."""
    return bool(value) and bool(INTEGER_ARC_RE.fullmatch(value.strip()))


def _is_drone_or_add_weapon(code: str) -> bool:
    """Dro* / ADD6 / ADD12 weapon codes (optional underscore or hyphen in ADD)."""
    return bool(code) and bool(DRONE_OR_ADD_WEAPON_RE.fullmatch(code.strip()))
ARC_HEADER_RE = re.compile(
    r"(^(arc|firearc|fire_arc|fa)(\s*|#|_|-)?\d*$)|"
    r"((arc|firearc)\s*(code)?(\s*|#|_|-)?\d+$)",
    re.IGNORECASE,
)
COUNT_HEADER_RE = re.compile(
    r"(^(count|num|number|qty|shots?|mounts?)(\s*|#|_|-)?\d*$)",
    re.IGNORECASE,
)
RACE_HEADER_RE = re.compile(r"^race$", re.IGNORECASE)

FIGHTER_HULL_TOKENS = {"ftr", "fighter", "fighters"}
PF_HULL_TOKENS = {"pf", "pfs", "fast patrol", "fastpatrol"}

COORD_HEADER_RE = re.compile(
    r"^(x|y|z|wx|wy|wz|lon|lat|xpos|ypos|zpos|coordx|coordy|coordz|coord)$",
    re.IGNORECASE,
)

MAX_PROBE_BYTES = 1_048_576  # 1 MiB cap when sniffing a file's structure
TEXT_PRINTABLE = set(range(32, 127)) | {9, 10, 13}

class MetadataLog:
    """Stdout logger that refuses to echo tab/comma data rows."""

    _ROW_LIKE = re.compile(r".*\t.*\t.*")

    def __init__(self, stream=None) -> None:
        self.stream = stream or sys.stdout
        self.lines: list[str] = []

    def info(self, message: str) -> None:
        if self._looks_like_data_row(message):
            message = "[redacted: refused to log a line that looks like a data row]"
        self.lines.append(message)
        print(message, file=self.stream, flush=True)

    @classmethod
    def _looks_like_data_row(cls, message: str) -> bool:
        if "\t" not in message:
            return False
        # Header names are allowed only when the line is explicitly labelled.
        # A bare tab-separated line with three or more fields is treated as a
        # data row, even if its cells are non-numeric (ship rows often are).
        stripped = message.strip()
        low = stripped.lower()
        if low.startswith("headers:") or "header names:" in low:
            return False
        return bool(cls._ROW_LIKE.match(stripped))


def _looks_like_header_line(line: str) -> bool:
    cells = [c.strip() for c in re.split(r"[\t,;]", line)]
    if len(cells) < 2:
        return False
    numeric = 0
    for cell in cells:
        if not cell:
            continue
        try:
            float(cell)
            numeric += 1
        except ValueError:
            pass
    non_empty = sum(1 for c in cells if c)
    return non_empty > 0 and numeric * 2 < non_empty


def _is_repeat_header(line: str, delimiter: str, header_names: list[str]) -> bool:
    cells = [c.strip() for c in split_line(line, delimiter)]
    if not cells or not header_names:
        return False
    folded = [c.casefold() for c in cells[: len(header_names)]]
    headers = [h.casefold() for h in header_names]
    if folded == headers:
        return True
    # A second header row that starts with the same first label (typically Race).
    return bool(folded[0]) and folded[0] == headers[0] and folded[0] == "race" and _looks_like_header_line(line)


_INSTRUCTION_RE = re.compile(
    r"(do not edit|back-?up|this file contains|keep the first column blank|"
    r"write a comment|instruction|synthetic fixture)",
    re.IGNORECASE,
)
_PREAMBLE_MARKER_RE = re.compile(r"^<[^>\s]*>?$")
_SINGLE_HEADER_VOCAB_RE = re.compile(
    r"^(code|name|id|index|count|type|class|race|weapon|arc|damage|range|value)$",
    re.IGNORECASE,
)


def _is_numeric_token(text: str) -> bool:
    try:
        float(text.strip())
        return True
    except ValueError:
        return False


def _is_comment_or_instruction_line(line: str, delimiter: str) -> bool:
    """True for leading instruction rows, not for column-header or data rows.

    The CE 2.670 shiplist/ftrlist comment form is: first column blank, a
    sentence in column 2, and trailing empty fields.
    """
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.startswith(";") or stripped.startswith("#") or stripped.startswith("//"):
        return True
    cells = [c.strip() for c in split_line(line, delimiter)]
    if len(cells) >= 2 and cells[0] == "" and cells[1]:
        if all(not c for c in cells[2:]):
            text = cells[1]
            if " " in text or len(text) > 24 or _INSTRUCTION_RE.search(text):
                return True
    return False


def _is_preamble_marker_line(line: str) -> bool:
    """A lone marker such as ``<0``, not a column-header row."""
    stripped = line.strip()
    if not stripped:
        return False
    if "\t" in line:
        return False
    return bool(_PREAMBLE_MARKER_RE.match(stripped))


def _looks_like_column_header_line(line: str, delimiter: str) -> bool:
    return bool(_header_line_verdict(line, delimiter)["accepted"])


def _line_cell_stats(line: str, delimiter: str) -> tuple[list[str], list[str], int]:
    cells = [c.strip() for c in split_line(line, delimiter)]
    nonempty = [c for c in cells if c]
    max_len = max((len(c) for c in nonempty), default=0)
    return cells, nonempty, max_len


def _header_line_verdict(line: str, delimiter: str) -> dict[str, Any]:
    """Decide whether a line is a column-header row.

    The returned dict is metadata only: accepted, reason, nonemptyCount,
    maxCellLength. It never includes cell text.
    """
    if _is_comment_or_instruction_line(line, delimiter):
        return {
            "accepted": False,
            "reason": "comment-or-instruction",
            "nonemptyCount": None,
            "maxCellLength": None,
        }
    if _is_preamble_marker_line(line):
        return {
            "accepted": False,
            "reason": "preamble-marker",
            "nonemptyCount": None,
            "maxCellLength": None,
        }
    _cells, nonempty, max_len = _line_cell_stats(line, delimiter)
    base: dict[str, Any] = {"nonemptyCount": len(nonempty), "maxCellLength": max_len}
    if not nonempty:
        return {**base, "accepted": False, "reason": "empty"}
    first = nonempty[0]
    # A Race header is accepted even when some labels are long.
    if first.casefold() == "race":
        return {**base, "accepted": True, "reason": "first-cell-race"}
    if len(nonempty) == 1:
        ok = bool(_SINGLE_HEADER_VOCAB_RE.match(first))
        return {**base, "accepted": ok, "reason": "single-vocab" if ok else "single-non-vocab"}
    numeric = sum(1 for c in nonempty if _is_numeric_token(c))
    if numeric * 2 >= len(nonempty):
        return {**base, "accepted": False, "reason": "mostly-numeric"}
    # Relaxed long-label rule: reject only when most nonempty cells look like
    # sentences, not when a single header label is long.
    sentence_like = sum(1 for c in nonempty if len(c) > 64 or c.count(" ") >= 6)
    if sentence_like * 2 >= len(nonempty):
        return {**base, "accepted": False, "reason": "mostly-sentence-like"}
    return {**base, "accepted": True, "reason": "column-labels"}



def _slot_number_from_header(name: str) -> int | None:
    m = re.search(r"(\d+)\s*$", name.strip())
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _slot_band(slot: int | None) -> str:
    if slot is None:
        return "other"
    if 1 <= slot <= 10:
        return "1-10"
    if 11 <= slot <= 25:
        return "11-25"
    return "other"


def _column_slot_number(column_index: int, headers: Sequence[str], assigned: dict[int, int | None]) -> int | None:
    """Prefer a paired slot number; fall back to a numeric suffix on the header itself."""
    if column_index in assigned and assigned[column_index] is not None:
        return assigned[column_index]
    if 0 <= column_index < len(headers):
        return _slot_number_from_header(headers[column_index])
    return None


def pair_weapon_arc_count_slots(
    headers: Sequence[str],
    weapon_cols: Sequence[int],
    arc_cols: Sequence[int],
    count_cols: Sequence[int],
) -> dict[str, Any]:
    """Give unlabeled Arc/Num columns the slot number of the adjacent weapon header.

    CE 2.670 groups are `Num`, `Heavy Weapon N` / `Weapon N`, `Arc`. ftrlist
    groups are `Num`, `WeaponN`, `Arc`, `Shots`. Existing fixtures that number
    the Arc header itself (`Arc 1`) still resolve via the suffix fallback.
    """
    arc_set = set(arc_cols)
    count_set = set(count_cols)
    weapon_slot: dict[int, int | None] = {}
    arc_slot: dict[int, int | None] = {}
    count_slot: dict[int, int | None] = {}
    pairs: list[dict[str, Any]] = []

    def _name(idx: int | None) -> str | None:
        if idx is None or idx < 0 or idx >= len(headers):
            return None
        return headers[idx]

    for i in weapon_cols:
        slot = _slot_number_from_header(headers[i]) if i < len(headers) else None
        weapon_slot[i] = slot
        if slot is None:
            pairs.append(
                {
                    "slot": None,
                    "weaponColumnIndex": i,
                    "weaponColumnName": _name(i),
                    "arcColumnIndex": None,
                    "arcColumnName": None,
                    "countColumnIndex": None,
                    "countColumnName": None,
                }
            )
            continue
        arc_i = None
        for j in (i + 1, i + 2):
            if j in arc_set and j not in arc_slot:
                arc_i = j
                break
        count_i = None
        for j in (i - 1, i + 1, i - 2):
            if j in count_set and j not in count_slot and j != arc_i:
                count_i = j
                break
        if arc_i is not None:
            arc_slot[arc_i] = slot
        if count_i is not None:
            count_slot[count_i] = slot
        pairs.append(
            {
                "slot": slot,
                "weaponColumnIndex": i,
                "weaponColumnName": _name(i),
                "arcColumnIndex": arc_i,
                "arcColumnName": _name(arc_i),
                "countColumnIndex": count_i,
                "countColumnName": _name(count_i),
            }
        )

    for i in arc_cols:
        if i in arc_slot:
            continue
        for j in range(i - 1, max(-1, i - 4), -1):
            if j in weapon_slot and weapon_slot[j] is not None:
                arc_slot[i] = weapon_slot[j]
                for pair in pairs:
                    if pair["weaponColumnIndex"] == j and pair["arcColumnIndex"] is None:
                        pair["arcColumnIndex"] = i
                        pair["arcColumnName"] = _name(i)
                        break
                break

    pairs.sort(key=lambda p: ((p["slot"] is None), p["slot"] if p["slot"] is not None else 0, p["weaponColumnIndex"]))
    return {
        "weaponSlotOf": weapon_slot,
        "arcSlotOf": arc_slot,
        "countSlotOf": count_slot,
        "slotPairs": pairs,
    }


def _is_assets_specs_path(path: str) -> bool:
    parts = Path(str(path).replace("\\", "/")).parts
    lower = [p.lower() for p in parts]
    for i, part in enumerate(lower):
        if part == "assets" and i + 1 < len(lower) and lower[i + 1] == "specs":
            return True
    return False


def _is_metaassets_path(path: str) -> bool:
    return "metaassets" in [p.lower() for p in Path(str(path).replace("\\", "/")).parts]


def preferred_spec_index(copies: Sequence[tuple[Path, Any]], root: Path) -> int:
    """Prefer Assets/Specs (any case) over MetaAssets."""
    best = 0
    best_rank = (2, 1, "")
    for i, (path, _meta) in enumerate(copies):
        rel = relpath(path, root)
        rank = (
            0 if _is_assets_specs_path(rel) else 1,
            1 if _is_metaassets_path(rel) else 0,
            rel.lower(),
        )
        if rank < best_rank:
            best_rank = rank
            best = i
    return best

def relpath(path: Path, root: Path | None) -> str:
    try:
        if root is not None:
            return path.resolve().relative_to(root.resolve()).as_posix()
    except (ValueError, OSError):
        pass
    return path.as_posix()


def file_sha256(path: Path, bufsize: int = 1024 * 1024) -> str:
    import hashlib

    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(bufsize)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _sha256_bytes(data: bytes) -> str:
    import hashlib

    return hashlib.sha256(data).hexdigest()


def normalize_hash(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text.startswith("sha256:"):
        text = text[7:]
    if re.fullmatch(r"[0-9a-f]{64}", text):
        return text
    return text or None


def ext_of(path_str: str) -> str:
    name = Path(path_str).name
    if name.startswith(".") and name.count(".") == 1:
        return ""
    suffix = Path(name).suffix
    return suffix.lower() if suffix else ""


def top_folder(rel: str) -> str:
    parts = Path(rel).parts
    return parts[0] if parts else "."


@dataclass
class FileMeta:
    path: str  # relative posix path from extracted root when possible
    size: int
    sha256: str | None
    absolute: str | None = None


def load_manifest(path: Path, extracted_root: Path | None, log: MetadataLog) -> list[FileMeta]:
    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        entries: list[Any] = []
        for line in raw.splitlines():
            line = line.strip()
            if line:
                entries.append(json.loads(line))
        data = entries
    files = _coerce_manifest_entries(data, extracted_root)
    log.info(f"manifest: {path.as_posix()} ({len(files)} entries)")
    return files


def _coerce_manifest_entries(data: Any, extracted_root: Path | None) -> list[FileMeta]:
    rows: Any
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict):
        if "files" in data:
            files = data["files"]
            if isinstance(files, dict):
                rows = [
                    {"path": k, **(v if isinstance(v, dict) else {"sha256": v})}
                    for k, v in files.items()
                ]
            else:
                rows = files
        elif "entries" in data:
            rows = data["entries"]
        else:
            rows = [{"path": k, **(v if isinstance(v, dict) else {"sha256": v})} for k, v in data.items()]
    else:
        raise ValueError("unrecognised manifest.json shape")

    out: list[FileMeta] = []
    for item in rows:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            p, size = item[0], int(item[1])
            digest = normalize_hash(item[2]) if len(item) > 2 else None
            out.append(FileMeta(path=_normalize_rel(str(p), extracted_root), size=size, sha256=digest))
            continue
        if not isinstance(item, dict):
            continue
        p = item.get("path") or item.get("file") or item.get("name") or item.get("relpath")
        if not p:
            continue
        size = item.get("size") or item.get("bytes") or item.get("length") or 0
        digest = normalize_hash(item.get("sha256") or item.get("hash") or item.get("digest"))
        out.append(
            FileMeta(
                path=_normalize_rel(str(p), extracted_root),
                size=int(size),
                sha256=digest,
                absolute=item.get("absolute") or item.get("abspath"),
            )
        )
    return out


def _normalize_rel(path_str: str, extracted_root: Path | None) -> str:
    path_str = path_str.replace("\\", "/")
    if extracted_root is not None:
        try:
            p = Path(path_str)
            if p.is_absolute():
                return p.resolve().relative_to(extracted_root.resolve()).as_posix()
            root_s = extracted_root.resolve().as_posix().rstrip("/") + "/"
            if path_str.startswith(root_s):
                return path_str[len(root_s) :]
        except (ValueError, OSError):
            pass
    return path_str.lstrip("/")


def cross_check_manifest(
    files: Sequence[FileMeta],
    extracted_root: Path,
    log: MetadataLog,
) -> dict[str, Any]:
    """Compare manifest entries to the tree (existence and size only)."""
    missing = 0
    size_mismatch = 0
    missing_paths: list[str] = []
    mismatch_paths: list[str] = []
    manifest_paths = set()
    for f in files:
        manifest_paths.add(f.path.lower())
        abs_path = extracted_root / f.path
        if not abs_path.is_file():
            missing += 1
            if len(missing_paths) < 20:
                missing_paths.append(f.path)
            continue
        disk_size = abs_path.stat().st_size
        if f.size and disk_size != f.size:
            size_mismatch += 1
            if len(mismatch_paths) < 20:
                mismatch_paths.append(f.path)

    extras = 0
    extra_paths: list[str] = []
    for p in _walk_files(extracted_root):
        rel = relpath(p, extracted_root)
        if rel.lower() not in manifest_paths and rel.lower() != "manifest.json":
            extras += 1
            if len(extra_paths) < 20:
                extra_paths.append(rel)

    result = {
        "manifestEntries": len(files),
        "missingOnDisk": missing,
        "sizeMismatches": size_mismatch,
        "extraOnDisk": extras,
        "missingPathExamples": missing_paths,
        "sizeMismatchPathExamples": mismatch_paths,
        "extraPathExamples": extra_paths,
    }
    log.info(
        "manifest cross-check: "
        f"entries={len(files)} missing={missing} sizeMismatches={size_mismatch} extraOnDisk={extras}"
    )
    return result


def _walk_files(root: Path) -> Iterator[Path]:
    if not root.exists():
        return
    import os

    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [d for d in dirnames if d not in {".git", ".cache"}]
        base = Path(dirpath)
        for name in filenames:
            yield base / name

def summarize_files(files: Sequence[FileMeta]) -> dict[str, Any]:
    by_ext: dict[str, dict[str, int]] = {}
    by_folder: dict[str, dict[str, int]] = {}
    total_bytes = 0
    for f in files:
        total_bytes += f.size or 0
        ext = ext_of(f.path) or "(none)"
        bucket = by_ext.setdefault(ext, {"count": 0, "bytes": 0})
        bucket["count"] += 1
        bucket["bytes"] += f.size or 0
        folder = top_folder(f.path)
        fb = by_folder.setdefault(folder, {"count": 0, "bytes": 0})
        fb["count"] += 1
        fb["bytes"] += f.size or 0
    return {
        "fileCount": len(files),
        "totalBytes": total_bytes,
        "byExtension": dict(sorted(by_ext.items(), key=lambda kv: (-kv[1]["count"], kv[0]))),
        "byTopLevelFolder": dict(sorted(by_folder.items(), key=lambda kv: (-kv[1]["count"], kv[0]))),
    }


def locate_interesting(files: Sequence[FileMeta]) -> dict[str, Any]:
    """Group notable paths by role. Paths/sizes/hashes only."""
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)

    def add(group: str, f: FileMeta) -> None:
        groups[group].append({"path": f.path, "size": f.size, "sha256": f.sha256})

    for f in files:
        name = Path(f.path).name
        lower = name.lower()
        parent_parts = [p.lower() for p in Path(f.path).parts[:-1]]
        ext = ext_of(f.path)

        if lower in INTERESTING_NAMES:
            add(INTERESTING_NAMES[lower], f)
        if lower == "sprites.q3" or ext == ".q3":
            add("q3-archives", f)
        if ext == ".mod":
            add("models", f)
        if ext in {".bmp", ".tga", ".png", ".jpg", ".jpeg"}:
            add("textures", f)
        if ext in {".wav", ".mp3", ".ogg"}:
            add("audio", f)
        if ext == ".scr":
            add("mission-modules", f)
        if ext == ".mct":
            add("mct", f)
        if ext == ".gf":
            add("gf", f)
        if ext == ".bft":
            add("bft", f)
        if ext == ".fms" or "fmse" in parent_parts or "scenario" in parent_parts:
            add("fmse-or-scenario", f)
        if ext in {".ttf", ".otf", ".fnt", ".fon"}:
            add("fonts", f)
        if any(tok in parent_parts for tok in ("campaign", "campaigns", "conquest", "dynaverse", "galactic")):
            add("campaign-or-conquest", f)
        if ext == "" and lower not in {"manifest", "readme", "license", "makefile"}:
            add("extensionless", f)

    return {k: sorted(v, key=lambda e: e["path"].lower()) for k, v in sorted(groups.items())}


def parse_readme_structure(path: Path, log: MetadataLog) -> dict[str, Any]:
    """Extract headings and mentioned paths from the runner README. No large quotes."""
    if not path.is_file():
        log.info(f"readme: missing {path.as_posix()}")
        return {"path": path.as_posix(), "present": False}
    text = path.read_text(encoding="utf-8", errors="replace")
    headings = []
    for line in text.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            headings.append({"level": len(m.group(1)), "title": m.group(2).strip()})
    paths = sorted(set(re.findall(r"(/srv/sfc2/[A-Za-z0-9._/\-]+)", text)))
    log.info(f"readme: {path.as_posix()} headings={len(headings)} mentionedPaths={len(paths)}")
    return {
        "path": path.as_posix(),
        "present": True,
        "size": path.stat().st_size,
        "headings": headings,
        "mentionedPaths": paths,
    }


@dataclass
class TableMeta:
    path: str
    size: int
    sha256: str | None
    encoding: str
    lineEndings: str
    delimiter: str
    headerNames: list[str]
    columnCount: int
    rowCount: int
    headerLine: int
    headerRowCount: int
    hasBom: bool
    dataColumnCountMin: int | None = None
    dataColumnCountMax: int | None = None
    headerRejection: dict[str, Any] | None = None


def sniff_text_prefix(data: bytes) -> tuple[str, bool, str]:
    """Return (encoding_label, has_bom, decoded text)."""
    if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
        enc = "utf-16-le" if data.startswith(b"\xff\xfe") else "utf-16-be"
        return enc, True, data.decode(enc, errors="replace")
    if data.startswith(b"\xef\xbb\xbf"):
        body = data[3:]
        try:
            return "utf-8-sig", True, body.decode("utf-8")
        except UnicodeDecodeError:
            return "windows-1252-with-utf8-bom", True, body.decode("cp1252", errors="replace")
    ascii_only = all(b < 128 for b in data)
    if ascii_only:
        return "ascii", False, data.decode("ascii")
    try:
        data.decode("utf-8")
        return "utf-8", False, data.decode("utf-8")
    except UnicodeDecodeError:
        return "windows-1252", False, data.decode("cp1252", errors="replace")


def detect_line_endings(text: str) -> str:
    crlf = text.count("\r\n")
    stripped = text.replace("\r\n", "")
    cr = stripped.count("\r")
    lf = stripped.count("\n")
    kinds = []
    if crlf:
        kinds.append(f"{crlf} CRLF")
    if lf:
        kinds.append(f"{lf} LF")
    if cr:
        kinds.append(f"{cr} CR")
    if not kinds:
        return "none"
    if crlf and not lf and not cr:
        return "CRLF"
    if lf and not crlf and not cr:
        return "LF"
    if cr and not crlf and not lf:
        return "CR"
    return "mixed (" + ", ".join(kinds) + ")"


def detect_delimiter(header_line: str) -> str:
    tab = header_line.count("\t")
    comma = header_line.count(",")
    semi = header_line.count(";")
    if tab >= comma and tab >= semi and tab > 0:
        return "TAB"
    if comma > semi and comma > 0:
        return "comma"
    if semi > 0:
        return "semicolon"
    return "unknown"


def split_line(line: str, delimiter: str) -> list[str]:
    if delimiter == "TAB":
        return line.split("\t")
    if delimiter == "comma":
        return line.split(",")
    if delimiter == "semicolon":
        return line.split(";")
    if "\t" in line:
        return line.split("\t")
    return [line]


def inspect_table_file(
    path: Path,
    root: Path | None,
    digest: str | None = None,
    log: MetadataLog | None = None,
) -> TableMeta:
    data = path.read_bytes()
    encoding, has_bom, text = sniff_text_prefix(data)
    if text.endswith("\r\n"):
        body = text[:-2]
    elif text.endswith("\n") or text.endswith("\r"):
        body = text[:-1]
    else:
        body = text
    raw_lines = re.split(r"\r\n|\n|\r", body)
    line_endings = detect_line_endings(text)
    rel = relpath(path, root)

    def _data_widths(start: int, delimiter: str) -> tuple[int | None, int | None, str]:
        widths: list[int] = []
        used = delimiter
        for line in raw_lines[start:]:
            if not line.strip():
                continue
            if _is_preamble_marker_line(line) or _is_comment_or_instruction_line(line, detect_delimiter(line)):
                continue
            delim = detect_delimiter(line)
            if used == "unknown" and delim != "unknown":
                used = delim
            widths.append(len(split_line(line, used if used != "unknown" else delim)))
        if not widths:
            return None, None, used
        return min(widths), max(widths), used

    def _empty_meta(
        delimiter: str = "unknown",
        header_names: list[str] | None = None,
        header_line: int = 0,
        header_row_count: int = 0,
        row_count: int = 0,
        width_min: int | None = None,
        width_max: int | None = None,
        rejection: dict[str, Any] | None = None,
    ) -> TableMeta:
        names = header_names or []
        return TableMeta(
            path=rel,
            size=len(data),
            sha256=digest or _sha256_bytes(data),
            encoding=encoding,
            lineEndings=line_endings,
            delimiter=delimiter,
            headerNames=names,
            columnCount=len(names) if names else (width_max or 0),
            rowCount=row_count,
            headerLine=header_line,
            headerRowCount=header_row_count,
            hasBom=has_bom,
            dataColumnCountMin=width_min,
            dataColumnCountMax=width_max,
            headerRejection=rejection,
        )

    header_idx = None
    delimiter = "unknown"
    rejection: dict[str, Any] | None = None
    for i, line in enumerate(raw_lines):
        if not line.strip():
            continue
        delim = detect_delimiter(line)
        if _is_preamble_marker_line(line) or _is_comment_or_instruction_line(line, delim):
            continue
        verdict = _header_line_verdict(line, delim)
        if verdict["accepted"]:
            header_idx = i
            delimiter = delim
            break
        rejection = {
            "line": i + 1,
            "nonemptyCount": verdict["nonemptyCount"],
            "maxCellLength": verdict["maxCellLength"],
            "reason": verdict["reason"],
        }
        if log is not None:
            log.info(
                f"header candidate rejected: path={rel} line={rejection['line']} "
                f"nonemptyCells={rejection['nonemptyCount']} "
                f"maxCellLength={rejection['maxCellLength']} reason={rejection['reason']}"
            )
        # A non-comment, non-header line means data has started; do not invent a header.
        break
    if header_idx is None:
        row_count = sum(
            1
            for line in raw_lines
            if line.strip()
            and not _is_preamble_marker_line(line)
            and not _is_comment_or_instruction_line(line, detect_delimiter(line))
        )
        width_min, width_max, used = _data_widths(0, "unknown")
        return _empty_meta(
            delimiter=used,
            row_count=row_count,
            width_min=width_min,
            width_max=width_max,
            rejection=rejection,
        )

    header_line = raw_lines[header_idx]
    if delimiter == "unknown":
        delimiter = detect_delimiter(header_line)
    header_names = [c.strip() for c in split_line(header_line, delimiter)]
    header_row_count = 1
    first_data = header_idx + 1
    # Extra header rows are counted only when they repeat the header labels
    # (for example a second "Race" header). Ordinary data rows are often
    # mostly non-numeric, so a loose "looks like a header" test is not safe.
    while first_data < len(raw_lines) and raw_lines[first_data].strip() and _is_repeat_header(
        raw_lines[first_data], delimiter, header_names
    ):
        header_row_count += 1
        first_data += 1
    row_count = sum(1 for line in raw_lines[first_data:] if line.strip())
    width_min, width_max, _used = _data_widths(first_data, delimiter)
    return TableMeta(
        path=rel,
        size=len(data),
        sha256=digest or _sha256_bytes(data),
        encoding=encoding,
        lineEndings=line_endings,
        delimiter=delimiter,
        headerNames=header_names,
        columnCount=len(header_names),
        rowCount=row_count,
        headerLine=header_idx + 1,
        headerRowCount=header_row_count,
        hasBom=has_bom,
        dataColumnCountMin=width_min,
        dataColumnCountMax=width_max,
        headerRejection=None,
    )



def table_meta_dict(meta: TableMeta) -> dict[str, Any]:
    return {
        "path": meta.path,
        "size": meta.size,
        "sha256": meta.sha256,
        "encoding": meta.encoding,
        "lineEndings": meta.lineEndings,
        "delimiter": meta.delimiter,
        "headerNames": meta.headerNames,
        "columnCount": meta.columnCount,
        "rowCount": meta.rowCount,
        "headerLine": meta.headerLine,
        "headerRowCount": meta.headerRowCount,
        "hasBom": meta.hasBom,
        "dataColumnCountMin": meta.dataColumnCountMin,
        "dataColumnCountMax": meta.dataColumnCountMax,
        "headerRejection": meta.headerRejection,
    }

def find_columns(headers: Sequence[str], pattern: re.Pattern[str]) -> list[int]:
    return [i for i, name in enumerate(headers) if pattern.match(name.strip())]


def pick_class_column(headers: Sequence[str]) -> int | None:
    """Prefer a short class / class name column over a generic Type column."""
    preferred = []
    fallback = []
    for i, name in enumerate(headers):
        n = name.strip()
        if re.match(r"^(class|ship\s*class|classname|class\s*name|short\s*class)$", n, re.IGNORECASE):
            preferred.append(i)
        elif re.match(r"^(type|typename|type\s*name)$", n, re.IGNORECASE):
            fallback.append(i)
    if preferred:
        return preferred[0]
    if fallback:
        return fallback[0]
    return None


def pick_hull_column(headers: Sequence[str], class_index: int | None) -> int | None:
    for i, name in enumerate(headers):
        if re.match(r"^hull(\s*type)?$", name.strip(), re.IGNORECASE):
            return i
    for i, name in enumerate(headers):
        if re.match(r"^type$", name.strip(), re.IGNORECASE) and i != class_index:
            return i
    return None


def identify_weapon_arc_columns(headers: Sequence[str]) -> dict[str, Any]:
    """Locate weapon and arc columns from header names, without inventing codes."""
    weapon_cols = [i for i, h in enumerate(headers) if WEAPON_HEADER_RE.match(h.strip())]
    arc_cols = [i for i, h in enumerate(headers) if ARC_HEADER_RE.match(h.strip())]
    count_cols = [i for i, h in enumerate(headers) if COUNT_HEADER_RE.match(h.strip())]
    method = "header-name-patterns"
    if not weapon_cols and not arc_cols:
        groups = _repeating_numeric_groups(headers)
        if groups:
            method = "repeating-numeric-suffix-groups"
            for cols in groups:
                names = [(i, headers[i]) for i in cols]
                used: set[int] = set()
                for i, n in names:
                    if ARC_HEADER_RE.search(n.strip()) or re.search(r"arc", n, re.IGNORECASE):
                        arc_cols.append(i)
                        used.add(i)
                for i, n in names:
                    if i not in used and (
                        WEAPON_HEADER_RE.search(n.strip())
                        or re.search(r"wpn|weapon|special|type", n, re.IGNORECASE)
                    ):
                        weapon_cols.append(i)
                        used.add(i)
                remaining = [i for i, _ in names if i not in used]
                if remaining and not any(i in weapon_cols for i, _ in names):
                    weapon_cols.append(remaining[0])
                if len(remaining) > 1 and not any(i in arc_cols for i, _ in names):
                    arc_cols.append(remaining[-1])
    paired = pair_weapon_arc_count_slots(headers, weapon_cols, arc_cols, count_cols)
    return {
        "method": method,
        "weaponColumns": weapon_cols,
        "arcColumns": arc_cols,
        "countColumns": count_cols,
        "weaponColumnNames": [headers[i] for i in weapon_cols],
        "arcColumnNames": [headers[i] for i in arc_cols],
        "countColumnNames": [headers[i] for i in count_cols],
        "slotPairs": paired["slotPairs"],
        "weaponSlotOf": {str(i): paired["weaponSlotOf"][i] for i in paired["weaponSlotOf"]},
        "arcSlotOf": {str(i): paired["arcSlotOf"][i] for i in paired["arcSlotOf"]},
        "countSlotOf": {str(i): paired["countSlotOf"][i] for i in paired["countSlotOf"]},
    }


def _repeating_numeric_groups(headers: Sequence[str]) -> list[list[int]]:
    buckets: dict[str, list[int]] = defaultdict(list)
    for i, name in enumerate(headers):
        m = re.search(r"(\d+)\s*$", name.strip())
        if m:
            buckets[m.group(1)].append(i)
    if len(buckets) < 8:
        return []
    widths = Counter(len(v) for v in buckets.values())
    width, n = widths.most_common(1)[0]
    if n < 8 or width < 2:
        return []
    return [buckets[k] for k in sorted(buckets, key=lambda s: int(s)) if len(buckets[k]) == width]


@dataclass
class SpecVerification:
    copies: list[dict[str, Any]]
    table: dict[str, Any] | None
    diagnostics: list[dict[str, Any]]
    uniqueness: dict[str, Any]
    fightersAndPfs: dict[str, Any]
    weaponCodes: list[dict[str, Any]]
    arcCodes: list[dict[str, Any]]
    raceTokens: list[str]
    hullTokens: list[str]
    columnSelection: dict[str, Any]
    sourcePath: str | None
    raceRowCounts: list[dict[str, Any]]
    numericColumnStats: list[dict[str, Any]]
    numericArcCodeSources: list[dict[str, Any]]
    heavyWeaponSlotArcs: list[dict[str, Any]]
    numericArcWeaponPairings: dict[str, Any]



def _decimal_places_of(token: str) -> int | None:
    """Return decimal-place count if token is a base-10 number, else None."""
    t = token.strip()
    if not t:
        return None
    if re.fullmatch(r"[+-]?\d+", t):
        return 0
    m = re.fullmatch(r"[+-]?\d+\.(\d+)", t)
    if m:
        return len(m.group(1))
    m = re.fullmatch(r"[+-]?\.(\d+)", t)
    if m:
        return len(m.group(1))
    return None


def _numeric_column_stats(
    headers: Sequence[str],
    column_values: dict[int, list[str]],
    data_row_total: int,
) -> list[dict[str, Any]]:
    """Min, max and max decimal places for columns whose nonempty cells are all numeric.

    Aggregates only; individual cell values are not logged or returned except as min/max.
    """
    width = max([len(headers), *column_values.keys(), -1]) + (1 if column_values or headers else 0)
    # width: if headers has 36 and values only use 0..35, max(key)+1 is enough
    if headers:
        width = max(width, len(headers))
    if column_values:
        width = max(width, max(column_values) + 1)
    stats: list[dict[str, Any]] = []
    for ci in range(width):
        values = column_values.get(ci) or []
        if not values:
            continue
        places = [_decimal_places_of(v) for v in values]
        if any(p is None for p in places):
            continue
        numbers = []
        for v in values:
            try:
                numbers.append(Decimal(v))
            except InvalidOperation:
                numbers = []
                break
        if not numbers:
            continue
        lo, hi = min(numbers), max(numbers)
        max_places = max(places)
        def _emit(n: Decimal):
            if max_places == 0:
                return int(n)
            return float(n)
        name = headers[ci] if ci < len(headers) and str(headers[ci]).strip() else f"col{ci}"
        stats.append(
            {
                "column": name,
                "columnIndex": ci,
                "min": _emit(lo),
                "max": _emit(hi),
                "maxDecimalPlaces": max_places,
                "numericRowCount": len(values),
                "emptyRowCount": max(0, data_row_total - len(values)),
            }
        )
    return stats


def verify_spec_tables(
    label: str,
    copies: Sequence[tuple[Path, FileMeta | None]],
    root: Path,
    log: MetadataLog,
) -> SpecVerification:
    """Inspect every copy of shiplist.txt or ftrlist.txt. No data rows in output."""
    copy_infos: list[dict[str, Any]] = []
    tables: list[TableMeta] = []
    texts: list[tuple[TableMeta, list[str], str]] = []

    for path, manifest_entry in copies:
        digest = manifest_entry.sha256 if manifest_entry and manifest_entry.sha256 else _sha256_bytes(path.read_bytes())
        size = path.stat().st_size
        info = {
            "path": relpath(path, root),
            "absoluteParent": path.parent.as_posix(),
            "size": size,
            "sha256": digest,
            "exists": True,
        }
        copy_infos.append(info)
        meta = inspect_table_file(path, root, digest=digest, log=log)
        tables.append(meta)
        data = path.read_bytes()
        _, _, text = sniff_text_prefix(data)
        if text.endswith("\r\n"):
            body = text[:-2]
        elif text.endswith("\n") or text.endswith("\r"):
            body = text[:-1]
        else:
            body = text
        raw_lines = re.split(r"\r\n|\n|\r", body)
        texts.append((meta, raw_lines, meta.delimiter))
        log.info(
            f"{label} copy: path={info['path']} size={size} sha256={digest} "
            f"encoding={meta.encoding} lineEndings={meta.lineEndings} "
            f"delimiter={meta.delimiter} columns={meta.columnCount} rows={meta.rowCount}"
        )
        log.info(f"{label} header names: {json.dumps(meta.headerNames, ensure_ascii=True)}")

    hashes = {c["sha256"] for c in copy_infos}
    if len(copy_infos) > 1:
        log.info(f"{label} copies identical: {len(hashes) == 1} distinctHashes={len(hashes)}")

    empty = SpecVerification(
        copies=copy_infos,
        table=None,
        diagnostics=[{"code": "fileNotFound", "source": label, "severity": "error", "details": {}}],
        uniqueness={"unique": None, "duplicateKeyCount": 0, "duplicateKeys": [], "duplicateClassNameCount": 0, "duplicateClassNames": []},
        fightersAndPfs={},
        weaponCodes=[],
        arcCodes=[],
        raceTokens=[],
        hullTokens=[],
        columnSelection={},
        sourcePath=None,
        raceRowCounts=[],
        numericColumnStats=[],
        numericArcCodeSources=[],
        heavyWeaponSlotArcs=[],
        numericArcWeaponPairings={},
    )
    if not tables:
        return empty

    preferred = preferred_spec_index(copies, root)
    meta, raw_lines, delimiter = texts[preferred]
    source_path = copy_infos[preferred]["path"]
    log.info(f"{label} source copy (Assets/Specs preferred over MetaAssets): {source_path}")
    headers = meta.headerNames
    race_cols = find_columns(headers, RACE_HEADER_RE)
    class_idx = pick_class_column(headers)
    hull_idx = pick_hull_column(headers, class_idx)
    race_idx = race_cols[0] if race_cols else None
    col_sel = {
        "raceColumn": None if race_idx is None else headers[race_idx],
        "raceColumnIndex": race_idx,
        "classNameColumn": None if class_idx is None else headers[class_idx],
        "classNameColumnIndex": class_idx,
        "hullTypeColumn": None if hull_idx is None else headers[hull_idx],
        "hullTypeColumnIndex": hull_idx,
    }
    weapon_info = identify_weapon_arc_columns(headers)
    col_sel["weaponArc"] = weapon_info

    diagnostics: list[dict[str, Any]] = []
    key_rows: dict[str, dict[str, Any]] = {}
    race_tokens: Counter[str] = Counter()
    hull_tokens: Counter[str] = Counter()
    weapon_rows: dict[str, dict[str, set[int]]] = defaultdict(lambda: {"all": set(), "1-10": set(), "11-25": set(), "other": set()})
    weapon_occ: dict[str, dict[str, int]] = defaultdict(lambda: {"all": 0, "1-10": 0, "11-25": 0, "other": 0})
    arc_rows: dict[str, dict[str, set[int]]] = defaultdict(lambda: {"all": set(), "1-10": set(), "11-25": set(), "other": set()})
    arc_occ: dict[str, dict[str, int]] = defaultdict(lambda: {"all": 0, "1-10": 0, "11-25": 0, "other": 0})
    name_rows: dict[str, dict[str, Any]] = {}
    fighter_rows = 0
    pf_rows = 0
    paired_maps = pair_weapon_arc_count_slots(
        headers,
        weapon_info["weaponColumns"],
        weapon_info["arcColumns"],
        weapon_info.get("countColumns") or [],
    )
    weapon_slot_no = {
        i: _column_slot_number(i, headers, paired_maps["weaponSlotOf"])
        for i in weapon_info["weaponColumns"]
    }
    arc_slot_no = {
        i: _column_slot_number(i, headers, paired_maps["arcSlotOf"])
        for i in weapon_info["arcColumns"]
    }
    weapon_slot_of = {i: _slot_band(weapon_slot_no[i]) for i in weapon_slot_no}
    arc_slot_of = {i: _slot_band(arc_slot_no[i]) for i in arc_slot_no}
    numeric_arc_col_rows: dict[str, dict[int, set[int]]] = defaultdict(lambda: defaultdict(set))
    numeric_arc_col_occ: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    slot_arc_rows: dict[int, dict[str, set[int]]] = defaultdict(lambda: defaultdict(set))
    slot_arc_occ: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    arc_col_to_weapon_col: dict[int, int] = {
        p["arcColumnIndex"]: p["weaponColumnIndex"]
        for p in paired_maps["slotPairs"]
        if p.get("arcColumnIndex") is not None
    }
    # numeric arc value -> weapon code -> row numbers / occurrences (and by slot / band)
    num_arc_wpn_rows: dict[str, dict[str, set[int]]] = defaultdict(lambda: defaultdict(set))
    num_arc_wpn_occ: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    num_arc_wpn_band_rows: dict[str, dict[str, dict[str, set[int]]]] = defaultdict(
        lambda: defaultdict(lambda: {"1-10": set(), "11-25": set(), "other": set(), "all": set()})
    )
    num_arc_wpn_band_occ: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"1-10": 0, "11-25": 0, "other": 0, "all": 0})
    )
    slot_num_arc_wpn_rows: dict[int, dict[str, dict[str, set[int]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(set))
    )
    slot_num_arc_wpn_occ: dict[int, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )
    other_pair_rows: dict[str, dict[str, set[int]]] = defaultdict(lambda: defaultdict(set))
    other_pair_occ: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    other_pair_slot_rows: dict[str, dict[str, dict[int, set[int]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(set))
    )
    other_pair_slot_occ: dict[str, dict[str, dict[int, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )
    drone_add_rows: set[int] = set()
    drone_add_occ = 0
    drone_add_kind_rows: dict[str, set[int]] = {"numeric": set(), "letter": set(), "empty": set()}
    drone_add_kind_occ: dict[str, int] = {"numeric": 0, "letter": 0, "empty": 0}
    drone_add_kind_arc_rows: dict[str, dict[str, set[int]]] = {
        "numeric": defaultdict(set),
        "letter": defaultdict(set),
    }
    drone_add_kind_arc_occ: dict[str, dict[str, int]] = {
        "numeric": defaultdict(int),
        "letter": defaultdict(int),
    }
    drone_add_weapon_codes: set[str] = set()
    # Per-column raw nonempty cells for numeric-stat detection (aggregates only).
    column_values: dict[int, list[str]] = defaultdict(list)
    data_row_total = 0

    def _tally(rows_map: dict, occ_map: dict, code: str, line_no: int, band: str) -> None:
        rows_map[code]["all"].add(line_no)
        rows_map[code][band].add(line_no)
        occ_map[code]["all"] += 1
        occ_map[code][band] += 1

    for line_no, line in enumerate(raw_lines, start=1):
        if line_no <= meta.headerLine - 1 + meta.headerRowCount:
            continue
        if not line.strip():
            continue
        if _is_comment_or_instruction_line(line, delimiter):
            continue
        cells = split_line(line, delimiter)
        data_row_total += 1
        for ci, raw in enumerate(cells):
            val = raw.strip()
            if val:
                column_values[ci].append(val)
        race = _cell(cells, race_idx)
        class_name = _cell(cells, class_idx)
        hull = _cell(cells, hull_idx)
        if race:
            race_tokens[race] += 1
        if hull:
            hull_tokens[hull] += 1
            folded = hull.casefold()
            if folded in FIGHTER_HULL_TOKENS or folded.startswith("ftr"):
                fighter_rows += 1
            if folded in PF_HULL_TOKENS or folded == "pf" or folded.startswith("pf "):
                pf_rows += 1
        if class_name and hull_idx is None:
            folded_c = class_name.casefold()
            if "ftr" in folded_c or "fighter" in folded_c:
                fighter_rows += 1
            if re.search(r"(^|[^a-z])pf([^a-z]|$)", folded_c):
                pf_rows += 1

        if race_idx is not None and class_idx is not None and (race or class_name):
            fold = f"{race.casefold()}:{class_name.casefold()}"
            entry = key_rows.get(fold)
            if entry is None:
                key_rows[fold] = {"race": race, "className": class_name, "rows": [line_no]}
            else:
                entry["rows"].append(line_no)
        if class_idx is not None and class_name:
            nfold = class_name.casefold()
            nentry = name_rows.get(nfold)
            if nentry is None:
                name_rows[nfold] = {"className": class_name, "rows": [line_no]}
            else:
                nentry["rows"].append(line_no)

        for ci in weapon_info["weaponColumns"]:
            val = _cell(cells, ci)
            if val:
                _tally(weapon_rows, weapon_occ, val, line_no, weapon_slot_of[ci])
        for ci in weapon_info["arcColumns"]:
            val = _cell(cells, ci)
            if val:
                _tally(arc_rows, arc_occ, val, line_no, arc_slot_of[ci])
                if _is_integer_arc(val):
                    numeric_arc_col_rows[val][ci].add(line_no)
                    numeric_arc_col_occ[val][ci] += 1
                slot_no = arc_slot_no.get(ci)
                if slot_no is not None and 1 <= slot_no <= 10:
                    slot_arc_rows[slot_no][val].add(line_no)
                    slot_arc_occ[slot_no][val] += 1

        # Pair each Arc cell with the weapon code in the same slot (counts only).
        for pair in paired_maps["slotPairs"]:
            wci = pair["weaponColumnIndex"]
            aci = pair["arcColumnIndex"]
            slot_no = pair["slot"]
            weapon_val = _cell(cells, wci)
            arc_val = _cell(cells, aci) if aci is not None else ""
            band = _slot_band(slot_no)
            if _is_integer_arc(arc_val):
                wkey = weapon_val if weapon_val else "(empty)"
                num_arc_wpn_rows[arc_val][wkey].add(line_no)
                num_arc_wpn_occ[arc_val][wkey] += 1
                num_arc_wpn_band_rows[arc_val][wkey]["all"].add(line_no)
                num_arc_wpn_band_rows[arc_val][wkey][band].add(line_no)
                num_arc_wpn_band_occ[arc_val][wkey]["all"] += 1
                num_arc_wpn_band_occ[arc_val][wkey][band] += 1
                if slot_no is not None:
                    slot_num_arc_wpn_rows[slot_no][arc_val][wkey].add(line_no)
                    slot_num_arc_wpn_occ[slot_no][arc_val][wkey] += 1
                if not _is_drone_or_add_weapon(weapon_val):
                    other_pair_rows[arc_val][wkey].add(line_no)
                    other_pair_occ[arc_val][wkey] += 1
                    if slot_no is not None:
                        other_pair_slot_rows[arc_val][wkey][slot_no].add(line_no)
                        other_pair_slot_occ[arc_val][wkey][slot_no] += 1
            if _is_drone_or_add_weapon(weapon_val):
                drone_add_weapon_codes.add(weapon_val)
                drone_add_rows.add(line_no)
                drone_add_occ += 1
                if not arc_val:
                    kind = "empty"
                    drone_add_kind_rows[kind].add(line_no)
                    drone_add_kind_occ[kind] += 1
                elif _is_integer_arc(arc_val):
                    kind = "numeric"
                    drone_add_kind_rows[kind].add(line_no)
                    drone_add_kind_occ[kind] += 1
                    drone_add_kind_arc_rows[kind][arc_val].add(line_no)
                    drone_add_kind_arc_occ[kind][arc_val] += 1
                else:
                    kind = "letter"
                    drone_add_kind_rows[kind].add(line_no)
                    drone_add_kind_occ[kind] += 1
                    drone_add_kind_arc_rows[kind][arc_val].add(line_no)
                    drone_add_kind_arc_occ[kind][arc_val] += 1

    duplicate_keys = []
    for _fold, entry in sorted(key_rows.items(), key=lambda kv: kv[1]["rows"][0]):
        if len(entry["rows"]) > 1:
            diag = {
                "code": "duplicateClassKey",
                "source": label,
                "severity": "error",
                "details": {
                    "race": entry["race"],
                    "className": entry["className"],
                    "rows": entry["rows"],
                },
            }
            diagnostics.append(diag)
            duplicate_keys.append(
                {
                    "key": f"{entry['race']}:{entry['className']}",
                    "race": entry["race"],
                    "className": entry["className"],
                    "rows": entry["rows"],
                }
            )
            log.info(
                f"{label} diagnostic: code=duplicateClassKey source={label} severity=error "
                f"race={entry['race']!s} className={entry['className']!s} rows={entry['rows']}"
            )

    duplicate_names = []
    for _fold, entry in sorted(name_rows.items(), key=lambda kv: kv[1]["rows"][0]):
        if len(entry["rows"]) > 1:
            diag = {
                "code": "duplicateClassName",
                "source": label,
                "severity": "warning",
                "details": {
                    "className": entry["className"],
                    "rows": entry["rows"],
                },
            }
            diagnostics.append(diag)
            duplicate_names.append(
                {
                    "className": entry["className"],
                    "rows": entry["rows"],
                }
            )
            log.info(
                f"{label} diagnostic: code=duplicateClassName source={label} severity=warning "
                f"className={entry['className']!s} rows={entry['rows']}"
            )

    uniqueness = {
        "keyForm": "${race}:${className}",
        "comparison": "case-insensitive",
        "columnsFound": race_idx is not None and class_idx is not None,
        "unique": (len(duplicate_keys) == 0) if (race_idx is not None and class_idx is not None) else None,
        "keyCount": len(key_rows),
        "duplicateKeyCount": len(duplicate_keys),
        "duplicateKeys": duplicate_keys,
        "duplicateClassNameCount": len(duplicate_names),
        "duplicateClassNames": duplicate_names,
    }
    log.info(
        f"{label} uniqueness: columnsFound={uniqueness['columnsFound']} "
        f"keyCount={uniqueness['keyCount']} duplicateKeyCount={uniqueness['duplicateKeyCount']} "
        f"duplicateClassNameCount={uniqueness['duplicateClassNameCount']} "
        f"unique={uniqueness['unique']}"
    )

    fighter_tokens = sorted(
        {t for t in hull_tokens if t.casefold() in FIGHTER_HULL_TOKENS or t.casefold().startswith("ftr")}
    )
    pf_tokens = sorted(
        {t for t in hull_tokens if t.casefold() in PF_HULL_TOKENS or t.casefold() == "pf" or t.casefold().startswith("pf")}
    )
    fpf = {
        "fightersPresent": fighter_rows > 0,
        "fighterRowCount": fighter_rows,
        "fighterHullTokens": fighter_tokens,
        "pfsPresent": pf_rows > 0,
        "pfRowCount": pf_rows,
        "pfHullTokens": pf_tokens,
    }
    log.info(
        f"{label} fightersPresent={fpf['fightersPresent']} fighterRowCount={fighter_rows} "
        f"pfsPresent={fpf['pfsPresent']} pfRowCount={pf_rows} "
        f"fighterHullTokens={fighter_tokens} pfHullTokens={pf_tokens}"
    )

    def _code_items(rows_map: dict, occ_map: dict) -> list[dict[str, Any]]:
        items = []
        for code in sorted(occ_map, key=lambda c: (-occ_map[c]["all"], c)):
            items.append(
                {
                    "code": code,
                    "rows": len(rows_map[code]["all"]),
                    "occurrences": occ_map[code]["all"],
                    "slots1to10": {
                        "rows": len(rows_map[code]["1-10"]),
                        "occurrences": occ_map[code]["1-10"],
                    },
                    "slots11to25": {
                        "rows": len(rows_map[code]["11-25"]),
                        "occurrences": occ_map[code]["11-25"],
                    },
                }
            )
        return items

    weapon_codes = _code_items(weapon_rows, weapon_occ)
    arc_codes = _code_items(arc_rows, arc_occ)
    if weapon_info["weaponColumns"]:
        log.info(
            f"{label} distinct weapon codes: {len(weapon_codes)} "
            f"(column names: {json.dumps(weapon_info['weaponColumnNames'])})"
        )
        for item in weapon_codes:
            log.info(
                f"{label} weapon code {item['code']!s}: rows={item['rows']} occurrences={item['occurrences']} "
                f"slots1to10 rows={item['slots1to10']['rows']} occ={item['slots1to10']['occurrences']} "
                f"slots11to25 rows={item['slots11to25']['rows']} occ={item['slots11to25']['occurrences']}"
            )
    else:
        log.info(f"{label} weapon columns: not identified from headers")
    if weapon_info["arcColumns"]:
        log.info(
            f"{label} distinct arc codes: {len(arc_codes)} "
            f"(column names: {json.dumps(weapon_info['arcColumnNames'])})"
        )
        for item in arc_codes:
            log.info(
                f"{label} arc code {item['code']!s}: rows={item['rows']} occurrences={item['occurrences']} "
                f"slots1to10 rows={item['slots1to10']['rows']} occ={item['slots1to10']['occurrences']} "
                f"slots11to25 rows={item['slots11to25']['rows']} occ={item['slots11to25']['occurrences']}"
            )
    else:
        log.info(f"{label} arc columns: not identified from headers")

    numeric_arc_sources: list[dict[str, Any]] = []
    source_codes = list(NUMERIC_ARC_CODES)
    extra_ints = [
        c for c in numeric_arc_col_rows
        if c not in source_codes
    ]
    extra_ints.sort(key=lambda c: (int(c) if INTEGER_ARC_RE.fullmatch(c) else 0, c))
    source_codes.extend(extra_ints)
    for code in source_codes:
        columns = []
        for ci in sorted(numeric_arc_col_rows[code]):
            columns.append(
                {
                    "columnIndex": ci,
                    "headerName": headers[ci] if ci < len(headers) else f"col{ci}",
                    "slot": arc_slot_no.get(ci),
                    "rows": len(numeric_arc_col_rows[code][ci]),
                    "occurrences": numeric_arc_col_occ[code][ci],
                }
            )
        rec = {
            "code": code,
            "rows": len(arc_rows[code]["all"]) if code in arc_rows else 0,
            "occurrences": arc_occ[code]["all"] if code in arc_occ else 0,
            "columns": columns,
        }
        numeric_arc_sources.append(rec)
        log.info(
            f"{label} numeric arc code {code}: rows={rec['rows']} occurrences={rec['occurrences']} "
            f"columns={json.dumps([{k: c[k] for k in ('columnIndex', 'headerName', 'slot', 'rows', 'occurrences')} for c in columns], ensure_ascii=True)}"
        )

    pair_by_slot = {p["slot"]: p for p in paired_maps["slotPairs"] if p.get("slot") is not None}
    heavy_weapon_slot_arcs: list[dict[str, Any]] = []
    for slot in range(1, 11):
        pair = pair_by_slot.get(slot)
        # A slot is reported when a weapon column with that number was paired
        # (Heavy Weapon N or Weapon N). Skip unused slots with no weapon column.
        if pair is None:
            continue
        codes = [
            {
                "code": code,
                "rows": len(slot_arc_rows[slot][code]),
                "occurrences": slot_arc_occ[slot][code],
            }
            for code in sorted(slot_arc_occ[slot], key=lambda c: (-slot_arc_occ[slot][c], c))
        ]
        rec = {
            "slot": slot,
            "weaponColumnIndex": pair["weaponColumnIndex"],
            "weaponColumnName": pair["weaponColumnName"],
            "arcColumnIndex": pair["arcColumnIndex"],
            "arcColumnName": pair["arcColumnName"],
            "countColumnIndex": pair["countColumnIndex"],
            "countColumnName": pair["countColumnName"],
            "codes": codes,
        }
        heavy_weapon_slot_arcs.append(rec)
        log.info(
            f"{label} heavy weapon slot {slot}: weaponColumn={pair['weaponColumnIndex']} "
            f"weaponHeader={pair['weaponColumnName']!s} arcColumn={pair['arcColumnIndex']} "
            f"arcHeader={pair['arcColumnName']!s} "
            f"codes={json.dumps(codes, ensure_ascii=True)}"
        )

    def _weapon_items(arc_code: str) -> list[dict[str, Any]]:
        items = []
        for wcode in sorted(num_arc_wpn_occ[arc_code], key=lambda c: (-num_arc_wpn_occ[arc_code][c], c)):
            bands = num_arc_wpn_band_rows[arc_code][wcode]
            bocc = num_arc_wpn_band_occ[arc_code][wcode]
            items.append(
                {
                    "weaponCode": wcode,
                    "droneOrAdd": _is_drone_or_add_weapon(wcode),
                    "rows": len(num_arc_wpn_rows[arc_code][wcode]),
                    "occurrences": num_arc_wpn_occ[arc_code][wcode],
                    "slots1to10": {"rows": len(bands["1-10"]), "occurrences": bocc["1-10"]},
                    "slots11to25": {"rows": len(bands["11-25"]), "occurrences": bocc["11-25"]},
                }
            )
        return items

    by_numeric_arc: list[dict[str, Any]] = []
    for arc_code in sorted(num_arc_wpn_occ, key=lambda c: (int(c) if INTEGER_ARC_RE.fullmatch(c) else 0, c)):
        weapons = _weapon_items(arc_code)
        rec = {
            "arcCode": arc_code,
            "rows": len(set().union(*(num_arc_wpn_rows[arc_code][w] for w in num_arc_wpn_rows[arc_code]))),
            "occurrences": sum(num_arc_wpn_occ[arc_code].values()),
            "weapons": weapons,
        }
        by_numeric_arc.append(rec)
        log.info(
            f"{label} numeric arc {arc_code} paired weapon codes: "
            + json.dumps(
                [{"weaponCode": w["weaponCode"], "rows": w["rows"], "occurrences": w["occurrences"],
                  "droneOrAdd": w["droneOrAdd"],
                  "slots1to10": w["slots1to10"], "slots11to25": w["slots11to25"]} for w in weapons],
                ensure_ascii=True,
            )
        )

    by_slot_pairs: list[dict[str, Any]] = []
    for slot in sorted(slot_num_arc_wpn_occ):
        pairs = []
        for arc_code in sorted(slot_num_arc_wpn_occ[slot], key=lambda c: (int(c) if INTEGER_ARC_RE.fullmatch(c) else 0, c)):
            for wcode in sorted(slot_num_arc_wpn_occ[slot][arc_code], key=lambda c: (-slot_num_arc_wpn_occ[slot][arc_code][c], c)):
                pairs.append(
                    {
                        "arcCode": arc_code,
                        "weaponCode": wcode,
                        "droneOrAdd": _is_drone_or_add_weapon(wcode),
                        "rows": len(slot_num_arc_wpn_rows[slot][arc_code][wcode]),
                        "occurrences": slot_num_arc_wpn_occ[slot][arc_code][wcode],
                    }
                )
        rec = {"slot": slot, "pairs": pairs}
        by_slot_pairs.append(rec)
        log.info(
            f"{label} slot {slot} numeric-arc weapon pairs: "
            + json.dumps(
                [{"arcCode": p["arcCode"], "weaponCode": p["weaponCode"], "rows": p["rows"],
                  "occurrences": p["occurrences"]} for p in pairs],
                ensure_ascii=True,
            )
        )

    non_drone: list[dict[str, Any]] = []
    for arc_code in sorted(other_pair_occ, key=lambda c: (int(c) if INTEGER_ARC_RE.fullmatch(c) else 0, c)):
        for wcode in sorted(other_pair_occ[arc_code], key=lambda c: (-other_pair_occ[arc_code][c], c)):
            slots = [
                {
                    "slot": s,
                    "rows": len(other_pair_slot_rows[arc_code][wcode][s]),
                    "occurrences": other_pair_slot_occ[arc_code][wcode][s],
                }
                for s in sorted(other_pair_slot_occ[arc_code][wcode])
            ]
            non_drone.append(
                {
                    "arcCode": arc_code,
                    "weaponCode": wcode,
                    "rows": len(other_pair_rows[arc_code][wcode]),
                    "occurrences": other_pair_occ[arc_code][wcode],
                    "slots": slots,
                }
            )
    pairs_only_drone_or_add = len(non_drone) == 0
    if non_drone:
        log.info(
            f"{label} numeric arcs pair only with Dro*/ADD6/ADD12: false "
            f"otherPairings={json.dumps(non_drone, ensure_ascii=True)}"
        )
    else:
        log.info(f"{label} numeric arcs pair only with Dro*/ADD6/ADD12: true")

    def _kind_block(kind: str) -> dict[str, Any]:
        block: dict[str, Any] = {
            "rows": len(drone_add_kind_rows[kind]),
            "occurrences": drone_add_kind_occ[kind],
        }
        if kind in drone_add_kind_arc_occ:
            block["arcCodes"] = [
                {
                    "code": code,
                    "rows": len(drone_add_kind_arc_rows[kind][code]),
                    "occurrences": drone_add_kind_arc_occ[kind][code],
                }
                for code in sorted(
                    drone_add_kind_arc_occ[kind],
                    key=lambda c: (-drone_add_kind_arc_occ[kind][c], c),
                )
            ]
        return block

    drone_add_arc_kinds = {
        "weaponCodes": sorted(drone_add_weapon_codes),
        "filledOrEmptySlots": {"rows": len(drone_add_rows), "occurrences": drone_add_occ},
        "numericArc": _kind_block("numeric"),
        "letterArc": _kind_block("letter"),
        "emptyArc": _kind_block("empty"),
    }
    log.info(
        f"{label} Dro*/ADD6/ADD12 slots: weaponCodes={json.dumps(drone_add_arc_kinds['weaponCodes'])} "
        f"total rows={drone_add_arc_kinds['filledOrEmptySlots']['rows']} "
        f"occ={drone_add_arc_kinds['filledOrEmptySlots']['occurrences']} "
        f"numericArc rows={drone_add_arc_kinds['numericArc']['rows']} occ={drone_add_arc_kinds['numericArc']['occurrences']} "
        f"letterArc rows={drone_add_arc_kinds['letterArc']['rows']} occ={drone_add_arc_kinds['letterArc']['occurrences']} "
        f"emptyArc rows={drone_add_arc_kinds['emptyArc']['rows']} occ={drone_add_arc_kinds['emptyArc']['occurrences']}"
    )

    numeric_arc_weapon_pairings: dict[str, Any] = {
        "byNumericArc": by_numeric_arc,
        "bySlot": by_slot_pairs,
        "nonDroneOrAddPairings": non_drone,
        "pairsOnlyWithDroneOrAdd": pairs_only_drone_or_add,
        "droneAddArcKinds": drone_add_arc_kinds,
    }

    race_row_counts = [
        {"race": name, "rows": race_tokens[name]}
        for name in sorted(race_tokens)
    ]
    log.info(
        f"{label} distinct race tokens ({len(race_tokens)}): "
        + json.dumps([{"race": r["race"], "rows": r["rows"]} for r in race_row_counts], ensure_ascii=True)
    )
    log.info(f"{label} distinct hull tokens ({len(hull_tokens)}): {json.dumps(sorted(hull_tokens))}")

    numeric_stats = _numeric_column_stats(headers, column_values, data_row_total)
    if numeric_stats:
        log.info(f"{label} numeric columns: {len(numeric_stats)}")
        for item in numeric_stats:
            log.info(
                f"{label} numeric column {item['column']!s} index={item['columnIndex']} "
                f"min={item['min']} max={item['max']} maxDecimalPlaces={item['maxDecimalPlaces']} "
                f"numericRows={item['numericRowCount']} emptyRows={item['emptyRowCount']}"
            )
    else:
        log.info(f"{label} numeric columns: none identified")

    return SpecVerification(
        copies=copy_infos,
        table=table_meta_dict(meta),
        diagnostics=diagnostics,
        uniqueness=uniqueness,
        fightersAndPfs=fpf,
        weaponCodes=weapon_codes,
        arcCodes=arc_codes,
        raceTokens=sorted(race_tokens),
        hullTokens=sorted(hull_tokens),
        columnSelection=col_sel,
        sourcePath=source_path,
        raceRowCounts=race_row_counts,
        numericColumnStats=numeric_stats,
        numericArcCodeSources=numeric_arc_sources,
        heavyWeaponSlotArcs=heavy_weapon_slot_arcs,
        numericArcWeaponPairings=numeric_arc_weapon_pairings,
    )



def _cell(cells: Sequence[str], index: int | None) -> str:
    if index is None or index < 0 or index >= len(cells):
        return ""
    return cells[index].strip()

def is_mostly_text(data: bytes) -> bool:
    if not data:
        return True
    sample = data[:MAX_PROBE_BYTES]
    if b"\x00" in sample:
        return False
    printable = sum(1 for b in sample if b in TEXT_PRINTABLE)
    return printable / len(sample) >= 0.85


def magic_hex(data: bytes, n: int = 16) -> str:
    return data[:n].hex()


def ascii_magic(data: bytes, n: int = 16) -> str:
    return "".join(chr(b) if 32 <= b < 127 else "." for b in data[:n])


def inspect_extensionless_tables(
    files: Sequence[FileMeta],
    extracted_root: Path,
    log: MetadataLog,
) -> dict[str, Any]:
    entries = []
    header_signatures: dict[tuple[str, ...], list[str]] = defaultdict(list)
    sizes = []
    text_count = 0
    binary_count = 0
    for f in files:
        path = extracted_root / f.path
        if not path.is_file():
            continue
        sizes.append(f.size)
        data = path.read_bytes()
        if len(data) > MAX_PROBE_BYTES:
            probe = data[:MAX_PROBE_BYTES]
        else:
            probe = data
        rec: dict[str, Any] = {"path": f.path, "size": f.size, "sha256": f.sha256}
        if is_mostly_text(probe):
            text_count += 1
            meta = inspect_table_file(path, extracted_root, digest=f.sha256, log=log)
            rec.update(
                {
                    "kind": "text-table" if meta.headerNames else "text",
                    "encoding": meta.encoding,
                    "lineEndings": meta.lineEndings,
                    "delimiter": meta.delimiter,
                    "headerNames": meta.headerNames,
                    "columnCount": meta.columnCount,
                    "rowCount": meta.rowCount,
                    "dataColumnCountMin": meta.dataColumnCountMin,
                    "dataColumnCountMax": meta.dataColumnCountMax,
                    "headerRejection": meta.headerRejection,
                }
            )
            if meta.headerNames:
                header_signatures[tuple(meta.headerNames)].append(f.path)
        else:
            binary_count += 1
            rec.update({"kind": "binary", "magicHex": magic_hex(probe), "magicAscii": ascii_magic(probe)})
        entries.append(rec)

    paths = [e["path"] for e in entries]
    common = _common_dir_prefix(paths)
    name_re = _name_pattern([Path(p).name for p in paths])
    shared = len(header_signatures) == 1
    log.info(
        f"extensionless files: count={len(entries)} text={text_count} binary={binary_count} "
        f"commonDir={common!s} namePattern={name_re!s} distinctHeaderLayouts={len(header_signatures)} "
        f"headersSharedAcrossTables={shared}"
    )
    for sig, sig_paths in header_signatures.items():
        log.info(
            f"extensionless header layout columns={len(sig)} files={len(sig_paths)} "
            f"header names: {json.dumps(list(sig))}"
        )
    size_summary = _size_summary(sizes)
    if size_summary:
        log.info(
            f"extensionless sizes: min={size_summary['min']} max={size_summary['max']} "
            f"total={size_summary['total']} mean={size_summary['mean']}"
        )

    # Layouts by observed column counts. Do not invent header names when none
    # were identified; still report delimiter and min/max column counts.
    column_layouts: dict[tuple[Any, ...], list[str]] = defaultdict(list)
    for e in entries:
        if e.get("kind") not in {"text", "text-table"}:
            continue
        has_header = bool(e.get("headerNames"))
        key = (
            has_header,
            e.get("delimiter") or "unknown",
            e.get("columnCount") or 0,
            e.get("dataColumnCountMin"),
            e.get("dataColumnCountMax"),
        )
        column_layouts[key].append(e["path"])
    layout_rows = []
    for key, sig_paths in sorted(column_layouts.items(), key=lambda kv: -len(kv[1])):
        has_header, delim, col, wmin, wmax = key
        layout_rows.append(
            {
                "headerIdentified": has_header,
                "delimiter": delim,
                "columnCount": col,
                "dataColumnCountMin": wmin,
                "dataColumnCountMax": wmax,
                "fileCount": len(sig_paths),
                "pathExamples": sig_paths[:5],
            }
        )
        log.info(
            f"extensionless column layout headerIdentified={has_header} delimiter={delim} "
            f"columnCount={col} dataColumnCountMin={wmin} dataColumnCountMax={wmax} "
            f"files={len(sig_paths)}"
        )

    return {
        "count": len(entries),
        "textCount": text_count,
        "binaryCount": binary_count,
        "pathPattern": {"commonDirectory": common, "fileNamePattern": name_re},
        "sizes": size_summary,
        "headersSharedAcrossTables": shared if header_signatures else None,
        "distinctHeaderLayouts": [
            {
                "headerNames": list(sig),
                "columnCount": len(sig),
                "fileCount": len(sig_paths),
                "pathExamples": sig_paths[:5],
            }
            for sig, sig_paths in sorted(header_signatures.items(), key=lambda kv: -len(kv[1]))
        ],
        "columnLayouts": layout_rows,
        "files": [
            {
                "path": e["path"],
                "size": e["size"],
                "sha256": e["sha256"],
                "kind": e.get("kind"),
                "columnCount": e.get("columnCount"),
                "dataColumnCountMin": e.get("dataColumnCountMin"),
                "dataColumnCountMax": e.get("dataColumnCountMax"),
                "headerIdentified": bool(e.get("headerNames")),
            }
            for e in entries
        ],
    }


def _common_dir_prefix(paths: Sequence[str]) -> str:
    if not paths:
        return ""
    parts_list = [Path(p).parent.parts for p in paths]
    common_parts: list[str] = []
    for chunk in zip(*parts_list):
        if len(set(chunk)) == 1:
            common_parts.append(chunk[0])
        else:
            break
    return "/".join(common_parts) if common_parts else ""


def _name_pattern(names: Sequence[str]) -> str:
    if not names:
        return ""
    if len(set(names)) == 1:
        return names[0]
    lengths = {len(n) for n in names}
    charset = set("".join(names))
    alpha = all(c.isalpha() or c in "-_" for c in charset)
    alnum = all(c.isalnum() or c in "-_" for c in charset)
    kind = "letters" if alpha else "alnum" if alnum else "mixed"
    lo, hi = min(lengths), max(lengths)
    length = str(lo) if lo == hi else f"{lo}-{hi}"
    return f"{kind}{{{length}}} ({len(names)} names)"


def _size_summary(sizes: Sequence[int]) -> dict[str, int] | None:
    if not sizes:
        return None
    return {
        "min": min(sizes),
        "max": max(sizes),
        "total": sum(sizes),
        "mean": int(round(sum(sizes) / len(sizes))),
        "count": len(sizes),
    }


@dataclass
class CoordStats:
    largestAbs: float | None = None
    largestAbsPath: str | None = None
    smallestNonzeroStep: float | None = None
    smallestNonzeroStepPath: str | None = None
    parseable: bool = False
    notes: str = ""


def probe_map_files(
    files: Sequence[FileMeta],
    extracted_root: Path,
    log: MetadataLog,
    label: str,
) -> dict[str, Any]:
    records = []
    stats = CoordStats()
    text_n = 0
    binary_n = 0
    for f in files:
        path = extracted_root / f.path
        if not path.is_file():
            continue
        size = path.stat().st_size
        with path.open("rb") as fh:
            prefix = fh.read(MAX_PROBE_BYTES)
        kind = "text" if is_mostly_text(prefix) else "binary"
        rec: dict[str, Any] = {
            "path": f.path,
            "size": f.size or size,
            "sha256": f.sha256,
            "kind": kind,
            "magicHex": magic_hex(prefix),
            "magicAscii": ascii_magic(prefix),
        }
        if kind == "text":
            text_n += 1
            data = path.read_bytes() if size <= MAX_PROBE_BYTES else prefix
            encoding, _, text = sniff_text_prefix(data)
            rec["encoding"] = encoding
            rec["lineEndings"] = detect_line_endings(text)
            first = next((ln for ln in re.split(r"\r\n|\n|\r", text) if ln.strip()), "")
            delim = detect_delimiter(first)
            headers = [c.strip() for c in split_line(first, delim)] if first else []
            if headers and _looks_like_header_line(first):
                rec["headerNames"] = headers
                rec["columnCount"] = len(headers)
            values, step, note = _extract_coordinates(text, headers, delim)
            rec["coordinatesParseable"] = bool(values)
            rec["coordinateNote"] = note
            if values:
                _update_coord_stats(stats, values, step, f.path)
        else:
            binary_n += 1
            rec["coordinatesParseable"] = False
            rec["coordinateNote"] = "binary; structure not determinable from a clean-room prefix sniff"
        records.append(rec)

    log.info(f"{label} files: count={len(records)} text={text_n} binary={binary_n}")
    for rec in records:
        bits = [
            f"path={rec['path']}",
            f"size={rec['size']}",
            f"kind={rec['kind']}",
            f"magicHex={rec['magicHex']}",
        ]
        if rec.get("headerNames"):
            bits.append(f"header names: {json.dumps(rec['headerNames'])}")
        bits.append(f"coordinatesParseable={rec.get('coordinatesParseable')}")
        log.info(f"{label} {' '.join(bits)}")
    if stats.parseable:
        log.info(
            f"{label} coordinates: largestAbsolute={stats.largestAbs} source={stats.largestAbsPath} "
            f"smallestNonzeroStep={stats.smallestNonzeroStep} source={stats.smallestNonzeroStepPath}"
        )
    else:
        log.info(f"{label} coordinates: not determinable")

    return {
        "count": len(records),
        "textCount": text_n,
        "binaryCount": binary_n,
        "files": records,
        "coordinates": {
            "parseable": stats.parseable,
            "largestAbsolute": stats.largestAbs,
            "largestAbsolutePath": stats.largestAbsPath,
            "smallestNonzeroStep": stats.smallestNonzeroStep,
            "smallestNonzeroStepPath": stats.smallestNonzeroStepPath,
            "notes": stats.notes
            or ("observed from numeric coordinate columns or numeric pairs" if stats.parseable else "not determinable"),
        },
    }


def _extract_coordinates(
    text: str, headers: Sequence[str], delimiter: str
) -> tuple[list[float], list[float], str]:
    """Return (scalar coordinate values, pairwise point-distance samples, note)."""
    coord_idxs = [i for i, h in enumerate(headers) if COORD_HEADER_RE.match(h)]
    values: list[float] = []
    points: list[tuple[float, ...]] = []
    lines = [ln for ln in re.split(r"\r\n|\n|\r", text) if ln.strip()]
    data_lines = lines[1:] if headers and lines and _looks_like_header_line(lines[0]) else lines
    if coord_idxs:
        for ln in data_lines:
            cells = split_line(ln, delimiter)
            pt: list[float] = []
            for i in coord_idxs:
                if i < len(cells):
                    num = _try_float(cells[i])
                    if num is not None:
                        values.append(num)
                        pt.append(num)
            if len(pt) >= 2:
                points.append(tuple(pt[:3]))
        return values, _point_distances(points), "from named coordinate columns"
    numeric_rows = 0
    for ln in data_lines:
        cells = [c.strip() for c in split_line(ln, delimiter if delimiter != "unknown" else "TAB")]
        if delimiter == "unknown":
            cells = ln.split()
        nums = []
        other = 0
        for c in cells:
            if not c:
                continue
            n = _try_float(c)
            if n is None:
                other += 1
            else:
                nums.append(n)
        if len(nums) >= 2 and other == 0:
            numeric_rows += 1
            values.extend(nums)
            points.append(tuple(nums[:3]))
    if numeric_rows >= 2 and values:
        return values, _point_distances(points), "from numeric-only rows (no named coordinate columns)"
    return [], [], "no parseable coordinate columns or numeric-only rows"


def _try_float(text: str) -> float | None:
    try:
        return float(text.strip())
    except (TypeError, ValueError):
        return None


def _point_distances(points: Sequence[tuple[float, ...]]) -> list[float]:
    dists: list[float] = []
    prev = None
    for p in points:
        if prev is not None and len(p) == len(prev):
            d = sum((a - b) ** 2 for a, b in zip(p, prev)) ** 0.5
            if d > 0:
                dists.append(d)
        prev = p
    return dists


def _update_coord_stats(
    stats: CoordStats, values: Sequence[float], point_steps: Sequence[float], path: str
) -> None:
    if not values:
        return
    stats.parseable = True
    local_abs = max(abs(v) for v in values)
    if stats.largestAbs is None or local_abs > stats.largestAbs:
        stats.largestAbs = local_abs
        stats.largestAbsPath = path
    unique = sorted(set(values))
    gaps = [b - a for a, b in zip(unique, unique[1:]) if b > a]
    candidates = [g for g in gaps if g > 0]
    candidates.extend(s for s in point_steps if s > 0)
    if candidates:
        local_step = min(candidates)
        if stats.smallestNonzeroStep is None or local_step < stats.smallestNonzeroStep:
            stats.smallestNonzeroStep = local_step
            stats.smallestNonzeroStepPath = path

def inspect_q3_archive(path: Path, root: Path | None, log: MetadataLog, label: str) -> dict[str, Any]:
    """Inspect a .q3 archive directory only (no payload bytes).

    Identifies a ZIP directory (including PK-style packs) or a Quake PACK
    directory. If neither is present, reports the format as unidentified
    and records only magic bytes, path, size and hash.
    """
    size = path.stat().st_size
    rec: dict[str, Any] = {
        "path": relpath(path, root),
        "size": size,
        "sha256": file_sha256(path),
        "format": "unidentified",
        "entryCount": None,
        "entries": None,
        "note": None,
    }
    with path.open("rb") as fh:
        magic = fh.read(16)
    rec["magicHex"] = magic_hex(magic)
    rec["magicAscii"] = ascii_magic(magic)

    if magic.startswith(b"PK"):
        try:
            with zipfile.ZipFile(path, "r") as zf:
                infos = zf.infolist()
            rec["format"] = "zip"
            rec["entryCount"] = len(infos)
            rec["entries"] = [
                {"name": info.filename, "size": info.file_size, "compressedSize": info.compress_size}
                for info in infos
            ]
            rec["note"] = "ZIP central directory only; no payload bytes were read."
        except zipfile.BadZipFile:
            rec["note"] = "PK magic present but the ZIP directory is not readable."
        log.info(
            f"{label} q3 path={rec['path']} format={rec['format']} size={size} "
            f"entryCount={rec['entryCount']}"
        )
        return rec

    if magic.startswith(b"PACK") and size >= 12:
        try:
            with path.open("rb") as fh:
                header = fh.read(12)
            _sig, dir_off, dir_size = struct.unpack("<4sII", header)
            if dir_off + dir_size <= size and dir_size % 64 == 0:
                with path.open("rb") as fh:
                    fh.seek(dir_off)
                    directory = fh.read(dir_size)
                entries = []
                for i in range(0, dir_size, 64):
                    name_b, _off, ent_size = struct.unpack("<56sII", directory[i : i + 64])
                    name = name_b.split(b"\x00", 1)[0].decode("latin-1", errors="replace")
                    entries.append({"name": name, "size": ent_size})
                rec["format"] = "pak"
                rec["entryCount"] = len(entries)
                rec["entries"] = entries
                rec["note"] = "PACK directory only; no payload bytes were read."
            else:
                rec["note"] = "PACK magic present but the directory offset/size is not usable."
        except (OSError, struct.error):
            rec["note"] = "PACK magic present but the directory could not be parsed."
        log.info(
            f"{label} q3 path={rec['path']} format={rec['format']} size={size} "
            f"entryCount={rec['entryCount']}"
        )
        return rec

    rec["note"] = "No identifiable archive directory (not ZIP or PACK)."
    log.info(
        f"{label} q3 path={rec['path']} format=unidentified size={size} "
        f"magicHex={rec['magicHex']}"
    )
    return rec


def find_q3(root: Path, log: MetadataLog, label: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if not root.exists():
        log.info(f"{label}: tree missing at {root.as_posix()}")
        return found
    for p in _walk_files(root):
        if p.suffix.lower() == ".q3" or p.name.lower().endswith(".q3"):
            found.append(inspect_q3_archive(p, root, log, label))
    log.info(
        f"{label} *.q3 count={len(found)}"
        + ("" if not found else " paths=" + json.dumps([f["path"] for f in found]))
    )
    return found


BMP_COMPRESSION_NAMES = {
    0: "BI_RGB",
    1: "BI_RLE8",
    2: "BI_RLE4",
    3: "BI_BITFIELDS",
    4: "BI_JPEG",
    5: "BI_PNG",
}

# Self-illum pair: stem ends in _<token>i where token starts with a digit (e.g. _1i, _512ai).
ILLUM_NI_STEM_RE = re.compile(r"^(?P<base>.*)_(?P<token>[0-9][0-9A-Za-z]*)i$", re.IGNORECASE)


def parse_bmp_file_header(path: Path) -> dict[str, Any] | None:
    """Read BITMAPFILEHEADER + BITMAPINFOHEADER only. No pixel bytes."""
    try:
        with path.open("rb") as fh:
            head = fh.read(54)
    except OSError:
        return None
    if len(head) < 26 or head[0:2] != b"BM":
        return {"readable": False, "reason": "not-bmp-or-truncated"}
    if len(head) < 54:
        return {"readable": False, "reason": "header-truncated"}
    _type, _size, _res1, _res2, _off = struct.unpack_from("<2sIHHI", head, 0)
    info_size, width, height, planes, bit_count, compression = struct.unpack_from("<IiiHHI", head, 14)
    return {
        "readable": True,
        "infoHeaderSize": info_size,
        "width": width,
        "height": height,
        "planes": planes,
        "bitCount": bit_count,
        "compression": compression,
        "compressionName": BMP_COMPRESSION_NAMES.get(compression, f"unknown-{compression}"),
    }


def bmp_patterns(files: Sequence[FileMeta], log: MetadataLog, extracted_root: Path | None = None) -> dict[str, Any]:
    bmps = [f for f in files if ext_of(f.path) == ".bmp"]
    by_folder: Counter[str] = Counter()
    suffix_counts: Counter[str] = Counter()
    illum_counts: Counter[str] = Counter()
    gui_folders: Counter[str] = Counter()
    model_folder_count = 0
    by_path = {f.path.replace("\\", "/"): f for f in bmps}
    by_path_l = {p.lower(): p for p in by_path}

    for f in bmps:
        parent = str(Path(f.path).parent).replace("\\", "/")
        by_folder[parent] += 1
        parts_l = [p.lower() for p in Path(f.path).parts]
        if "models" in parts_l or "model" in parts_l:
            model_folder_count += 1
        else:
            gui_folders[parent] += 1
        stem = Path(f.path).stem
        m = re.search(r"[_-]([A-Za-z0-9]+)$", stem)
        if m:
            suffix_counts[m.group(1)] += 1
        illum = ILLUM_SUFFIX_RE.search(stem)
        if illum:
            illum_counts[illum.group(0)] += 1

    log.info(
        f"BMP count={len(bmps)} folders={len(by_folder)} "
        f"modelFolderBmps={model_folder_count} nonModelFolderBmps={sum(gui_folders.values())}"
    )
    if illum_counts:
        shown = ", ".join(
            f"{pat}={cnt}" for pat, cnt in sorted(illum_counts.items(), key=lambda kv: (-kv[1], kv[0]))
        )
        log.info(f"BMP self-illumination suffix patterns: {shown}")
    else:
        log.info("BMP self-illumination suffix patterns: none matched known endings")
    for folder, cnt in sorted(gui_folders.items(), key=lambda kv: (-kv[1], kv[0]))[:40]:
        log.info(f"BMP non-model/GUI folder: path={folder} count={cnt}")
    if len(gui_folders) > 40:
        log.info(f"BMP non-model/GUI folders truncated in log: totalFolders={len(gui_folders)}")

    # _<n>i pairs: header-only compare of bit depth, compression, width, height.
    pair_summary: dict[str, Any] = {
        "pattern": "_<n>i",
        "illumCount": 0,
        "pairedCount": 0,
        "missingBaseCount": 0,
        "unreadableHeaderCount": 0,
        "depthMatches": 0,
        "depthDiffers": 0,
        "dimensionMatches": 0,
        "dimensionDiffers": 0,
        "bitCountHistogram": {},
        "differingPairs": [],
    }
    if extracted_root is not None:
        illum_files = []
        for f in bmps:
            stem = Path(f.path).stem
            m = ILLUM_NI_STEM_RE.match(stem)
            if m:
                illum_files.append((f, m.group("base"), m.group("token")))
        pair_summary["illumCount"] = len(illum_files)
        bit_hist: Counter[str] = Counter()
        for f, base_stem, token in illum_files:
            parent = str(Path(f.path).parent).replace("\\", "/")
            ext = Path(f.path).suffix
            base_rel = f"{parent}/{base_stem}_{token}{ext}" if parent != "." else f"{base_stem}_{token}{ext}"
            base_key = by_path_l.get(base_rel.replace("\\", "/").lower())
            illum_abs = extracted_root / f.path
            illum_hdr = parse_bmp_file_header(illum_abs) if illum_abs.is_file() else None
            if not illum_hdr or not illum_hdr.get("readable"):
                pair_summary["unreadableHeaderCount"] += 1
                continue
            bit_hist[str(illum_hdr["bitCount"])] += 1
            if not base_key:
                pair_summary["missingBaseCount"] += 1
                continue
            base_abs = extracted_root / base_key
            base_hdr = parse_bmp_file_header(base_abs) if base_abs.is_file() else None
            if not base_hdr or not base_hdr.get("readable"):
                pair_summary["unreadableHeaderCount"] += 1
                continue
            pair_summary["pairedCount"] += 1
            depth_match = illum_hdr["bitCount"] == base_hdr["bitCount"]
            dim_match = (
                illum_hdr["width"] == base_hdr["width"]
                and abs(illum_hdr["height"]) == abs(base_hdr["height"])
            )
            if depth_match:
                pair_summary["depthMatches"] += 1
            else:
                pair_summary["depthDiffers"] += 1
                pair_summary["differingPairs"].append(
                    {
                        "illumPath": f.path,
                        "basePath": base_key,
                        "illum": {
                            "bitCount": illum_hdr["bitCount"],
                            "compression": illum_hdr["compression"],
                            "compressionName": illum_hdr["compressionName"],
                            "width": illum_hdr["width"],
                            "height": illum_hdr["height"],
                        },
                        "base": {
                            "bitCount": base_hdr["bitCount"],
                            "compression": base_hdr["compression"],
                            "compressionName": base_hdr["compressionName"],
                            "width": base_hdr["width"],
                            "height": base_hdr["height"],
                        },
                    }
                )
            if dim_match:
                pair_summary["dimensionMatches"] += 1
            else:
                pair_summary["dimensionDiffers"] += 1
        pair_summary["bitCountHistogram"] = dict(bit_hist.most_common())
        log.info(
            f"BMP _<n>i pairs: illum={pair_summary['illumCount']} paired={pair_summary['pairedCount']} "
            f"missingBase={pair_summary['missingBaseCount']} unreadable={pair_summary['unreadableHeaderCount']} "
            f"depthMatches={pair_summary['depthMatches']} depthDiffers={pair_summary['depthDiffers']} "
            f"dimensionMatches={pair_summary['dimensionMatches']} dimensionDiffers={pair_summary['dimensionDiffers']}"
        )

    return {
        "bmpCount": len(bmps),
        "folderCount": len(by_folder),
        "modelFolderBmpCount": model_folder_count,
        "nonModelBmpCount": sum(gui_folders.values()),
        "guiOrNonModelFolders": [
            {"path": p, "count": n} for p, n in sorted(gui_folders.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "allFolders": [{"path": p, "count": n} for p, n in sorted(by_folder.items(), key=lambda kv: (-kv[1], kv[0]))],
        "underscoreSuffixCounts": dict(suffix_counts.most_common()),
        "selfIlluminationPatterns": dict(illum_counts.most_common()),
        "illumPairs": pair_summary,
    }



def bft_report(files: Sequence[FileMeta], log: MetadataLog) -> dict[str, Any]:
    bfts = [f for f in files if ext_of(f.path) == ".bft"]
    folders: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for f in bfts:
        folders[str(Path(f.path).parent).replace("\\", "/")].append(
            {"path": f.path, "size": f.size, "sha256": f.sha256}
        )
    log.info(f".bft count={len(bfts)} folders={len(folders)}")
    for folder, items in sorted(folders.items()):
        sizes = [i["size"] or 0 for i in items]
        log.info(
            f".bft folder: path={folder} count={len(items)} "
            f"bytes={sum(sizes)} min={min(sizes) if sizes else 0} max={max(sizes) if sizes else 0}"
        )
        for item in items:
            log.info(f".bft file: path={item['path']} size={item['size']}")
    return {
        "count": len(bfts),
        "folders": [
            {"path": folder, "count": len(items), "files": items}
            for folder, items in sorted(folders.items())
        ],
        "note": "Observed by path and size only; no .bft payload is parsed or logged.",
    }


def group_mission_files(files: Sequence[FileMeta], log: MetadataLog) -> dict[str, Any]:
    wanted = [f for f in files if ext_of(f.path) in {".scr", ".mct", ".gf"}]
    groups: dict[str, list[FileMeta]] = defaultdict(list)
    for f in wanted:
        groups[str(Path(f.path).parent).replace("\\", "/")].append(f)
    log.info(f"mission-like files: scr+mct+gf count={len(wanted)} folders={len(groups)}")
    out_groups = []
    for folder, items in sorted(groups.items(), key=lambda kv: kv[0].lower()):
        empire = _infer_empire(folder)
        items_s = sorted(items, key=lambda x: x.path.lower())
        ext_counts = Counter(ext_of(i.path) for i in items_s)
        log.info(
            f"mission folder: path={folder} inferredEmpire={empire or 'unspecified'} "
            + " ".join(f"{k}={v}" for k, v in sorted(ext_counts.items()))
        )
        out_groups.append(
            {
                "folder": folder,
                "inferredEmpireOrCampaign": empire,
                "counts": dict(ext_counts),
                "files": [
                    {
                        "name": Path(i.path).name,
                        "path": i.path,
                        "size": i.size,
                        "sha256": i.sha256,
                        "extension": ext_of(i.path),
                    }
                    for i in items_s
                ],
            }
        )
    return {"fileCount": len(wanted), "folderCount": len(groups), "groups": out_groups}


def _infer_empire(folder: str) -> str | None:
    parts = Path(folder).parts
    for token in PLAN_EMPIRE_TOKENS:
        for p in parts:
            if token.casefold() in p.casefold():
                return token
    return None

def compact_inventory_json(files: Sequence[FileMeta], extra: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "build": BUILD_LABEL,
        "observedOn": OBSERVED_ON,
        "generatedAt": extra.get("generatedAt"),
        "extractedRoot": extra.get("extractedRoot"),
        "manifestPath": extra.get("manifestPath"),
        "fileCount": len(files),
        "totalBytes": sum(f.size or 0 for f in files),
        "files": [[f.path, f.size, f.sha256] for f in files],
    }


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=True, separators=(",", ":"), sort_keys=False)
    path.write_text(text + "\n", encoding="utf-8")


def _md_escape(text: str) -> str:
    return text.replace("|", "\\|")



def _write_q3_md(a, archives: list[dict[str, Any]]) -> None:
    for e in archives:
        a(
            f"  - `{_md_escape(e['path'])}` size={e['size']} sha256=`{e['sha256']}` "
            f"format=`{e.get('format') or 'unidentified'}` entryCount={e.get('entryCount')}"
        )
        if e.get("note"):
            a(f"    - {e['note']}")
        if e.get("entries"):
            a("")
            a("    | Entry name | Size |")
            a("    | --- | ---: |")
            for ent in e["entries"]:
                a(f"    | `{_md_escape(ent['name'])}` | {ent['size']} |")
            a("")


def write_inventory_markdown(
    path: Path,
    summary: dict[str, Any],
    interesting: dict[str, Any],
    readme: dict[str, Any],
    cross: dict[str, Any],
    q3_extracted: list[dict[str, Any]],
    q3_reference: list[dict[str, Any]],
    bmp: dict[str, Any],
    bft: dict[str, Any],
    extensionless: dict[str, Any],
    gf: dict[str, Any],
    mct: dict[str, Any],
    extra: dict[str, Any],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    a = lines.append
    a(f"# {BUILD_LABEL} extracted-tree inventory")
    a("")
    a(f"Observed on the private `{OBSERVED_ON}` runner against Community Edition 2.670 (no 2.679 patch).")
    a("This document is metadata only: paths, sizes, hashes, counts, header names, and aggregate stats.")
    a("It contains no game data rows and no binary payloads.")
    a("")
    a(f"- Generated (UTC): `{extra.get('generatedAt')}`")
    a(f"- Extracted tree: `{extra.get('extractedRoot')}`")
    a(f"- Reference tree: `{extra.get('referenceRoot')}`")
    a(f"- Manifest: `{extra.get('manifestPath')}`")
    a(f"- Files: {summary['fileCount']}")
    a(f"- Total bytes: {summary['totalBytes']}")
    a("")
    a("## Manifest cross-check")
    a("")
    a(f"- Manifest entries: {cross.get('manifestEntries')}")
    a(f"- Missing on disk: {cross.get('missingOnDisk')}")
    a(f"- Size mismatches: {cross.get('sizeMismatches')}")
    a(f"- Extra on disk (not in manifest, excluding manifest.json): {cross.get('extraOnDisk')}")
    a("")
    a("## Counts by extension")
    a("")
    a("| Extension | Count | Total bytes |")
    a("| --- | ---: | ---: |")
    for ext, bucket in summary["byExtension"].items():
        a(f"| `{_md_escape(ext)}` | {bucket['count']} | {bucket['bytes']} |")
    a("")
    a("## Counts by top-level folder")
    a("")
    a("| Folder | Count | Total bytes |")
    a("| --- | ---: | ---: |")
    for folder, bucket in summary["byTopLevelFolder"].items():
        a(f"| `{_md_escape(folder)}` | {bucket['count']} | {bucket['bytes']} |")
    a("")
    a("## README structure (`/srv/sfc2/README.md`)")
    a("")
    if not readme.get("present"):
        a("README was not present at the expected path.")
    else:
        a(f"- Size: {readme.get('size')} bytes")
        a("- Headings:")
        for h in readme.get("headings") or []:
            a(f"  - L{h['level']}: {h['title']}")
        a("- Mentioned `/srv/sfc2/` paths:")
        for pth in readme.get("mentionedPaths") or []:
            a(f"  - `{pth}`")
    a("")
    a("## Notable locations")
    a("")
    for group, entries in interesting.items():
        a(f"### {group}")
        a("")
        a(f"{len(entries)} path(s).")
        a("")
        if group in {"textures", "audio", "models"} and len(entries) > 30:
            folder_c: Counter[str] = Counter()
            for e in entries:
                folder_c[str(Path(e["path"]).parent).replace("\\", "/")] += 1
            a("By folder (path and count only):")
            a("")
            a("| Folder | Count |")
            a("| --- | ---: |")
            for folder, n in folder_c.most_common():
                a(f"| `{_md_escape(folder)}` | {n} |")
            a("")
            a("First 10 paths:")
            a("")
            a("| Path | Size | sha256 |")
            a("| --- | ---: | --- |")
            for e in entries[:10]:
                a(f"| `{_md_escape(e['path'])}` | {e['size']} | `{e['sha256'] or ''}` |")
            a("")
            continue
        a("| Path | Size | sha256 |")
        a("| --- | ---: | --- |")
        for e in entries:
            a(f"| `{_md_escape(e['path'])}` | {e['size']} | `{e['sha256'] or ''}` |")
        a("")
    a("## `*.q3` archives")
    a("")
    a(f"- Extracted tree: {len(q3_extracted)} file(s)")
    _write_q3_md(a, q3_extracted)
    a(f"- Reference tree: {len(q3_reference)} file(s)")
    _write_q3_md(a, q3_reference)
    if not q3_extracted and not q3_reference:
        a("- No `*.q3` file was found in either tree. GUI art, if present, is listed under BMP folders below.")
    a("")
    a("## GUI / non-model BMP folders")
    a("")
    a(
        f"Total BMPs: {bmp.get('bmpCount')}. In a `models` folder: {bmp.get('modelFolderBmpCount')}. "
        f"Outside `models`: {bmp.get('nonModelBmpCount')}."
    )
    a("")
    a("| Folder | BMP count |")
    a("| --- | ---: |")
    for e in bmp.get("guiOrNonModelFolders") or []:
        a(f"| `{_md_escape(e['path'])}` | {e['count']} |")
    a("")
    a("### Self-illumination naming patterns")
    a("")
    pats = bmp.get("selfIlluminationPatterns") or {}
    if not pats:
        a("No BMP file names matched the known self-illumination suffix patterns (`_i`, `_illum`, `_glow`, `_si`, and similar).")
        a("Underscore/hyphen suffixes observed (pattern + count only) are listed in `observations-ce-2.670.json`.")
    else:
        a("| Pattern | Count |")
        a("| --- | ---: |")
        for pat, n in pats.items():
            a(f"| `{_md_escape(str(pat))}` | {n} |")
    a("")
    pairs = bmp.get("illumPairs") or {}
    a("### BMP `_<n>i` self-illumination pairs (header only, no pixel reads)")
    a("")
    a(f"- Illum files matching `_<n>i`: {pairs.get('illumCount', 0)}")
    a(f"- Paired with a base texture (`_<n>`): {pairs.get('pairedCount', 0)}")
    a(f"- Missing base: {pairs.get('missingBaseCount', 0)}")
    a(f"- Unreadable BMP header: {pairs.get('unreadableHeaderCount', 0)}")
    a(f"- Bit-depth matches: {pairs.get('depthMatches', 0)}; differs: {pairs.get('depthDiffers', 0)}")
    a(f"- Width/height matches: {pairs.get('dimensionMatches', 0)}; differs: {pairs.get('dimensionDiffers', 0)}")
    if pairs.get("bitCountHistogram"):
        a("- Illum `biBitCount` histogram: " + ", ".join(f"{k}={v}" for k, v in pairs["bitCountHistogram"].items()))
    a("")
    if pairs.get("differingPairs"):
        a("Pairs whose `biBitCount` differs (path and header fields only):")
        a("")
        a("| Illum | Base | Illum bitCount | Base bitCount | Illum WxH | Base WxH | Compression |")
        a("| --- | --- | ---: | ---: | --- | --- | --- |")
        for p in pairs["differingPairs"]:
            ih, bh = p["illum"], p["base"]
            a(
                f"| `{_md_escape(p['illumPath'])}` | `{_md_escape(p['basePath'])}` | "
                f"{ih['bitCount']} | {bh['bitCount']} | {ih['width']}x{ih['height']} | "
                f"{bh['width']}x{bh['height']} | {ih.get('compressionName')}/{bh.get('compressionName')} |"
            )
        a("")
    a("## `.bft` files (path and size only)")
    a("")
    a(f"Count: {bft.get('count')}. {bft.get('note')}")
    a("")
    for folder in bft.get("folders") or []:
        a(f"### `{folder['path']}` ({folder['count']} files)")
        a("")
        a("| Path | Size | sha256 |")
        a("| --- | ---: | --- |")
        for e in folder["files"]:
            a(f"| `{_md_escape(e['path'])}` | {e['size']} | `{e['sha256'] or ''}` |")
        a("")
    a("## Extensionless files (weapon-group table candidates)")
    a("")
    a(
        f"- Count: {extensionless.get('count')} "
        f"(text={extensionless.get('textCount')}, binary={extensionless.get('binaryCount')})"
    )
    pp = extensionless.get("pathPattern") or {}
    a(f"- Common directory: `{pp.get('commonDirectory')}`")
    a(f"- File-name pattern: {pp.get('fileNamePattern')}")
    sz = extensionless.get("sizes") or {}
    if sz:
        a(f"- Sizes: min={sz.get('min')} max={sz.get('max')} total={sz.get('total')} mean={sz.get('mean')}")
    a(f"- Headers shared across tables: {extensionless.get('headersSharedAcrossTables')}")
    a("")
    for layout in extensionless.get("distinctHeaderLayouts") or []:
        names = ", ".join(f"`{h}`" for h in layout["headerNames"])
        a(f"- Layout used by {layout['fileCount']} file(s), {layout['columnCount']} columns. Header names: {names}")
    if not extensionless.get("distinctHeaderLayouts"):
        a("- No column-header row was identified in these files (none invented).")
    a("")
    if extensionless.get("columnLayouts"):
        a("Column-count layouts (including files with no header):")
        a("")
        a("| Header? | Delimiter | Columns | Data cols min | Data cols max | Files |")
        a("| --- | --- | ---: | ---: | ---: | ---: |")
        for layout in extensionless["columnLayouts"]:
            a(
                f"| {layout.get('headerIdentified')} | `{layout.get('delimiter')}` | "
                f"{layout.get('columnCount')} | {layout.get('dataColumnCountMin')} | "
                f"{layout.get('dataColumnCountMax')} | {layout.get('fileCount')} |"
            )
        a("")
    a("## `.gf` structure")
    a("")
    _write_probe_md(a, gf)
    a("## `.mct` structure")
    a("")
    _write_probe_md(a, mct)
    a("")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_probe_md(a, probe: dict[str, Any]) -> None:
    a(f"- Count: {probe.get('count')} (text={probe.get('textCount')}, binary={probe.get('binaryCount')})")
    coords = probe.get("coordinates") or {}
    if coords.get("parseable"):
        a(f"- Largest absolute coordinate: `{coords.get('largestAbsolute')}` (source: `{coords.get('largestAbsolutePath')}`)")
        a(
            f"- Smallest nonzero distance/coordinate step: `{coords.get('smallestNonzeroStep')}` "
            f"(source: `{coords.get('smallestNonzeroStepPath')}`)"
        )
    else:
        a("- Coordinates: not determinable")
    a("")
    a("| Path | Size | Kind | Magic (hex) | Headers | Coords parseable |")
    a("| --- | ---: | --- | --- | --- | --- |")
    for rec in probe.get("files") or []:
        headers = ", ".join(rec.get("headerNames") or [])
        a(
            f"| `{_md_escape(rec['path'])}` | {rec['size']} | {rec['kind']} | "
            f"`{rec.get('magicHex','')}` | {_md_escape(headers)} | {rec.get('coordinatesParseable')} |"
        )
    a("")


def write_missions_markdown(path: Path, grouped: dict[str, Any], extra: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    a = lines.append
    a(f"# {BUILD_LABEL} mission and campaign files")
    a("")
    a(f"Observed on `{OBSERVED_ON}`. Grouped `.scr`, `.mct` and `.gf` paths for the Mission & Campaign Designer.")
    a("Metadata only: names, folder paths, sizes, sha256. No module contents.")
    a("")
    a(f"- Generated (UTC): `{extra.get('generatedAt')}`")
    a(f"- Files: {grouped.get('fileCount')} in {grouped.get('folderCount')} folder(s)")
    a("")
    for g in grouped.get("groups") or []:
        empire = g.get("inferredEmpireOrCampaign") or "unspecified"
        a(f"## `{g['folder']}`")
        a("")
        a(f"- Inferred empire/campaign from path: **{empire}**")
        counts = g.get("counts") or {}
        a("- Counts: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        a("")
        a("| Name | Size | sha256 | Extension |")
        a("| --- | ---: | --- | --- |")
        for f in g.get("files") or []:
            a(f"| `{_md_escape(f['name'])}` | {f['size']} | `{f['sha256'] or ''}` | `{f['extension']}` |")
        a("")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_verify_markdown(
    path: Path,
    shiplist: SpecVerification,
    ftrlist: SpecVerification,
    bft: dict[str, Any],
    q3_extracted: list[dict[str, Any]],
    q3_reference: list[dict[str, Any]],
    extra: dict[str, Any],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    a = lines.append
    a(f"# {BUILD_LABEL} shiplist / ftrlist verification")
    a("")
    a(f"Observed on `{OBSERVED_ON}`. Metadata only: no data rows.")
    a("")
    a(f"- Generated (UTC): `{extra.get('generatedAt')}`")
    a("")
    _write_spec_md(a, "shiplist", shiplist)
    _write_spec_md(a, "ftrlist", ftrlist)
    a("## GUI art: `*.q3` and `.bft`")
    a("")
    a(f"- `*.q3` in extracted tree: {len(q3_extracted)}")
    _write_q3_md(a, q3_extracted)
    a(f"- `*.q3` in reference tree: {len(q3_reference)}")
    _write_q3_md(a, q3_reference)
    if not q3_extracted and not q3_reference:
        a("- No `*.q3` archive exists in either tree.")
    a(f"- `.bft` files: {bft.get('count')} (path and size only).")
    a("")
    for folder in bft.get("folders") or []:
        a(f"### `.bft` folder `{folder['path']}`")
        a("")
        a("| Path | Size | sha256 |")
        a("| --- | ---: | --- |")
        for e in folder["files"]:
            a(f"| `{_md_escape(e['path'])}` | {e['size']} | `{e['sha256'] or ''}` |")
        a("")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_spec_md(a, label: str, spec: SpecVerification) -> None:
    a(f"## {label}")
    a("")
    if spec.sourcePath:
        a(f"- Source copy (Assets/Specs preferred over MetaAssets): `{_md_escape(spec.sourcePath)}`")
        a("")
    a(f"### Copies ({len(spec.copies)})")
    a("")
    a("| Path | Size | sha256 |")
    a("| --- | ---: | --- |")
    for c in spec.copies:
        a(f"| `{_md_escape(c['path'])}` | {c['size']} | `{c['sha256']}` |")
    hashes = {c["sha256"] for c in spec.copies}
    if len(spec.copies) > 1:
        a("")
        a(f"Copies identical: **{len(hashes) == 1}** ({len(hashes)} distinct hash(es)).")
    a("")
    t = spec.table or {}
    a("### Encoding and layout")
    a("")
    a(f"- Encoding: `{t.get('encoding')}` (BOM: {t.get('hasBom')})")
    a(f"- Line endings: `{t.get('lineEndings')}`")
    a(f"- Delimiter: `{t.get('delimiter')}`")
    a(f"- Header line (1-based): {t.get('headerLine')}")
    a(f"- Header row count: {t.get('headerRowCount')}")
    a(f"- Column count: {t.get('columnCount')}")
    a(f"- Data row count: {t.get('rowCount')}")
    a("- Header names:")
    a("")
    for name in t.get("headerNames") or []:
        a(f"  - `{name}`")
    a("")
    a("### Uniqueness (`race` + short class name)")
    a("")
    u = spec.uniqueness
    a(f"- Key form: `{u.get('keyForm')}` (comparison: {u.get('comparison')})")
    a(f"- Columns found: {u.get('columnsFound')}")
    a(f"- Key count: {u.get('keyCount')}")
    a(f"- Unique: {u.get('unique')}")
    a(f"- Duplicate key count: {u.get('duplicateKeyCount')}")
    a(f"- Duplicate class-name count: {u.get('duplicateClassNameCount')}")
    a("")
    if u.get("duplicateKeys"):
        a("Duplicate keys (keys and row numbers only):")
        a("")
        a("| Key | race | className | rows |")
        a("| --- | --- | --- | --- |")
        for k in u["duplicateKeys"]:
            a(
                f"| `{_md_escape(k['key'])}` | `{_md_escape(k['race'])}` | "
                f"`{_md_escape(k['className'])}` | {k['rows']} |"
            )
        a("")
    if u.get("duplicateClassNames"):
        a("Duplicate class names (names and row numbers only):")
        a("")
        a("| className | rows |")
        a("| --- | --- |")
        for k in u["duplicateClassNames"]:
            a(f"| `{_md_escape(k['className'])}` | {k['rows']} |")
        a("")
    if spec.diagnostics:
        a("Diagnostics use a flat camelCase `code` plus a separate `source` naming the format:")
        a("")
        for d in spec.diagnostics:
            a(
                f"- `code={d['code']}` `source={d['source']}` `severity={d['severity']}` "
                f"details=`{json.dumps(d.get('details') or {}, ensure_ascii=True)}`"
            )
        a("")
    a("### Fighters and PFs")
    a("")
    fpf = spec.fightersAndPfs
    a(f"- Fighters present: {fpf.get('fightersPresent')} (row count: {fpf.get('fighterRowCount')})")
    a(f"- Fighter hull tokens: {', '.join(f'`{t}`' for t in fpf.get('fighterHullTokens') or []) or '(none)'}")
    a(f"- PFs present: {fpf.get('pfsPresent')} (row count: {fpf.get('pfRowCount')})")
    a(f"- PF hull tokens: {', '.join(f'`{t}`' for t in fpf.get('pfHullTokens') or []) or '(none)'}")
    a("")
    a("### Distinct race and hull tokens (vocabulary)")
    a("")
    a("- Races: " + ", ".join(f"`{t}`" for t in spec.raceTokens))
    a("- Hull types: " + ", ".join(f"`{t}`" for t in spec.hullTokens))
    a("")
    if spec.raceRowCounts:
        a("Race column values (row counts):")
        a("")
        a("| Race | Rows |")
        a("| --- | ---: |")
        for item in spec.raceRowCounts:
            a(f"| `{_md_escape(str(item['race']))}` | {item['rows']} |")
        a("")
    if spec.numericColumnStats:
        a("### Numeric column stats (private-run artifact only; do not commit)")
        a("")
        a("Min, max and maximum decimal places for columns whose nonempty cells are all numeric. No per-row values.")
        a("")
        a("| Column | Index | Min | Max | Max decimal places | Numeric rows | Empty rows |")
        a("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
        for item in spec.numericColumnStats:
            a(
                f"| `{_md_escape(str(item['column']))}` | {item['columnIndex']} | "
                f"{item['min']} | {item['max']} | {item['maxDecimalPlaces']} | "
                f"{item['numericRowCount']} | {item['emptyRowCount']} |"
            )
        a("")
    if label == "shiplist" or spec.weaponCodes or spec.arcCodes:
        a("### Weapon and arc codes (vocabulary, with row counts)")
        a("")
        a("Empty cells are omitted. `rows` is the number of data rows that use the code at least once; `occurrences` is the number of filled slot cells.")
        a("")
        a("Weapon codes:")
        a("")
        a("| Code | Rows | Occurrences | Rows 1–10 | Occ. 1–10 | Rows 11–25 | Occ. 11–25 |")
        a("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
        for item in spec.weaponCodes:
            s1 = item.get("slots1to10") or {}
            s2 = item.get("slots11to25") or {}
            a(
                f"| `{_md_escape(item['code'])}` | {item['rows']} | {item['occurrences']} | "
                f"{s1.get('rows', 0)} | {s1.get('occurrences', 0)} | "
                f"{s2.get('rows', 0)} | {s2.get('occurrences', 0)} |"
            )
        if not spec.weaponCodes:
            a("| *(none identified)* | | | | | | |")
        a("")
        a("Arc codes:")
        a("")
        a("| Code | Rows | Occurrences | Rows 1–10 | Occ. 1–10 | Rows 11–25 | Occ. 11–25 |")
        a("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
        for item in spec.arcCodes:
            s1 = item.get("slots1to10") or {}
            s2 = item.get("slots11to25") or {}
            a(
                f"| `{_md_escape(item['code'])}` | {item['rows']} | {item['occurrences']} | "
                f"{s1.get('rows', 0)} | {s1.get('occurrences', 0)} | "
                f"{s2.get('rows', 0)} | {s2.get('occurrences', 0)} |"
            )
        if not spec.arcCodes:
            a("| *(none identified)* | | | | | | |")
        a("")
        a("Slot ranges 1–10 and 11–25 use a numeric suffix on the header when present, otherwise the slot of the paired weapon column (`Num` / `Heavy Weapon N` or `Weapon N` / `Arc`).")
        a("")
        if spec.numericArcCodeSources:
            a("Numeric arc codes `1`, `2`, `3` (per-column sources; used to check Num/Arc pairing):")
            a("")
            a("| Code | Column index | Header | Slot | Rows | Occurrences |")
            a("| --- | ---: | --- | ---: | ---: | ---: |")
            for rec in spec.numericArcCodeSources:
                if not rec.get("columns"):
                    a(f"| `{_md_escape(str(rec['code']))}` | — | *(not observed)* | | {rec.get('rows', 0)} | {rec.get('occurrences', 0)} |")
                    continue
                for col in rec["columns"]:
                    slot = col.get("slot")
                    slot_s = "" if slot is None else str(slot)
                    a(
                        f"| `{_md_escape(str(rec['code']))}` | {col['columnIndex']} | "
                        f"`{_md_escape(str(col['headerName']))}` | {slot_s} | "
                        f"{col['rows']} | {col['occurrences']} |"
                    )
            a("")
        if spec.heavyWeaponSlotArcs:
            a("Per-slot arc counts for weapon slots 1–10 (after Num/Arc pairing):")
            a("")
            a("| Slot | Weapon column | Weapon header | Arc column | Arc header | Arc code | Rows | Occurrences |")
            a("| ---: | ---: | --- | ---: | --- | --- | ---: | ---: |")
            for rec in spec.heavyWeaponSlotArcs:
                wname = rec.get("weaponColumnName") or ""
                aname = rec.get("arcColumnName") or ""
                aidx = rec.get("arcColumnIndex")
                aidx_s = "" if aidx is None else str(aidx)
                codes = rec.get("codes") or []
                if not codes:
                    a(
                        f"| {rec['slot']} | {rec['weaponColumnIndex']} | `{_md_escape(str(wname))}` | "
                        f"{aidx_s} | `{_md_escape(str(aname))}` | *(none)* | | |"
                    )
                    continue
                for c in codes:
                    a(
                        f"| {rec['slot']} | {rec['weaponColumnIndex']} | `{_md_escape(str(wname))}` | "
                        f"{aidx_s} | `{_md_escape(str(aname))}` | `{_md_escape(str(c['code']))}` | "
                        f"{c['rows']} | {c['occurrences']} |"
                    )
            a("")
        pairings = spec.numericArcWeaponPairings or {}
        if pairings:
            a("Numeric arc values paired with the weapon code in the same slot (counts only; no ship names):")
            a("")
            only = pairings.get("pairsOnlyWithDroneOrAdd")
            a(
                f"- Numeric arcs pair only with `Dro*` / `ADD6` / `ADD12`: "
                f"{'yes' if only else 'no'}"
            )
            a("")
            a("By numeric arc value:")
            a("")
            a("| Arc code | Weapon code | Dro*/ADD | Rows | Occurrences | Rows 1–10 | Occ. 1–10 | Rows 11–25 | Occ. 11–25 |")
            a("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
            for rec in pairings.get("byNumericArc") or []:
                weapons = rec.get("weapons") or []
                if not weapons:
                    a(f"| `{_md_escape(str(rec['arcCode']))}` | *(none)* | | {rec.get('rows', 0)} | {rec.get('occurrences', 0)} | | | | |")
                    continue
                for w in weapons:
                    s1 = w.get("slots1to10") or {}
                    s2 = w.get("slots11to25") or {}
                    a(
                        f"| `{_md_escape(str(rec['arcCode']))}` | `{_md_escape(str(w['weaponCode']))}` | "
                        f"{'yes' if w.get('droneOrAdd') else 'no'} | {w['rows']} | {w['occurrences']} | "
                        f"{s1.get('rows', 0)} | {s1.get('occurrences', 0)} | "
                        f"{s2.get('rows', 0)} | {s2.get('occurrences', 0)} |"
                    )
            a("")
            if pairings.get("bySlot"):
                a("By slot:")
                a("")
                a("| Slot | Arc code | Weapon code | Dro*/ADD | Rows | Occurrences |")
                a("| ---: | --- | --- | --- | ---: | ---: |")
                for rec in pairings["bySlot"]:
                    for pr in rec.get("pairs") or []:
                        a(
                            f"| {rec['slot']} | `{_md_escape(str(pr['arcCode']))}` | "
                            f"`{_md_escape(str(pr['weaponCode']))}` | "
                            f"{'yes' if pr.get('droneOrAdd') else 'no'} | {pr['rows']} | {pr['occurrences']} |"
                        )
                a("")
            others = pairings.get("nonDroneOrAddPairings") or []
            a("Numeric-arc pairings that are **not** `Dro*` / `ADD6` / `ADD12`:")
            a("")
            if not others:
                a("None observed.")
                a("")
            else:
                a("| Arc code | Weapon code | Rows | Occurrences | Slots (slot: rows/occ) |")
                a("| --- | --- | ---: | ---: | --- |")
                for pr in others:
                    slot_s = ", ".join(
                        f"{s['slot']}: {s['rows']}/{s['occurrences']}" for s in (pr.get("slots") or [])
                    )
                    a(
                        f"| `{_md_escape(str(pr['arcCode']))}` | `{_md_escape(str(pr['weaponCode']))}` | "
                        f"{pr['rows']} | {pr['occurrences']} | {_md_escape(slot_s)} |"
                    )
                a("")
            kinds = pairings.get("droneAddArcKinds") or {}
            if kinds:
                tot = kinds.get("filledOrEmptySlots") or {}
                num = kinds.get("numericArc") or {}
                let = kinds.get("letterArc") or {}
                emp = kinds.get("emptyArc") or {}
                a("Converse: slots whose weapon code is `Dro*` / `ADD6` / `ADD12`, by arc kind:")
                a("")
                a(
                    "- Weapon codes: "
                    + (", ".join(f"`{_md_escape(c)}`" for c in (kinds.get("weaponCodes") or [])) or "(none)")
                )
                a(f"- Total such slot cells: rows={tot.get('rows', 0)}, occurrences={tot.get('occurrences', 0)}")
                a(f"- Numeric arc: rows={num.get('rows', 0)}, occurrences={num.get('occurrences', 0)}")
                a(f"- Letter arc: rows={let.get('rows', 0)}, occurrences={let.get('occurrences', 0)}")
                a(f"- Empty arc: rows={emp.get('rows', 0)}, occurrences={emp.get('occurrences', 0)}")
                a("")
                a("| Kind | Arc code | Rows | Occurrences |")
                a("| --- | --- | ---: | ---: |")
                for kind_name, block in (("numeric", num), ("letter", let)):
                    for c in block.get("arcCodes") or []:
                        a(
                            f"| {kind_name} | `{_md_escape(str(c['code']))}` | {c['rows']} | {c['occurrences']} |"
                        )
                a("")
    a("### Column selection")
    a("")
    a("```json")
    a(json.dumps(spec.columnSelection, indent=2, ensure_ascii=True))
    a("```")
    a("")

def _common_option_parser() -> argparse.ArgumentParser:
    """Shared flags for every subcommand.

    They are attached to the subparsers, not the top-level parser, so the
    command lines used by .github/workflows/private-inventory.yml work:

        inventory.py inventory --extracted ... --reference ... --manifest ... --readme ... --output-dir ...
        inventory.py verify    --extracted ... --reference ... --manifest ... --output-dir ...
    """
    p = argparse.ArgumentParser(add_help=False)
    p.add_argument("--extracted", type=Path, default=DEFAULT_EXTRACTED, help="Extracted tree root")
    p.add_argument("--reference", type=Path, default=DEFAULT_REFERENCE, help="Read-only reference install root")
    p.add_argument("--manifest", type=Path, default=None, help="manifest.json (default: <extracted>/manifest.json)")
    p.add_argument("--readme", type=Path, default=DEFAULT_README, help="Wintermute /srv/sfc2/README.md")
    p.add_argument(
        "--output-dir",
        type=Path,
        default=Path("docs/formats/inventory"),
        help="Where to write metadata files",
    )
    return p


def build_parser() -> argparse.ArgumentParser:
    common = _common_option_parser()
    p = argparse.ArgumentParser(
        description=(
            "CE 2.670 inventory and shiplist/ftrlist verification (metadata only). "
            "Pass options after the subcommand, matching the private-inventory workflow."
        )
    )
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("inventory", parents=[common], help="Job A: inventory + locations + missions + probes")
    sub.add_parser("verify", parents=[common], help="Job B: shiplist/ftrlist verification")
    sub.add_parser("all", parents=[common], help="Run inventory and verify")
    return p


def resolve_files(args: argparse.Namespace, log: MetadataLog) -> tuple[Path, Path, list[FileMeta], dict[str, Any]]:
    extracted = args.extracted
    manifest_path = args.manifest or (extracted / "manifest.json")
    files = load_manifest(manifest_path, extracted, log)
    cross = cross_check_manifest(files, extracted, log)
    return extracted, manifest_path, files, cross


def locate_named(files: Sequence[FileMeta], extracted: Path, filename: str) -> list[tuple[Path, FileMeta]]:
    want = filename.casefold()
    found: list[tuple[Path, FileMeta]] = []
    for f in files:
        if Path(f.path).name.casefold() == want:
            found.append((extracted / f.path, f))
    seen = {relpath(p, extracted).lower() for p, _ in found}
    for p in _walk_files(extracted):
        if p.name.casefold() == want:
            rel = relpath(p, extracted)
            if rel.lower() not in seen:
                found.append((p, FileMeta(path=rel, size=p.stat().st_size, sha256=file_sha256(p))))
                seen.add(rel.lower())
    found.sort(key=lambda pair: pair[1].path.lower())
    return found


def cmd_inventory(args: argparse.Namespace, log: MetadataLog) -> int:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    extracted, manifest_path, files, cross = resolve_files(args, log)
    summary = summarize_files(files)
    log.info(f"inventory files={summary['fileCount']} totalBytes={summary['totalBytes']}")
    for ext, bucket in summary["byExtension"].items():
        log.info(f"extension {ext}: count={bucket['count']} bytes={bucket['bytes']}")
    for folder, bucket in summary["byTopLevelFolder"].items():
        log.info(f"top-level folder {folder}: count={bucket['count']} bytes={bucket['bytes']}")

    interesting = locate_interesting(files)
    for group, entries in interesting.items():
        log.info(f"location group {group}: count={len(entries)}")

    readme = parse_readme_structure(args.readme, log)
    q3_ex = find_q3(extracted, log, "extracted")
    q3_ref = find_q3(args.reference, log, "reference")
    bmp = bmp_patterns(files, log, extracted)
    bft = bft_report(files, log)
    extensionless_meta = interesting.get("extensionless") or []
    extensionless = inspect_extensionless_tables(
        [FileMeta(e["path"], e["size"], e["sha256"]) for e in extensionless_meta],
        extracted,
        log,
    )
    gf = probe_map_files(
        [FileMeta(e["path"], e["size"], e["sha256"]) for e in (interesting.get("gf") or [])],
        extracted,
        log,
        ".gf",
    )
    mct = probe_map_files(
        [FileMeta(e["path"], e["size"], e["sha256"]) for e in (interesting.get("mct") or [])],
        extracted,
        log,
        ".mct",
    )
    missions = group_mission_files(files, log)

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    extra = {
        "generatedAt": generated_at,
        "extractedRoot": extracted.as_posix(),
        "referenceRoot": args.reference.as_posix(),
        "manifestPath": manifest_path.as_posix(),
    }
    inv = compact_inventory_json(files, extra)
    inv_path = out / "ce-2.670.json"
    write_json(inv_path, inv)
    inv_size = inv_path.stat().st_size
    log.info(f"wrote {inv_path.as_posix()} bytes={inv_size} under1MiB={inv_size <= 1048576}")
    if inv_size > 1048576:
        log.info(
            "note: ce-2.670.json exceeds the 1 MiB no-game-files size limit; "
            "keep it as a workflow artifact unless a size-only allowlist entry is agreed"
        )

    write_inventory_markdown(
        out / "ce-2.670.md",
        summary,
        interesting,
        readme,
        cross,
        q3_ex,
        q3_ref,
        bmp,
        bft,
        extensionless,
        gf,
        mct,
        extra,
    )
    log.info(f"wrote {(out / 'ce-2.670.md').as_posix()}")
    write_missions_markdown(out / "missions-ce-2.670.md", missions, extra)
    log.info(f"wrote {(out / 'missions-ce-2.670.md').as_posix()}")

    observations = {
        "schemaVersion": 1,
        "build": BUILD_LABEL,
        "observedOn": OBSERVED_ON,
        **extra,
        "summary": summary,
        "manifestCrossCheck": cross,
        "readmeStructure": readme,
        "q3": {"extracted": q3_ex, "reference": q3_ref},
        "bmp": bmp,
        "bft": bft,
        "extensionless": extensionless,
        "gf": gf,
        "mct": mct,
        "missions": missions,
    }
    write_json(out / "observations-ce-2.670.json", observations)
    log.info(f"wrote {(out / 'observations-ce-2.670.json').as_posix()}")
    return 0


def _spec_to_dict(spec: SpecVerification) -> dict[str, Any]:
    return {
        "copies": spec.copies,
        "sourcePath": spec.sourcePath,
        "table": spec.table,
        "diagnostics": spec.diagnostics,
        "uniqueness": spec.uniqueness,
        "fightersAndPfs": spec.fightersAndPfs,
        "weaponCodes": spec.weaponCodes,
        "arcCodes": spec.arcCodes,
        "raceTokens": spec.raceTokens,
        "hullTokens": spec.hullTokens,
        "columnSelection": spec.columnSelection,
        "raceRowCounts": spec.raceRowCounts,
        "numericColumnStats": spec.numericColumnStats,
        "numericArcCodeSources": spec.numericArcCodeSources,
        "heavyWeaponSlotArcs": spec.heavyWeaponSlotArcs,
        "numericArcWeaponPairings": spec.numericArcWeaponPairings,
    }


def cmd_verify(args: argparse.Namespace, log: MetadataLog) -> int:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    extracted, manifest_path, files, _cross = resolve_files(args, log)
    shiplist_copies = locate_named(files, extracted, "shiplist.txt")
    ftrlist_copies = locate_named(files, extracted, "ftrlist.txt")
    log.info(f"shiplist copies found: {len(shiplist_copies)}")
    log.info(f"ftrlist copies found: {len(ftrlist_copies)}")
    shiplist = verify_spec_tables("shiplist", shiplist_copies, extracted, log)
    ftrlist = verify_spec_tables("ftrlist", ftrlist_copies, extracted, log)
    bft = bft_report(files, log)
    q3_ex = find_q3(extracted, log, "extracted")
    q3_ref = find_q3(args.reference, log, "reference")

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    extra = {
        "generatedAt": generated_at,
        "extractedRoot": extracted.as_posix(),
        "referenceRoot": args.reference.as_posix(),
        "manifestPath": manifest_path.as_posix(),
    }
    payload = {
        "schemaVersion": 1,
        "build": BUILD_LABEL,
        "observedOn": OBSERVED_ON,
        **extra,
        "shiplist": _spec_to_dict(shiplist),
        "ftrlist": _spec_to_dict(ftrlist),
        "bft": bft,
        "q3": {"extracted": q3_ex, "reference": q3_ref},
    }
    write_json(out / "shiplist-ftrlist-ce-2.670.json", payload)
    log.info(f"wrote {(out / 'shiplist-ftrlist-ce-2.670.json').as_posix()}")
    write_verify_markdown(
        out / "shiplist-ftrlist-ce-2.670.md",
        shiplist,
        ftrlist,
        bft,
        q3_ex,
        q3_ref,
        extra,
    )
    log.info(f"wrote {(out / 'shiplist-ftrlist-ce-2.670.md').as_posix()}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    log = MetadataLog()
    if not args.extracted.exists():
        log.info(f"error: extracted tree not found: {args.extracted.as_posix()}")
        return 2
    if args.command == "inventory":
        return cmd_inventory(args, log)
    if args.command == "verify":
        return cmd_verify(args, log)
    if args.command == "all":
        rc = cmd_inventory(args, log)
        if rc != 0:
            return rc
        return cmd_verify(args, log)
    return 2


if __name__ == "__main__":
    sys.exit(main())
