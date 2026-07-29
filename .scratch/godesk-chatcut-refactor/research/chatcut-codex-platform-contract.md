# ChatCut and Codex platform contract

Research snapshot: 2026-07-29. Sources are limited to the installed ChatCut
0.2.20 bundle, the active ChatCut MCP tool schemas exposed to this Codex
session, and current first-party OpenAI documentation.

## Decision

Godesk should copy ChatCut's **layering**, not mistake every ChatCut workflow
rule for a Codex host requirement:

1. Ship a thin plugin containing workflow Skills, install metadata, and a
   remote Streamable HTTP MCP connection.
2. Keep authenticated project data and writes behind that MCP server.
3. Return structured, model-readable results from every tool; add MCP App UI
   only to bounded inspect/select/confirm interactions.
4. Return an exact editor handoff from project create/target operations, while
   keeping the full editor as Godesk's own web work surface.
5. Specify installation for the desktop plugin browser/private marketplace
   first, with CLI installation as a capability-tested secondary path.

## Platform requirements Godesk must honor

| Area | Current contract |
| --- | --- |
| Plugin package | `.codex-plugin/plugin.json` is the required entry point. `skills/`, `.mcp.json`, hooks, UI/app mappings, and assets live at the plugin root; manifest paths are `./`-prefixed and relative to that root. A plugin may contain Skills, MCP, or both. [Package your plugin](https://developers.openai.com/plugins/build/plugins), [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins) |
| Remote MCP | Codex supports Streamable HTTP MCP servers with bearer or OAuth authentication. The server owns tool names, descriptions, input/output schemas, annotations, auth requirements, structured results, and optional UI resources. [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp), [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server) |
| Authentication | Customer-specific data and writes require authentication. OAuth integrations must follow MCP OAuth 2.1: protected-resource metadata, authorization-server discovery, the `resource` parameter, authorization code + PKCE, an accepted client-registration mode, and issuer/audience/expiry/scope validation on every request. Tool-level linking additionally needs security metadata plus a runtime `mcp/www_authenticate` challenge. [Authentication](https://developers.openai.com/plugins/build/auth) |
| Tool results | If a tool returns `structuredContent`, declare an exact `outputSchema`. `structuredContent` and `content` are model-visible; result `_meta` is component-only. Read-only, destructive, open-world, and idempotent annotations inform host approval UX but do not replace server authorization. [Plugin reference](https://developers.openai.com/plugins/reference) |
| MCP Apps | Custom UI is optional. Associate a tool with a UI resource using `_meta.ui.resourceUri`; the iframe communicates using the MCP Apps bridge. New UI must retain a headless tool path. Prefer separate data tools and render tools so UI does not remount on every mutation. [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui) |
| Installation/runtime loading | Plugins are supported in ChatGPT Work web, ChatGPT desktop Work/Codex, and Codex CLI, but not the IDE extension or mobile. After installation, bundled Skills/tools load in a **new chat/session**. Private distribution can use a repo or personal marketplace; public distribution is a later reviewed submission. [Plugins](https://learn.chatgpt.com/docs/plugins), [Package your plugin](https://developers.openai.com/plugins/build/plugins) |

The locally installed `codex-cli 0.34.0` does not expose the current manual's
`codex plugin` or MCP-management subcommands (`codex mcp` only starts Codex as
an MCP server). Therefore, Godesk's private-install acceptance must detect the
actual host surface/version and must not promise one CLI command sequence as a
universal installation contract.

## What ChatCut 0.2.20 actually chooses

The installed manifest is thin: it points at `./skills/` and `./.mcp.json` and
declares Read/Write install metadata; its MCP config points at one HTTPS
endpoint, supplies a surface header, and uses that endpoint as the OAuth
resource. See
[`plugin.json`](/Users/halyu/.codex/plugins/cache/chatcut-inc/chatcut/0.2.20/.codex-plugin/plugin.json)
lines 1-45 and
[`.mcp.json`](/Users/halyu/.codex/plugins/cache/chatcut-inc/chatcut/0.2.20/.mcp.json)
lines 1-11.

The active schemas observed in this session confirm a live service contract,
not a local editor implementation:

- `list_projects`, `create_project`, `target_project`, and `get_editor_url`
  establish identity, project scope, and an exact user-visible editor handoff.
- `read_project` is staged and paginated; omitted collections are unknown, not
  empty. Explicit per-call `projectId` overrides session targeting.
- `view_timeline_frames` returns up to nine composed-frame resources and says
  pixels must be inspected before making a visual-verification claim.
- `ask_followup_questions` supplies one product-specific MCP App form (maximum
  12 fields, no file upload).
- `submit_export` returns durable render jobs and `track_export` reads their
  later state.

These schemas outrank stale Skill prose. For example, the installed base Skill
still names `render_cloud_screenshot`, while the active tool is
`view_timeline_frames`. ChatCut itself says to treat the active MCP manifest as
the runtime contract. See
[`chatcut-plugin-basics/SKILL.md`](/Users/halyu/.codex/plugins/cache/chatcut-inc/chatcut/0.2.20/skills/chatcut-plugin-basics/SKILL.md)
lines 16-20 and
[`verification/SKILL.md`](/Users/halyu/.codex/plugins/cache/chatcut-inc/chatcut/0.2.20/skills/verification/SKILL.md)
lines 55-66.

## Host requirement versus product choice

| Observed behavior | Classification | Consequence for Godesk |
| --- | --- | --- |
| Required plugin manifest; relative component paths | Host/package requirement | Follow exactly. |
| MCP tools with schemas, auth metadata, annotations, and structured results | Host/protocol requirement | Design a small controlled surface and validate every schema. |
| OAuth resource discovery, PKCE, token validation | Host/protocol requirement for authenticated writes | Implement before external creator projects are writable. |
| MCP App iframe/bridge | Optional host capability | Use for compact project pickers, review cards, diffs, and confirmations; do not make it the game editor. |
| Create/target a project, then immediately return/open the exact editor URL | ChatCut product choice enabled by host links/browser | Adopt as Godesk's creator onboarding rule. |
| Backend project state is authoritative; never write the database from Codex | ChatCut architecture choice | Adopt. Codex sends controlled intents; services persist accepted changes. |
| Refresh only relevant project state before nontrivial edits because the user may edit concurrently | ChatCut concurrency/workflow choice | Adopt, and add explicit project/version conflict semantics in a later Godesk decision; ChatCut's exposed schema does **not** establish `expectedVersion` as a host requirement. |
| Editable project/timeline is the checkpoint; flattened export is not the editing artifact | ChatCut product choice | Map to editable Game Definition versus immutable Playable Build. |
| Structural readback plus composed-pixel inspection before claiming success | ChatCut quality policy | Adopt as structural/compiler/runtime/render verification for Godesk. |
| Durable `submit -> job id -> track` export flow | ChatCut service design | Adopt for long generation, compile, render, and export work where synchronous calls would exceed tool timeouts. |
| `ask_followup_questions` field limit and no-upload rule | ChatCut tool-schema choice | Do not treat as a universal MCP Apps limit; design Godesk's own bounded review widgets. |
| Zero/DB/S3 paths, timeline/track/item model, exact tool names | ChatCut implementation detail | Do not copy. Map the pattern to Game Project, Source Library, Game Definition, and Playable Build. |

## Constraints to carry into later tickets

- The controlled MCP surface must never expose arbitrary database mutation or
  make Codex the deterministic game runtime.
- Every mutating result should be useful without UI and return stable IDs,
  affected entities, the resulting project/version state, warnings, and the
  exact editor handoff where relevant.
- The later concurrency decision must define Godesk's own optimistic-version or
  change-set contract; it cannot be claimed as inherited from Codex or ChatCut.
- MCP App widgets should be progressive enhancement around the Codex control
  plane. The Godesk Web Editor remains the high-fidelity, concurrently editable
  work surface.
- Installation acceptance must separately verify desktop private-marketplace
  install, authentication, new-session discovery, active tool schemas, and
  editor handoff. CLI commands are accepted only on a CLI build that actually
  exposes them.
