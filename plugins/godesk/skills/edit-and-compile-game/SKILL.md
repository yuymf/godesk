---
name: edit-and-compile-game
description: Revise an existing GoDesk Rule System and compile an immutable Playable Build. Use when a creator changes participants, rules, entities, actions, play surface, outcomes, scoring, shared progress, duration, goal target, or turn limit, or asks to rebuild after Web Studio edits.
---

# Edit and Compile a Game

Keep Codex edits and manual Web Studio edits on the same optimistic-version path.

## Workflow

1. Identify the exact project with `list_projects`; never rely on hidden session
   state.
2. Call `read_project` for `overview` and the smallest affected `rules`,
   `entities`, `surface`, `outcomes`, or `entity` view before planning a
   change.
3. Open the exact Web Studio URL if it is not already visible.
4. Translate the requested revision into the smallest supported
   `apply_project_patch` operations. Use `configure_score_race` for per-seat
   scoring, `configure_shared_goal` for one explicit cooperative progress
   track, or `configure_turn_taking` for an explicit bounded round-robin
   action loop without inferred scoring or a winner. Use
   `configure_take_away` for an explicit initial shared pool, legal take
   amounts, and last-taken-wins condition. Use `configure_roll_and_move` for
   explicit die sides, movement by the result, target position, and safety
   turn limit. Use `configure_draw_and_score` for explicit card values, copies
   per value, target score, and one draw action; preserve finite-deck and
   exhaustion semantics. Use `configure_push_your_luck` for explicit die,
   bust face, banked-score target, safety limit, and the canonical `roll` and
   `bank` actions. Do not silently change
   Kernel semantics.
5. Pass the latest version as `expectedVersion` and a stable idempotency key.
6. If the server rejects a stale version, re-read and reconcile. Preserve
   creator changes; do not force an overwrite.
7. Re-read the changed view and confirm Web Studio reflects it. If the project
   has a pending `generation-plan`, review it and approve it before compiling.
8. Submit a `compile-build` job with the new current version and track it until
   succeeded or failed. When the revision applies a persisted Validation
   Finding, pass that Finding as `basedOnFindingId`; otherwise leave the field
   absent.
9. Read and open the immutable build from the terminal result. Report its
   Rule System version, warnings, and unsupported behavior.

## Build discipline

- A build snapshots one Rule System version. Later project edits must not change
  it.
- To revise from a historical Build, call `restore_build_as_rule_system` with
  the latest project version, re-read the new active Rule System and its
  `restoredFromBuildId`, then apply focused edits and compile a new Build.
- A successful compile may still contain warnings or unsupported behavior.
- Never substitute a new project for a requested revision unless the creator
  explicitly asks to branch or duplicate it.
