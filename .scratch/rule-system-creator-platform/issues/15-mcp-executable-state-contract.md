# 15 — Expose every Executable Kernel state through MCP

Type: bug
Status: resolved

Blocked by: 14

## Question

Can Codex inspect and continue every executable Shared Session through the same
MCP contract, including the structured voyage state used by the `港口十三号`
example?

## Answer

The `harbor-voyage-v1` kernel already executed correctly over HTTP, but the MCP
`sessionState` schema only declared score and shared-goal fields. MCP now exposes
the complete bounded `voyage` state for Shared Sessions, accepted Actions, and
Replays. The pending Generation Plan path also refreshes its visible snapshot
after a focused candidate correction, so the review gate and control-plane
state remain aligned.

## Verification

- `pnpm test:worker` passes 4 files and 69 tests.
- The MCP regression creates `港口十三号`, compiles it, creates a Room, accepts
  `place:cedar`, and reads the placement through the MCP Replay.
- `pnpm typecheck` and `git diff --check` pass.

All evidence is automated local evidence. It does not assert public OAuth,
deployment reachability, or real-person human playtest acceptance.
