#!/usr/bin/env bash
# Fail if tracked files look like original SFC2 game assets or are large
# binaries. This script is the source of truth for the blocked extension
# and path lists; extend the arrays below when we learn of more types.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ALLOWLIST_FILE="${ALLOWLIST_FILE:-tools/allowed-fixtures.txt}"
MAX_BYTES="${MAX_BYTES:-1048576}"

# Lowercase extensions without the dot.
FORBIDDEN_EXTENSIONS=(
  exe dll mod sprite mvm wav mp3 bik mpg mpeg tga bmp gf scs dat sav scr q3
  msi iso
)

# Path prefixes, matched case-insensitively against the start of a tracked
# path or any path segment prefix.
FORBIDDEN_PATH_PREFIXES=(
  assets/original/
  "starfleet command ii"
  "starfleet command 2"
  sfc2ce/
  sfc2/
  "empires at war"
)

usage() {
  cat <<'EOF'
Usage: tools/check-no-game-files.sh

Scans tracked files (git ls-files). Fails if any of the following is true
and the path is not listed in tools/allowed-fixtures.txt:

  - the file extension is a likely original SFC2 asset or installer type
  - the path looks like a game-install or assets/original/ location
  - the file is larger than 1 MB (1048576 bytes)

Environment:
  ALLOWLIST_FILE   override the allowlist path
  MAX_BYTES        override the large-file threshold
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: this check must run inside a git repository" >&2
  exit 2
fi

declare -A ALLOWED=()
if [[ -f "$ALLOWLIST_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    ALLOWED["$line"]=1
  done < "$ALLOWLIST_FILE"
fi

is_allowed() {
  [[ -n "${ALLOWED[$1]+x}" ]]
}

is_forbidden_path() {
  local path_lc="$1"
  local prefix prefix_lc
  for prefix in "${FORBIDDEN_PATH_PREFIXES[@]}"; do
    prefix_lc="$(printf '%s' "$prefix" | tr '[:upper:]' '[:lower:]')"
    if [[ "$path_lc" == "$prefix_lc"* ]]; then
      return 0
    fi
    if [[ "$path_lc" == *"/$prefix_lc"* ]]; then
      return 0
    fi
  done
  return 1
}

file_size() {
  local path="$1"
  if size="$(git cat-file -s ":$path" 2>/dev/null)"; then
    printf '%s' "$size"
    return 0
  fi
  if [[ -f "$path" ]]; then
    wc -c < "$path" | tr -d ' '
    return 0
  fi
  echo 0
}

violations=0
files=0

while IFS= read -r -d '' path; do
  files=$((files + 1))
  if is_allowed "$path"; then
    continue
  fi

  path_lc="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"
  ext=""
  base="${path_lc##*/}"
  if [[ "$base" == *.* ]]; then
    ext="${base##*.}"
  fi

  if [[ -n "$ext" ]]; then
    for forbidden in "${FORBIDDEN_EXTENSIONS[@]}"; do
      if [[ "$ext" == "$forbidden" ]]; then
        echo "FORBIDDEN EXTENSION: $path (.$ext)"
        violations=$((violations + 1))
        continue 2
      fi
    done
  fi

  if is_forbidden_path "$path_lc"; then
    echo "FORBIDDEN PATH: $path"
    violations=$((violations + 1))
    continue
  fi

  size="$(file_size "$path")"
  if [[ "$size" =~ ^[0-9]+$ ]] && (( size > MAX_BYTES )); then
    echo "LARGE BINARY: $path (${size} bytes; limit is ${MAX_BYTES})"
    violations=$((violations + 1))
  fi
done < <(git ls-files -z)

if (( violations > 0 )); then
  echo
  echo "error: $violations tracked file(s) look like original game assets or exceed ${MAX_BYTES} bytes."
  echo "Remove them, or if they are synthetic fixtures we created, add the path to ${ALLOWLIST_FILE}."
  echo "Original SFC2 files must never be committed. See docs/LEGAL.md."
  exit 1
fi

echo "OK: ${files} tracked file(s); no forbidden game files or large binaries."
