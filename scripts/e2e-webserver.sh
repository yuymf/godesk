#!/usr/bin/env bash
# Playwright webServer entry: keep wrangler alive across transient workerd
# crashes (empty ✘ [ERROR] / OOM) so later e2e specs are not all
# ERR_CONNECTION_REFUSED. DO state persists under .wrangler/e2e.
set -uo pipefail
PORT="${GODESK_E2E_PORT:-8799}"
cd "$(dirname "$0")/.."
test -f .dev.vars || cp .dev.vars.example .dev.vars
pnpm build || exit 1
attempt=0
while true; do
  attempt=$((attempt + 1))
  echo "[e2e-webserver] start wrangler attempt=${attempt} port=${PORT}"
  # Do not `exec` — we need the loop after exit.
  pnpm exec wrangler dev --local --ip 127.0.0.1 --port "${PORT}" --persist-to .wrangler/e2e
  code=$?
  echo "[e2e-webserver] wrangler exited code=${code}; restarting in 2s"
  sleep 2
done
