#!/usr/bin/env bash
# p2_turns.sh <copy n> <hud> <prefix> <spec...>
# spec = speed:button:secs (e.g. 5:mouse_n:30). When the speed differs from the previous spec, set it closed-loop with
# duel_accel.py in CIRCLE mode (ship circles N/W/S/E to stay near the map centre; final heading East, held 24 s),
# then capture_turn.py (same target, no extra presses). Next spec at the same speed reuses the state.
# Analysis: analyze_turn2.py and p2_turn_agg.py afterwards.
set -euo pipefail
n=$1; hud=$2; pre=$3; shift 3
C=${CE_CONTAINER:-ceh-c$n}; prev=""
for spec in "$@"; do
  IFS=: read -r sp btn secs <<< "$spec"
  lab="${pre}-s${sp}-${btn}"
  if [ "$sp" != "$prev" ]; then
    docker exec -e DISPLAY=:99 -e CIRCLE=24 "$C" python3 /h/duel_accel.py "${lab}-set" "${sp}:24" "$hud" | tail -2
  fi
  prev=$sp
  docker exec -e DISPLAY=:99 "$C" xdotool mousemove 182 15 click 1 mousemove 100 700; sleep 0.6
  docker exec -e DISPLAY=:99 -e HUD="$hud" "$C" python3 /h/capture_turn.py "$lab" "$sp" "$btn" "$secs"
done
echo "TURNS-DONE $(date)"
