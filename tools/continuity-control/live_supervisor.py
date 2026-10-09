#!/usr/bin/env python3
"""Third-terminal GitHub→WSL live conductor. Never deploys, merges, or pushes."""
import json
import os
import hashlib
from pathlib import Path
import shutil
import signal
import socket
import sys
import subprocess
import time
import urllib.request

HOME = Path.home()
CINEMA = Path(os.environ.get("CINEMA_DIR", HOME / "continuity-cinema-v5-conversation-theater/continuity-cinema")).expanduser()
MANAGED_CINEMA = Path(os.environ.get("CINEMA_GIT_DIR", HOME / ".local/share/blochfield-cinema/source")).expanduser()
CINEMA_REPO = "YasmindIess/continuity-cinema"
CI_RUNNER = HOME / ".local/share/blochfield-cinema-runner"
CINEMA_BRANCH = "main"
BIBLE = Path(os.environ.get("BIBLE_REPO_DIR", HOME / "bi-ble-cinema")).expanduser()
ROBIN = Path(os.environ.get("ROBIN_REPO_DIR", HOME / "nice-robin-cinema")).expanduser()
REPOS = [
    ("bi-ble", "YasmindIess/bi-ble", BIBLE, os.environ.get("BIBLE_EXPECTED_BRANCH", "feat/continuity-handoff-v1")),
    ("nice-robin", "YasmindIess/nice-robin", ROBIN, os.environ.get("ROBIN_EXPECTED_BRANCH", "feat/continuity-bounded-local-worker-v1")),
]
CONTROL = Path(__file__).resolve().parents[2]
CONTROL_BRANCH = "feat/continuity-conductor-v1"
POLL = max(20, int(os.environ.get("BLOCHFIELD_POLL_SECONDS", "45")))
STATE = HOME / ".local/state/blochfield-conductor/status.json"
EVENTS = STATE.with_name("events.jsonl")
CHILDREN = {}
STOP = False

def log(s):
    print(time.strftime("%H:%M:%S"), s, flush=True)

def run(argv, cwd, timeout=35):
    p = subprocess.run(argv, cwd=str(cwd), capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError((p.stderr or p.stdout or f"exit {p.returncode}").strip()[-180:])
    return p.stdout.strip()

def listening(port):
    try:
        with socket.create_connection(("127.0.0.1", port), 0.5):
            return True
    except OSError:
        return False

def exact_ci(repo, sha, directory):
    if not shutil.which("gh"):
        raise RuntimeError("gh CLI unavailable; cannot verify CI")
    data = json.loads(run(["gh", "api", f"repos/{repo}/actions/runs?head_sha={sha}&per_page=100"], directory))
    runs = [r for r in data.get("workflow_runs", []) if r.get("head_sha") == sha
            and r.get("event") in ("push", "pull_request", "workflow_dispatch")]
    if not runs:
        raise RuntimeError("no exact-head GitHub Actions result")
    latest = {}
    for r in runs:
        key = str(r.get("workflow_id") or r.get("name"))
        if key not in latest or r.get("created_at", "") > latest[key].get("created_at", ""):
            latest[key] = r
    for item in latest.values():
        status=item.get("status")
        conclusion=item.get("conclusion")
        if status == "completed" and conclusion == "success":
            continue
        run_id=item.get("id","unknown")
        name=str(item.get("name") or "workflow")[:55]
        if status in ("queued","waiting","pending","requested","in_progress"):
            raise RuntimeError(f"CI pending: {name} run {run_id} ({status})")
        raise RuntimeError(f"CI not passed: {name} run {run_id} ({status}/{conclusion or 'none'})")
    return len(latest)

def synchronize(name, repo, directory, branch):
    report = {"name": name, "branch": branch, "state": "held"}
    try:
        if not (directory / ".git").exists():
            raise RuntimeError("local repository missing")
        remote = run(["git", "remote", "get-url", "origin"], directory).removesuffix(".git").rstrip("/")
        if remote not in (f"https://github.com/{repo}", f"git@github.com:{repo}", f"ssh://git@github.com/{repo}"):
            raise RuntimeError("remote origin does not match pinned repository")
        if run(["git", "branch", "--show-current"], directory) != branch:
            raise RuntimeError("branch is not the pinned branch")
        if run(["git", "status", "--porcelain", "--untracked-files=normal"], directory):
            raise RuntimeError("dirty tree: user changes preserved")
        old = run(["git", "rev-parse", "HEAD"], directory)
        run(["git", "-c", "credential.interactive=never", "fetch", "--quiet", "--no-tags",
             "origin", f"refs/heads/{branch}"], directory)
        head = run(["git", "rev-parse", "FETCH_HEAD"], directory)
        report["head"] = old
        if old == head:
            report["state"] = "current"
            return report
        run(["git", "merge-base", "--is-ancestor", old, head], directory)
        report["ci_workflows"] = exact_ci(repo, head, directory)
        if run(["git", "rev-parse", "HEAD"], directory) != old or run(["git", "status", "--porcelain"], directory):
            raise RuntimeError("tree changed while checking CI")
        run(["git", "-c", "core.hooksPath=/dev/null", "merge", "--ff-only", head], directory)
        report.update({"head": head, "state": "updated"})
    except Exception as exc:
        report["reason"] = str(exc)[:200]
    return report

def busy_capture():
    """Preserve both operator-loop and direct/manual Cinema captures.

    If an HTTP server is listening but its status cannot be inspected, hold
    restarts rather than risk terminating a live recording or publication.
    """
    if not listening(8765):
        return False
    for endpoint in ("api/loop/status", "api/cycle"):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8765/" + endpoint,
                                        timeout=1.25) as response:
                status = json.load(response).get("status")
                if status in ("running", "publishing"):
                    return True
        except (OSError, ValueError, TypeError, KeyError):
            return True
    return False

def start(name, command, directory, port, extra_env=None):
    child = CHILDREN.get(name)
    if child and child.poll() is None:
        return "owned"
    CHILDREN.pop(name, None)
    if listening(port):
        return "external (left running)"
    if not directory.is_dir():
        return "missing checkout"
    try:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        os.chmod(STATE.parent, 0o700)
        logfile = STATE.parent / (name + ".log")
        fd = os.open(str(logfile), os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        with os.fdopen(fd, "ab", buffering=0) as stream:
            CHILDREN[name] = subprocess.Popen(
                command, cwd=str(directory), start_new_session=True,
                stdout=stream, stderr=subprocess.STDOUT,
                env={**os.environ, "CINEMA_BACKGROUND_SYNC": "0", **(extra_env or {})}
            )
        return "started"
    except OSError as exc:
        return f"could not start: {exc}"

def repair_runner_launch_files():
    """Repair omissions in the initial private runner clone, never its credentials.

    run.sh needs run-helper.sh.template, which can call safe_sleep.sh. The
    initial Cinema enrollment copied run.sh but neither helper. Require the
    exact same run.sh bytes in the trusted source before copying anything.
    Refuse symlinks and existing replacements; only create missing helpers.
    """
    required=("run-helper.sh.template", "safe_sleep.sh")
    if not (CI_RUNNER / ".runner").is_file():
        return "unregistered"
    launcher=CI_RUNNER / "run.sh"
    if not launcher.is_file() or launcher.is_symlink():
        return "missing or unsafe runner launcher"
    missing=[n for n in required if not (CI_RUNNER / n).is_file()]
    if not missing:
        if any((CI_RUNNER / n).is_symlink() for n in required):
            return "unsafe runner helper symlink"
        return None
    for source in (HOME / "actions-runner-blochfield", HOME / "actions-runner-ngu"):
        reference=source / "run.sh"
        if not reference.is_file() or reference.is_symlink():
            continue
        if hashlib.sha256(launcher.read_bytes()).digest() != hashlib.sha256(reference.read_bytes()).digest():
            continue
        for name in missing:
            item=source / name
            if not item.is_file() or item.is_symlink():
                return f"trusted runner helper {name} unavailable"
            destination=CI_RUNNER / name
            if destination.exists() or destination.is_symlink():
                return f"unexpected destination {name}; refusing overwrite"
            # Exclusive creation: prevents overwriting registered runner material.
            with destination.open("xb") as out:
                out.write(item.read_bytes())
            destination.chmod(item.stat().st_mode & 0o777)
        return None
    return "no matching trusted runner distribution; helper repair held"


def start_ci_runner():
    """Own a separately registered private-repo runner; never reuse NICE-ROBIN runner."""
    child=CHILDREN.get("cinema-runner")
    if child and child.poll() is None:
        return "owned"
    CHILDREN.pop("cinema-runner",None)
    if not (CI_RUNNER / ".runner").is_file() or not (CI_RUNNER / "run.sh").is_file():
        return "not_registered"
    problem=repair_runner_launch_files()
    if problem:
        return "held: "+problem
    STATE.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(str(STATE.parent / "cinema-runner.log"),
               os.O_WRONLY|os.O_APPEND|os.O_CREAT,0o600)
    try:
        with os.fdopen(fd,"ab",buffering=0) as logstream:
            CHILDREN["cinema-runner"]=subprocess.Popen(
                ["bash","./run.sh"],cwd=str(CI_RUNNER),start_new_session=True,
                stdout=logstream,stderr=subprocess.STDOUT,env=os.environ.copy())
        return "started"
    except OSError as exc:
        return "held: "+str(exc)[:100]


def cinema_runner_busy():
    """Conservatively defer supervisor self-reexec while its own CI runner is busy."""
    child=CHILDREN.get("cinema-runner")
    if not child or child.poll() is not None:
        return False
    try:
        registration=json.loads((CI_RUNNER / ".runner").read_text(encoding="utf-8"))
        runner_name=registration["agentName"]
        result=json.loads(run(["gh","api",
            "repos/YasmindIess/continuity-cinema/actions/runners?per_page=100"],
            CONTROL,timeout=18))
        match=next((item for item in result.get("runners",[])
                    if item.get("name")==runner_name),None)
        return match is None or match.get("busy") is not False
    except (OSError,ValueError,KeyError,RuntimeError,subprocess.TimeoutExpired):
        return True


def stop_owned(name):
    child = CHILDREN.get(name)
    if child is None:
        return True
    if child.poll() is None:
        try:
            os.killpg(child.pid, signal.SIGTERM)
            child.wait(timeout=8)
        except (OSError, subprocess.TimeoutExpired):
            log(f"{name}: stop timed out; refusing force kill")
            return False
    CHILDREN.pop(name, None)
    return True

def append_event(subject, state, detail):
    event = {"at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
             "subject": subject, "state": state, "detail": str(detail)[:120]}
    fd = os.open(str(EVENTS), os.O_CREAT | os.O_WRONLY | os.O_APPEND, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as stream:
        stream.write(json.dumps(event, separators=(",", ":")) + "\n")


def write_status(value):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE.parent, 0o700)
    try:
        previous = json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = {}
    prev_repos = {r["name"]: r for r in previous.get("repos", []) if "name" in r}
    for row in value.get("repos", []):
        name = row.get("name")
        earlier = prev_repos.get(name, {})
        if row.get("head") != earlier.get("head") and row.get("head"):
            append_event(name, "revision", row["head"][:16])
        elif row.get("state") != earlier.get("state") and row.get("state") != "current":
            append_event(name, row.get("state"), row.get("reason") or row.get("branch", ""))
    for name in ("cinema", "vite"):
        if value.get(name) != previous.get(name):
            append_event(name, "runtime", value.get(name, "unknown"))
    if value.get("cinema_source") != previous.get("cinema_source"):
        append_event("cinema", "source", value.get("cinema_source"))
    tmp = STATE.with_name(f".status-{os.getpid()}.tmp")
    tmp.write_text(json.dumps(value, indent=2), encoding="utf-8")
    tmp.chmod(0o600)
    tmp.replace(STATE)

def halt(*_):
    global STOP
    STOP = True

def main():
    signal.signal(signal.SIGINT, halt)
    signal.signal(signal.SIGTERM, halt)
    log("Blochfield third runtime active: clean fast-forward + exact-head CI + local reload")
    log("External processes are never killed. Stop the old Cinema once to transfer ownership.")
    pending = {"cinema": False, "vite": False}
    self_update_pending = False
    cinema_managed = False
    prior_messages = {}
    try:
        while not STOP:
            repos = [synchronize(*p) for p in REPOS]
            control = synchronize("conductor", "YasmindIess/bi-ble", CONTROL, CONTROL_BRANCH)
            managed = {"name": "cinema", "branch": CINEMA_BRANCH, "state": "not_adopted"}
            managed_ready = False
            if (MANAGED_CINEMA / ".git").is_dir():
                managed = synchronize("cinema", CINEMA_REPO, MANAGED_CINEMA, CINEMA_BRANCH)
                if managed["state"] in ("current", "updated"):
                    try:
                        # Even an unchanged adopted checkout must pass CI before cutover.
                        managed["ci_workflows"] = exact_ci(CINEMA_REPO, managed["head"], MANAGED_CINEMA)
                        needs_install = (not (MANAGED_CINEMA / "node_modules/playwright").is_dir()
                                         or managed["state"] == "updated")
                        if needs_install:
                            run(["npm", "ci", "--no-audit", "--no-fund"], MANAGED_CINEMA, timeout=180)
                        browser_ready = MANAGED_CINEMA / "node_modules/.cinema-chromium-ready"
                        if needs_install or not browser_ready.exists():
                            run(["npx", "--no-install", "playwright", "install", "chromium"],
                                MANAGED_CINEMA, timeout=300)
                            browser_ready.write_text("chromium provisioned by continuity conductor\n")
                        managed_ready = True
                    except Exception as exc:
                        managed.update({"state": "held", "reason": "Cinema CI/runtime prerequisite: " + str(exc)[:150]})
            ci_runner=start_ci_runner()
            for r in [*repos, control, managed]:
                message=f"{r['state']}" + (f" ({r['reason']})" if r.get("reason") else "")
                if prior_messages.get(r['name']) != message:
                    log(r["name"] + ": " + message)
                    prior_messages[r["name"]]=message
            pending["cinema"] |= any(r["state"] == "updated" for r in repos)
            pending["cinema"] |= managed["state"] == "updated" or (managed_ready != cinema_managed)
            cinema_dir = MANAGED_CINEMA if managed_ready else CINEMA
            cinema_env = {"CINEMA_CAPTURES_DIR": str(CINEMA / "captures")} if managed_ready else {}
            pending["vite"] |= repos[0]["state"] == "updated"
            cinema = start("cinema", ["bash", "./run-local.sh"], cinema_dir, 8765, cinema_env)
            if cinema == "started":
                cinema_managed = managed_ready
            vite = start("vite", ["pnpm", "editor:web"], BIBLE, 5173) if shutil.which("pnpm") else "pnpm unavailable"
            for name in ("cinema", "vite"):
                if not pending[name]:
                    continue
                if name == "cinema" and busy_capture():
                    log("Cinema capture active: delaying restart")
                    continue
                if name not in CHILDREN:
                    log(f"{name}: external runtime; cannot restart it (Vite HMR still works)")
                    pending[name] = False
                    continue
                if stop_owned(name):
                    pending[name] = False
                    if name == "cinema":
                        cinema = start("cinema", ["bash", "./run-local.sh"], cinema_dir, 8765, cinema_env)
                        if cinema == "started":
                            cinema_managed = managed_ready
                    else:
                        vite = start("vite", ["pnpm", "editor:web"], BIBLE, 5173)
                    log(f"{name}: restarted after verified source update")
            write_status({"schema": "blochfield-live-conductor-v1", "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "runtime_marker": "github-self-update-smoke-v1", "supervisor_pid": os.getpid(),
                "service_pids": {n: (p.pid if p.poll() is None else None)
                                 for n, p in CHILDREN.items()},
                "cinema_ci_runner": ci_runner,
                "cinema_runner_launch_files_ready": all(
                    (CI_RUNNER / name).is_file()
                    for name in ("run.sh", "run-helper.sh.template", "safe_sleep.sh")),
                "repos": [*repos, control, managed], "cinema": cinema, "vite": vite,
                "cinema_source": "github" if cinema_managed else "legacy",
                "cinema_managed_branch": CINEMA_BRANCH if cinema_managed else None, "unmerged": True,
                "release_authorized": False, "production_deployed": False})
            self_update_pending |= control['state'] == 'updated'
            if self_update_pending:
                if busy_capture() or cinema_runner_busy():
                    log('Supervisor source updated: postpone self-reexec while capture or Cinema CI is busy')
                else:
                    log('Supervisor source updated and CI-verified: restart supervised processes and re-exec')
                    if stop_owned('cinema') and stop_owned('vite') and stop_owned('cinema-runner'):
                        os.execv(sys.executable, [sys.executable, str(Path(__file__).resolve())])
            for _ in range(POLL):
                if STOP:
                    break
                time.sleep(1)
    finally:
        for name in ("cinema", "vite", "cinema-runner"):
            stop_owned(name)
        log("Third runtime stopped; evidence and external services untouched")

if __name__ == "__main__":
    main()
