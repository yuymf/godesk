# GoDesk — create and validate rule-orchestrated games from Codex

GoDesk is an installable Codex Skills package and hosted runtime for creating,
sharing, and validating rule-orchestrated games. A creator can start with one
idea, optional rules text, a source document, or visual material. Codex is the natural-language
control plane; GoDesk owns authenticated Game Projects, versioned Rule Systems,
immutable Playable Builds, authoritative Shared Sessions, replays, Design
Hypotheses, Experiment Briefs, and Validation Findings. The same project remains visible and
manually editable in GoDesk Web Studio.

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
Shared Session inline. The Creator can claim a seat and submit an authoritative
action without leaving the project; that action persists in the same Session
State and Replay used by the independent friend invitation URL.

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
routes. `pnpm verify:local-mcp` drives the same kind of isolated Worker through
the actual Streamable HTTP MCP route, including tool discovery, durable job
tracking, plan approval, Build/preview, self-play, Shared Session, participant
feedback, same-project iteration, and Replay.
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

The feedback loop is explicit: friends can leave a rating and short comment on
the URL-only Shared Session. When the Creator binds a Design Hypothesis, the
Room snapshots its question and success signal as one immutable Experiment
Brief; feedback cannot be reassigned to a different hypothesis.
Each feedback entry also records the participant's latest Accepted Action as a
Feedback Moment, so the Creator can inspect the exact play context in Replay.
`validate-game-idea` reads that qualitative input,
records a `participant-feedback` evidence snapshot and one actionable `nextChange`; `iterate-from-finding` applies
that change to the same project, compiles a new immutable Build, and compares
fixed-seed self-play. Participant comments never become human evidence by
themselves.

## Production configuration

The production Worker validates Cloudflare Access JWTs using:

- `GODESK_AUTH_ISSUER`
- `GODESK_AUTH_AUDIENCE`

GitHub Actions also requires `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`. Never store secrets in the repository.

See [ADR 0005](docs/adr/0005-rule-system-creator-platform.md) and the
[Rule System creator specification](.scratch/rule-system-creator-platform/spec.md).
