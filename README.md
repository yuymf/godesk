<div align="center">
  <img src="src/assets/godesk-mark.svg" alt="GoDesk" width="72" height="72">

# GoDesk

**Upload rules. Get a playable game.**

[![CI](https://github.com/yuymf/godesk/actions/workflows/verify.yml/badge.svg?style=flat-square)](https://github.com/yuymf/godesk/actions/workflows/verify.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-10.15.1-f69220?style=flat-square)](https://pnpm.io)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020?style=flat-square)](https://workers.cloudflare.com)

[English](#)
</div>

GoDesk is a ChatCut-style Codex Plugin and hosted runtime. ChatCut lets someone install a Plugin, upload a video, and receive a finished film. GoDesk is the same shape for rule-orchestrated games: a Creator uploads a script, a rulebook, or a written idea and receives a playable, shareable game. Other people join through a URL and play together. They do not install Codex.

```
source in  →  playable game out  →  others can play together
```

Codex is the natural-language control plane. GoDesk owns authenticated Game Projects, versioned Rule Systems, immutable Playable Builds, authoritative Shared Sessions, and Replays — the same project stays visible in Web Studio. Design Hypotheses and Validation Findings are optional iteration tools, not the product.

## Quick start

Requirements: **Node.js ≥ 22**, [pnpm](https://pnpm.io) `10.15.1` (see `packageManager` in `package.json`).

```bash
pnpm install
pnpm dev:worker
```

`pnpm dev:worker` builds the client and starts the full local Worker + Assets + Durable Objects flow at `http://127.0.0.1:8799`. `pnpm dev` is a static Vite-only UI server; it does not proxy `/api`, `/mcp`, or OAuth and is not a valid end-to-end creator flow.

Localhost uses an explicit development identity. It is not live OAuth evidence. Copy `.dev.vars.example` → `.dev.vars` for local OAuth placeholders.

### Codex Plugin

Public install is distributed from [`yuymf/godesk-plugin`](https://github.com/yuymf/godesk-plugin) (Marketplace manifest + thin Plugin bundle only). The intended public install sentence is hosted at `/chatgpt-plugin`.

Repo-local Marketplace: [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json). Thin package: [`plugins/godesk`](plugins/godesk) — brand metadata, workflow Skills, and the remote MCP declaration. No project truth or rules execution lives in the Plugin.

Friends joining a Shared Session only need its URL; they do not install Codex or GoDesk.

### Default examples

Creator home ships three rights-safe originals. Each copies into a real editable project with GoDesk-authored rules and programmatic presentation only:

| Example | Shape |
|:---|:---|
| `港口十三号` | Competitive harbor-voyage race (`harbor-voyage-v1`) |
| `雾岭山庄` | Hidden-role deduction: secret identities, open talk, accusations (`hidden-role-v1`) |
| `灵感接力` | Conversation game — no board or physical components (`conversation-relay-v1`) |

### Play kernels

Executable Builds run on one of these authoritative kernels (`src/runtime/`):

| Kernel | Play shape |
|:---|:---|
| `disc-flipping-v1` | Othello / Reversi board |
| `auction-bidding-v1` | Auction and bidding board |
| `hex-settlement-v1` | Catan-style hex settlement |
| `network-route-v1` | Route-claiming network map |
| `hand-play-v1` | Card hand / play area |
| `worker-placement-v1` | Worker placement regions |
| `harbor-voyage-v1` | Harbor dispatch and dice voyage |
| `hidden-role-v1` | Secret roles, speech, accusation |
| `conversation-relay-v1` | Turn-based conversation relay |
| `score-race-v1` / `turn-taking-v1` | Generic score track / turn order |

## Why this repo exists

| Without GoDesk | With GoDesk |
|:---|:---|
| Rules live in a doc or chat | **Versioned Rule System** — editable, compilable |
| “Looks playable” is subjective | **Immutable Playable Build** — share gate is playability |
| Friends need the same tooling | **URL-only Shared Session** — join and act in the browser |
| Feedback evaporates | **Replay + optional findings** — iteration input, not the product |

Success is the invitation URL letting someone else sit down and play. Ratings and comments on a Shared Session are optional; they are not the criterion.

## Product routes

| Route | Role |
|:---|:---|
| `/` | Creator project home (composer + original examples) |
| `/games` | Game gallery / lobby of the creator's projects |
| `/settings` | Creator settings |
| `/studio/:projectId` | Authoritative workspace with embedded Creator self-play |
| `/play/:buildId` | Immutable Build preview |
| `/room/:roomId` | Shared Session: invite link, seat claim, play |
| `/replay/:replayId` | Read-only replay |
| `/try/:projectId` | Stable playtest link; the Worker redirects to the pinned Shared Session |
| `/chatgpt-plugin` | One-sentence Codex installation contract |

Every route is also served under the public mount `/chatgpt-plugin/*` (home is `/chatgpt-plugin/new`).

## How it works

Rule Systems describe participants, rules, entities, setup, actions, play surfaces, stages, outcomes, presentation, and explicit runtime support. A play surface may be a conversation, cards, a screen, a scene, a table, or a hybrid — tabletop is one presentation, not the product boundary.

Natural-language and source-driven generation produces a durable **Generation Plan**. The creator reviews its proposed loop, actions, assumptions, and unsupported behavior in Web Studio or through MCP. GoDesk refuses a new immutable Build for that generation until `approve_generation_plan` is recorded. After approval, the Rule System stays editable for the normal compile → play → feedback → focused iteration loop.

After an executable Build exists, Web Studio can create and show the latest Shared Session inline. The Creator claims a seat and takes an action without leaving the project; that action persists in the same Session State and Replay used by the friend invitation URL. Long-running work is persisted as recoverable jobs. Web Studio polls authoritative state while preserving unsaved creator drafts.

Further reading: [AGENTS.md](AGENTS.md), [CONTEXT.md](CONTEXT.md), [ADR 0011](docs/adr/0011-chatcut-playable-output-is-the-product.md), [ADR 0012](docs/adr/0012-playability-floor-is-the-share-gate.md), [ADR index](docs/adr/README.md).

## Develop

```bash
pnpm install
pnpm test
pnpm test:worker
pnpm test:e2e
pnpm typecheck
pnpm build
pnpm verify:plugin
pnpm verify:plugin:public
pnpm verify:local-routes
pnpm verify:local-loop
pnpm verify:local-mcp
pnpm deploy:dry-run
```

| Command | Role |
|:---|:---|
| `pnpm test` / `pnpm test:worker` / `pnpm typecheck` / `pnpm build` / `pnpm verify:plugin` | CI (`verify.yml` on PRs, `deploy.yml` on `main`); Playwright runs in `verify.yml` for ready PRs (see [docs/ci/actions-budget.md](docs/ci/actions-budget.md)) |
| `pnpm test:e2e` | Starts the local Worker; Chromium charter path: home → playable Shared Session → friend join → action |
| `pnpm verify:local-routes` | OAuth metadata, login/callback, MCP route contracts |
| `pnpm verify:local-loop` | Full prompt → Generation Plan → approval → Build → fixed-seed self-play → Finding → revised Build → Shared Session → Replay |
| `pnpm verify:local-mcp` | Streamable HTTP MCP: tools, durable jobs, plan approval, Build/preview, self-play, Session, Replay |
| `pnpm verify:plugin:public` | Compares the published thin Plugin (`yuymf/godesk-plugin`) to the local contract; uses the unauthenticated GitHub API, so it can hit HTTP 403 rate limits |

`verify:local-routes`, `verify:local-loop`, and `verify:local-mcp` are release-only local smokes (shared temporary Worker bootstrap; overlap `test:worker` + Playwright) — not in CI. `verify:plugin:public` is not in CI; `deploy.yml` publishes the bundle to the public repo after each production deploy.

Cloud-computer / Asia/Shanghai nightly one-shot (Node ≥ 22, no real Worker secrets): **[docs/NIGHTLY-E2E.md](docs/NIGHTLY-E2E.md)**.

Set repository secret `GODESK_PLUGIN_SYNC_TOKEN` (write access to `yuymf/godesk-plugin`) so a push to `main` publishes the current bundle.

### Release records

Every successful production deploy is recorded as one GitHub Release. The `release` job in [`deploy.yml`](.github/workflows/deploy.yml) runs only after `verify` → `deploy` → production smoke → public Plugin publish have all passed, then creates a tag `deploy-YYYY.MM.DD-<run_number>-<run_attempt>` on the deployed commit with auto-generated notes (`gh release create --generate-notes`). The successful `deploy` job supplies this identity to `release`.

- View them at [Releases](https://github.com/yuymf/godesk/releases) — tag, deployed commit, and the merged PRs/changes since the previous deploy.
- Trigger: pushing to `main` (or re-running the `Verify and deploy Godesk` workflow from the Actions tab) does it automatically. There is nothing to run by hand.
- A full redeploy gets a new attempt suffix. Retrying only `release` reuses the deploy's tag and accepts an existing Release only when its tag points to the deployed SHA; it does not create another record.
- `node scripts/verify-release-records.mjs` checks full reruns, release-only retries, and mismatched tag targets with a local GitHub CLI stub. It does not publish a real Release.
- The tag is a deploy record, not a package version — `package.json` stays the source of the app version.

### Production configuration

Public Worker vars (`wrangler.jsonc`):

- `GODESK_AUTH_ISSUER`
- `GODESK_AUTH_AUDIENCE`
- `GODESK_ACCESS_AUD` — Access application **AUD tag** for *GoDesk Creator and MCP* (Zero Trust → Access → Applications → Overview). Production value is set in `wrangler.jsonc`. Do not use the application UUID (`35ecc084-9dfa-48af-8e36-25c062c3e794`) as the AUD. This is separate from the SaaS OIDC client ID in `GODESK_AUTH_AUDIENCE`.

Required Worker secrets (`wrangler secret put <NAME>` before deploy; production fail-closes if missing). Localhost may omit `GODESK_SHARE_SECRET` and use the local default:

- `GODESK_SHARE_SECRET`
- `GODESK_WEB_CLIENT_ID`
- `GODESK_WEB_CLIENT_SECRET`

GitHub Actions also needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Never store secrets in the repository.

## License

No SPDX license file is published in this repository yet.
