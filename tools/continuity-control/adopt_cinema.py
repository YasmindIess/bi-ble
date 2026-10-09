#!/usr/bin/env python3
"""One-time, explicit private GitHub adoption of the existing local Cinema source.

No ZIPs. Does not overwrite the running installation, captures, or secrets.
Only an allowlist of program files is ever staged for GitHub.
"""
import argparse
import hashlib
import struct
import zlib
import os
from pathlib import Path
import shutil
import subprocess
import sys

HOME = Path.home()
LEGACY = Path(os.getenv("CINEMA_DIR", HOME / "continuity-cinema-v5-conversation-theater/continuity-cinema")).expanduser()
DEST = Path(os.getenv("CINEMA_GIT_DIR", HOME / ".local/share/blochfield-cinema/source")).expanduser()
REPO = "YasmindIess/continuity-cinema"
BRANCH = "main"

TOP = {
    "README.md", "CINEMA-V5.md", "index.html", "snapshot.json",
    "run-local.sh", "setup-capture.sh", "package.json", ".gitignore",
}
SUBDIRS = {
    "fixtures": {".json"},
    "userscripts": {".js"},
    "edge": {".mjs", ".toml"},
}
SOURCE_SUFFIXES = {".mjs"}
BAD_MARKERS = (b"-----BEGIN PRIVATE KEY-----", b"-----BEGIN OPENSSH PRIVATE KEY-----")
# CI fixture from the known, publicly reproducible bi-ble browser workflow.
APPROVED_FIXTURE_SHA256 = "b1bd089c1ac2c4d446da8890acbf7df2ab1cc6d9cba5a64705cbd6f9df8030e2"


def synthetic_png():
    def chunk(name, payload):
        return struct.pack("!I", len(payload)) + name + payload + struct.pack("!I", zlib.crc32(name + payload))
    return (b"\x89PNG\\r\\n\x1a\\n" + chunk(b"IHDR", struct.pack("!IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\x00\x00\x00\x00")) + chunk(b"IEND", b""))


WORKFLOW = """name: Continuity Cinema integrity and source tests
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci --no-audit --no-fund
      - run: npm test
      - name: Verify private evidence stays excluded
        run: |
          test ! -e captures
          test ! -e .env
          test ! -e node_modules/.cache
          node --check server.mjs
          node --check cycle-browser.mjs
"""


def command(argv, cwd=None, timeout=120):
    p = subprocess.run(argv, cwd=str(cwd) if cwd else None, text=True,
                       capture_output=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError((p.stderr or p.stdout or "command failed")[-700:])
    return p.stdout.strip()


def select_sources():
    if not LEGACY.is_dir() or not (LEGACY / "server.mjs").is_file():
        raise RuntimeError("Existing Cinema source directory unavailable; nothing changed")
    for p in LEGACY.rglob("*"):
        if p.is_symlink() and (p.parent == LEGACY or p.parent.name in SUBDIRS):
            raise RuntimeError("Symlink found in candidate program files; held")
    files = []
    for p in LEGACY.iterdir():
        if p.is_file() and (p.name in TOP or p.suffix in SOURCE_SUFFIXES):
            files.append(p)
    for subdir, suffixes in SUBDIRS.items():
        directory = LEGACY / subdir
        if directory.is_dir():
            files.extend(p for p in directory.iterdir() if p.is_file() and p.suffix in suffixes)
    if not {"server.mjs", "cycle-browser.mjs", "run-local.sh", "package.json"}.issubset(
        {p.name for p in files}
    ):
        raise RuntimeError("Required application files missing; cannot adopt incomplete Cinema")
    for p in files:
        raw = p.read_bytes()
        if len(raw) > 750_000 or any(marker in raw for marker in BAD_MARKERS):
            raise RuntimeError(f"Unapproved or sensitive program file: {p.name}")
        if p.name in ("snapshot.json", "package.json", "server.mjs") and b"CINEMA_EDGE_WRITE_KEY=" in raw:
            raise RuntimeError(f"Credential-like assignment in {p.name}; held")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approve-private-upload", action="store_true",
                        help="Explicitly approve pushing allowlisted Cinema program files to a new private GitHub repository")
    args = parser.parse_args()
    files = select_sources()
    print(f"Source: {LEGACY}")
    print(f"Destination: {DEST}")
    print(f"GitHub: {REPO} (private)")
    print(f"Program files: {len(files)}; screenshots/captures/credentials: EXCLUDED")
    if not args.approve_private_upload:
        print("DRY RUN. No GitHub or filesystem changes. Add --approve-private-upload to execute.")
        return
    if DEST.exists():
        raise RuntimeError("Managed checkout already exists. Never replace it automatically.")
    for cmd in ("git", "gh", "npm"):
        if not shutil.which(cmd):
            raise RuntimeError(f"Required local command missing: {cmd}")
    command(["gh", "auth", "status"])
    try:
        command(["gh", "repo", "view", REPO, "--json", "name"])
    except RuntimeError as exc:
        if "Could not resolve" in str(exc) or "authentication" in str(exc).lower():
            raise RuntimeError("Cannot verify target repository; refusing creation") from exc
    else:
        raise RuntimeError("Target GitHub repository already exists; refusing to modify it")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(mode=0o700)
    try:
        for src in files:
            rel = src.relative_to(LEGACY)
            target = DEST / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)
        fixture_source = LEGACY / "assets" / "bi-ble-roundtrip.png"
        fixture_target = DEST / "assets" / "bi-ble-roundtrip.png"
        fixture_target.parent.mkdir(parents=True, exist_ok=True)
        if (fixture_source.is_file() and not fixture_source.is_symlink()
            and hashlib.sha256(fixture_source.read_bytes()).hexdigest() == APPROVED_FIXTURE_SHA256):
            shutil.copy2(fixture_source, fixture_target)
        else:
            # Never upload an unrecognized local screenshot to GitHub.
            fixture_target.write_bytes(synthetic_png())
        server = DEST / "server.mjs"
        text = server.read_text()
        anchor = "const captures=path.join(root,'captures');"
        if anchor not in text:
            raise RuntimeError("Cannot externalize captures: expected server anchor missing")
        text = text.replace(anchor, "const captures=path.resolve(process.env.CINEMA_CAPTURES_DIR||path.join(root,'captures'));", 1)
        server.write_text(text)
        ignore = DEST / ".gitignore"
        ignore.write_text("node_modules/\ncaptures/\n*.log\n.env\n.env.*\n.edge*\n")
        workflow = DEST / ".github/workflows/ci.yml"
        workflow.parent.mkdir(parents=True, exist_ok=True)
        workflow.write_text(WORKFLOW)
        command(["npm", "install", "--package-lock-only", "--ignore-scripts",
                 "--no-audit", "--no-fund"], DEST, timeout=180)
        command(["git", "init", "-b", BRANCH], DEST)
        command(["git", "add", "-A"], DEST)
        staged = command(["git", "diff", "--cached", "--name-only"], DEST).splitlines()
        forbidden = [n for n in staged if n.startswith(("captures/", "node_modules/")) or n.endswith((".env", ".pem", ".key"))]
        if forbidden:
            raise RuntimeError("Sensitive paths staged; refusing to push: " + ", ".join(forbidden))
        command(["git", "commit", "-m", "feat: adopt bounded Cinema runtime as private version-controlled source"], DEST)
        command(["gh", "repo", "create", REPO, "--private", "--source", str(DEST),
                 "--remote", "origin", "--push"], DEST, timeout=150)
        # Prevent local captures from following the Git tree. The supervisor supplies
        # CINEMA_CAPTURES_DIR pointing to the untouched original archive.
        print("PRIVATE SOURCE CREATED:", REPO)
        print("Original capture archive untouched:", LEGACY / "captures")
        print("Conductor will adopt this source after exact-head CI passes.")
    except BaseException:
        if (DEST / ".git").exists():
            print("NOTICE: initial source checkout retained for diagnosis. No original files were changed.", file=sys.stderr)
        else:
            shutil.rmtree(DEST, ignore_errors=True)
        raise


if __name__ == "__main__":
    main()
