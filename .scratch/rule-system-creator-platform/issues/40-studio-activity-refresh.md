# Bound Studio Activity Refresh

Type: task
Status: resolved

## Question

Can Web Studio stay current while an embedded Room is running without polling
every project view every two seconds or issuing concurrent reads to the same
Durable Object?

## Answer

Yes. The Worker now exposes one read-only `activity` view containing the Game
Project version, persisted Jobs, and reconstructed Shared Sessions. Studio
reads that view once every five seconds through one recursive timeout chain.
It updates Jobs and Sessions directly, and performs the existing full project
load only when the project version or a Job's `id/status/updatedAt` activity
signature changes.

This preserves the important collaboration boundary: changes made through
Codex/MCP and Rooms created outside the current Studio tab remain visible. It
does not introduce a client cache, websocket protocol, or second state owner.

## Acceptance

Browser acceptance used Project
`project_b0ca290f-8acd-4cd7-9d32-5934c933d8b1`, Build
`build_f40467382ff9a06e9d0c75c0`, embedded Room
`room_e0134934-6dc3-4027-af8e-aa75587722eb`, and Replay
`replay_1d2772c4-8778-4a9a-a6b5-18988fbd03c4`. Studio remained responsive for
twenty seconds of background refresh. Codex claimed seat 0 and submitted
`connect` as Accepted Action sequence 1; Session State and Replay both retained
turn 1 and scores `3 / 0 / 0`.

Room `room_6755e0ef-ca5d-4f89-8548-a20a7e466220` was then created outside the
browser tab through the HTTP API. Within one activity interval, Studio selected
that exact newer Room and stayed on the same project URL. The final isolated
Worker remained listening after the observation window; the earlier concurrent
three-read prototype was discarded after reproducing a local Wrangler proxy
failure.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 26 tests, Worker 104 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.
