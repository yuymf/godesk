# Nightly / cloud-computer Playwright e2e

Secret-free local e2e for this box (and any machine without real Cloudflare
Worker secrets). CI (`verify.yml`, ready PRs and the `full-e2e` label) runs the
same suite on Node 22; `deploy.yml` on `main` skips e2e unless dispatched with
`full_e2e=true` (see `docs/ci/actions-budget.md`).

## Prerequisites

- **Node.js ≥ 22** (Wrangler 4.x refuses Node 20). On this cloud computer put
  `/home/box/.local/node22/bin` first on `PATH` when the default is still Node 20.
- `pnpm` 10.15.1 (see `packageManager` in `package.json`).
- Chromium for Playwright (installed once below).

No production `wrangler secret` values are required. `playwright.config.ts`
copies `.dev.vars.example` → `.dev.vars` when the latter is missing; the
example file holds localhost placeholders only.

## Clone path

Any checkout works, for example `git clone https://github.com/yuymf/godesk.git`
and `cd godesk`. If corepack cannot write its default cache, set
`COREPACK_HOME="$HOME/.cache/corepack"` before running `pnpm`.

## One-shot recipe (Asia/Shanghai nightly)

```bash
export PATH="/home/box/.local/node22/bin:$PATH"
cd godesk
git fetch origin && git checkout main && git pull --ff-only origin main
test -f .dev.vars || cp .dev.vars.example .dev.vars
CI=true pnpm i --frozen-lockfile
pnpm exec playwright install chromium
# first time / bare image only:
#   pnpm exec playwright install-deps chromium
CI=true pnpm test:e2e
```

`playwright.config.ts` `webServer` builds the client, starts
`wrangler dev --local` on `127.0.0.1:8799`, and persists Worker state under
`.wrangler/e2e`. Expect every spec to pass (Chromium, single worker); the
human/live-proof rows in `sol-max-release-matrix.spec.ts` are skipped by design.

## Fail-fast Node check

`pnpm test:e2e` exits immediately if `process.versions.node` major is below 22,
so a Node 20 default does not surface as a cryptic webServer start failure.

## Out of scope

- `pnpm verify:production` (live workers.dev / Access) is not part of this
  secret-free nightly gate.
- Product / engine / Room behavior changes do not belong in this recipe doc.
