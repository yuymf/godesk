# GoDesk — upload rules, get a playable game

GoDesk is a ChatCut-style Codex Plugin and hosted runtime. ChatCut lets someone
install a Plugin, upload a video, and receive a finished film. GoDesk is the
same shape for rule-orchestrated games: a Creator or hobbyist uploads a script,
a rulebook, or a written idea and receives a playable, shareable game. Other
people join through a URL and play together. They do not install Codex.

The success bar is `source in → playable game out → others can play together`.
Design Hypotheses and Validation Findings are optional iteration tools, not
the product. Codex is the natural-language control plane. GoDesk owns
authenticated Game Projects, versioned Rule Systems, immutable Playable Builds,
authoritative Shared Sessions, and Replays. The same project stays visible in
Web Studio.

Rule Systems describe participants, rules, entities, setup, actions, play
surfaces, stages, outcomes, presentation, and explicit runtime support. A play
surface may be a conversation, cards, a screen, a scene, a table, or a hybrid;
tabletop is one presentation, not the product boundary. Long-running work is
persisted as recoverable jobs. Web Studio polls authoritative state while
preserving unsaved creator drafts.

Natural-language and source-driven generation also produces a durable
Generation Plan. The creator reviews its proposed loop, actions, assumptions,
and unsupported behavior in Web Studio or through MCP; GoDesk refuses a new
immutable Build for that generation until `approve_generation_plan` is recorded.
After approval, the same Rule System remains editable and can return to the
normal compile → play → feedback → focused iteration loop.

After an executable Build exists, Web Studio can create and show the latest
Shared Session inline. The Creator can claim a seat and take an action without
leaving the project; that action persists in the same Session State and Replay
used by the friend invitation URL. The invitation URL is the product handoff.

The creator home includes three rights-safe default examples:

- `港口十三号`, an original competitive harbor-voyage game.
- `雾岭山庄`, an original cooperative exploration mechanism slice.
- `灵感接力`, an original conversation game with no board or physical-component
  requirement.

All three copy into real editable projects and contain only GoDesk-authored
rules and programmatic presentation.

## Product routes

- `/` — creator project home
- `/studio/:projectId` — authoritative project workspace with embedded Creator self-play
- `/play/:buildId` — immutable Build preview
- `/room/:roomId` — authoritative Shared Session and friend invitation
- `/replay/:replayId` — read-only replay
- `/chatgpt-plugin` — one-sentence Codex installation contract

## Run and verify

```bash
pnpm install
pnpm dev:worker
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

`pnpm dev:worker` builds the client and starts the full local Worker + Assets +
Durable Objects flow at `http://127.0.0.1:8799`. `pnpm dev` remains a static Vite-only UI server; it
does not proxy `/api`, `/mcp`, or OAuth routes and is not a valid end-to-end
creator flow. `pnpm verify:local-routes` starts an isolated temporary Worker
state and checks the OAuth metadata, login/callback, and MCP route contracts.
`pnpm verify:local-loop` starts another isolated temporary Worker and exercises
the complete prompt → Generation Plan → approval → Build → fixed-seed self-play
→ Finding → revised Build → Shared Session → Replay loop against real HTTP
routes. `pnpm test:e2e` starts the local Worker and drives the user-visible charter
path in Chromium: home → playable Shared Session → friend join → action.
Unit tests and HTTP verifiers are not a substitute. `pnpm verify:local-mcp`
drives an isolated Worker through the Streamable HTTP MCP route, including
tool discovery, durable jobs, plan approval, Build/preview, self-play, Shared
Session, and Replay.
`pnpm verify:plugin:public` compares the separately published thin Plugin with
the local manifest, MCP declaration, Skill set, and current contract terms; it
is expected to fail while the public repository is on an older release.

Localhost uses an explicit development identity. It is not live OAuth evidence.

## Codex Plugin

The repo-local Marketplace is [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json)
and the thin plugin package is [`plugins/godesk`](plugins/godesk). It contains
brand metadata, workflow Skills, and the remote MCP declaration; no project
truth or rules execution lives in the Plugin.

Public installation is distributed from
[`yuymf/godesk-plugin`](https://github.com/yuymf/godesk-plugin), which contains
only the Marketplace manifest and thin Plugin bundle.

The intended public install sentence is hosted at `/chatgpt-plugin`. Friends
joining a Shared Session only need its URL; they do not install Codex or GoDesk.
A durable
public install additionally requires this repository revision to be pushed,
the Worker to be deployed, and a production OAuth provider to be configured.

Friends can leave a rating and short comment on the URL-only Shared Session.
That feedback is an optional iteration input, not the success criterion. The
journey succeeds when the invitation URL lets someone else sit down and play.

## Production configuration

The production Worker validates Cloudflare Access JWTs using:

- `GODESK_AUTH_ISSUER`
- `GODESK_AUTH_AUDIENCE`

GitHub Actions also requires `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`. Never store secrets in the repository.

See [AGENTS.md](AGENTS.md), [ADR 0011](docs/adr/0011-chatcut-playable-output-is-the-product.md),
and the [Rule System specification](.scratch/rule-system-creator-platform/spec.md).
