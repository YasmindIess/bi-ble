"""Read-only loopback observations of the living WSL conductor.

A separate localhost endpoint keeps β×R telemetry available even if Cinema
itself is serving an older release. No code execution, secrets, repo writes,
production authority, or remote networking is exposed.
"""
import json
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


def handler_for(status_path):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            target = urlsplit(self.path)
            if target.path != "/api/observatory" or target.query:
                return self.send_error(404, "route not found")
            body = json.dumps(snapshot(read_status(status_path)), separators=(",", ":")).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
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


def start(status_path, port=PORT):
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(Path(status_path)))
    server.daemon_threads = True
    Thread(target=server.serve_forever, name="bxr-conductor-observation", daemon=True).start()
    return server
