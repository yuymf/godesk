---
name: godesk-plugin-basics
description: Operate authoritative GoDesk tabletop game projects safely from Codex. Use for any GoDesk creation, editing, compilation, playtest, room, replay, duplication, deletion, or editor-handoff request, including requests that mention a GoDesk project or an editable online board game.
---

# GoDesk Plugin Basics

Use Codex as the control plane and GoDesk as the authoritative project service,
deterministic runtime, and visible editing surface.

## Required workflow

1. Call `list_projects` or `create_project`. Never invent a project ID.
2. Open the exact URL from `get_editor_url` early so the creator can see and
   manually edit the same project.
3. Before every mutation, call `read_project` and use its current project
   version as `expectedVersion`.
   For list views, request a bounded `limit` and follow `page.nextCursor`
   instead of assuming the first page is complete.
   Use `rules`, `components`, `board`, `scenarios`, or `entity` views for
   focused inspection instead of loading the whole Definition.
4. Apply focused operations with `apply_game_patch`. Never rewrite a whole
   project to change one field.
5. Re-read the affected project view after a mutation. Tool success alone does
   not prove the editor-visible result.
6. Submit compilation, bot playtest, preview, and export work with `submit_job`.
   Keep the returned job ID and use `track_job` until it is terminal.
   If transport or execution fails, call `retry_job` so GoDesk reuses the
   persisted input, job ID, and underlying idempotency keys.
7. Treat each returned build as immutable.
8. For playable claims, open the returned build, room, or replay URL and inspect
   the visible state.
9. Use `duplicate_definition` before a risky rules experiment that should keep
   the same project's Source Library. Use `activate_definition` through
   `apply_game_patch` to switch variants; duplicate the whole project only when
   the creator asks for a separate access-control/versioning aggregate.

## Authority boundaries

- Let Codex interpret the creator's intent and propose content.
- Let GoDesk validate versions, persist project state, compile builds, accept
  room intents, and reconstruct replays.
- Do not use an LLM as a rules engine or update room state outside GoDesk.
- Treat `automated-bot-simulation` as automated evidence only. Never call it a
  human playtest.
- Report unsupported behavior and build warnings exactly as returned.

## Conflicts and destructive actions

On a version conflict, re-read the project, preserve the creator's visible
changes, and construct a new focused patch. Do not silently retry stale input.

Before `delete_project`, state the exact project name and ID and obtain explicit
confirmation. Pass the same ID as `confirmationProjectId`.
