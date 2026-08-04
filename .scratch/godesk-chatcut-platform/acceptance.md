# GoDesk ChatCut-form acceptance ledger

Date: 2026-08-03

## Evidence boundary

This ledger separates local, Cloudflare control-plane, independent public
network, OAuth, and human evidence. It does not claim a completed user OAuth
session or a human playtest.

## Local automated evidence

- App suite: 7 files, 31 tests.
- Worker suite: 4 files, 36 tests, including rulebook structure materialization,
  Cloudflare Access JWT claims,
  malformed nested patches,
  action-source build provenance, legacy Build normalization, Durable Object
  eviction/alarm recovery, immutable builds, tenant isolation, rooms, replay
  reconstruction, runtime invalidation, concurrent job idempotency, and
  queued-job alarm recovery.
- Default-example tests instantiate both `harbor-13` and `mistpeak-lodge` as
  independent, source-anchored, executable projects and reject unknown
  third-party templates.
- TypeScript project references, production Vite build, Wrangler deployment
  dry-run, five Skill validators, Plugin validator, isolated local route
  verification, and `git diff --check` pass.
- MCP `tools/list` exposes 16 goal-oriented tools. Durable compile/playtest/
  preview/export work is only available through submit/track/retry jobs.
- The installed local Plugin version is
  `0.1.0+codex.20260730011500`.

## Browser evidence

- The default creator route is now a ChatCut-form, prompt-first dark workspace
  with a project rail, rulebook attachment area, separate experience prompt,
  generation pipeline, source/definition panels, Build viewer, and durable job
  evidence. Desktop and 390x844 responsive layouts were visually inspected.
- An isolated local Worker at `http://127.0.0.1:8800` accepted the internal
  456.9 KB `sources/manila/manila-rulebook-en.pdf` plus the description
  "保留竞价、货船航行、海盗和港口结算的紧张感，生成 3 人、45 分钟的可编辑可玩版本。"
  from the visible browser UI. The one-action flow created Project
  `project_945a50a6-f3c0-4091-9969-55dad634c7c7`, source-anchored Definition
  version 2, and immutable Build `build_bd54193e7a7ce73381c7910c`, then opened
  the authoritative Editor at project version 3.
- The Editor visibly read back the uploaded PDF as `creator-upload`, the
  separate system runtime source, 20 rules, 6 components, 6 setup steps,
  6 actions, 4 board zones, 6 phases, executable `score-race-v1`, successful
  generation/compile jobs, and both persistent changesets.
- The generated Build route visibly rendered the four source-derived zones,
  six source-derived action cards, and three-player score track. All six
  extracted actions are mapped to room controls; `unsupportedBehavior`
  explicitly says that auction, movement, payment, random events, and original
  settlement are not executed by the score-race kernel.
- Browser acceptance ran fixed-seed bot job
  `job_8a2051fe-d70e-4e09-b543-3a0fafd065c7` to an 18-turn terminal result,
  created authoritative Room `room_61936eb0-a503-460b-b789-96a7ae54dc47`,
  accepted source-derived `source-action-1`, advanced Seat 0 from 0 to 1, and
  reconstructed read-only Replay `replay_5ddb8206-ef30-48a7-9c0c-6d959a82a6c6` with matching
  initial state, final state, and accepted-action log.
- This Manila run is internal engineering evidence only. Its extracted text is
  not a cleared public example, and the generic runtime is not a rules-complete
  Manila implementation or human playtest.
- Independent Luna Worker acceptance re-ran the live local flow and returned
  PASS for upload/generation, source provenance, structured Definition,
  source-derived executable controls, immutable Build, unsupported-behavior
  disclosure, durable jobs, fixed-seed bot, authoritative Room rejection, Replay,
  and the full automated matrix. Its overall completion verdict remains FAIL
  only because no real-human playtest record exists; automated evidence is not
  substituted for that external gate.

- Installation contract: `http://127.0.0.1:8799/chatgpt-plugin` displays the
  one-sentence entry and the desktop host, bundled CLI, OAuth, verification,
  new-task, and recovery contract.
- The trailing-slash installation URL `/chatgpt-plugin/` resolves to the same
  installation surface rather than falling through to the creator home.
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
- The Playable Build route visibly renders a structured board preview with
  zones, a score track, action cards, and exact unsupported behavior. It is
  explicitly labelled a structured visual preview, not a screenshot artifact.
  Replay routes visibly show Initial state, accepted actions, and Final state.
- The local route verifier starts Wrangler with an isolated temporary Durable
  Object state and checks both OAuth metadata paths, `/login`, `/oauth/callback`,
  and `/mcp` without interfering with the long-running browser server.
- Production asset generation disables Vite's `public/` copy. The build
  assertion confirms `dist/manila` does not exist, so uncleared internal
  Manila photos and rulebook pages are not published with the site.

## Public installation evidence

- Public repository `https://github.com/yuymf/godesk-plugin` is public and
  contains only the thin Marketplace, Plugin, five Skills, metadata, and
  production route verifier. Its default branch is `main`.
- The bundled CLI at
  `/Applications/ChatGPT.app/Contents/Resources/codex` removed the checkout
  Marketplace, added `yuymf/godesk-plugin --ref main`, installed
  `godesk@godesk`, and resolved the enabled package from
  `~/.codex/plugins/cache/godesk/`.
- The installed public package contains the production
  `https://godesk.yumengfan220.workers.dev/mcp` resource and all five validated
  Skills, including export-and-publish. The public repository was
  independently cloned before validation.
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
  Build/structured-preview, jobs, bot evidence, room, replay, and
  tenant-isolation paths.
- The strict reviewer independently re-ran the full matrix and accepted
  nested patch guards, legacy Definition/Build normalization, action
  provenance, draft-baseline conflict handling, runtime invalidation, job
  transaction claims, and replay state visibility.
- The reviewer returned local PASS and retained only production OAuth/OTP,
  authenticated remote MCP, and human-playtest gates.

## External gates

- The current acceptance branch is pushed to
  `origin/codex/chatcut-platform`; Draft PR
  `https://github.com/yuymf/godesk/pull/1` is open against `main`.
- Cloudflare production version
  `98ba7d10-c075-40da-acf9-aaf2496e407e` runs the refactored Worker with the
  `CreatorProjects` Durable Object, static assets, and Access issuer/audience
  bindings. Versioned preview URLs are explicitly disabled.
- Cloudflare Access now owns browser and MCP OAuth. The Worker validates the
  `Cf-Access-Jwt-Assertion` issuer, audience, expiry, and creator identity.
  Access application `35ecc084-9dfa-48af-8e36-25c062c3e794` has Managed OAuth
  and dynamic client registration enabled; its policy requires an authenticated
  email one-time PIN. A narrower bypass application keeps the installer,
  hashed assets, and both OAuth protected-resource metadata paths public.
- Public workflow run
  `https://github.com/yuymf/godesk-plugin/actions/runs/30759516709` passed from
  a GitHub-hosted runner: the installer HTML, hashed asset, both JSON metadata
  routes, and the protected creator root returned as expected; `/mcp` returned
  the Managed OAuth `401` plus `WWW-Authenticate` resource metadata.
- The current local network closes TLS connections to `workers.dev` before an
  HTTP response. The same failure occurs in `curl`, the in-app browser, and
  `codex mcp login godesk`. Cloudflare deployment state and the independent
  GitHub runner prove public service behavior, but an actual browser OTP
  authorization, authenticated remote MCP tool call, and automatic fresh-task
  handoff remain unverified.
- The Cloudflare account currently has no active DNS zone or Worker custom
  domain. A custom domain is therefore not silently assumed as a workaround
  for this network-specific `workers.dev` reachability failure.
- Future GitHub application deployment still requires
  `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` repository secrets; the
  completed production release used the authorized local Wrangler OAuth
  session.
- Bot simulations are deterministic automated evidence only. No human
  playtest evidence is claimed.
