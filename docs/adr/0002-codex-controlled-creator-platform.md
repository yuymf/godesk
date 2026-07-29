# ADR 0002: Codex-controlled creator platform

Status: accepted

Date: 2026-07-29

Supersedes: ADR 0001

## Context

The player-first upload flow made GoDesk itself responsible for hiding the
entire creation pipeline. The product owner instead chose the ChatCut pattern:
Codex is the natural-language control plane and GoDesk remains the visible,
authoritative specialist application.

## Decision

Package GoDesk as a thin Codex Plugin containing brand metadata, remote MCP
configuration, and workflow Skills. Keep identity, Game Projects, versioned
Game Definitions, compilation, deterministic runtime state, rooms, and replays
in GoDesk services.

Open the exact Web Editor early. Manual edits and Codex edits use the same
optimistic version contract. Compile immutable builds; never use an LLM as the
rules engine. Separate bot, visual, deployment, and human evidence.

The canonical journey is:

```text
one-sentence install
  -> GoDesk OAuth
  -> fresh Codex task
  -> Game Project + visible editor
  -> versioned changes
  -> immutable build
  -> deterministic playtest / room / replay
```

## Consequences

- ADR 0001's player-first route is no longer canonical.
- The old upload and Manila authoring UIs remain internal fixtures only.
- Plugin success requires more than package validation: fresh-task discovery,
  OAuth, real MCP calls, and editor-visible verification are separate gates.
- Production publication cannot be claimed until the repository revision,
  Worker deployment, and OAuth provider are live.
