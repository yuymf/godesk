# Stable Playtest Link across iterations

Type: task
Status: resolved

## Question

Can a Creator give friends one durable playtest URL, then explicitly move that
URL to a revised Shared Session without changing an active Room or rewriting
the evidence collected from an older Build?

## Answer

Yes. Each Game Project can now publish one stable Playtest Link through the
existing versioned Changeset seam. `publish_shared_session` pins one explicit,
executable, presentation-ready Shared Session; `playtest-link` reads the
current pointer and its stable `/try/:projectId` URL. A new Build or Room never
publishes itself implicitly.

Studio's publish action creates a fresh Room from the selected immutable Build,
then moves the pointer. New visits redirect to that Room while previous Room
URLs, Accepted Actions, feedback, and Replays remain unchanged. Codex can use
the same operation and read view through MCP, and the bundled creation,
playtest, and Finding-iteration Skills return this stable friend handoff.

This adopts the mature separation between private iteration and an explicit
shared version. It does not copy Tesana's engine, marketplace, or source-code
ownership model.

## Acceptance

Fresh local browser acceptance used Project
`project_c6284be7-2891-4b66-8f57-807201dabd61` and Build
`build_374c8030a26ed817f21da8a0`. Studio first published Room
`room_b460d506-cf1c-407c-a16d-80c5d1639b80` at the stable URL
`http://127.0.0.1:8830/try/project_c6284be7-2891-4b66-8f57-807201dabd61?creator=local-creator`.
Codex opened that URL, claimed seat 0, and submitted `constraint`; Replay
`replay_8a19e35d-5472-42c5-97ef-f1b0869ac09a` retained Accepted Action 1 and
scores `[2, 0, 0]`.

Studio then published fresh Room
`room_8ddc73bb-c937-4c93-bb4f-36393850e18c`. The stable URL text did not
change, a new visit resolved to the new zero-action Room, and the already-open
old Room plus its Replay still exposed the original action. Browser acceptance
also caught and fixed the missing `/try/*` Worker-first asset route; without
that deployment configuration the SPA intercepted the redirect.

This is local agent-operated evidence, not a real-person playtest or public
deployment.

The final local matrix passed: frontend 28 tests, Worker 107 tests, typecheck,
production build, Worker route verification, 14-invariant HTTP creator loop,
17-tool / 22-invariant MCP loop, 12-Skill Plugin verification, deployment
dry-run, and diff whitespace checks.
