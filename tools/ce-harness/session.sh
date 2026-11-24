#!/bin/bash
# Container entrypoint: virtual display + the game, then idle so the harness can drive it.
Xvfb :99 -screen 0 1024x768x16 -nolisten tcp >/tmp/xvfb.log 2>&1 &
export DISPLAY=:99
sleep 2
[ -f "$WINEPREFIX/system.reg" ] || { wineboot -i >/tmp/wineboot.log 2>&1; wineserver -w; }
cd /game
wine Starfleet2CE.exe >/out/wine.log 2>&1 &
sleep infinity
