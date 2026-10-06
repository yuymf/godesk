#!/bin/bash
# round-6 ⑤: keep wrangler alive on GODESK_E2E_PORT (default 8844) during playwright.
# Usage: scripts/e2e-watchdog-8844.sh [extra playwright args...]
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH=/home/box/.local/node22/bin:${PATH:-}
export COREPACK_HOME=${COREPACK_HOME:-$HOME/.cache/corepack}
PORT="${GODESK_E2E_PORT:-8844}"
PERSIST="${GODESK_E2E_PERSIST:-.wrangler/e2e}"
LOG="${GODESK_E2E_WRANGLER_LOG:-/tmp/godesk-wrangler-${PORT}.log}"
ORIGIN="http://127.0.0.1:${PORT}"

ensure() {
  if curl -sf -o /dev/null --max-time 8 "${ORIGIN}/chatgpt-plugin/new"; then
    return 0
  fi
  echo "[watchdog $(date +%T)] restarting wrangler :${PORT}" >&2
  for p in $(pgrep -f "wrangler|workerd" || true); do
    cwd=$(readlink /proc/$p/cwd 2>/dev/null || true)
    case "$cwd" in
      "$(pwd)"|"$(pwd)"/*) kill -9 "$p" 2>/dev/null || true ;;
    esac
  done
  # also kill listeners on PORT
  if command -v fuser >/dev/null 2>&1; then fuser -k "${PORT}/tcp" 2>/dev/null || true; fi
  sleep 1
  mkdir -p "$(dirname "$PERSIST")"
  (setsid nohup pnpm exec wrangler dev --local --ip 127.0.0.1 --port "$PORT" --persist-to "$PERSIST" \
    >>"$LOG" 2>&1 < /dev/null &)
  for i in $(seq 1 120); do
    if curl -sf -o /dev/null --max-time 5 "${ORIGIN}/chatgpt-plugin/new"; then
      echo "[watchdog $(date +%T)] up after ${i}s" >&2
      return 0
    fi
    sleep 1
  done
  echo "[watchdog $(date +%T)] FAILED to bring up :${PORT}" >&2
  tail -40 "$LOG" >&2 || true
  return 1
}

# build once so wrangler serves fresh assets
pnpm build || exit 1
ensure || exit 1

# side watchdog loop
(
  while true; do
    sleep 15
    # stop when no playwright from this tree
    if ! pgrep -f "playwright test" >/dev/null 2>&1; then
      # still keep checking briefly
      sleep 5
      if ! pgrep -f "playwright test" >/dev/null 2>&1; then break; fi
    fi
    ensure || true
  done
) &
WD=$!

export GODESK_E2E_PORT="$PORT"
echo "[watchdog $(date +%T)] playwright start port=$PORT" >&2
set +e
pnpm exec playwright test --reporter=line --workers=1 "$@"
rc=$?
set -e
kill "$WD" 2>/dev/null || true

if [ "$rc" -ne 0 ]; then
  echo "[watchdog $(date +%T)] rerun --last-failed (rc=$rc)" >&2
  ensure || true
  set +e
  pnpm exec playwright test --reporter=line --workers=1 --last-failed
  rc=$?
  set -e
fi

echo "[watchdog $(date +%T)] DONE rc=$rc" >&2
exit "$rc"
