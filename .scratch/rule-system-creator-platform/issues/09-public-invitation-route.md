# 09 — Make the invitation URL a real friend handoff

Type: task
Status: resolved

## Question

Can a friend open the Shared Session URL without installing GoDesk, signing in
to Codex, or receiving creator project access, while the creator's project and
MCP surfaces remain protected?

## Acceptance

- Shared Session, Build, and Replay links carry the routing context required to
  reach the owning creator Durable Object.
- A request from a non-local host with that context can load `/room/:id`, read
  the referenced Build, claim seats, submit legal intents, and read the Replay
  without an OAuth header.
- The same non-local host without the invitation context remains protected by
  the normal OAuth/login gate.
- Ordinary project routes and MCP authentication are unchanged.

## Answer

Implemented in the Worker and browser API client. Public share URLs carry a
`creator` routing query value; only the exact public Room/Build/Replay pages and
the minimal session endpoints accept it. The creator's project API and MCP
remain behind their existing scopes.

The existing two-client Worker acceptance test now exercises the invitation
path on `friend.godesk.example` without auth: it loads the Room, reads the
session and Build, claims both seats, submits two authoritative turns, and
reads the Replay. Removing `creator` returns the normal login redirect. The
evidence is local automated HTTP coverage; public deployment reachability and
real-person identity remain separate acceptance gates.
