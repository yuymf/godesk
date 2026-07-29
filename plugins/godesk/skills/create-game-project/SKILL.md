---
name: create-game-project
description: Turn a tabletop game brief, rules text, or creator idea into a real editable GoDesk Game Project. Use when a creator asks to make, prototype, generate, or adapt a board game and expects a visible GoDesk editor rather than a document or code-only result.
---

# Create Game Project

Create the smallest honest playable prototype that preserves the creator's
intent and remains editable in GoDesk.

## Workflow

1. Extract the game's working name, player count, target duration, core
   decision, victory goal, and available source material. Make conservative
   defaults when details are non-blocking and state them.
2. Call `create_project` once and immediately open its returned editor URL.
3. Submit a `generate-definition` job with the creator's brief, working name,
   player count, and duration, then track it to terminal. This durably
   materializes the brief as a traceable Source and editable Definition; it
   does not claim to understand every prose rule.
4. Re-read the Definition. Add any supplied rulebook material as traceable
   sources, then apply focused patches for rules, components, setup, actions,
   board zones, phases, scenarios, and presentation that Codex can support
   honestly. Give rule-bearing facts source anchors and confidence.
5. For the current executable prototype, configure a clear `score-race-v1`
   kernel with a victory target, turn limit, and a small set of meaningful
   actions. Say plainly that this is a deterministic mechanics slice, not a
   complete implementation of arbitrary prose rules.
6. Re-read `overview`, `sources`, and `definition`.
7. Submit a `compile-build` job and track it to a terminal result. If warnings
   or unsupported behavior remain, report them before calling the project
   playable.
8. Submit and track a `render-preview` job, open its exact preview URL, and
   inspect it.
9. Submit and track one fixed-seed `bot-playtest` job. Return the durable job
   IDs, editor, playable build, and replay URLs.

## Content rules

- Preserve source provenance. Do not present generated interpretation as quoted
  rulebook text.
- Prefer one coherent core loop over many shallow systems.
- Do not call a fixture, mechanics slice, or automated simulation a complete
  game or human-validated experience.
