# ADR 0011: ChatCut-style playable output is the product

Status: accepted

Date: 2026-08-30

Supersedes: ADR 0005's product identity (validation platform / learning loop as
the success criterion). Retains ADR 0002's Codex Plugin + authoritative GoDesk
runtime. Restores ADR 0004's shareable-playable low bar as the product, and
raises it: the destination is a playable, shareable game that others can join,
not a Finding.

## Context

ChatCut is a Codex Plugin: a person installs it, uploads a video, and receives
a finished film they can use. GoDesk must be the same shape for rule-orchestrated
games. The primary users are Creators and hobbyists. They upload a script, a
rulebook, or a written idea and must receive a playable, shareable prototype —
and, as Kernels and presentation grow, mature playable game content. Other
people join through a URL and play together. They do not install Codex.

ADR 0005 recast the product as a validation and learning platform. Design
Hypotheses, Experiment Briefs, and Validation Findings are useful iteration
tools. They are not why the product exists. A journey that ends in a Finding
without a stranger being able to play has failed.

## Decision

The product charter is:

```text
install GoDesk in Codex, or open the website
  -> upload a script, rulebook, or written idea
  -> GoDesk generates a playable game
  -> that game can be shared so others play together in a Shared Session
```

Success is a playable, shareable output. Web Studio and Codex operate the same
Game Project. Generation Plan review, unsupported-behavior honesty, immutable
Builds, and Findings remain implementation contracts; they must not replace the
shareable game as the outcome.

## Consequences

- Judge work by "source in → others can play," not by editor completeness or
  Finding count.
- Friends need only the invitation URL.
- Tabletop is one Play Surface, not the product boundary.
- ADR 0005's evidence and plan gates stay as honesty machinery until a later
  ADR removes them; they are no longer the product story.
