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
import sys
from collections import Counter, defaultdict
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
    r"(^(wpn|weapon|weap|special|hardpoint|hp)(\s*|#|_|-)?\d+$)|"
    r"((wpn|weapon|weap|special)\s*(code|type|name)?(\s*|#|_|-)?\d+$)|"
    r"(^(wpn|weapon|weap)$)",
    re.IGNORECASE,
)
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


def inspect_table_file(path: Path, root: Path | None, digest: str | None = None) -> TableMeta:
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
    header_idx = None
    for i, line in enumerate(raw_lines):
        if line.strip():
            header_idx = i
            break
    if header_idx is None:
        return TableMeta(
            path=relpath(path, root),
            size=len(data),
            sha256=digest or _sha256_bytes(data),
            encoding=encoding,
            lineEndings=line_endings,
            delimiter="unknown",
            headerNames=[],
            columnCount=0,
            rowCount=0,
            headerLine=0,
            headerRowCount=0,
            hasBom=has_bom,
        )
    header_line = raw_lines[header_idx]
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
    return TableMeta(
        path=relpath(path, root),
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
    return {
        "method": method,
        "weaponColumns": weapon_cols,
        "arcColumns": arc_cols,
        "countColumns": count_cols,
        "weaponColumnNames": [headers[i] for i in weapon_cols],
        "arcColumnNames": [headers[i] for i in arc_cols],
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
        meta = inspect_table_file(path, root, digest=digest)
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
        uniqueness={"unique": None, "duplicateKeyCount": 0, "duplicateKeys": []},
        fightersAndPfs={},
        weaponCodes=[],
        arcCodes=[],
        raceTokens=[],
        hullTokens=[],
        columnSelection={},
    )
    if not tables:
        return empty

    meta, raw_lines, delimiter = texts[0]
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
    weapon_rows: dict[str, set[int]] = defaultdict(set)
    weapon_occ: Counter[str] = Counter()
    arc_rows: dict[str, set[int]] = defaultdict(set)
    arc_occ: Counter[str] = Counter()
    fighter_rows = 0
    pf_rows = 0

    for line_no, line in enumerate(raw_lines, start=1):
        if line_no <= meta.headerLine - 1 + meta.headerRowCount:
            continue
        if not line.strip():
            continue
        cells = split_line(line, delimiter)
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

        for ci in weapon_info["weaponColumns"]:
            val = _cell(cells, ci)
            if val:
                weapon_occ[val] += 1
                weapon_rows[val].add(line_no)
        for ci in weapon_info["arcColumns"]:
            val = _cell(cells, ci)
            if val:
                arc_occ[val] += 1
                arc_rows[val].add(line_no)

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

    uniqueness = {
        "keyForm": "${race}:${className}",
        "comparison": "case-insensitive",
        "columnsFound": race_idx is not None and class_idx is not None,
        "unique": (len(duplicate_keys) == 0) if (race_idx is not None and class_idx is not None) else None,
        "keyCount": len(key_rows),
        "duplicateKeyCount": len(duplicate_keys),
        "duplicateKeys": duplicate_keys,
    }
    log.info(
        f"{label} uniqueness: columnsFound={uniqueness['columnsFound']} "
        f"keyCount={uniqueness['keyCount']} duplicateKeyCount={uniqueness['duplicateKeyCount']} "
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

    weapon_codes = [
        {"code": code, "rows": len(weapon_rows[code]), "occurrences": weapon_occ[code]}
        for code in sorted(weapon_occ, key=lambda c: (-weapon_occ[c], c))
    ]
    arc_codes = [
        {"code": code, "rows": len(arc_rows[code]), "occurrences": arc_occ[code]}
        for code in sorted(arc_occ, key=lambda c: (-arc_occ[c], c))
    ]
    if weapon_info["weaponColumns"]:
        log.info(
            f"{label} distinct weapon codes: {len(weapon_codes)} "
            f"(column names: {json.dumps(weapon_info['weaponColumnNames'])})"
        )
        for item in weapon_codes:
            log.info(f"{label} weapon code {item['code']!s}: rows={item['rows']} occurrences={item['occurrences']}")
    else:
        log.info(f"{label} weapon columns: not identified from headers")
    if weapon_info["arcColumns"]:
        log.info(
            f"{label} distinct arc codes: {len(arc_codes)} "
            f"(column names: {json.dumps(weapon_info['arcColumnNames'])})"
        )
        for item in arc_codes:
            log.info(f"{label} arc code {item['code']!s}: rows={item['rows']} occurrences={item['occurrences']}")
    else:
        log.info(f"{label} arc columns: not identified from headers")

    log.info(f"{label} distinct race tokens ({len(race_tokens)}): {json.dumps(sorted(race_tokens))}")
    log.info(f"{label} distinct hull tokens ({len(hull_tokens)}): {json.dumps(sorted(hull_tokens))}")

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
            meta = inspect_table_file(path, extracted_root, digest=f.sha256)
            rec.update(
                {
                    "kind": "text-table" if meta.headerNames else "text",
                    "encoding": meta.encoding,
                    "lineEndings": meta.lineEndings,
                    "delimiter": meta.delimiter,
                    "headerNames": meta.headerNames,
                    "columnCount": meta.columnCount,
                    "rowCount": meta.rowCount,
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
        "files": [
            {
                "path": e["path"],
                "size": e["size"],
                "sha256": e["sha256"],
                "kind": e.get("kind"),
                "columnCount": e.get("columnCount"),
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

def find_q3(root: Path, log: MetadataLog, label: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if not root.exists():
        log.info(f"{label}: tree missing at {root.as_posix()}")
        return found
    for p in _walk_files(root):
        if p.suffix.lower() == ".q3" or p.name.lower().endswith(".q3"):
            found.append({"path": relpath(p, root), "size": p.stat().st_size, "sha256": file_sha256(p)})
    log.info(
        f"{label} *.q3 count={len(found)}"
        + ("" if not found else " paths=" + json.dumps([f["path"] for f in found]))
    )
    return found


def bmp_patterns(files: Sequence[FileMeta], log: MetadataLog) -> dict[str, Any]:
    bmps = [f for f in files if ext_of(f.path) == ".bmp"]
    by_folder: Counter[str] = Counter()
    suffix_counts: Counter[str] = Counter()
    illum_counts: Counter[str] = Counter()
    gui_folders: Counter[str] = Counter()
    model_folder_count = 0
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
    for e in q3_extracted:
        a(f"  - `{e['path']}` size={e['size']} sha256=`{e['sha256']}`")
    a(f"- Reference tree: {len(q3_reference)} file(s)")
    for e in q3_reference:
        a(f"  - `{e['path']}` size={e['size']} sha256=`{e['sha256']}`")
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
    a(f"- `*.q3` in reference tree: {len(q3_reference)}")
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
    if label == "shiplist" or spec.weaponCodes or spec.arcCodes:
        a("### Weapon and arc codes (vocabulary, with row counts)")
        a("")
        a("Empty cells are omitted. `rows` is the number of data rows that use the code at least once; `occurrences` is the number of filled slot cells.")
        a("")
        a("Weapon codes:")
        a("")
        a("| Code | Rows | Occurrences |")
        a("| --- | ---: | ---: |")
        for item in spec.weaponCodes:
            a(f"| `{_md_escape(item['code'])}` | {item['rows']} | {item['occurrences']} |")
        if not spec.weaponCodes:
            a("| *(none identified)* | | |")
        a("")
        a("Arc codes:")
        a("")
        a("| Code | Rows | Occurrences |")
        a("| --- | ---: | ---: |")
        for item in spec.arcCodes:
            a(f"| `{_md_escape(item['code'])}` | {item['rows']} | {item['occurrences']} |")
        if not spec.arcCodes:
            a("| *(none identified)* | | |")
        a("")
    a("### Column selection")
    a("")
    a("```json")
    a(json.dumps(spec.columnSelection, indent=2, ensure_ascii=True))
    a("```")
    a("")

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="CE 2.670 inventory and shiplist/ftrlist verification (metadata only)."
    )
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
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("inventory", help="Job A: inventory + locations + missions + probes")
    sub.add_parser("verify", help="Job B: shiplist/ftrlist verification")
    sub.add_parser("all", help="Run inventory and verify")
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
    bmp = bmp_patterns(files, log)
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
        "table": spec.table,
        "diagnostics": spec.diagnostics,
        "uniqueness": spec.uniqueness,
        "fightersAndPfs": spec.fightersAndPfs,
        "weaponCodes": spec.weaponCodes,
        "arcCodes": spec.arcCodes,
        "raceTokens": spec.raceTokens,
        "hullTokens": spec.hullTokens,
        "columnSelection": spec.columnSelection,
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
