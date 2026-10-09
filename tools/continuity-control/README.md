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
