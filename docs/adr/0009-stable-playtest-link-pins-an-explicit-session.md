# ADR 0009: Stable Playtest Link pins an explicit Shared Session

Status: accepted

Date: 2026-08-11

GoDesk gives each Game Project one stable Playtest Link whose target changes
only through an explicit Creator publication. It points to an immutable Shared
Session rather than dynamically selecting the newest Build or Room. This keeps
friend handoffs stable across iteration without silently exposing a draft,
switching an active session underneath participants, or rewriting old evidence.

## Consequences

- Publishing creates or selects a concrete Shared Session, then moves the
  project-level pointer with the current project version.
- New visitors follow the current pointer; already-open Room URLs, Accepted
  Actions, feedback, and Replays remain attached to their original Build.
- Creating a Build or Shared Session does not publish it automatically.
