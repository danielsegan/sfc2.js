#!/usr/bin/env python3
"""Dispatch the 54-hull tier-2 queue onto at most 3 game copies (ceh-c1..c3).
Does not start a 4th copy. Skips hulls already marked ok/select_failed/running.
Combat only — no Playwright check here (caller must have confirmed it is gone).
"""
import json, os, subprocess, time, sys
from pathlib import Path

QUEUE = Path("/home/dsegan/harness/queue.json")
STATUS = Path("/home/dsegan/harness/tier2/status.json")
BIN = Path("/home/dsegan/harness/bin")
LOG = Path("/home/dsegan/harness/tier2/logs/dispatch.log")
COPIES = [1, 2, 3]

def log(msg):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    line = time.strftime("%Y-%m-%d %H:%M:%S EST ") + msg
    with LOG.open("a") as f:
        f.write(line + "\n")
    if msg.startswith("queue complete"):
        print(f"dispatch result=pass {msg}", flush=True)
    elif msg.startswith("launch"):
        print("dispatch class=launch", flush=True)
    elif msg.startswith("hold"):
        print("dispatch class=hold", flush=True)
    else:
        print("dispatch class=event", flush=True)

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

def game_copies():
    out = sh("docker ps --format '{{.Names}}'").stdout.split()
    return [int(n[5:]) for n in out if n.startswith("ceh-c") and n[5:].isdigit()]

def load_queue():
    return json.loads(QUEUE.read_text())

def load_status():
    if STATUS.exists():
        return json.loads(STATUS.read_text())
    return {"started": time.strftime("%Y-%m-%d %H:%M:%S %Z"), "hulls": {}}

def save_status(st):
    STATUS.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATUS.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, indent=1))
    tmp.replace(STATUS)

def live_workers():
    """Map copy -> (pid, seq, spawnKey) for running tier2_one.sh processes."""
    out = {}
    r = sh("ps -eo pid,cmd")
    for ln in (r.stdout or "").splitlines():
        if "tier2_one.sh" not in ln or "bash -c" in ln:
            continue
        parts = ln.split()
        try:
            i = next(i for i, tok in enumerate(parts) if tok.endswith("tier2_one.sh"))
            out[str(parts[i + 1])] = (parts[0], parts[i + 2], parts[i + 3])
        except (StopIteration, IndexError, ValueError):
            continue
    return out

def designation(hull):
    # F-CA -> CA, O-PR1 -> PR1, K-D7 -> D7, H-PAL -> PAL
    return hull.split("-", 1)[1]

def done_file(seq, desig):
    return Path(f"/home/dsegan/harness/tier2/results/{seq}-{desig}.json")

def harvest(st, q):
    for item in q["queue"]:
        desig = designation(item["hull"])
        key = item["spawnKey"]
        p = done_file(item["seq"], desig)
        if p.exists():
            rec = json.loads(p.read_text())
            st["hulls"][key] = {"status": rec.get("status", "ok"), "seq": item["seq"], "finished": True}
    return st

def main():
    q = load_queue()
    st = load_status()
    st = harvest(st, q)
    save_status(st)
    # running workers by copy: we launch setsid tier2_one and track pids in status
    st.setdefault("pids", {})
    while True:
        st = harvest(st, q)
        # reap finished pids
        alive = {}
        for copy, pid in list(st.get("pids", {}).items()):
            try:
                os.kill(int(pid), 0)
                alive[copy] = pid
            except (ProcessLookupError, ValueError, PermissionError):
                pass
        # Adopt live workers started outside the dispatcher (manual restart).
        for copy, (pid, seq, spawn) in live_workers().items():
            alive[copy] = pid
            rec = st["hulls"].get(spawn, {})
            if rec.get("finished") and rec.get("status") == "ok":
                continue
            rec.update({"status": "running", "seq": int(seq), "copy": int(copy),
                        "pid": pid, "finished": False})
            rec["tries"] = rec.get("tries") or 1
            st["hulls"][spawn] = rec
        st["pids"] = alive
        # any running copies from docker
        used = set(game_copies())
        # also treat a live worker as occupying its copy even during analysis (named after the game container is gone)
        for c in list(alive):
            used.add(int(c))
        pending = [it for it in q["queue"]
                   if st["hulls"].get(it["spawnKey"], {}).get("status") not in ("ok", "select_failed", "running")
                   and not st["hulls"].get(it["spawnKey"], {}).get("finished")]
        # clear stale running if pid gone and no result yet — leave as pending retry once
        for key, rec in list(st["hulls"].items()):
            if rec.get("status") == "running" and rec.get("copy") and str(rec["copy"]) not in st["pids"] and not rec.get("finished"):
                # worker died without a result
                if rec.get("tries", 1) >= 2:
                    rec["status"] = "worker_failed"
                else:
                    rec["status"] = "retry"
                    rec["tries"] = rec.get("tries", 1) + 1
        save_status(st)
        pending = [it for it in q["queue"]
                   if st["hulls"].get(it["spawnKey"], {}).get("status") not in ("ok", "select_failed", "worker_failed", "running")
                   and not st["hulls"].get(it["spawnKey"], {}).get("finished")]
        # Hold later hulls of an empire until its first queued hull has finished ok.
        # A failed first hull is a systematic select problem — do not roll the rest.
        first_by_empire = {}
        for it in q["queue"]:
            first_by_empire.setdefault(it["empire"], it)
        gated = []
        for it in pending:
            first = first_by_empire[it["empire"]]
            if it["spawnKey"] == first["spawnKey"]:
                gated.append(it)
                continue
            rec = st["hulls"].get(first["spawnKey"], {})
            # Only an ok first hull unblocks the rest. finished=True on
            # select_failed used to leak later hulls of the same empire.
            if rec.get("status") == "ok":
                gated.append(it)
            elif rec.get("status") in ("select_failed", "worker_failed", "battle_check_failed"):
                log(f"hold {it['spawnKey']}: first {first['spawnKey']} is {rec.get('status')}")
        pending = gated
        finished = sum(1 for it in q["queue"] if st["hulls"].get(it["spawnKey"], {}).get("finished") or st["hulls"].get(it["spawnKey"], {}).get("status") in ("ok","select_failed","worker_failed"))
        if not pending and not st["pids"]:
            log(f"queue complete: {finished}/54")
            st["finished"] = time.strftime("%Y-%m-%d %H:%M:%S %Z")
            save_status(st)
            return 0
        free = [c for c in COPIES if c not in used]
        for c, it in zip(free, pending):
            desig = designation(it["hull"])
            wp = "1" if it.get("weapons") else "0"
            cmd = (f"setsid nohup {BIN}/tier2_one.sh {c} {it['seq']} {it['spawnKey']} "
                   f"{it['race_clicks']} {desig} {it['hud']} {wp} "
                   f"> /home/dsegan/harness/tier2/logs/copy{c}.outer.log 2>&1 < /dev/null & echo $!")
            r = sh(cmd)
            pid = r.stdout.strip().split()[-1] if r.stdout.strip() else ""
            st["hulls"][it["spawnKey"]] = {"status": "running", "seq": it["seq"], "copy": c, "pid": pid, "tries": st["hulls"].get(it["spawnKey"], {}).get("tries", 0) + 1}
            if pid.isdigit():
                st["pids"][str(c)] = pid
            log(f"launch copy={c} pid={pid} {it['spawnKey']} {it['hud']} wp={wp}")
            save_status(st)
            time.sleep(2)
        time.sleep(15)

if __name__ == "__main__":
    sys.exit(main())
