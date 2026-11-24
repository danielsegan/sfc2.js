#!/usr/bin/env bash
# Drive one repeatable CE 2.670 skirmish on the private VM and measure own-ship turns.
#
#   run_scenario.sh <fed|klingon> <label-prefix> <speed> [speed...]
#
# fed     -> own ship F-CA (the skirmish default for the Federation fleet)
# klingon -> own ship K-D7 (picked in the ship selector by on-screen OCR)
# The AI opponent is set to one Klingon frigate, LOW BPV, so the run lasts
# long enough to measure. Observation only: screenshots, xdotool input, OCR.
#
# Environment (defaults suit the sfc2-ci VM):
#   CE_GAME_DIR   writable working copy of the install (never the reference tree)
#   CE_OUT_DIR    frames, logs and per-run JSON (stays on the VM)
#   CE_PREFIX     Wine prefix directory
#   CE_IMAGE      harness image tag
#   CE_CONTAINER  container name
#   CE_DOCKER_USER  optional uid:gid for the container user
set -euo pipefail
side=$1; pre=$2; shift 2
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME=${CE_GAME_DIR:-/srv/sfc2/work/ce-2.670}
OUT=${CE_OUT_DIR:-$HOME/harness/out}
PFX=${CE_PREFIX:-$HOME/harness/prefix}
IMG=${CE_IMAGE:-sfc2-ce-harness:dev}
C=${CE_CONTAINER:-ceh}
mkdir -p "$OUT" "$PFX"
dx() { docker exec -e DISPLAY=:99 -e HUD="$side" "$C" "$@"; }
click() { dx xdotool mousemove "$1" "$2" click 1 mousemove 900 700; sleep "${3:-0.5}"; }
ocr() { dx bash -c "import -window root /tmp/f.png; convert /tmp/f.png -crop $1 +repage -resize 300% -colorspace gray -negate /tmp/o.png; tesseract /tmp/o.png - --psm 7 2>/dev/null"; }

docker rm -f "$C" >/dev/null 2>&1 || true
USER_ARGS=()
# CE_DOCKER_USER=uid:gid runs Wine as the calling user (CI runner); HOME then lives in /tmp.
[[ -n "${CE_DOCKER_USER:-}" ]] && USER_ARGS=(--user "$CE_DOCKER_USER" -e HOME=/tmp -e WINEPREFIX=/home/wineuser/.wine)
docker run -d --rm --name "$C" -e WINEDEBUG=-all "${USER_ARGS[@]}" \
  -v "$GAME":/game -v "$OUT":/out -v "$PFX":/home/wineuser/.wine \
  -v "$HERE/session.sh":/session.sh:ro -v "$HERE":/h:ro "$IMG" /session.sh >/dev/null
trap 'docker rm -f "$C" >/dev/null 2>&1 || true' EXIT
sleep 22
# Main menu -> Single Player -> Skirmish -> Customize (640x480 menus centred in 1024x768)
click 350 315 2; click 512 275 2; click 768 502 2
if [[ "$side" == klingon ]]; then
  click 306 242 1        # fleet race -> Klingon
  click 344 291 2        # SELECT ship
  for _ in $(seq 1 20); do
    d=$(ocr 150x14+676+193); echo "selector: $d"
    [[ "$d" == *"N: D7"* ]] && break
    click 448 480 1
  done
  click 797 582 2        # DONE
fi
for _ in 1 2 3 4 5 6 7 8; do click 757 242 0.4; done   # AI 1 max hull -> Frigate
for _ in 1 2 3; do click 817 242 0.4; done             # AI 1 BPV -> LOW
dx import -window root "/out/$pre-setup.png"
click 768 527 20                                       # PLAY GAME
dx xdotool key F1; sleep 2                             # overhead camera (north-up)
for s in "$@"; do dx python3 /h/capture_turn.py "$pre-s$s-port" "$s" port 12; done
dx import -window root "/out/$pre-end.png"
labels=(); for s in "$@"; do labels+=("$pre-s$s-port"); done
dx python3 /h/analyze_turn.py "${labels[@]}"
echo "scenario $pre done"
