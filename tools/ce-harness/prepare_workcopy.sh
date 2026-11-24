#!/usr/bin/env bash
# Make a writable working copy of the private install for the harness and set
# the display/sound options it needs. The read-only reference tree is never
# modified. Runs on the sfc2-ci VM only.
#   prepare_workcopy.sh <reference_dir> <work_dir>
set -euo pipefail
ref=$1; work=$2
[[ -f "$ref/Starfleet2CE.exe" ]] || { echo "reference install not found at $ref" >&2; exit 1; }
if [[ ! -f "$work/Starfleet2CE.exe" ]]; then
  mkdir -p "$work"
  cp -a "$ref/." "$work/"
  chmod -R u+w "$work"
fi
ini="$work/sfc.ini"
# windowed DirectDraw (works under Xvfb), Miles audio off, sound off,
# heading overlay and grid on (visual references for screen measurements)
sed -i 's/^windowed=.*/windowed=1/; s/^UseMiles=.*/UseMiles=0/; s/^HeadingDisplay=.*/HeadingDisplay=1/; s/^Grid=.*/Grid=1/; s/^backdrop=.*/backdrop=0/; s/^spacedust=.*/spacedust=0/' "$ini"
sed -i '/^\[Sound\]/,/^\[/ s/^disable=.*/disable=1/' "$ini"
echo "work copy ready: $work"
