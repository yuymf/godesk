# GoDesk ChatCut-form acceptance ledger

Date: 2026-07-30

## Evidence boundary

This ledger records verified local implementation and browser behavior. It does
not claim a production deployment, live OAuth, public marketplace publication,
or a human playtest.

## Local automated evidence

- App suite: 7 files, 28 tests.
- Worker suite: 3 files, 28 tests, including malformed nested patches,
  action-source build provenance, legacy Build normalization, Durable Object
  eviction/alarm recovery, immutable builds, tenant isolation, rooms, and
  replay reconstruction.
- Default-example tests instantiate both `harbor-13` and `mistpeak-lodge` as
  independent, source-anchored, executable projects and reject unknown
  third-party templates.
- TypeScript project references, production Vite build, Wrangler deployment
  dry-run, four Skill validators, Plugin validator, and `git diff --check`
  pass.
- MCP `tools/list` exposes 16 goal-oriented tools. Durable compile/playtest/
  preview/export work is only available through submit/track/retry jobs.
- The installed local Plugin version is
  `0.1.0+codex.20260730011500`.

## Browser evidence

- Installation contract: `http://127.0.0.1:8799/chatgpt-plugin` displays the
  one-sentence entry and the desktop host, bundled CLI, OAuth, verification,
  new-task, and recovery contract.
- Final collaboration project:
  `project_a61bad5f-89c2-45c2-8afd-0fa097e1bfa9`.
  The Editor at `/editor/:projectId` showed authoritative version 4 while
  retaining a version-3 unsaved Definition draft. Saving used the draft's
  version-3 baseline, returned a visible 409 conflict, retained the draft, and
  left the server's version-4 MCP content unchanged.
- Earlier end-to-end local browser evidence used immutable Build
  `build_cc662cfb77aca6e24eabbcae`, authoritative Room
  `room_82e374d8-ada3-4118-bbf4-47e67a994968`, and read-only Replay
  `replay_40045880-b21e-45a1-bae1-9ec022e6947c`. A legal room intent advanced
  the accepted-action log and Table State; replay inspection did not mutate the
  room.
- The Editor now shows rules, components, setup, actions, board zones, phases,
  scenarios, presentation, persistent changesets, jobs, builds, playtests, and
  rooms, and polls authoritative state every two seconds.
- The creator home visibly places `港口十三号` and `雾岭山庄` between project
  creation and recent projects. Both are labeled as original, playable
  mechanism slices. Browser acceptance copied `港口十三号` into project
  `project_1876834d-829d-41d2-a822-90f5420b0283`, compiled Build
  `build_4eca86370386a40abf045096`, created Room
  `room_7bde5cfd-2685-4420-bed2-6724ae695292`, accepted one action, and
  reconstructed Replay `replay_86753ae9-f269-4dc0-aa80-40ae3c6f9a68`.
- Production asset generation disables Vite's `public/` copy. The build
  assertion confirms `dist/manila` does not exist, so uncleared internal
  Manila photos and rulebook pages are not published with the site.

## Installation evidence

- Local Marketplace `godesk` resolves this checkout's
  `.agents/plugins/marketplace.json`.
- The bundled CLI at
  `/Applications/ChatGPT.app/Contents/Resources/codex` removed the cached old
  package, installed the current package, and listed it as installed and
  enabled.
- A fresh Codex task is responsible for the final no-repository-edit Plugin +
  local MCP acceptance. Task `019faee0-b9af-70d3-ac71-83566b590568` passed:
  it discovered all 16 tools, created
  `project_cfd11071-1a9a-4efc-8236-d8a0a4862e1b`, completed generation,
  versioned full-structure patch/readback, runtime configuration, immutable
  Build `build_fc1a6e9a1a7d73d39fb1bba5`, and preview jobs. Its final report
  explicitly labels the result localhost-only.

## Independent feature-location acceptance

- The specification reviewer located and observed the install page, Plugin,
  creator home, Editor, concurrent Editor/MCP conflict, 16-tool MCP surface,
  Build/preview, jobs, bot evidence, room, replay, and tenant-isolation paths.
- The standards reviewer independently re-ran the full matrix and accepted
  nested patch guards, legacy Definition/Build normalization, action
  provenance, and draft-baseline conflict handling.
- Both reviewers returned local PASS and retained production OAuth,
  publication, public reachability, and human-playtest gates.

## External gates

- The user has authorized commit and push. Publication evidence is recorded
  separately after the branch is pushed.
- The production `godesk` Worker is an older static deployment with no Durable
  Object binding or OAuth secrets. This refactor has not been deployed.
- Production configuration still requires
  `GODESK_AUTH_ISSUER`, `GODESK_AUTH_AUDIENCE`,
  `GODESK_WEB_CLIENT_ID`, `GODESK_WEB_CLIENT_SECRET`,
  `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`.
- The private application repository cannot serve as a public Marketplace.
  A separate public thin-plugin repository is recommended, but making a
  repository public still requires an explicit visibility decision.
- Public MCP reachability, live OAuth, public Plugin discovery, and the
  production one-sentence install-to-new-task journey remain unverified.
- Bot simulations are deterministic automated evidence only. No human
  playtest evidence is claimed.
