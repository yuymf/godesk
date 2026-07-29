# 02 — Import sources and version a Game Definition

**What to build:** A creator can add traceable Source Library entries, inspect
an editable Game Definition, change it from Codex-equivalent or manual editor
intents, and receive atomic changesets with optimistic conflict protection.

**Blocked by:** 01 — Create and reopen a Game Project.

**Status:** completed

- [x] Sources retain stable identity, readiness, provenance, and source anchors.
- [x] A Game Definition exposes rules, components, setup, phases, scenarios,
      presentation, and supported-runtime status through bounded views.
- [x] Every mutation requires an expected version and idempotency key and
      returns an atomic changeset.
- [x] A stale version applies nothing and returns current version plus affected
      entities for recovery.
- [x] Manual editor changes and service-side changes share the same version
      contract.

## Verification

- Worker integration proves idempotent changesets, bounded definition/source
  reads, provenance, and atomic 409 conflicts.
- Browser created a Source Library brief and changed the active Game Definition.
- Two simulated concurrent service changes proved stale Editor drafts apply
  nothing; the Editor refreshes to the authoritative version and remains usable.
- Repository tests, Worker tests, typecheck, build, and `git diff --check`
  passed.
