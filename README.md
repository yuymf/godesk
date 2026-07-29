# GoDesk — create editable tabletop games from Codex

GoDesk is a Codex-controlled tabletop creation platform. Codex is the natural
language control plane; GoDesk owns authenticated Game Projects, versioned Game
Definitions, immutable Playable Builds, deterministic rooms, and replays. The
same project remains visible and manually editable in the GoDesk Web Editor.
Definitions cover rules, components, setup, actions, board zones, phases,
scenarios, presentation, and explicit runtime support. Long generation,
compile, playtest, preview, and export work is persisted as recoverable jobs;
the Editor polls authoritative state while retaining a separate optimistic
version baseline for unsaved drafts.

The creator home includes two source-anchored default examples:

- `港口十三号`, an original public-safe replacement for the internal Manila
  mechanism fixture.
- `雾岭山庄`, an original cooperative exploration mechanism slice.

Both copy into real editable projects. Neither contains third-party rulebook
text, scenarios, art, or photos. Vite's public-directory copy is disabled so
the internal Manila evidence under `public/manila` is never shipped in `dist`.

## Product routes

- `/` — creator project home
- `/editor/:projectId` — authoritative project editor
- `/play/:buildId` — immutable playable build
- `/room/:roomId` — authoritative room
- `/replay/:replayId` — read-only replay
- `/chatgpt-plugin` — one-sentence Codex installation contract

The former player-first upload shell and Manila authoring experiments are no
longer product routes. Their code and source material remain internal fixtures
only. Manila assets are not cleared for redistribution; see
[`sources/manila/PROVENANCE.md`](sources/manila/PROVENANCE.md).

## Run and verify

```bash
pnpm install
pnpm dev
pnpm test
pnpm test:worker
pnpm typecheck
pnpm build
pnpm deploy:dry-run
```

Localhost uses an explicit development identity. It is not live OAuth evidence.

## Codex Plugin

The repo-local Marketplace is [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json)
and the thin plugin package is [`plugins/godesk`](plugins/godesk). It contains
brand metadata, workflow Skills, and the remote MCP declaration; no project
truth or rules execution lives in the Plugin.

The intended public install sentence is hosted at `/chatgpt-plugin`. A durable
public install additionally requires this repository revision to be pushed,
the Worker to be deployed, and a production OAuth provider to be configured.

## Production configuration

The Worker requires:

- `GODESK_AUTH_ISSUER`
- `GODESK_AUTH_AUDIENCE`
- `GODESK_WEB_CLIENT_ID`
- `GODESK_WEB_CLIENT_SECRET`

GitHub Actions also requires `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`. Never store secrets in the repository.

See [ADR 0002](docs/adr/0002-codex-controlled-creator-platform.md) and the
[ChatCut-form refactor specification](.scratch/godesk-chatcut-refactor/spec.md).
