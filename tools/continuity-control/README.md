# Continuity Conductor — first GitHub → WSL evidence gate

This branch is based on bi-ble's existing unmerged continuity handoff branch, not on production `main`. It does **not** merge, deploy, publish screenshots, or grant execution authority.

## What is in GitHub

`tools/continuity-control/ci-gate.mjs` is a read-only CLI to compare the *actual checked-out commit* of each pinned repository with the exact-head GitHub Actions runs, requiring the local branch to be pinned and clean. It reports `green`, `held`, or `unverified` and never silently treats missing CI data as a passing check. Authentication for the private NICE-ROBIN repository is inherited from the local `gh` CLI; no token is embedded or printed.

Run this inside the bi-ble checkout:

```bash
node tools/continuity-control/ci-gate.mjs --report-only
```

Remove `--report-only` to make a non-green gate exit with code 2. This is a **report about GitHub CI**, not a replacement for the existing bi-ble or NICE-ROBIN tests.

## Local live development

In the separate Continuity Cinema v0.6 ZIP, `bash ./run-local.sh` loads protected local Cloudflare read/write credentials, starts Cinema in Node watch mode, and enables existing fast-forward-only fetch of two specifically pinned clean branches. The bi-ble Vite dev server on port 5173 applies local source edits using Vite HMR. Cinema itself stays on port 8765. Use the v0.6 ChatGPT Violentmonkey companion's **Run local cycle** action to request: *sync pinned branches → inspect CI status → capture the nine-stage browser sequence → record a local certificate*. It never automatically uploads private screenshots.

For users who explicitly choose to run the unmerged GitHub conductor branch locally, set `BIBLE_EXPECTED_BRANCH=feat/continuity-conductor-v1`; otherwise leave the existing `feat/continuity-handoff-v1` pin unchanged. **Do not switch a dirty checkout or discard local changes.**

GitHub code written here cannot directly manipulate an independently running WSL terminal. Live updates require a local agent or watcher; the Cinema `run-local.sh` session is that local counterpart. No CI pass alone implies production delivery.

## Next development boundary

The v0.6 controller remains distributed as a self-contained local package for now, not yet a tracked component of this repository. Integrating the Cinema source itself and moving its `captures/` archive outside the Git working tree are future steps, needed before GitHub pulls can safely update Cinema's own server and userscript code.

No real-world contract writes, deployment, merges, canonical realization, or independent witness are authorized by this gate.

## Third living terminal: GitHub pull → local reload

**One-time bootstrap in a third WSL terminal (no ZIP):**

```bash
mkdir -p "$HOME/.local/share/blochfield-conductor"
git clone --single-branch --branch feat/continuity-conductor-v1 \
  https://github.com/YasmindIess/bi-ble.git \
  "$HOME/.local/share/blochfield-conductor/source"
python3 "$HOME/.local/share/blochfield-conductor/source/tools/continuity-control/live_supervisor.py"
```

If that control checkout already exists, omit the clone and run only the Python command. The supervisor tracks its own branch, and after a CI-green update it re-executes the new supervisor code.

Pinned app branches: bi-ble at `~/bi-ble-cinema` on `feat/continuity-handoff-v1`; NICE-ROBIN at `~/nice-robin-cinema` on `feat/continuity-bounded-local-worker-v1`. Cinema stays at `~/continuity-cinema-v5-conversation-theater/continuity-cinema`.

**One-time service handoff:** Keep existing Vite running. Stop the old standalone Cinema using Ctrl+C in its terminal. The third terminal detects port 8765 becoming free, then starts Cinema itself via `run-local.sh` and Node watch mode. It never kills an externally started process.

Every 45 seconds it fetches pinned branches; requires a clean working tree, exact-head CI success for new commits, and fast-forward ancestry. Dirty, divergent, wrong-branch, wrong-origin, or unverified source is held. On updates, it restarts only services it owns. Externally started Vite receives code edits via HMR; NICE-ROBIN is a per-cycle bounded Python worker, not a persistent HTTP service.

**Inspect status:**

```bash
cat "$HOME/.local/state/blochfield-conductor/status.json"
```

Stop the third terminal with Ctrl+C to stop services it owns. It does not alter captures, credentials, GitHub PR merge state, Cloudflare publication, or production deployment.

**Remaining limitation:** Cinema source itself is not yet tracked as a standalone Git checkout. This supervisor restarts Cinema on upstream bi-ble/NICE-ROBIN updates and Node watch reloads local Cinema edits, but it cannot fetch new Cinema application code until that source is hosted in an approved Git checkout. This is a local development supervisor, not production CD.
## Cinema's private GitHub-native source (no ZIP)

The third-terminal supervisor can now switch Cinema to an independently versioned **private** repository, while preserving its original recordings in the existing legacy directory. GitHub migration is a deliberate one-time source-adoption action; the supervisor does not silently upload local files merely because it received an update.

After the supervisor updates itself to this feature revision, run:

```bash
python3 ~/.local/share/blochfield-conductor/source/tools/continuity-control/adopt_cinema.py
```

This is a dry-run listing only. If the path and source selection are correct, explicitly approve private source upload:

```bash
python3 ~/.local/share/blochfield-conductor/source/tools/continuity-control/adopt_cinema.py --approve-private-upload
```

This creates `YasmindIess/continuity-cinema` as a **private** GitHub repository, using only allowlisted application files from the already-running installation. It excludes `captures/`, `node_modules/`, hidden .env files, local credentials, and unrecognized screenshots. The known public CI fixture is copied only if it matches its pinned SHA-256. The original Cinema directory is not modified or deleted.

The supervisor observes the new Git checkout at `~/.local/share/blochfield-cinema/source`, waits for exact-head **green CI**, installs pinned npm dependencies, and only then switches its owned port 8765 runtime to that checkout. It supplies `CINEMA_CAPTURES_DIR` pointing to the original unchanged capture archive. On later GitHub pushes to `main`, it repeats CI-gated fast-forward and Cinema restart. A failed or missing CI run leaves the original runtime running.

`gh`, `git`, `npm`, and a correctly authenticated GitHub account with permission to create a private repository are prerequisites. If the target repository already exists, this script refuses to replace it. The original userscript has **not** been silently upgraded by this migration; Git-hosted Cinema scripts still need their own loader/distribution mechanism.

No PR merge, production deployment, NGU contract write, or authority promotion is performed.

## Two existing terminal windows as live, read-only reports

After the conductor pulls this CI-green update automatically, use the two previously idle terminals without stopping the supervisor:

bi-ble terminal:

```bash
python3 ~/.local/share/blochfield-conductor/source/tools/continuity-control/terminal_report.py vite
```

Cinema terminal:

```bash
python3 ~/.local/share/blochfield-conductor/source/tools/continuity-control/terminal_report.py cinema
```

Reports use Python's built-in curses and require no npm install or additional agents. They read the existing conductor JSON, append-only operational transition log, and per-service local output logs. HTTP checks are local and limited to 127.0.0.1. Polling runs at low frequency and redraws only on changed data; no Git fetches, Actions queries, or remote evidence reads are triggered by the reports.

Displayed facts include health and conductor ownership, exact source branch/commit, last synchronized state and CI gate details, conductor heartbeat, recent status transitions, service-output excerpts, and for Cinema the local capture/loop results plus private-upload configuration. The Cinema report deliberately does not claim to rehash private remote PNG bytes or independently witness execution.

Press q to close either report; this does not stop the Vite/Cinema processes. Their output is captured in private `~/.local/state/blochfield-conductor/vite.log` and `cinema.log` files, permission mode 0600. A state-change event log lives in `events.jsonl`. The conductor continues to own the services.

### Corrected first-time Cinema adoption

`adopt_cinema.py --approve-private-upload` now accepts an **authenticated owner-visible HTTP 404** as the expected indication that the private repository does not yet exist; the prior GraphQL `Could not resolve` error was incorrectly treated as an admission failure. Existing repository, wrong logged-in owner, 403, or unexpected GitHub errors remain blocked.

Private source creation is intentionally separate from read-only dashboards. Its one-time explicit command remains:

```bash
python3 ~/.local/share/blochfield-conductor/source/tools/continuity-control/adopt_cinema.py --approve-private-upload
```

The above approval will create and push allowlisted program files to a new private GitHub repo. It never includes private captures or Cloudflare secrets. No production deployment or authority promotion.
## Private Cinema Actions CI: separate WSL runner

The Cinema repository's first hosted `ubuntu-latest` run was blocked before the job started by a GitHub billing/spending annotation. **This is not a passing build and not an application failure.** NICE-ROBIN's registered repository runner does not automatically belong to the separate Cinema repository.

The [Cinema draft PR #1](https://github.com/YasmindIess/continuity-cinema/pull/1) therefore uses `[self-hosted, linux, x64, generalized]` and refuses fork-origin PR code. To enroll a separate runner, one explicit local operator action is required:

```bash
bash ~/.local/share/blochfield-conductor/source/tools/continuity-control/enroll_cinema_runner.sh --approve-repository-runner
```

The script verifies authenticated GitHub ownership and the private repository, copies only the executable distribution from the previously installed Blochfield/NICE-ROBIN runner into a **new isolated directory**, and registers a unique runner. It never changes an existing runner's `.runner` or `.credentials`, modifies account spending, or touches the Cinema application or its captures. The third-terminal supervisor then starts/owns the newly registered runner on its next poll, exposes `cinema_ci_runner` in status, and holds its own self-reexecution while that runner reports an active job.

The hosted `main` CI failure does not become green retroactively. A successful exact-head Cinema workflow must run on the registered repo runner; only after an explicitly reviewed integration into Cinema's pinned main branch can the conductor perform its CI-gated checkout cutover.

Terminal reports now sample Linux process-group CPU/RSS and actual HTTP latency; these values are observations, not fake activity. A reporter automatically restarts its curses drawing code when a GitHub-pulled file update changes its mtime, but never restarts its underlying server. The β×R userscript is still an independently installed browser extension and must follow its explicit browser-manager installation/update path.
## CI-verified immutable Cinema v0.7 local preview (no merge)

The living conductor may now prepare an **isolated localhost-only preview** from the private Cinema draft PR #1, without merging its `main` branch or modifying the legacy Cinema directory. It strictly checks the PR is open, owner-originated, targeted at `main`, on the pinned `feat/living-bxr-observatory-v1` branch, and that the **exact** 40-character HEAD has successful GitHub Actions results. A source-head change during fetch is rejected.

Only after admission does it create an immutable detached Git worktree at `~/.local/share/blochfield-cinema/previews/<sha>`, install the lockfile-pinned Playwright dependency, provision Chromium, and check that the executable exists. All slow installation occurs on a background worker, so the supervisor poll and two terminal reports stay responsive. The legacy runtime, captures, and the unmodified Cinema `main` checkout remain available.

When preparation succeeds, the conductor restarts **only its owned localhost Cinema** on port 8765, after confirming both local capture pathways are idle. Its runtime loads private credentials through the existing `run-local.sh`, explicitly clears legacy `PLAYWRIGHT_MODULE`, shares the original captures archive through `CINEMA_CAPTURES_DIR`, and requires verified CI for subsequent operator-initiated source synchronization. This is a locally admitted **draft preview**, not a merged release, public deployment, independently witnessed execution, or grant of chain authority.

`status.json` explicitly distinguishes `cinema_source: github-preview` and `cinema_preview: {state, head, reason, locally_admitted}`. When a newer PR commit has not passed CI, the old immutable preview continues running rather than accepting or overwriting unverified source. A failed preparation never deletes user evidence.

The new userscript is served by the admitted preview at `http://127.0.0.1:8765/userscripts/continuity-cinema-bridge.user.js`. Older already-installed Violentmonkey scripts cannot be forcibly replaced from local Node: the browser's userscript manager must authorize one installation/update to v0.7. After that, the metadata points future updates at this local URL. This is a browser security boundary, **not** a reason to download, unzip, or replace Cinema application files.

Acceptance remains observational: only `cinema_source=github-preview`, `cinema_preview.locally_admitted=true`, a live HTTP 200, and a new successful nine-frame capture establish that the full GitHub-to-local path was exercised. No claim of completed local cutover is made solely because GitHub CI passed.