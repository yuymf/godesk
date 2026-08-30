# 17 — Prove the Codex MCP control-plane loop over real HTTP

Type: acceptance
Status: resolved

Blocked by: 16

## Question

Does the installed Plugin's declared MCP surface support the same creator loop
over Streamable HTTP, rather than only passing direct Worker handler tests?

## Answer

The local verifier now starts an isolated full Worker and uses the actual `/mcp`
route with MCP initialize, initialized notification, tools/list, and
tools/call requests. It creates a prompt-and-source project, reads and approves
the Generation Plan, compiles and previews a Build, runs fixed-seed bot
self-play, creates a Shared Session, submits a legal action, and reconstructs
the Replay through MCP. It also asserts the current tool names are discoverable
and obsolete protocol names are absent.

## Verification

- `pnpm verify:local-mcp` passes the complete HTTP MCP control-plane loop.
- The verifier reports `mcp-initialize`, `mcp-tool-discovery`,
  `mcp-generation-plan-approval`, `mcp-build-preview`,
  `mcp-automated-playtest`, `mcp-shared-session-intent`, and
  `mcp-replay-reconstruction` as separate invariants.
- The test uses a local development identity only. It does not assert public
  OAuth, deployed reachability, fresh Codex task creation, or human playtest
  evidence.
