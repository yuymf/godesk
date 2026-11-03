<div align="center">
  <img src="src/assets/godesk-mark.svg" alt="GoDesk" width="72" height="72">

# GoDesk

**Upload rules. Get a playable game.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-10.15.1-f69220?style=flat-square)](https://pnpm.io)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020?style=flat-square)](https://workers.cloudflare.com)
[![License](https://img.shields.io/badge/license-Source--Available-lightgrey?style=flat-square)](./LICENSE)

[English](#) · [中文](README.zh.md) · [Glossary](docs/GLOSSARY.md) · [Design](DESIGN.md) · [ADRs](docs/adr/README.md)
</div>

GoDesk turns a script, rulebook, or written idea into a **playable, shareable** rule-orchestrated game. Friends join through a URL and play in the browser — they do not install Codex or GoDesk.

```
source in  →  playable game out  →  others can play together
```

Codex (or Web Studio) is the control plane. GoDesk owns authenticated Game Projects, versioned Rule Systems, immutable Playable Builds, authoritative Shared Sessions, and Replays. Design Hypotheses and Validation Findings are optional iteration tools, not the product.

## Features

- 🧩 **ChatCut-shaped flow** — install a Plugin or open the site → supply a source → get a joinable game
- 🎲 **Authoritative kernels** — disc-flipping, hex settlement, auctions, routes, hands, workers, hidden-role, conversation, …
- 🧊 **3D table by default** — Three.js presentation with quality tiers (ADR 0014)
- 🔗 **URL-only Shared Sessions** — seat claim, play, Replay; friends need no tooling
- 🔌 **Codex Plugin + MCP** — thin marketplace package; project truth stays on the Worker
- 🏗️ **Cloudflare Worker + Durable Objects** — one runtime for API, assets, OAuth, and rooms

## Quick start (Docker)

Full local stack (Vite assets + Worker + Durable Objects via `wrangler dev --local`):

```bash
git clone https://github.com/yuymf/godesk.git
cd godesk
cp .dev.vars.example .dev.vars   # local OAuth / share placeholders
docker compose up --build
```

Open **http://127.0.0.1:8799**.

> GoDesk is **not** a static Vercel app. Durable Objects and the Worker runtime are Cloudflare-only — there is no honest one-click Vercel Deploy button for the full product. Use Docker for local, Cloudflare for production.

## Quick start (pnpm)

Requirements: **Node.js ≥ 22**, [pnpm](https://pnpm.io) `10.15.1`.

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev:worker
```

`pnpm dev:worker` builds the client and starts Worker + Assets + DO at `http://127.0.0.1:8799`.  
`pnpm dev` is Vite-only UI — it does **not** proxy `/api`, `/mcp`, or OAuth.

Optional Tidewell asset search sidecar: [3d-asset-server](https://github.com/arielshad/3d-asset-server) on `http://127.0.0.1:8787` (`ASSET_SERVER_URL`). See [`docs/asset-server.md`](docs/asset-server.md).

## Deploy (Cloudflare)

One-command production path:

```bash
pnpm install
pnpm deploy          # build + wrangler deploy
# dry-run: pnpm deploy:dry-run
```

Or from the [Cloudflare dashboard](https://dash.cloudflare.com/) → Workers → Create → connect this repo (Workers Builds / Git integration).

Before first deploy, put secrets (never commit them):

```bash
wrangler secret put GODESK_SHARE_SECRET
wrangler secret put GODESK_WEB_CLIENT_ID
wrangler secret put GODESK_WEB_CLIENT_SECRET
```

Set GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` if you use [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The deploy job additionally requires secrets `GODESK_AUTH_ISSUER`, `GODESK_AUTH_AUDIENCE` and `GODESK_ACCESS_AUD` and injects them with `wrangler deploy --var` — self-hosting under your own Cloudflare account means filling those four secrets plus the Worker secrets above, with no edits to `wrangler.jsonc` required.

### Environment

| Name | Where | Required | Purpose |
|:---|:---|:---:|:---|
| `GODESK_SHARE_SECRET` | Worker secret | yes (prod) | HMAC for share / seat tokens |
| `GODESK_WEB_CLIENT_ID` | Worker secret | yes (prod) | Access SaaS OIDC client |
| `GODESK_WEB_CLIENT_SECRET` | Worker secret | yes (prod) | Access SaaS OIDC secret |
| `GODESK_AUTH_ISSUER` | GitHub secret → `--var` at deploy; `.dev.vars` locally | yes | Access OIDC issuer URL (placeholder in repo) |
| `GODESK_AUTH_AUDIENCE` | GitHub secret → `--var` at deploy; `.dev.vars` locally | yes | OIDC audience (client id) (placeholder in repo) |
| `GODESK_ACCESS_AUD` | GitHub secret → `--var` at deploy; `.dev.vars` locally | yes | Access application **AUD tag** (not the app UUID) (placeholder in repo) |
| `ASSET_SERVER_URL` | vars / `.dev.vars` | no | 3d-asset-server sidecar |

`account_id` is likewise not committed: `deploy.yml` resolves the account from the
`CLOUDFLARE_ACCOUNT_ID` repository secret, and local `wrangler` uses `wrangler login`
credentials (or the same env var — see [`.dev.vars.example`](.dev.vars.example)).
Because this repo is public, the Zero Trust identifiers above live **only** in
GitHub Actions secrets and the gitignored `.dev.vars`; the deploy job fails loudly
instead of shipping placeholders to production. Fresh clone → `cp .dev.vars.example .dev.vars`
→ fill values from your own Zero Trust dashboard → `pnpm dev:worker`.

Template: [`.dev.vars.example`](.dev.vars.example). Localhost uses an explicit development identity — not live OAuth evidence.

### Secret gate (and the 2026-10 history note)

On 2026-10-28 this public repository carried real Cloudflare Zero Trust
**identifiers** in `wrangler.jsonc` (`account_id`, the Access OIDC issuer URL, the
Access application AUD tags). They were moved out of git on 2026-10-29 — but by
hand, after the fact. The gate below is what stops a repeat:

```bash
pnpm secrets:check           # staged diff, offline — also installed as .git/hooks/pre-commit
pnpm secrets:check:all       # every file git would publish (this is what CI runs)
pnpm secrets:check:canary    # policy self-test: the rules still fire, the allowlist stays narrow
pnpm secrets:check:history   # full git history, for audits
pnpm secrets:install-hook    # opt-in commit interception on a new machine
```

Policy: [`.gitleaks.toml`](.gitleaks.toml) (Cloudflare Account ID / Access team
domain / OIDC issuer / AUD tag / `GODESK_*` hex literals, plus upstream
`generic-api-key`). The pinned gitleaks binary is checksum-verified once into
`~/.cache/godesk-secretscan` and never needs the network again. Allowlist entries
are line shapes, never whole files: the `wrangler types` banner hash, JSDoc
`@example` samples, `idempotencyKey:` test labels, and the documented
`REPLACE_ME` / `godesk-placeholder.invalid` placeholders. Findings always print
redacted — CI logs of a public repo are public.
GitHub-side, secret scanning and push protection are enabled on the repo;
non-provider patterns and validity checks stay off because they are paid
(GitHub Secret Protection) features, which is exactly why the repo owns the rule set.

**History triage — deliberate, and not rewritten.** `pnpm secrets:check:history`
reports **18 findings across 6 commits** (stock gitleaks rules without this repo's
policy report 33 across 11 — mostly `idempotencyKey` test labels). Re-extracting
every matched line at its own commit and comparing it against the real credential
values gives **0 credential hits**: no `GODESK_WEB_CLIENT_SECRET`,
`GODESK_SHARE_SECRET`, `GODESK_WEB_CLIENT_ID` or API-token value was ever in git,
so **nothing needs rotating**. The identifier-class residue is the Cloudflare
Account ID, the Access team domain / OIDC issuer (team host + app UUID) and the
Access AUD tags — note that `wrangler types` copies var values into the generated
`Env` literals, so `worker-configuration.d.ts` carried them too (2 commits); the
gate's rules cover that file, and HEAD carries none of them. These values are all
displayed in the Zero Trust dashboard by design, and the team domain is still
derivable from content this repo publishes today (the `workers.dev` hostname in
[`scripts/verify-production-smoke.mjs`](scripts/verify-production-smoke.mjs)).
Rewriting history (BFG / `git filter-repo` + force push) would therefore remove
nothing from the public surface while breaking every existing clone, leaving old
objects in forks and GitHub's caches, and buying a false "clean" signal. Decision:
**keep the history, document it here, and block new occurrences at commit time.**
Future auditors: findings in that class are triaged, not open incidents.

## Codex Plugin

Public thin package: [`yuymf/godesk-plugin`](https://github.com/yuymf/godesk-plugin). Install sentence is hosted at `/chatgpt-plugin`.

In this repo: Marketplace [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json), bundle [`plugins/godesk`](plugins/godesk) (Skills + remote MCP). No project truth runs inside the Plugin.

## Architecture

| Piece | Role |
|:---|:---|
| `src/` | React Web Studio, Room UI, 3D render, creator flows |
| `worker/` | Cloudflare Worker: API, MCP, OAuth, Durable Object rooms |
| `plugins/godesk` | Thin Codex Plugin (Skills + MCP declaration) |
| `docs/adr/` | Architecture Decision Records (start with 0011 / 0012 / 0014) |
| `wrangler.jsonc` | Worker, assets SPA, DO bindings, public vars |

### Product routes

| Route | Role |
|:---|:---|
| `/` | Creator home (composer + examples) |
| `/studio/:projectId` | Authoritative workspace + Creator self-play |
| `/play/:buildId` | Immutable Build preview |
| `/room/:roomId` | Shared Session |
| `/replay/:replayId` | Read-only Replay |
| `/try/:projectId` | Stable playtest link → pinned Session |
| `/chatgpt-plugin` | Codex installation contract |

Also mounted under `/chatgpt-plugin/*`.

### Play kernels

| Kernel | Shape |
|:---|:---|
| `disc-flipping-v1` | Reversi-style board |
| `hex-settlement-v1` | Hex-island resources & builds (Tidewell Isles) |
| `auction-bidding-v1` / `network-route-v1` / `hand-play-v1` / `worker-placement-v1` | Classic tabletop loops |
| `harbor-voyage-v1` / `hidden-role-v1` / `conversation-relay-v1` | Voyage / deduction / talk |
| `score-race-v1` / `turn-taking-v1` | Generic fallbacks |

### Default examples

| Example | Shape |
|:---|:---|
| `港口十三号` | Harbor voyage race |
| `雾岭山庄` | Hidden-role deduction |
| `灵感接力` | Conversation relay |

## Develop

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:worker
pnpm test:e2e          # needs Node ≥ 22; starts local Worker
pnpm build
pnpm verify:plugin
pnpm deploy:dry-run
```

| Command | Role |
|:---|:---|
| `pnpm test` / `test:worker` / `typecheck` / `build` | Unit + Worker tests; CI verify workflow |
| `pnpm test:e2e` | Playwright charter path: home → Shared Session → join → action |
| `pnpm verify:local-*` | Release-only local smokes (not in CI) |
| `pnpm deploy` | Production Worker deploy |

Pushing to `main` runs verify → deploy → production smoke → public Plugin publish → GitHub Release tag (`deploy-YYYY.MM.DD-…`). Set repo secret `GODESK_PLUGIN_SYNC_TOKEN` for Plugin sync.

## License

Source-available, **all rights reserved** — see [`LICENSE`](./LICENSE). Copyright (c) 2026 俞孟凡 (yuymf). You may view the code on GitHub; no license is granted to use, copy, modify, or distribute it. This is **not** MIT/Apache/GPL open source. Third-party components keep their own licenses ([`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md), [`assets/LICENSES.md`](./assets/LICENSES.md)).
