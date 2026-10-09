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
