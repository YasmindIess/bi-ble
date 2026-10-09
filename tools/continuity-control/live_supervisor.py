#!/usr/bin/env python3
"""Third-terminal GitHub→WSL live conductor. Never deploys, merges, or pushes."""
import json
import os
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
    if any(r.get("status") != "completed" or r.get("conclusion") != "success" for r in latest.values()):
        raise RuntimeError("exact-head CI not fully green")
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
    try:
        with urllib.request.urlopen("http://127.0.0.1:8765/api/loop/status", timeout=2) as r:
            return json.load(r).get("status") == "running"
    except Exception:
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
        CHILDREN[name] = subprocess.Popen(command, cwd=str(directory), start_new_session=True,
            env={**os.environ, "CINEMA_BACKGROUND_SYNC": "0", **(extra_env or {})})
        return "started"
    except OSError as exc:
        return f"could not start: {exc}"

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

def write_status(value):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE.parent, 0o700)
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
            for r in [*repos, control, managed]:
                log(f"{r['name']}: {r['state']}" + (f" ({r['reason']})" if r.get("reason") else ""))
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
                "repos": [*repos, control, managed], "cinema": cinema, "vite": vite,
                "cinema_source": "github" if cinema_managed else "legacy",
                "cinema_managed_branch": CINEMA_BRANCH if cinema_managed else None, "unmerged": True,
                "release_authorized": False, "production_deployed": False})
            self_update_pending |= control['state'] == 'updated'
            if self_update_pending:
                if busy_capture():
                    log('Supervisor source updated: postpone self-restart until capture ends')
                else:
                    log('Supervisor source updated and CI-verified: restart supervised processes and re-exec')
                    if stop_owned('cinema') and stop_owned('vite'):
                        os.execv(sys.executable, [sys.executable, str(Path(__file__).resolve())])
            for _ in range(POLL):
                if STOP:
                    break
                time.sleep(1)
    finally:
        for name in ("cinema", "vite"):
            stop_owned(name)
        log("Third runtime stopped; evidence and external services untouched")

if __name__ == "__main__":
    main()
