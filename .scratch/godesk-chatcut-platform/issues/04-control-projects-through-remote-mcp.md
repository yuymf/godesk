# 04 — Control Game Projects through remote MCP

**What to build:** Codex can discover, create, target, read, patch, compile, and
preview the same authenticated Game Project through a small MCP surface while
the creator watches the exact Web Editor project.

**Blocked by:** 03 — Compile and preview an immutable Playable Build.

**Status:** completed

- [x] MCP tools provide project discovery, creation, targeting, exact editor
      handoff, bounded reads, source import, versioned patching, compilation,
      preview, duplication, and explicit destructive operations.
- [x] Tool inputs and structured outputs have exact schemas and appropriate
      behavioral annotations.
- [x] Core operations remain usable without custom UI.
- [x] MCP-side changes become visible in the open Web Editor and conflicts do
      not overwrite manual changes.
- [x] Active tool-schema contract tests pass independently of Skill prose.

## Verification

- Streamable HTTP `/mcp` uses the current stateless MCP SDK v2 factory and
  exposes 16 headless tools with input/output schemas and behavioral hints.
- Worker integration called `create_project`, `apply_game_patch`,
  `duplicate_project`, and the explicitly confirmed `delete_project` through
  JSON-RPC, then read the same state through the public project API.
- A real local MCP call changed the open project from v6 to v7; browser
  inspection of the existing Editor showed the exact MCP-authored pitch.
- Repository tests, 24 Worker/MCP contract tests, typecheck, production
  build, Wrangler dry-run, and `git diff --check` passed.
