#!/usr/bin/env bash
# p2_hc_battle.sh <n>: Federation F-CA (default skirmish ship) vs one Klingon AI, hull class Heavy Cruiser
# (min=max), EARLY era, CAPTAIN skill. Overhead camera, enemy selected. Leaves the battle running.
#
# Environment:
#   CE_GAME_DIR     writable working copy of the install (see prepare_workcopy.sh)
#   CE_OUT_DIR      frames and per-run JSON output directory (default: ./out-c<n>)
#   CE_PREFIX       Wine prefix directory (default: ./prefix-c<n>)
#   CE_IMAGE        harness Docker image tag (default: sfc2-ce-harness:dev)
#   CE_CONTAINER    container name (default: ceh-c<n>)
#   CE_DOCKER_USER  optional uid:gid for the container user
set -euo pipefail
n=$1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME=${CE_GAME_DIR:?Set CE_GAME_DIR to a writable CE working copy (see prepare_workcopy.sh)}
OUT=${CE_OUT_DIR:-$PWD/out-c$n}
PFX=${CE_PREFIX:-$PWD/prefix-c$n}
IMG=${CE_IMAGE:-sfc2-ce-harness:dev}
C=${CE_CONTAINER:-ceh-c$n}
mkdir -p "$OUT" "$PFX"
D="docker exec -e DISPLAY=:99 $C"
o(){ $D bash -c "import -window root /tmp/f.png; convert /tmp/f.png -crop $1 +repage -resize 300% -separate -evaluate-sequence max -negate /tmp/o.png; tesseract /tmp/o.png - --psm 7 2>/dev/null"; }
docker rm -f "$C" >/dev/null 2>&1 || true
USER_ARGS=()
[[ -n "${CE_DOCKER_USER:-}" ]] && USER_ARGS=(--user "$CE_DOCKER_USER" -e HOME=/tmp)
docker run -d --rm --name "$C" -e WINEDEBUG=-all "${USER_ARGS[@]}" -e WINEPREFIX=/wineprefix \
  -v "$GAME":/game -v "$OUT":/out -v "$PFX":/wineprefix \
  -v "$HERE/session.sh":/session.sh:ro -v "$HERE":/h:ro "$IMG" /session.sh >/dev/null
sleep 25
for p in "350 315" "512 275" "768 502"; do $D xdotool mousemove $p click 1; sleep 2; done
# max hull: War Destroyer -> Heavy Cruiser (2 clicks); min hull: Frigate -> Heavy Cruiser (4 clicks)
for _ in 1 2; do $D xdotool mousemove 757 242 click 1 mousemove 900 700; sleep 0.4; done
for _ in 1 2 3 4; do $D xdotool mousemove 621 242 click 1 mousemove 900 700; sleep 0.4; done
for _ in 1 2 3 4; do e=$(o 76x16+425+519); case "$e" in *EARLY*) break;; esac; $D xdotool mousemove 541 527 click 1 mousemove 900 700; sleep 0.5; done
echo "c$n min=$(o 116x16+498+234) max=$(o 116x16+634+234) era=$(o 76x16+425+519) emp=$(o 96x16+517+256)"
$D xdotool mousemove 768 527 click 1; sleep 20
$D xdotool mousemove 612 740 key F1; sleep 2
$D xdotool key y; sleep 1
$D import -window root /out/p2hc-battle.png
echo "c$n hc-battle-ready"
