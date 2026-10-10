#!/usr/bin/env python3
"""One-time, user-initiated CI-pinned conductor handoff; never overwrites user work.

Runs from a terminal, NOT inside a self-hosted GitHub runner job. The old
supervisor owns that runner; interrupting it from a running job is unsafe.
"""
import argparse
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
from urllib.request import urlopen

HOME=Path.home()
ROOT=HOME/".local/share/blochfield-conductor"
OLD=ROOT/"source"
BRANCH="feat/continuity-conductor-v1"
REPO="YasmindIess/bi-ble"
STATE=HOME/".local/state/blochfield-conductor/status.json"
MATCH=re.compile(r"^[0-9a-f]{40}$")
GUARD={"running","publishing"}
class Held(RuntimeError):pass

def run(argv,cwd=None,timeout=45):
    proc=subprocess.run(argv,cwd=cwd,text=True,capture_output=True,timeout=timeout)
    if proc.returncode:
        raise Held("Command did not pass: "+argv[0]+" "+(" ".join(argv[1:3]))+
                   " ("+(proc.stderr or proc.stdout or "failed").strip()[-180:]+")")
    return proc.stdout.strip()

def gh_json(endpoint):
    return json.loads(run(["gh","api",endpoint],cwd=OLD,timeout=25))

def gh_gate(expected):
    if not MATCH.fullmatch(expected):raise Held("Invalid exact-head revision")
    pr=gh_json("repos/"+REPO+"/pulls/2")
    head=(pr.get("head") or {})
    if pr.get("state")!="open" or pr.get("merged_at") or head.get("sha")!=expected or (
        head.get("ref")!=BRANCH or (head.get("repo") or {}).get("full_name")!=REPO):
        raise Held("Selected revision is not current open owner-origin PR #2 head")
    data=gh_json("repos/"+REPO+"/actions/runs?head_sha="+expected+"&per_page=100")
    runs=[x for x in data.get("workflow_runs",[]) if x.get("head_sha")==expected and
          x.get("event") in ("pull_request","push","workflow_dispatch")]
    if not runs:raise Held("Exact-head GitHub CI not observed")
    latest={}
    for x in runs:
        key=x.get("workflow_id") or x.get("name")
        if key not in latest or x.get("created_at","")>latest[key].get("created_at",""):
            latest[key]=x
    if any(x.get("status")!="completed" or x.get("conclusion")!="success" for x in latest.values()):
        raise Held("Exact-head CI is not entirely green")
    return len(latest)

def identity(pid):
    if not isinstance(pid,int) or pid<2:raise Held("No valid previously observed supervisor PID")
    proc=Path("/proc")/str(pid)
    try:
        if proc.stat().st_uid!=os.getuid():raise Held("Supervisor UID differs")
        parts=[os.fsdecode(x) for x in (proc/"cmdline").read_bytes().split(b"\0") if x]
        scripts=[Path(x) for x in parts if x.endswith("live_supervisor.py")]
        if len(scripts)!=1 or scripts[0].resolve()!=(OLD/"tools/continuity-control/live_supervisor.py").resolve():
            raise Held("PID does not identify our exact old conductor script")
        return parts
    except (PermissionError,FileNotFoundError) as exc:
        raise Held("Supervisor process identity unavailable") from exc

def remote_json(port,route):
    try:
        with urlopen("http://127.0.0.1:"+str(port)+route,timeout=3) as r:
            if r.status!=200:raise Held("Unexpected local service HTTP code")
            value=json.load(r)
        if not isinstance(value,dict):raise Held("Unexpected local JSON")
        return value
    except OSError as exc:
        raise Held("Required local runtime endpoint is unavailable: "+route) from exc

def ensure_idle():
    samples=[]
    for _ in range(2):
        loop=remote_json(8765,"/api/loop/status")
        cycle=remote_json(8765,"/api/cycle")
        if loop.get("status") in GUARD or cycle.get("status") in GUARD:
            raise Held("Active local cycle or publication; no handoff permitted")
        if loop.get("status") not in ("idle","passed","held","failed") or cycle.get("status") not in ("idle","passed","held","failed"):
            raise Held("Unrecognized local runtime status")
        samples.append((loop.get("last",{}).get("capture",{}).get("id") if loop.get("last") else None,
                        cycle.get("id"),loop.get("status"),cycle.get("status")))
        time.sleep(.6)
    if samples[0]!=samples[1]:
        raise Held("Capture state changed during safety checks")
    return samples[-1]

def runner_busy():
    root=Path("/proc")
    try:
        for item in root.iterdir():
            if not item.name.isdigit():continue
            try:
                value=(item/"cmdline").read_bytes()
                if b"Runner.Worker" not in value:continue
                # An unscoped worker is unknown; never interrupt a job.
                return True
            except (FileNotFoundError,PermissionError,ProcessLookupError):
                continue
        return False
    except OSError:
        raise Held("Cannot inspect active runner jobs")

def state():
    if not STATE.is_file() or STATE.stat().st_size>65536:raise Held("Missing bounded conductor status")
    if time.time()-STATE.stat().st_mtime>150:
        raise Held("Conductor telemetry is stale; refusing to act on an old PID")
    d=json.loads(STATE.read_text())
    if d.get("schema")!="blochfield-live-conductor-v1":raise Held("Unexpected supervisor status schema")
    if d.get("cinema") not in ("owned","started") or d.get("vite") not in ("owned","started"):
        raise Held("Supervisor does not own both local services")
    guard=d.get("supervisor_restart_gate")
    if not isinstance(guard,dict) or any(guard.get(k) is not False for k in
        ("active_capture","runner_job_active","capture_preflight_running","preview_preflight_running")):
        raise Held("Existing conductor has an active or unverified restart guard")
    return d

def create_clean_parallel_checkout(sha):
    remote=run(["git","remote","get-url","origin"],cwd=OLD).removesuffix(".git").rstrip("/")
    if remote not in ("https://github.com/"+REPO,"git@github.com:"+REPO,"ssh://git@github.com/"+REPO):
        raise Held("Source remote is not the pinned owner repository")
    release=ROOT/"verified-supervisors"/sha
    if release.exists():
        if release.is_symlink() or not (release/".git").is_dir():
            raise Held("Prepared path is not an independent clone")
    else:
        release.parent.mkdir(parents=True,exist_ok=True)
        run(["git","-c","credential.interactive=never","clone","--branch",BRANCH,
             "--single-branch",remote,str(release)],cwd=OLD,timeout=210)
    if run(["git","rev-parse","HEAD"],cwd=release)!=sha or run(["git","branch","--show-current"],cwd=release)!=BRANCH:
        raise Held("Prepared parallel checkout is not the exact green branch revision")
    if run(["git","status","--porcelain","--untracked-files=normal"],cwd=release):
        raise Held("Parallel checkout not clean")
    src=release/"tools/continuity-control/live_supervisor.py"
    if src.is_symlink() or not src.is_file():raise Held("Verified supervisor program absent")
    if run(["git","remote","get-url","origin"],cwd=release).removesuffix(".git").rstrip("/")!=remote:
        raise Held("Prepared checkout remote identity differs")
    return src

def former_env(pid):
    # Keep inherited private configuration in memory, never print or persist it.
    try:
        pairs=(Path("/proc")/str(pid)/"environ").read_bytes().split(b"\0")
        env=dict(os.fsdecode(x).split("=",1) for x in pairs if b"=" in x)
        return env
    except OSError as exc:
        raise Held("Old supervisor configuration unavailable; refusing lossy handoff") from exc

def alive(pid):
    try:
        raw=(Path("/proc")/str(pid)/"stat").read_text()
        return raw.split(") ",1)[1][:1]!="Z"
    except (FileNotFoundError,ProcessLookupError):return False
    except OSError:return True

def handoff(sha,apply):
    gh_gate(sha)
    snap=state()
    pid=snap.get("supervisor_pid")
    identity(pid)
    if runner_busy():raise Held("Runner.Worker currently active; no self-hosted job may be interrupted")
    before=run(["git","status","--porcelain","--untracked-files=normal"],cwd=OLD)
    prior=ensure_idle()
    source=create_clean_parallel_checkout(sha) if apply else None
    if run(["git","status","--porcelain","--untracked-files=normal"],cwd=OLD)!=before:
        raise Held("Protected user working tree changed unexpectedly; abort")
    print("GATES PASS: exact-head CI, owned supervisor, runner idle, stable capture status, protected checkout unchanged")
    print("LOCAL CYCLE: "+str(prior))
    if not apply:
        print("DRY RUN ONLY: no processes signaled, no checkout changed")
        return
    if state().get("supervisor_pid")!=pid:raise Held("Supervisor changed identity before handoff")
    identity(pid)
    ensure_idle()
    if runner_busy():raise Held("Runner became active before handoff")
    gh_gate(sha)  # Reject a changed PR head/CI gate at the last non-destructive boundary.
    carry=former_env(pid)
    logfile=ROOT/"handoff-supervisor.log"
    print("HANDOFF: gracefully retiring old supervisor; preserving source, captures and credentials")
    os.kill(pid,signal.SIGTERM)
    for _ in range(100):
        if not alive(pid):break
        time.sleep(.25)
    if alive(pid):
        raise Held("Old supervisor has not exited; refusing to start a competing supervisor")
    fd=os.open(logfile,os.O_WRONLY|os.O_APPEND|os.O_CREAT,0o600)
    with os.fdopen(fd,"ab",buffering=0) as stream:
        child=subprocess.Popen([sys.executable,str(source)],cwd=source.parents[2],
            stdin=subprocess.DEVNULL,stdout=stream,stderr=subprocess.STDOUT,
            env=carry,start_new_session=True,close_fds=True)
    print("SUCCESSOR SPAWNED: isolated CI-green supervisor PID "+str(child.pid))
    acknowledged=False
    for _ in range(140):
        if child.poll() is not None:
            raise Held("Replacement supervisor exited; inspect protected handoff log")
        try:
            refreshed=state()
            if refreshed.get("supervisor_pid")==child.pid and refreshed.get("checked_at"):
                acknowledged=True
                break
        except (Held,ValueError,OSError):
            pass
        time.sleep(.3)
    if not acknowledged:
        raise Held("Replacement was spawned but did not publish a fresh heartbeat; outcome unverified")
    print("HANDOFF VERIFIED: successor heartbeat acknowledged; protected checkout unchanged")
    print("No archive was changed, no external publication and no authority escalation was performed.")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--expected",required=True,help="Exact CI-green conductor Git SHA")
    p.add_argument("--apply",action="store_true",help="Perform guarded one-time process handoff")
    args=p.parse_args()
    try:handoff(args.expected,args.apply)
    except (Held,subprocess.TimeoutExpired,ValueError,KeyError,OSError) as e:
        print("HANDOFF HELD: "+str(e)[:250],file=sys.stderr)
        return 2
    return 0

if __name__=="__main__":sys.exit(main())
