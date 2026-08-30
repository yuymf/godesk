# ADR 0003: Rulebook-first creator onboarding

Status: superseded by ADR 0005. Product identity is ADR 0011.

Date: 2026-08-03

## Context

ADR 0002 made Codex the control plane and the Web Editor the authoritative
visible work surface, but left source upload behind internal prototype routes.
The product owner now requires the default GoDesk journey to match ChatCut's
prompt-first onboarding: attach source material, describe the intended
experience, and receive an editable project with a playable build.

## Decision

The creator home is a source-first generation surface. A creator supplies one
PDF, TXT, or Markdown rulebook (or pasted rules) plus a separate experience
description. One action must:

1. create a Game Project;
2. extract and persist the source in its Source Library;
3. generate a source-anchored Game Definition;
4. attach an explicitly labelled deterministic runtime;
5. compile an immutable Playable Build; and
6. open the same project in the Web Editor.

The Editor keeps the authority boundaries from ADR 0002. Generated structure
is editable evidence, not a claim that every source rule is executable. The
generic `score-race-v1` runtime remains visibly distinct from source-derived
rules, and bot evidence remains distinct from human playtesting.

The visual organization follows ChatCut's creator pattern: dark multi-panel
workspace, project rail, prompt/AI surface, source library, central viewer,
and durable job/build track. It does not copy ChatCut assets or brand marks.

## Consequences

- ADR 0002 remains in force for persistence, versioning, MCP, build, room, and
  replay authority.
- Its statement that upload UI is only an internal fixture is superseded by
  this source-first onboarding decision.
- Third-party rulebooks are internal acceptance inputs unless their rights
  permit publication. Extracted Manila content must not ship as a default
  public example.
- Local browser acceptance is sufficient for this workflow while production
  `workers.dev` reachability remains independently gated.
