#!/usr/bin/env bash
# Explicit one-time enrollment of a separate private Cinema repository runner.
set -euo pipefail
umask 077
repo="YasmindIess/continuity-cinema"
dest="$HOME/.local/share/blochfield-cinema-runner"
state="$HOME/.local/state/blochfield-conductor"
source_runner=""
if [[ "${1:-}" != "--approve-repository-runner" ]]; then
  echo 'Dry run: explicit approval registers a new repository-scoped runner.'
  echo 'Use --approve-repository-runner to register. Existing runners are untouched.'
  exit 0
fi
for needed in gh git python3; do
  command -v "$needed" >/dev/null || { echo "Missing $needed" >&2; exit 1; }
done
for candidate in "$HOME/actions-runner-blochfield" "$HOME/actions-runner-ngu"; do
  if [[ -f "$candidate/config.sh" && -f "$candidate/run.sh" && -d "$candidate/bin" && -d "$candidate/externals" ]]; then
    source_runner="$candidate"
    break
  fi
done
[[ -n "$source_runner" ]] || { echo 'Existing trusted GitHub runner installation not found; held.' >&2; exit 1; }
[[ ! -e "$dest" ]] || { echo 'Cinema runner destination exists; refusing overwrite.' >&2; exit 1; }
gh auth status >/dev/null
account="$(gh api user --jq '.login')"
[[ "$account" == "YasmindIess" ]] || { echo 'GitHub owner mismatch; held.' >&2; exit 1; }
visibility="$(gh repo view "$repo" --json visibility --jq '.visibility')"
[[ "$visibility" == "PRIVATE" ]] || { echo 'Repository must be private; held.' >&2; exit 1; }
mkdir -p "$state" "$(dirname "$dest")"
chmod 700 "$state"
work="$(mktemp -d "${dest}.staging.XXXXXXXX")"
cleanup(){ if [[ ! -e "$dest" ]]; then rm -rf -- "$work"; fi; }
trap cleanup EXIT
cp -a "$source_runner/bin" "$source_runner/externals" "$source_runner/config.sh" "$source_runner/run.sh" "$work/"
[[ ! -f "$source_runner/env.sh" ]] || cp "$source_runner/env.sh" "$work/"
chmod u+x "$work/config.sh" "$work/run.sh"
token="$(gh api --method POST "repos/$repo/actions/runners/registration-token" --jq '.token')"
[[ -n "$token" ]] || { echo 'Registration token unavailable; held.' >&2; exit 1; }
name="continuity-cinema-$(hostname | tr -cd 'a-zA-Z0-9_-')"
(
  cd "$work"
  ./config.sh --unattended --url "https://github.com/$repo" \
    --token "$token" --name "$name" --labels generalized \
    --work _work --disableupdate >/dev/null
)
unset token
mv "$work" "$dest"
chmod 700 "$dest"
trap - EXIT
echo "Runner registered: $name (isolated from NICE-ROBIN)"
echo 'The third-terminal conductor will start it on its next poll.'
echo 'No hosted-runner billing, production deployment, or authority was changed.'
