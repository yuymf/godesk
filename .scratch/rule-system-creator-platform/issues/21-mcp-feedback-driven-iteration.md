# 21 — Prove MCP feedback-driven iteration on the same project

Type: acceptance
Status: resolved

Blocked by: 17, 18

## Question

After MCP records a participant-feedback Finding, can Codex apply its focused
next change to the same project and compare a new Build without rewriting the
motivating Build?

## Answer

Yes. The Streamable HTTP verifier now reads the Finding, applies a versioned
`configure_shared_goal` change to the same project, compiles a second immutable
Build, reruns seed 42, and confirms the first Build still has its original
action value. The new Replay reaches the shared target and remains labeled as
automated evidence.

## Verification

- `pnpm verify:local-mcp` passes `mcp-feedback-driven-iteration`.
- The verifier reports both old/new Build IDs and the second Playtest ID.
- This is local MCP/self-play evidence; it does not establish public OAuth or
  real-person participation.
