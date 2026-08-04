# Domain Context

## Purpose

GoDesk turns a written or uploaded board-game rulebook into a shareable
playable prototype. Users reach that outcome through a ChatCut-style website
and/or an agent plugin; Codex may plan and edit, but GoDesk remains
authoritative for project versions, builds, rules execution, rooms, and replay.
The product low bar is rulebook in → shareable prototype out — not editor
completeness.

## Glossary

- **Creator**: the person who supplies a rulebook (and optional experience
  intent) and receives a shareable playable prototype. They may work in the
  website, through an agent plugin, or both.
  _Avoid_: treating "Creator" as synonymous with "professional author who must
  operate the full Web Editor."
- **Shareable Prototype**: a Playable Build exposed as a Room (or equivalent
  invitation) that other people can join and play, even when only a disclosed
  subset of the source rules is executable.
- **Game Project**: the tenant-scoped, versioned aggregate.
- **Source Library**: traceable briefs, rulebooks, images, and provenance. It is
  also the asset library for extracted rulebook images, uploaded art, and
  generated visuals bound into a prototype.
- **Generated Asset**: an image or visual produced for a missing or unusable
  component, always labeled with provenance (extracted, uploaded, or
  generative-API) and replaceable without rewriting rules.
- **Visual Floor**: the minimum presentable table presentation required before
  a Shareable Prototype may be invited. It may come from extraction, generation,
  or a designed fallback kit — never from pure text or naked placeholders alone.
- **Game Definition**: editable rules, components, phases, presentation, and
  supported deterministic runtime configuration.
- **Changeset**: one atomic, idempotent, expected-version mutation.
- **Build Job**: durable work tracked independently from one tool call.
- **Playable Build**: immutable output from one Game Definition version.
- **Playtest**: a recorded test against one build. Bot simulations are not
  human evidence.
- **Room**: an authoritative play session tied to one immutable build.
- **Intent**: a client-requested action.
- **Accepted Action**: a validated intent persisted in sequence.
- **Action Log**: the ordered accepted actions used for reconstruction.
- **Table State**: authoritative state reconstructed by the runtime.
- **Replay**: a read-only reconstruction that cannot mutate a live room.
- **Web Editor**: the visible collaboration surface for the same project Codex
  edits through MCP.

## Trust boundaries

- Every mutation requires the current project version and an idempotency key.
- Clients submit intents; only the deterministic service changes Table State.
- LLM output may propose content but cannot decide authoritative outcomes.
- Builds are immutable; rooms and playtests retain their exact build baseline.
- Automated, visual, deployed, and human evidence are reported separately.
- Source provenance and unsupported behavior remain visible.
- Manila materials are internal evidence, not licensed product content.
