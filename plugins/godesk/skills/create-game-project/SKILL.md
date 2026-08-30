---
name: create-game-project
description: Turn a creator idea, optional rules text, or source document into an editable GoDesk rule game. Use when a creator asks to make, prototype, generate, or adapt a conversation, card, screen, scene, table, or hybrid game and expects a playable shared result.
---

# Create Game Project

Create the smallest honest playable prototype that preserves the creator's
intent and remains editable in GoDesk.

## Workflow

1. Extract the game's working name, participant range, target duration, core
   decision, victory goal, and available source material. Make conservative
   defaults when details are non-blocking and state them.
2. Call `create_project` once and immediately open its returned Web Studio URL.
3. Classify every supplied image before submission: use `visual-reference`
   when it only guides style/composition, and `project-asset` when the creator
   wants the exact pixels in the game. Submit the idea, optional text source,
   and classified images as `visualInputs`, plus working name,
   participant range, and duration; then track it to terminal. This durably
   materializes an editable Rule System, Source Library entries, and a pending
   Generation Plan. Visual References remain unbound; Project Assets may shape
   presentation. Neither is evidence for inventing rules, and the job does not
   claim to understand every prose rule.
4. Re-read `generation-plan` and the Rule System. Inspect the proposed loop,
   actions, assumptions, and unsupported behavior. Apply focused corrections
   while the plan is still pending; GoDesk refuses a new Build until this gate
   is explicit.
5. Add any supplied source material as traceable
   sources, then apply focused patches for rules, constraints, entities, setup,
   actions, play surface, stages, outcomes, and presentation that Codex can support
   honestly. Give rule-bearing facts source anchors and confidence.
6. For the current executable prototype, configure exactly one clear
   Executable Kernel. Use `score-race-v1` for explicit per-seat scoring and a
   winner, `shared-goal-v1` for explicit cooperative progress toward one
   shared target, or `turn-taking-v1` when the source explicitly describes
   players taking turns with a bounded action list. Use `take-away-v1` only
   when the source explicitly provides an initial shared pool, legal positive
   take amounts, and a last-taken-wins condition. Use `roll-and-move-v1` only
   when the source explicitly provides die sides,
   round-robin rolls, movement by the result, and a first-to-position target.
   Its fixed seed makes rolls replayable; a visible safety turn limit ends
   without inventing a winner.
   Use `draw-and-score-v1` only when the source explicitly provides a finite
   value set, copies per value, shuffled top-card draws without replacement,
   scoring by drawn value, a victory target, and highest-score deck exhaustion.
   Future deck order stays private; ties at exhaustion remain ties.
   Use `push-your-luck-v1` only when the source explicitly provides die sides,
   one bust face, repeated same-turn rolls, an unbanked turn score, voluntary
   banking that ends the turn, and a banked-score victory target. A visible
   action safety limit ends without inventing a winner.
   The turn-taking Kernel
   deliberately does not infer a winner, score, resources, or other rule
   resolution. Scoring, shared-goal, and turn-taking Kernels require a turn
   limit; take-away and draw-and-score terminate from finite resources. Every Kernel
   requires a small set of meaningful actions. Say plainly that this is a deterministic mechanics
   slice, not a complete implementation of arbitrary prose rules.
7. Re-read `generation-plan`, the Rule System, and the current project version.
   Approve the plan with `approve_generation_plan` using that version.
8. Re-read `overview`, `generation-plan`, `sources`, and the Rule System through `rule-system`.
9. Submit a `compile-build` job and track it to a terminal result. If warnings
   or unsupported behavior remain, report them before calling the project
   playable.
10. Submit and track a `render-preview` job, open its exact preview URL, and
   inspect it.
11. Submit and track one fixed-seed `bot-playtest` job. Create a Shared Session,
   open Web Studio, and use the Studio embedded Room for the Creator's first
   self-play action. Re-read the Shared Session and Replay to verify the same
   Accepted Action and Session State. Then create a fresh friend Room, re-read
   the project version, apply `publish_shared_session`, and verify the
   `playtest-link` URL resolves to it. Return that stable Playtest Link first,
   followed by the immutable Room, durable job, Web Studio, Build, and Replay
   URLs.

## Content rules

- Preserve source provenance. Do not present generated interpretation as quoted
  rulebook text.
- Prefer one coherent core loop over many shallow systems.
- Do not call a fixture, mechanics slice, or automated simulation a complete
  game or human-validated experience.
