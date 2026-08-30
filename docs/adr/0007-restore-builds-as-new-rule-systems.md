# ADR 0007: Restore Builds as new Rule Systems

Status: accepted

Date: 2026-08-11

GoDesk restores a historical game version from its immutable Playable Build,
not from the project's Rule System branch list. Editing advances a Rule System
in place, while a Build retains the exact Rule System snapshot used by its
Shared Sessions, Replays, and Validation Findings. A restore therefore copies
that Build snapshot into a new active editable Rule System and records the
source Build ID on both the Rule System and Changeset.

## Consequences

- Restore never mutates or reactivates the Rule System inside an old Build.
- Existing Builds, Shared Sessions, Replays, and Validation Findings keep their
  original references and content.
- Rule System duplication remains the operation for parallel design branches;
  activation remains the operation for switching among those branches.
- A pending Generation Plan blocks restore, and every restore uses the current
  project version plus an idempotency key.
- Restoring a Build whose playable content already matches the active Rule
  System is rejected as `build_already_active` instead of creating a no-op
  branch. After later edits diverge from that content, the same Build may be
  restored again.
