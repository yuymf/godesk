# 09 — Retire the player-first product route

**What to build:** GoDesk has one canonical creator-platform route and domain
language, while reusable ingestion, provenance, deterministic runtime, and
internal Manila evidence survive behind the new contracts without exposing
superseded product experiments.

**Blocked by:** 03 — Compile and preview an immutable Playable Build; 05 — Run
playtests, rooms, and replays.

**Status:** completed

- [x] The creator-platform ADR supersedes the player-first ADR.
- [x] The glossary uses Creator, Game Project, Source Library, Game Definition,
      Playable Build, Changeset, Playtest, Room, and replay terms consistently.
- [x] The canonical route no longer exposes player-first generation or old
      authoring variants.
- [x] Reused code is reachable through the new contracts; misleading or
      orphaned routes created by the refactor are removed.
- [x] Manila licensing and completeness boundaries remain visible.
