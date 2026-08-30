# ADR 0005: Rule System creator and validation platform

Status: accepted

Date: 2026-08-10

GoDesk is a ChatCut-style creator product for rule-orchestrated games, not a
tabletop-game generator. A Creator installs GoDesk's thin Skills package in
Codex, describes an idea or supplies optional sources, and receives an editable
Rule System plus a bounded Generation Plan. The creator explicitly reviews and
approves that plan before it can compile into an immutable Playable Build. Friends join a
Shared Session through a URL without installing Codex, and the Creator records
Validation Findings against explicit Design Hypotheses. GoDesk remains
authoritative for project versions, deterministic execution, sessions, and
replays; Codex is the natural-language control plane. Tabletop concepts become
one Play Surface and one family of Executable Kernels rather than required
fields in the root model. This supersedes ADR 0003's rulebook-required emphasis
and ADR 0004's board-game wording while retaining their source-first and
share-first lessons.

## Consequences

- The canonical flow is `idea or sources -> Rule System + Generation Plan ->
  approved plan -> Playable Build -> Shared Session -> Validation Finding ->
  revision`.
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
