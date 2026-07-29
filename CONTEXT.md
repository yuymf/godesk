# Domain Context

## Purpose

GoDesk lets a tabletop creator use Codex to create, edit, compile, test, and
share a real online game project. Codex plans and proposes changes; GoDesk is
authoritative for project versions, builds, rules execution, rooms, and replay.

## Glossary

- **Creator**: the person operating GoDesk through Codex and the Web Editor.
- **Game Project**: the tenant-scoped, versioned aggregate.
- **Source Library**: traceable briefs, rulebooks, images, and provenance.
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
