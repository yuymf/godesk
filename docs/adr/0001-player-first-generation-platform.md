# ADR 0001: Player-first end-to-end game generation

Status: superseded by ADR 0002

Date: 2026-07-23

## Context

The first Manila prototype and the previous planning handoff treated the primary
user as a tabletop creator who reviews extracted facts, resolves many
divergences, and compiles a project before playing.

The product owner clarified that this is the wrong product boundary. The
primary user is an ordinary player. They should be able to upload a rulebook PDF
and an asset atlas or material package, receive a playable digital game, open an
online room, and invite friends. Their own rules and artwork are valid inputs,
but they are not expected to understand or operate an authoring pipeline.

This decision supersedes the designer-first and manual-review-first framing in
the original PRD and the Manila next-phase handoff.

## Decision

The primary product journey is:

```text
upload rulebook and assets
  -> automatic rule and asset understanding
  -> generate missing images when needed
  -> assemble and verify a playable build
  -> create an online room
  -> invite friends and play
```

The system may ask one lightweight clarification step when a high-impact
ambiguity cannot be resolved safely. Clarification is an exception. The product
must not expose routine candidate review, source reconciliation, or project
compilation as player work.

Traceability, confidence, coverage, and source anchors remain internal platform
contracts. Clients still send intents to an authoritative game runtime, and
online room state must be synchronized and replayable.

## Consequences

- Upload-to-play conversion, image handling, rule compilation, and online rooms
  are core product scope, not later validation utilities.
- The Manila game remains a development fixture and a first generated output,
  not the product itself.
- Existing authoring variants may remain reachable for engineering diagnosis,
  but they are not the default or an end-user route.
- The default UI and issue sequence must be organized around player outcomes
  and automatic generation.
- The scope is technically larger than a manual editor, so automated pipeline
  evidence and honest partial-capability reporting are required.
