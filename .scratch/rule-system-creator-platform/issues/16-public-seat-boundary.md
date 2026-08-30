# 16 — Enforce the public Shared Session seat boundary

Type: bug
Status: resolved

Blocked by: 15

## Question

Can a friend using only the invitation URL act as a claimed participant, while
the same browser cannot impersonate multiple seats or create an action before
anyone has joined?

## Answer

Public invitation requests now carry an internal public-share marker. The
authoritative Worker rejects a public Intent until its client has claimed the
requested seat, and rejects a second seat claim from the same client. The
authenticated/MCP control-plane path remains able to run deterministic
headless self-play without a browser seat, so this boundary does not block the
user-requested local iteration loop.

## Verification

- The public two-browser regression rejects `seat_not_claimed` before joining
  and `client_already_seated` for a second seat claim.
- Distinct clients still claim seats, submit ordered authoritative actions, and
  persist participant feedback.
- `pnpm test:worker` passes 4 files and 69 tests; `pnpm typecheck` and
  `git diff --check` pass.

All evidence is automated local evidence. It does not assert public OAuth,
deployment reachability, or real-person human playtest acceptance.
