# Authoritative Room WebSocket Broadcast

Type: task
Status: resolved

## Question

Can friends see a Shared Session action immediately without every open Room
polling the complete Session once per second or creating another state owner?

## Answer

Yes. Each Room opens `/api/sessions/:id/events` as a Cloudflare Durable Object
Hibernation WebSocket. The browser requests one `session.sync` snapshot after
connect and reconnect. The connection stores only its `sessionId` as a
hibernation-safe attachment; the persisted Shared Session and immutable Build
remain the sole source of truth.

Seat claims, accepted Intents, and feedback still use their existing HTTP
transactions. Only after a successful transaction is persisted does the
Durable Object broadcast the resulting authoritative snapshot to sockets whose
attachment names that exact Room. There is no polling fallback, client-side
game state, new message bus, or WebSocket write path for game actions.

## Acceptance

The Worker test opens two Rooms on one creator Durable Object, verifies their
distinct serialized attachments, and proves that a seat claim and Accepted
Action reach only the matching socket. The Hibernation API owns the sockets;
the current Vitest eviction helper itself did not return for this stateful
object, so forced runtime eviction is not claimed as test evidence.

Fresh browser acceptance at `http://127.0.0.1:8829` used Project
`project_b4a1d516-6f3d-4124-995e-9788d026ad31`, Build
`build_be2b681fd380a50bce8d6644`, Room
`room_5b6fa495-1052-421e-9300-7042606a2c62`, and Replay
`replay_3504c62c-965a-480f-a9a6-79bb5e4697e5`. The initial Room load issued
one WebSocket upgrade and one Build read, with no Session polling during the
observation window. A separate HTTP client claimed seat 0 and submitted
`connect`; the already-open page showed turn 1, scores `3 / 0 / 0`, and
Accepted Action sequence 1 within the next 250 ms observation. Reloading the
Room opened a fresh socket and restored that exact persisted state. The Replay
retained the same action and final state.

This is local automated and agent-operated evidence, not a real-person
playtest, production deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 27 tests, Worker 105 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.
