#!/bin/bash
# pbattle_hull.sh <n> <race_clicks> <designation> [hud]
# Isolated copy n: start the game, open Customize, click the fleet race arrow
# race_clicks times (0=Federation), SELECT, page CHOOSE VESSEL until DESIGNATION
# matches (e.g. CA for F-CA, D7 for K-D7), weak AI, Play, F1 overhead.
# HARD CHECK before returning success: CHOOSE VESSEL / Customize must be gone,
# a battle helm/energy tab must be visible, and the last confirmed designation
# must equal the target. On mismatch: HULL-SELECT-FAILED / BATTLE-CHECK-FAILED,
# never "battle-ready".
set -e
n=$1; clicks=$2; want=$3; hud=${4:-}
C=ceh-c$n
D="docker exec -e DISPLAY=:99 $C"
if [ -z "$hud" ]; then
  case "$clicks" in
    0) hud=federation ;;
    1) hud=klingon ;;
    2) hud=romulan ;;
    3) hud=lyran ;;
    4) hud=hydran ;;
    5) hud=gorn ;;
    6) hud=isc ;;
    7) hud=mirak ;;
    8) hud=orion ;;  # Your Fleet arrow wraps here; click 8 is Federation, not Orion
    *) hud=federation ;;
  esac
fi
docker rm -f $C >/dev/null 2>&1
docker run -d --rm --name $C -e WINEDEBUG=-all -e WINEPREFIX=/wineprefix \
  -v /srv/sfc2/work/ce-2.670-c$n:/game -v ~/harness/out-c$n:/out -v ~/harness/prefix-c$n:/wineprefix \
  -v ~/harness/session.sh:/session.sh:ro -v ~/harness/bin:/h:ro sfc2-ce-harness:dev /session.sh >/dev/null
sleep 25
for p in "350 315" "512 275" "768 502"; do $D xdotool mousemove $p click 1; sleep 2; done
for i in $(seq 1 $clicks); do $D xdotool mousemove 306 242 click 1 mousemove 900 700; sleep 0.9; done
$D xdotool mousemove 344 291 click 1 mousemove 900 700; sleep 2

# Resolve per-skin click targets (printed as ship_next class_next done stats_crop title_crop)
coords=$($D python3 /h/choose_vessel.py "$hud")
set -- $coords
SX=$1; SY=$2; CX=$3; CY=$4; DX=$5; DY=$6; STATS=$7; TITLE=$8

ocr_desig(){
  # Stats panel first (one OCR). Fall back to title + both panels only if
  # DESIGNATION is missing, so wrap detection stays on a short stable token.
  $D bash -c "import -window root /tmp/f.png
    convert /tmp/f.png -crop ${STATS} +repage -resize 300% -separate -evaluate-sequence max -negate /tmp/o.png
    tesseract /tmp/o.png - --psm 6 2>/dev/null"
}

ocr_desig_full(){
  $D bash -c "import -window root /tmp/f.png
    convert /tmp/f.png -crop ${STATS} +repage -resize 300% -separate -evaluate-sequence max -negate /tmp/o.png
    tesseract /tmp/o.png - --psm 6 2>/dev/null
    convert /tmp/f.png -crop ${TITLE} +repage -resize 300% -separate -evaluate-sequence max -negate /tmp/t.png
    tesseract /tmp/t.png - --psm 6 2>/dev/null
    convert /tmp/f.png -crop 200x400+200+175 +repage -resize 300% -separate -evaluate-sequence max -negate /tmp/l.png
    tesseract /tmp/l.png - --psm 6 2>/dev/null
    convert /tmp/f.png -crop 200x400+640+155 +repage -resize 300% -separate -evaluate-sequence max -negate /tmp/r.png
    tesseract /tmp/r.png - --psm 6 2>/dev/null"
}

desig_token(){
  # Stable wrap key: the DESIGNATION value, not a 160-char noisy OCR blob.
  echo "$1" | grep -Eo 'DESIGNATION[[:space:]]*:[[:space:]]*[^[:space:]]+' | head -1 | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]'
}

desig_match(){
  local txt="$1"
  echo "$txt" | grep -Eiq "DESIGNATION[[:space:]]*:[[:space:]]*${want}([+:[:space:]]|$)" \
    || echo "$txt" | grep -Eiq "^${want}[[:space:]]*-"
}

found=0
for ci in $(seq 0 15); do
  first=""
  misses=0
  for si in $(seq 0 79); do
    txt=$(ocr_desig)
    if ! echo "$txt" | grep -Eiq "DESIGNATION"; then
      txt=$(ocr_desig_full)
    fi
    tok=$(desig_token "$txt")
    echo "c$n page class=$ci ship=$si desig=${tok:-?}"
    if desig_match "$txt"; then
      found=1; break
    fi
    if [ -z "$tok" ]; then
      misses=$((misses+1))
      # If the stats crop keeps missing, still advance; don't treat empty as wrap.
      if [ $misses -ge 3 ]; then tok="MISS-$si"; fi
    fi
    if [ $si -eq 0 ]; then first="$tok"; fi
    if [ $si -gt 0 ] && [ -n "$first" ] && [ "$tok" = "$first" ]; then
      echo "c$n class $ci wrapped after $si ships at $tok"
      break
    fi
    $D xdotool mousemove $SX $SY click 1 mousemove 900 700; sleep 0.55
  done
  [ $found -eq 1 ] && break
  $D xdotool mousemove $CX $CY click 1 mousemove 900 700; sleep 0.9
done
$D import -window root /out/setup-${want}.png
if [ $found -ne 1 ]; then
  echo "c$n HULL-SELECT-FAILED ($want) hud=$hud"
  docker rm -f $C >/dev/null 2>&1
  exit 3
fi
# Re-read designation immediately before DONE so we never confirm a stale page.
txt=$(ocr_desig)
if ! desig_match "$txt"; then
  echo "c$n HULL-SELECT-FAILED ($want) designation lost before DONE"
  docker rm -f $C >/dev/null 2>&1
  exit 3
fi
$D xdotool mousemove $DX $DY click 1 mousemove 900 700; sleep 1.8
# If still on CHOOSE VESSEL, DONE missed — fail, do not fake battle-ready.
stay=$($D bash -c 'import -window root /tmp/f.png
  convert /tmp/f.png -crop 400x80+300+145 +repage -resize 200% -separate -evaluate-sequence max -negate /tmp/v.png
  tesseract /tmp/v.png - --psm 6 2>/dev/null')
if echo "$stay" | grep -Eiq "CHOOSE[[:space:]]+VESSEL"; then
  $D import -window root /out/setup-${want}-done-miss.png
  echo "c$n HULL-SELECT-FAILED ($want) DONE did not leave CHOOSE VESSEL (hud=$hud)"
  docker rm -f $C >/dev/null 2>&1
  exit 3
fi
# weak AI: max hull Frigate x8, BPV LOW x3
for i in $(seq 1 8); do $D xdotool mousemove 757 242 click 1; sleep 0.35; done
for i in $(seq 1 3); do $D xdotool mousemove 817 242 click 1; sleep 0.35; done
$D xdotool mousemove 768 527 click 1; sleep 20
$D xdotool mousemove 612 740 key F1; sleep 2
$D import -window root /out/setup-${want}-battle.png

# Hard battle-UI check (must pass before any capture).
if ! $D python3 /h/battle_check.py "$want" /out/setup-${want}-battle.png; then
  echo "c$n BATTLE-CHECK-FAILED ($want) hud=$hud"
  docker rm -f $C >/dev/null 2>&1
  exit 3
fi
echo "c$n battle-ready ($want)"
