---
name: edit-and-compile-game
description: Revise an existing GoDesk Game Project and compile an immutable playable build. Use when a creator asks to change rules, pitch, player count, duration, scoring, actions, victory target, or turn limit, or asks to rebuild after editing in the visible GoDesk editor.
---

# Edit and Compile a Game

Keep Codex edits and manual editor edits on the same optimistic-version path.

## Workflow

1. Identify the exact project with `list_projects`; never rely on hidden session
   state.
2. Call `read_project` for `overview` and the smallest affected `rules`,
   `components`, `board`, `scenarios`, or `entity` view before planning a
   change.
3. Open the exact editor URL if it is not already visible.
4. Translate the requested revision into the smallest supported
   `apply_game_patch` operations.
5. Pass the latest version as `expectedVersion` and a stable idempotency key.
6. If the server rejects a stale version, re-read and reconcile. Preserve
   creator changes; do not force an overwrite.
7. Re-read the changed view and confirm the visible editor reflects it.
8. Submit a `compile-build` job with the new current version and track it until
   succeeded or failed.
9. Read and open the immutable build from the terminal result. Report its
   definition version, warnings, and unsupported behavior.

## Build discipline

- A build snapshots one definition version. Later project edits must not change
  it.
- A successful compile may still contain warnings or unsupported behavior.
- Never substitute a new project for a requested revision unless the creator
  explicitly asks to branch or duplicate it.
