#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ADAPTER_PORT="${BI_BLE_GITHUB_ADAPTER_PORT:-8787}"
ADAPTER_LOG="/tmp/bi-ble-github-adapter.log"

cleanup() {
  if [ -n "${ADAPTER_PID:-}" ]; then
    kill "$ADAPTER_PID" \
      >/dev/null 2>&1 || true

    wait "$ADAPTER_PID" \
      >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

pnpm editor:adapter \
  >"$ADAPTER_LOG" 2>&1 &

ADAPTER_PID=$!

adapter_ready=false

for _ in $(seq 1 50); do
  if curl \
    --fail \
    --silent \
    "http://127.0.0.1:${ADAPTER_PORT}/health" \
    >/dev/null
  then
    adapter_ready=true
    break
  fi

  if ! kill -0 "$ADAPTER_PID" \
    >/dev/null 2>&1
  then
    break
  fi

  sleep 0.1
done

if [ "$adapter_ready" != true ]; then
  echo
  echo "GitHub adapter did not become ready."
  echo
  cat "$ADAPTER_LOG" || true
  exit 1
fi

echo
echo "GitHub adapter ready on port ${ADAPTER_PORT}"
echo "Adapter log: ${ADAPTER_LOG}"
echo

pnpm editor:web
