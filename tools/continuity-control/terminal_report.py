#!/usr/bin/env python3
"""Read-only, low-overhead dashboard for the two former service terminals.

Usage: python3 terminal_report.py vite
       python3 terminal_report.py cinema
Press q to exit the report. The conductor owns the actual service processes.
No Git, GitHub, Cloudflare, or service mutation is performed.
"""
import argparse
import curses
import os
import sys
import json
from datetime import datetime
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


def group_metrics(pgid, prior, now):
    """Observe Linux process-group CPU/memory without spawning a process."""
    if not isinstance(pgid, int) or pgid <= 0:
        return {"members": 0, "rss_mb": None, "cpu_pct": None}, None
    ticks=pages=members=0
    try:
        for item in Path("/proc").iterdir():
            if not item.name.isdigit():
                continue
            try:
                data=(item/"stat").read_text(encoding="utf-8").rsplit(")",1)[1].split()
                if int(data[2]) != pgid:
                    continue
                ticks += int(data[11])+int(data[12])
                pages += int(data[21])
                members += 1
            except (OSError,ValueError,IndexError):
                continue
    except OSError:
        return {"members": 0, "rss_mb": None, "cpu_pct": None},None
    if not members:
        return {"members": 0, "rss_mb": None, "cpu_pct": None},None
    hz=os.sysconf("SC_CLK_TCK")
    mem=os.sysconf("SC_PAGE_SIZE")*pages/1048576
    cpu=None if prior is None or now<=prior[1] else round(max(0,100*(ticks-prior[0])/(hz*(now-prior[1]))),1)
    return {"members":members,"rss_mb":round(mem,1),"cpu_pct":cpu},(ticks,now)


def event_rows():
    records = []
    for line in tail(EVENTS, 14):
        try:
            event = json.loads(line)
            records.append(
                f"{str(event.get('at',''))[11:19]} {event.get('subject','')} "
                f"{event.get('state','')} {event.get('detail','')}"
            )
        except (ValueError, TypeError):
            continue
    return records[-6:]


def elapsed_label(checked):
    if not checked:
        return "never"
    try:
        stamp = datetime.strptime(checked, "%Y-%m-%dT%H:%M:%S%z")
        age = max(0, round(time.time() - stamp.timestamp()))
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
    perf = remote.get("perf") or {}
    cpu = perf.get("cpu_pct")
    rss = perf.get("rss_mb")
    cpu_label = "not sampled" if cpu is None else str(cpu)+"%"
    mem_label = "not sampled" if rss is None else str(rss)+" MiB"
    rows = [
        ("heading", f"  {heading}  |  127.0.0.1:{port}"),
        ("muted", f"  {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(now))}   q: quit report   r: refresh"),
        ("divider", ""),
        ("section", "RUNTIME"),
        ("good" if http_ok else "bad", f"  HTTP: {'200 OK' if http_ok else 'not responding'}   Ownership: {state.get(mode, 'unknown')}"),
        ("normal", f"  Supervisor PID: {state.get('supervisor_pid','?')}   Last poll: {elapsed_label(state.get('checked_at'))}"),
        ("good" if http_ok else "bad", f"  HTTP latency: {remote.get('latency_ms','—')} ms  |  CPU: {cpu_label}"),
        ("normal", f"  Process group: {perf.get('members','?')}  |  RSS memory: {mem_label}"),
        ("normal", f"  Git source: {state.get('cinema_source','legacy') if mode == 'cinema' else 'bi-ble checkout'}"),
        ("divider", ""),
        ("section", "SOURCE & GATES"),
        ("normal", f"  Branch: {local.get('branch','not adopted' if mode == 'cinema' else '?')}"),
        ("normal", f"  Commit: {local.get('head','—')}"),
        ("good" if local.get("state") in ("current", "updated") else "muted",
         f"  Git sync: {local.get('state','not adopted')}"),
        ("normal", f"  Incoming CI: {local.get('ci_workflows', 'not evaluated in this poll')}"),
        ("bad" if local.get("state") == "held" else "normal",
         f"  Hold reason: {local.get('reason', 'unknown; inspect status.json')}" if local.get("state") == "held"
         else f"  Hold reason: none"),
        ("normal", f"  Conductor: {str(conductor.get('head','?'))[:16]}  ({conductor.get('state','?')})"),
        ("divider", ""),
    ]
    if mode == "vite":
        rows.extend([
            ("section", "EDITOR OPERATIONS"),
            ("normal", "  Vite HMR follows verified changes in the pinned checkout."),
            ("good" if http_ok else "bad", f"  Live preview: {'responsive' if http_ok else 'unavailable'}; production held"),
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
            ("good" if (state.get("cinema_preview") or {}).get("locally_admitted") else
             "running" if (state.get("cinema_preview") or {}).get("state")=="checking" else "held",
             f"  Draft v0.7 preview: {(state.get('cinema_preview') or {}).get('state','not prepared')}  |  live: {(state.get('cinema_preview') or {}).get('locally_admitted',False)}"),
            ("normal", f"  Preview revision: {(state.get('cinema_preview') or {}).get('head','unavailable')}"),
            ("bad" if (state.get("cinema_preview") or {}).get("reason") else "muted",
             f"  Preview gate: {(state.get('cinema_preview') or {}).get('reason') or 'no reported obstruction'}"),
            ("good" if state.get("cinema_capture_runtime") in ("ready","ready: managed CI-admitted checkout")
             else "running" if str(state.get("cinema_capture_runtime","")).startswith("checking")
             else "held",
             f"  Chromium readiness: {state.get('cinema_capture_runtime','not yet checked')}"),
            ("good" if (state.get("cinema_runner_connection") or {}).get("state")=="online" else "held",
             f"  GitHub runner: {(state.get('cinema_runner_connection') or {}).get('state','unknown')}  |  busy: {(state.get('cinema_runner_connection') or {}).get('busy','unknown')}"),
            ("normal", f"  Local runner process: {state.get('cinema_ci_runner','not reported')}"),
            ("normal", f"  Launcher helpers: {'present' if state.get('cinema_runner_launch_files_ready') else 'unverified'}"),
            ("good" if loop.get("status")=="passed" else "held" if loop.get("status")=="held" else "running" if loop.get("status")=="running" else "normal",
             f"  Loop: {loop.get('status','unavailable')}  |  Phase: {loop.get('phase','—')}"),
            ("normal", f"  Last loop: {(loop.get('last') or {}).get('status','none')}"),
            ("bad" if loop.get("error") else "muted", f"  Loop hold: {(loop.get('error') or 'none')[:120]}"),
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
            "running": 7, "held": 8,
        }.get(kind, 1)
        attribute = curses.color_pair(color) | (curses.A_BOLD if kind in ("heading", "section") else 0)
        try:
            stdscr.addnstr(index, 0, clean(value), width - 1, attribute)
        except curses.error:
            pass
    stdscr.noutrefresh()
    curses.doupdate()


def watch(stdscr, mode, source_mtime):
    try:
        curses.curs_set(0)
    except curses.error:
        pass
    curses.use_default_colors()
    for idx, fg in ((1, curses.COLOR_WHITE), (2, curses.COLOR_GREEN),
                    (3, curses.COLOR_CYAN), (4, curses.COLOR_YELLOW),
                    (5, curses.COLOR_RED), (6, -1),
                    (7, curses.COLOR_CYAN), (8, curses.COLOR_MAGENTA)):
        curses.init_pair(idx, fg, -1)
    stdscr.nodelay(True)
    stdscr.keypad(True)
    cache = {"http": False}
    latest_remote = 0
    last_paint = None
    previous_usage = None
    while True:
        try:
            if Path(__file__).stat().st_mtime_ns != source_mtime:
                return 'reload'
        except OSError:
            pass
        now = time.time()
        key = stdscr.getch()
        if key in (ord("q"), 27):
            break
        if now - latest_remote > 2 or key == ord("r"):
            port = "5173/" if mode == "vite" else "8765/"
            started=time.perf_counter()
            cache["http"] = ping(port)
            cache["latency_ms"] = round((time.perf_counter()-started)*1000,1)
            status_sample=read_json(STATUS)
            service_pid=(status_sample.get("service_pids") or {}).get(mode)
            cache["perf"],previous_usage=group_metrics(service_pid,previous_usage,time.monotonic())
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
    try:
        mtime=Path(__file__).stat().st_mtime_ns
    except OSError:
        mtime=0
    action=curses.wrapper(lambda scr: watch(scr, args.mode, mtime))
    if action=='reload':
        # Curses has already restored the terminal before the code is replaced.
        os.execv(sys.executable,[sys.executable,str(Path(__file__).resolve()),args.mode])


if __name__ == "__main__":
    main()
