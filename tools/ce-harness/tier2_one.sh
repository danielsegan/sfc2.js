#!/bin/bash
# tier2_one.sh <n> <seq> <spawnKey> <race_clicks> <designation> <hud> <weapons 0|1>
# Run one queued hull on isolated copy n. Tags kind via analyze_turn (button->kind).
# Per-hull JSON stays on the VM under ~/harness/out-c<n>/ and ~/harness/tier2/results/.
# Failed hull-select or battle-UI checks write status select_failed / battle_check_failed, never ok.
set -e
n=$1; seq=$2; spawn=$3; clicks=$4; desig=$5; hud=$6; do_wp=${7:-0}
C=ceh-c$n
pre="t2-$(echo "$spawn" | tr ': ' '__')"
outdir=~/harness/tier2/results
mkdir -p $outdir ~/harness/tier2/logs
log=~/harness/tier2/logs/${seq}-${desig}.log
exec >>"$log" 2>&1
echo "tier2 class=start"
fail_json() {
  local status="$1" reason="$2"
  python3 - "$outdir/${seq}-${desig}.json" "$seq" "$spawn" "$desig" "$status" "$reason" << 'PY'
import json,sys
path,seq,spawn,desig,status,reason=sys.argv[1:7]
json.dump({"seq":int(seq),"spawnKey":spawn,"designation":desig,"status":status,
           "reason":reason,"runs":[]}, open(path,"w"), indent=1)
print("WROTE 0 runs status", status, reason)
PY
}
if ! ~/harness/bin/pbattle_hull.sh $n $clicks $desig $hud; then
  # distinguish select vs battle-check from the log tail
  reason=$(grep -E "HULL-SELECT-FAILED|BATTLE-CHECK-FAILED" "$log" | tail -1 || true)
  status="select_failed"
  echo "$reason" | grep -q "BATTLE-CHECK-FAILED" && status="battle_check_failed"
  fail_json "$status" "${reason:-pbattle_hull failed}"
  echo "tier2 result=fail class=$status"
  exit 3
fi

# Normal turns first, then HETs only while CHANCE FOR HET and hull integrity allow it.
# Skip remaining HETs when chance is missing/too low or the ship is broken down.
normal_specs=(5:mouse_w:25 10:mouse_s:25 20:mouse_e:25)
het_specs=(5:port:16 15:port:16 31:port:16)
labels=()
skip_reasons=()

capture_one() {
  local sp=$1 b=$2 secs=$3
  local l="${pre}-s${sp}-${b}"
  labels+=("$l")
  if ! docker exec -e DISPLAY=:99 -e HUD=$hud -e SPAWN_KEY="$spawn" $C python3 /h/capture_turn.py "$l" "$sp" "$b" "$secs"; then
    echo "WARN capture failed $l"
  fi
  docker exec -e DISPLAY=:99 $C import -window root -crop 200x232+0+0 +repage "/out/frames/$l/helm-after.png" || true
  docker exec -e DISPLAY=:99 $C import -window root "/out/frames/$l/full-after.png" || true
}

for spec in "${normal_specs[@]}"; do
  IFS=: read -r sp b secs <<<"$spec"
  capture_one "$sp" "$b" "$secs"
done

het_skipped=()
for spec in "${het_specs[@]}"; do
  IFS=: read -r sp b secs <<<"$spec"
  # Snapshot helm + full frame and read CHANCE / damage before clicking HET.
  docker exec -e DISPLAY=:99 $C import -window root -crop 200x232+0+0 +repage /tmp/helm-now.png || true
  docker exec -e DISPLAY=:99 $C import -window root /tmp/full-now.png || true
  docker cp $C:/tmp/helm-now.png /tmp/helm-now-$n.png 2>/dev/null || true
  docker cp $C:/tmp/full-now.png /tmp/full-now-$n.png 2>/dev/null || true
  st=$(docker exec $C python3 /h/helm_status.py /tmp/full-now.png 2>/dev/null || docker exec $C python3 /h/helm_status.py /tmp/helm-now.png 2>/dev/null || echo '{}')
  echo "het class=pre"
  skip=$(python3 -c "import json,sys
d=json.loads(sys.argv[1] or '{}')
ch=d.get('chance'); dmg=d.get('damaged'); conf=d.get('confident')
if dmg:
    print('damaged')
elif ch is not None and float(ch)<=1 and conf:
    print('low-chance')

else:
    print('')
" "$st")
  if [ -n "$skip" ]; then
    echo "SKIP remaining HETs from s$sp ($skip)"
    het_skipped+=("s${sp}-port:$skip")
    # record the rest as skipped, do not click
    for rest in "${het_specs[@]}"; do
      IFS=: read -r rsp rb rsecs <<<"$rest"
      # only mark this and later speeds
      python3 -c "import sys; raise SystemExit(0 if float(sys.argv[1])>=float(sys.argv[2]) else 1)" "$rsp" "$sp" || continue
      skip_reasons+=("s${rsp}-${rb}:$skip")
    done
    break
  fi
  capture_one "$sp" "$b" "$secs"
  # After a HET, if helm_status now says damaged, stop later ones.
  post=$(docker exec $C python3 /h/helm_status.py /out/frames/${pre}-s${sp}-${b}/full-after.png 2>/dev/null || echo '{}')
  echo "het class=post"
done

if [ "$do_wp" = "1" ]; then
  # Weapons probes start from speed 0 (wp4 setup), not leftover combat speed.
  echo "weapons: settling to speed 0"
  docker exec -e DISPLAY=:99 $C python3 - << 'PY' || echo "WARN speed-0 settle failed"
import subprocess, time
def sh(*a):
    return subprocess.run(a, capture_output=True, text=True)
# mash A to drop target speed, then wait
for _ in range(40):
    sh("xdotool", "key", "a"); time.sleep(0.08)
time.sleep(8)
print("speed-0 settle done")
PY
  dmg=$(docker exec -e DISPLAY=:99 $C bash -c 'import -window root /tmp/wpre.png; python3 /h/helm_status.py /tmp/wpre.png' 2>/dev/null || echo '{}')
  echo "weapons class=pre"
  if python3 -c "import json,sys; d=json.loads(sys.argv[1] or '{}'); raise SystemExit(0 if d.get('damaged') else 1)" "$dmg"; then
    echo "SKIP weapons probe (damaged)"
    skip_reasons+=("weapons:damaged")
  else
    # fire_range 20, min_gap 4, speed_presses 0 (already at 0)
    if ! docker exec -e DISPLAY=:99 $C python3 /h/weapons_probe3.py "${pre}-wp" 180 20 4 0; then
      echo "WARN weapons probe failed"
    fi
    docker exec -e DISPLAY=:99 $C import -window root /out/${pre}-wp-end.png || true
  fi
fi
docker exec -e DISPLAY=:99 $C import -window root /out/${pre}-end.png || true
docker rm -f $C >/dev/null 2>&1

docker run --rm -e SPAWN_KEY="$spawn" -v ~/harness/out-c$n:/out -v ~/harness/bin:/h:ro sfc2-ce-harness:dev \
  python3 /h/analyze_turn.py "${labels[@]}" >/dev/null || echo "WARN analyze v1 failed"
docker run --rm -e SPAWN_KEY="$spawn" -v ~/harness/out-c$n:/out -v ~/harness/bin:/h:ro sfc2-ce-harness:dev \
  python3 /h/analyze_turn2.py "${labels[@]}" >/dev/null || echo "WARN analyze v2 failed"

# Stamp spawnKey; analyzers already set kind, noop, noop_reason, speed_key.
python3 - "$spawn" "$desig" "$seq" "$n" "$hud" "${skip_reasons[*]}" -- "${labels[@]}" << 'PY'
import json,os,sys
sys.path.insert(0,"/home/dsegan/harness/bin")
from turn_tags import apply_noop, turn_kind
args=sys.argv[1:]
sep=args.index("--")
spawn,desig,seq,n,hud,skip_blob=args[:6]
labels=args[sep+1:]
runs=[]; skips=[]
if skip_blob:
    for part in skip_blob.split():
        if ":" in part:
            skips.append(part)
base=f"/home/dsegan/harness/out-c{n}/runs"
for lab in labels:
    for name in (lab+".json", lab+".r2.json"):
        p=os.path.join(base,name)
        if not os.path.exists(p): continue
        d=json.load(open(p))
        d["spawnKey"]=spawn
        d["kind"]=d.get("kind") or turn_kind(d.get("button"))
        apply_noop(d)
        json.dump(d, open(p,"w"), indent=1)
        if name.endswith(".r2.json"):
            rec={k:d[k] for k in d if k!="series"}
            runs.append(rec)
out={"seq":int(seq),"spawnKey":spawn,"designation":desig,"hud":hud,
     "status":"ok","runs":runs,"skipped":skips,
     "noops":[r.get("label") for r in runs if r.get("noop")]}
json.dump(out, open(f"/home/dsegan/harness/tier2/results/{seq}-{desig}.json","w"), indent=1)
print("tier2 result=pass runs", len(runs), "skipped", len(skips), "noops", len(out["noops"]))
PY
echo "tier2 result=done"
