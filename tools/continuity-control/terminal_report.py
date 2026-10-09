#!/usr/bin/env python3
"""Read-only, low-overhead dashboard for the two former service terminals.

Usage: python3 terminal_report.py vite
       python3 terminal_report.py cinema
Press q to exit the report. The conductor owns the actual service processes.
No Git, GitHub, Cloudflare, or service mutation is performed.
"""
import argparse
from collections import deque
import curses
import json
from pathlib import Path
import re
import time
from urllib.request import urlopen

ROOT = Path.home() / ".local/state/blochfield-conductor"
STATUS = ROOT / "status.json"
EVENTS = ROOT / "events.jsonl"
ESCAPES = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")
NONPRINT = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


def clean(value):
    text = ESCAPES.sub("", str(value).replace("\r", ""))
    return NONPRINT.sub(" ", text).replace("\n", " ")


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError):
        return {}


def get_local(path):
    try:
        with urlopen("http://127.0.0.1:" + path, timeout=0.35) as response:
            return json.loads(response.read(80_000))
    except (OSError, ValueError, TimeoutError, UnicodeError):
        return None


def tail(path, count=7, max_bytes=12000):
    try:
        with path.open("rb") as f:
            f.seek(0, 2)
            n = min(f.tell(), max_bytes)
            f.seek(-n, 2)
            data = f.read().decode("utf-8", errors="replace")
        lines = data.splitlines()
        if n == max_bytes and len(lines) > 1:
            lines = lines[1:]
        return [clean(line) for line in lines[-count:] if clean(line).strip()]
    except OSError:
        return []


def event_rows():
    records = []
    for line in tail(EVENTS, 14):
        try:
            event = json.loads(line)
            records.append(
                f"{event.get('at','')[-8:]} {event.get('subject','')} "
                f"{event.get('state','')} {event.get('detail','')}"
            )
        except (ValueError, TypeError):
            continue
    return records[-6:]


def elapsed_label(checked):
    if not checked:
        return "never"
    try:
        stamp = time.strptime(checked, "%Y-%m-%dT%H:%M:%S%z")
        age = max(0, round(time.time() - time.mktime(stamp)))
        return f"{age}s ago"
    except (ValueError, TypeError, OverflowError):
        return clean(checked)[-24:]


def project_record(status, key):
    return next((r for r in status.get("repos", []) if r.get("name") == key), {})


def fmt_run(cycle):
    if not isinstance(cycle, dict):
        return "No recorded cycle in this response"
    ident = str(cycle.get("id") or cycle.get("cycle_id") or "?")
    state = cycle.get("status") or "unknown"
    count = cycle.get("frames")
    if isinstance(count, list):
        count = len(count)
    return f"{ident[-24:]} | {state}" + (f" | {count} frames" if count is not None else "")


def report(mode, state, remote, previous, now):
    key = "bi-ble" if mode == "vite" else "cinema"
    port = 5173 if mode == "vite" else 8765
    local = project_record(state, key)
    conductor = project_record(state, "conductor")
    heading = "BI-BLE · LIVE EDITOR" if mode == "vite" else "CONTINUITY CINEMA · EVIDENCE"
    http_ok = remote.get("http", False)
    rows = [
        ("heading", f"  {heading}  |  127.0.0.1:{port}"),
        ("muted", f"  {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(now))}   q: quit report   r: refresh"),
        ("divider", ""),
        ("section", "RUNTIME"),
        ("good" if http_ok else "bad", f"  HTTP: {'200 OK' if http_ok else 'not responding'}   Ownership: {state.get(mode, 'unknown')}"),
        ("normal", f"  Supervisor PID: {state.get('supervisor_pid','?')}   Last poll: {elapsed_label(state.get('checked_at'))}"),
        ("normal", f"  Git source: {state.get('cinema_source','legacy') if mode == 'cinema' else 'bi-ble checkout'}"),
        ("divider", ""),
        ("section", "SOURCE & GATES"),
        ("normal", f"  Branch: {local.get('branch','not adopted' if mode == 'cinema' else '?')}"),
        ("normal", f"  Commit: {local.get('head','—')}"),
        ("good" if local.get("state") in ("current", "updated") else "muted",
         f"  Git sync: {local.get('state','not adopted')}  |  CI workflows on incoming update: {local.get('ci_workflows','not checked this poll')}"),
        ("normal", f"  Conductor: {str(conductor.get('head','?'))[:16]}  ({conductor.get('state','?')})"),
        ("divider", ""),
    ]
    if mode == "vite":
        rows.extend([
            ("section", "EDITOR OPERATIONS"),
            ("normal", "  Vite HMR follows verified changes in the pinned checkout."),
            ("normal", "  NICE-ROBIN: " + str(project_record(state, "nice-robin").get("head", "unknown"))[:16]),
            ("normal", "  CI results are checked for new heads; no prod deployment."),
        ])
    else:
        loop = remote.get("loop") or {}
        captures = remote.get("captures") or {}
        edge = remote.get("edge") or {}
        latest = (captures.get("cycles") or [{}])[0]
        rows.extend([
            ("section", "CAPTURE & EVIDENCE"),
            ("normal", f"  Loop: {loop.get('status','unavailable')}  |  Phase: {loop.get('phase','—')}"),
            ("normal", f"  Last loop: {(loop.get('last') or {}).get('status','none')}"),
            ("normal", f"  Latest: {fmt_run(latest)}"),
            ("normal", f"  Local recordings: {len(captures.get('cycles') or [])} (recent index)"),
            ("normal", f"  Cloudflare upload: {'configured' if edge.get('configured') else 'not configured'}; automatic={edge.get('auto_push',False)}"),
            ("muted", "  Remote certificate pixels are NOT verified by this display."),
        ])
    rows += [
        ("divider", ""),
        ("section", "RECENT SUPERVISOR EVENTS"),
    ]
    events = event_rows()
    rows += [("normal", "  " + e) for e in events] if events else [("muted", "  No transitions recorded yet")]
    rows += [("divider", ""), ("section", "SERVICE OUTPUT · LAST LINES")]
    lines = tail(ROOT / ("vite.log" if mode == "vite" else "cinema.log"), 10, 28000)
    rows += [("muted", "  " + line) for line in lines] if lines else [("muted", "  Log stream appears after supervisor re-exec")]
    rows.extend([
        ("divider", ""),
        ("muted", "  Read-only monitor. Ctrl+C / q closes the report, NOT the service."),
    ])
    return rows


def paint(stdscr, rows):
    stdscr.erase()
    height, width = stdscr.getmaxyx()
    if height < 4 or width < 24:
        stdscr.addnstr(0, 0, "Increase terminal size", max(1, width - 1))
        stdscr.refresh()
        return
    for index, (kind, value) in enumerate(rows[:height - 1]):
        if kind == "divider":
            value = "─" * (width - 1)
        color = {
            "heading": 3, "section": 4, "good": 2,
            "bad": 5, "muted": 6, "normal": 1, "divider": 6,
        }.get(kind, 1)
        attribute = curses.color_pair(color) | (curses.A_BOLD if kind in ("heading", "section") else 0)
        try:
            stdscr.addnstr(index, 0, clean(value), width - 1, attribute)
        except curses.error:
            pass
    stdscr.noutrefresh()
    curses.doupdate()


def watch(stdscr, mode):
    try:
        curses.curs_set(0)
    except curses.error:
        pass
    curses.use_default_colors()
    for idx, fg in ((1, curses.COLOR_WHITE), (2, curses.COLOR_GREEN),
                    (3, curses.COLOR_CYAN), (4, curses.COLOR_YELLOW),
                    (5, curses.COLOR_RED), (6, -1)):
        curses.init_pair(idx, fg, -1)
    stdscr.nodelay(True)
    stdscr.keypad(True)
    cache = {"http": False}
    latest_remote = 0
    last_paint = None
    while True:
        now = time.time()
        key = stdscr.getch()
        if key in (ord("q"), 27):
            break
        if now - latest_remote > 2 or key == ord("r"):
            port = "5173/" if mode == "vite" else "8765/"
            cache["http"] = get_local(port) is not None if mode == "cinema" else ping(port)
            if mode == "cinema":
                cache["loop"] = get_local("8765/api/loop/status") or {}
                cache["captures"] = get_local("8765/api/captures") or {}
                if int(now) % 12 < 3 or "edge" not in cache:
                    cache["edge"] = get_local("8765/api/edge/status") or {}
            latest_remote = now
        status = read_json(STATUS)
        rows = report(mode, status, cache, last_paint, now)
        signature = tuple(rows)
        if signature != last_paint:
            paint(stdscr, rows)
            last_paint = signature
        time.sleep(0.35)


def ping(address):
    try:
        with urlopen("http://127.0.0.1:" + address, timeout=0.35) as response:
            return response.status == 200
    except (OSError, TimeoutError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("vite", "cinema"))
    args = parser.parse_args()
    curses.wrapper(lambda scr: watch(scr, args.mode))


if __name__ == "__main__":
    main()
