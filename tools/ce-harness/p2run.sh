#!/usr/bin/env bash
# p2run.sh <n> <race_clicks> <desig> <hud> <prefix>
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
n=$1; rc=$2; de=$3; hud=$4; pre=$5
C=${CE_CONTAINER:-ceh-c$n}
bash "$HERE/pbattle_hull.sh" "$n" "$rc" "$de" "$hud" || { echo SETUP-FAILED; exit 3; }
bash "$HERE/p2_turns.sh" "$n" "$hud" "$pre" 5:mouse_n:32 5:port:16 10:mouse_n:30 10:port:16 15:mouse_n:30 15:port:16 20:mouse_n:30 20:port:16 31:mouse_n:30 31:port:16
docker exec -e DISPLAY=:99 "$C" import -window root "/out/$pre-end.png"
