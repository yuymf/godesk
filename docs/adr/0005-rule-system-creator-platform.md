# ADR 0005: Rule System creator platform (historical product identity)

Status: superseded by ADR 0011 for product identity

Date: 2026-08-10

Product identity is ChatCut-style playable output (ADR 0011): source in,
playable shareable game out, others join through a URL. The evidence and
Generation Plan contracts below remain implementation details until a later
ADR removes them. Do not treat a Validation Finding as the product success bar.

This ADR recorded how GoDesk generalized beyond tabletop and added honesty
machinery (Generation Plans, evidence types, Findings). A Creator installs
GoDesk's thin Skills package in Codex, describes an idea or supplies optional
sources, and receives an editable Rule System plus a bounded Generation Plan.
Friends join a Shared Session through a URL without installing Codex. GoDesk
remains authoritative for project versions, deterministic execution, sessions,
and replays; Codex is the natural-language control plane. Tabletop concepts
become one Play Surface and one family of Executable Kernels rather than
required fields in the root model. This superseded ADR 0003's rulebook-required
emphasis and ADR 0004's board-game wording while retaining their source-first
and share-first lessons.

## Consequences

- The implementation flow may still be `idea or sources -> Rule System +
  Generation Plan -> approved plan -> Playable Build -> Shared Session`. A
  Validation Finding is an optional later revision tool, not the destination.
- A prompt alone is a valid start; PDF, Markdown, text, and images are optional
  Source Library inputs.
- The root Rule System uses participants, Game Entities, stages, actions,
  outcomes, and a Play Surface. Board zones and physical components are
  tabletop-specific data, not universal requirements.
- A share link is an experiment handoff, not merely a publishing action.
- Generation Plans make the interpretation seam explicit: they summarize the
  proposed loop, actions, assumptions, sources, and unsupported behavior, and a
  pending plan blocks new Builds until `approve_generation_plan` is persisted.
- A Shared Session can carry one updatable participant rating/comment per
  claimed seat. That feedback returns to the same Game Project, while Replay
  remains an action-log artifact and human evidence still requires explicit
  creator attestation. A Finding may preserve the feedback as a separate
  `participant-feedback` snapshot without making a human claim.
- MCP Shared Session and Replay schemas expose the bounded state of each
  supported Executable Kernel, including structured voyage state rather than
  reducing a kernel to derived scores.
- Public invitation requests are seat-scoped: each client claims one seat before
  acting, while authenticated/MCP headless self-play is kept on its separate
  control-plane path.
- The Plugin's MCP declaration is exercised through a real local Streamable HTTP
  loop, so tool discovery and durable creator operations are verified at the
  transport boundary rather than only through in-process handler tests.
- Claims about arbitrary-game support remain capability-bounded: unsupported
  behavior is visible until an Executable Kernel implements it.
