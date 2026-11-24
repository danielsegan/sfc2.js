#!/bin/bash
# Open Customize on copy n and photograph CHOOSE VESSEL for all 9 race skins.
# Uses Escape to leave the vessel screen so we do not depend on DONE coords.
# Usage: map_cv.sh [n]
set -e
n=${1:-1}
C=ceh-c$n
D="docker exec -e DISPLAY=:99 $C"
# do not touch non-ceh containers
if docker ps --format '{{.Names}}' | grep -Eiq 'playwright|chrom'; then
  echo "WARN playwright-like container present; leaving it alone"
fi
docker rm -f $C >/dev/null 2>&1 || true
docker run -d --rm --name $C -e WINEDEBUG=-all -e WINEPREFIX=/wineprefix \
  -v /srv/sfc2/work/ce-2.670-c$n:/game -v ~/harness/out-c$n:/out -v ~/harness/prefix-c$n:/wineprefix \
  -v ~/harness/session.sh:/session.sh:ro -v ~/harness/bin:/h:ro sfc2-ce-harness:dev /session.sh >/dev/null
sleep 25
# Main -> Single Player -> Skirmish -> Customize
for p in "350 315" "512 275" "768 502"; do $D xdotool mousemove $p click 1; sleep 2; done
$D import -window root /out/cvmap-customize.png
$D python3 /h/map_cv.py
echo "map_cv done copy=$n"
