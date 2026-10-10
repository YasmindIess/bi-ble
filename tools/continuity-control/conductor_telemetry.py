"""Read-only loopback observations of the living WSL conductor.

A separate localhost endpoint keeps β×R telemetry available even if Cinema
itself is serving an older release. No code execution, secrets, repo writes,
production authority, or remote networking is exposed.
"""
import json
import hashlib
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit

PORT = 8767
STATE_LIMIT = 64 * 1024
NAMES = frozenset(("bi-ble", "nice-robin", "conductor", "cinema"))
STATES = frozenset(("current", "updated", "held", "not_adopted", "unknown"))
MODES = frozenset(("github-preview", "github-main", "legacy"))
SHA = re.compile(r"^[a-f0-9]{40}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")


def brief(value, limit=180):
    if not isinstance(value, str):
        return None
    return re.sub(r"[\x00-\x1f\x7f]+", " ", value)[:limit]


def read_status(path):
    try:
        if not path.is_file() or path.stat().st_size > STATE_LIMIT:
            return {}
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError, UnicodeError):
        return {}


def snapshot(status, clock=None):
    """Only allowlisted fields; never serialize credentials, env, paths or logs."""
    if clock is None:
        clock = datetime.now(timezone.utc)
    projects = []
    for entry in status.get("repos", []):
        if not isinstance(entry, dict) or entry.get("name") not in NAMES:
            continue
        state = entry.get("state")
        projects.append({
            "name": entry["name"],
            "branch": brief(entry.get("branch"), 100),
            "head": entry.get("head") if isinstance(entry.get("head"), str) and SHA.fullmatch(entry["head"]) else None,
            "state": state if state in STATES else "unknown",
            "reason": brief(entry.get("reason")),
            "ci_workflows": entry.get("ci_workflows") if isinstance(entry.get("ci_workflows"), int) else None,
        })
    checked = status.get("checked_at")
    age = None
    if isinstance(checked, str):
        try:
            instant = datetime.strptime(checked, "%Y-%m-%dT%H:%M:%S%z")
            age = max(0, round((clock-instant).total_seconds()*1000))
        except (TypeError, ValueError, OverflowError):
            pass
    preview = status.get("cinema_preview")
    preview = preview if isinstance(preview, dict) else {}
    live = status.get("cinema_live_build")
    live = live if isinstance(live, dict) else {}
    mode = status.get("cinema_source")
    if mode not in MODES:
        mode = "unknown"
    def owned(name):
        value = status.get(name)
        return value if value in ("owned", "started", "external (left running)") else "unknown"
    head = preview.get("head")
    return {
        "schema": "cinema-observatory-v1",
        "transport": "conductor-direct-loopback",
        "observed_at": clock.isoformat(),
        "supervisor": {
            "state": "unknown" if age is None else "stale" if age > 150000 else "responsive",
            "heartbeat_age_ms": age,
            "revision": next((x["head"] for x in projects if x["name"] == "conductor"), None),
        },
        "runtimes": {"cinema": owned("cinema"), "vite": owned("vite"), "cinema_source": mode},
        "preview": {
            "state": preview.get("state") if preview.get("state") in ("ready", "checking", "held") else "unknown",
            "head": head if isinstance(head, str) and SHA.fullmatch(head) else None,
            "locally_admitted": preview.get("locally_admitted") is True,
            "reason": brief(preview.get("reason")),
        },
        "capture_runtime": brief(status.get("cinema_capture_runtime")),
        "live_build": {
            "state": brief(live.get("state"), 30),
            "source_mode": live.get("source_mode") if live.get("source_mode") in MODES else "unknown",
            "source_commit": live.get("source_commit") if isinstance(live.get("source_commit"), str) and SHA.fullmatch(live["source_commit"]) else None,
            "version": brief(live.get("version"), 30),
            "reason": brief(live.get("reason")),
        },
        "projects": projects,
        "independent_witness": False,
        "release_authorized": False,
        "production_deployed": False,
    }


def verified_userscript(status_path, script_root):
    """Only expose the one pinned CI-admitted userscript, never arbitrary files."""
    manifest = read_status(status_path.with_name("userscript.json"))
    head = manifest.get("head")
    digest = manifest.get("content_sha256")
    if (manifest.get("schema") != "bxr-ci-admitted-userscript-v1"
        or manifest.get("ci_admitted") is not True
        or not isinstance(head, str) or not SHA.fullmatch(head)
        or not isinstance(digest, str) or not SHA256.fullmatch(digest)):
        return None
    project = script_root / head
    scripts = project / "userscripts"
    candidate = scripts / "continuity-cinema-bridge.user.js"
    try:
        if (script_root.is_symlink() or project.is_symlink()
            or scripts.is_symlink() or candidate.is_symlink()
            or not candidate.is_file()):
            return None
        if candidate.stat().st_size > 220000:
            return None
        data = candidate.read_bytes()
        if (not data.startswith(b"// ==UserScript==")
            or hashlib.sha256(data).hexdigest() != digest):
            return None
        return data
    except OSError:
        return None


def handler_for(status_path, script_root):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            target = urlsplit(self.path)
            if target.query:
                return self.send_error(404, "route not found")
            if target.path == "/userscripts/continuity-cinema-bridge.user.js":
                body = verified_userscript(status_path, script_root)
                if body is None:
                    return self.send_error(404, "No CI-admitted userscript available")
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
            elif target.path == "/api/observatory":
                body = json.dumps(snapshot(read_status(status_path)), separators=(",", ":")).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
            else:
                return self.send_error(404, "route not found")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            self.send_error(405, "read only")

        def log_message(self, *args):
            return
    return Handler


def start(status_path, port=PORT, script_root=None):
    if script_root is None:
        script_root = Path.home() / ".local/share/blochfield-cinema/previews"
    server = ThreadingHTTPServer(("127.0.0.1", port),
                                 handler_for(Path(status_path), Path(script_root)))
    server.daemon_threads = True
    Thread(target=server.serve_forever, name="bxr-conductor-observation", daemon=True).start()
    return server
