#!/usr/bin/env bash
# p2run2.sh <n> <race_clicks> <desig> <hud> <prefix> <spec...>: fresh battle, then p2_turns.sh with the given specs
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
n=$1; rc=$2; de=$3; hud=$4; pre=$5; shift 5
C=${CE_CONTAINER:-ceh-c$n}
bash "$HERE/pbattle_hull.sh" "$n" "$rc" "$de" "$hud" || { echo SETUP-FAILED; exit 3; }
bash "$HERE/p2_turns.sh" "$n" "$hud" "$pre" "$@"
docker exec -e DISPLAY=:99 "$C" import -window root "/out/$pre-end.png"
