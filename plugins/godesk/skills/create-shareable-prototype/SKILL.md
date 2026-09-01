---
name: create-shareable-prototype
description: Turn a game idea or source into a presentable GoDesk Shared Session and return its invitation URL. Use when a creator asks to make, share, or quickly test a rule-orchestrated game with friends.
---

# Create a Shareable Prototype

The success path is Idea or Source → playable finished game → invitation URL
that others can open and play. Presentation Floor and Playability Floor,
immutable Build, Studio embedded Shared Session, and a stable Playtest Link
exist to make that output real. A themed score-race stand-in is not delivery.
A Finding is optional.

## Workflow

1. Call `create_project`, then submit and track `generate-rule-system` with the
   idea and optional source content. Include harvested page images as
   `project-asset` entries in `visualInputs` when a PDF is
   supplied.
2. Read `generation-plan`, Sources, and the Rule System. Review the plan's
   loop, actions, assumptions, and unsupported behavior. If its runtime support is still `draft`,
   use one version-checked `apply_project_patch` to make the requested prototype
   explicit: update the Rule System fields and configure the smallest meaningful
   supported Kernel that matches the source genre (`hidden-role-v1` for secret
   identities and accusations, `hand-play-v1` for hidden hands, `conversation-relay-v1`
   for recorded speech, `harbor-voyage-v1` for placement, `score-race-v1` only
   when the source itself is a point race,
   `shared-goal-v1` for cooperative progress, or `turn-taking-v1` for an
   explicit bounded round-robin action loop with no inferred winner, or
   `take-away-v1` for an explicit finite shared pool and last-taken-wins loop,
   or `roll-and-move-v1` when die sides, movement by the roll, and a finish
   position are explicit, or `draw-and-score-v1` for an explicit finite shuffled
   deck, top-card draws, score-by-value, target, and exhaustion result). Do not
   substitute score-race for another genre. Give
   roll-and-move a visible safety turn limit with no invented winner;
   use `push-your-luck-v1` when repeated rolls, one bust face, unbanked score,
   voluntary banking, and a banked-score target are explicit. Give it a visible
   action safety limit with no invented winner. Mark Codex-proposed rules as
   `ai-proposed`, keep every unsupported behavior visible, and disclose the
   assumptions in the handoff. Then approve the pending plan with
   `approve_generation_plan` using the latest project version. Compile only an
   approved, executable Rule System.
3. Harvest and bind extracted art first. Use
   `generate-visual-fill` for missing art; without host generation capacity,
   apply typographic/programmatic presentation or a theme kit so the
   Presentation Floor supports the selected play surface.
4. Submit `compile-build` with the latest version and track it to terminal.
   Inspect warnings, unsupported behavior, `presentationFloor`, and
   `playabilityFloor`. If either floor is unmet, fix the gap and compile
   again; do not create a Shared Session.
5. If the creator named a question to test, persist it as a Design Hypothesis
   before sharing. Call `create_shared_session` with the immutable Build ID,
   explicit seed, stable idempotency key, and that exact `hypothesisId`.
   Otherwise create an explicitly exploratory Session without a hypothesis.
   Re-read the Session and verify its Experiment Brief. Open Web Studio and use
   the embedded Room for one Creator self-play action; verify the Accepted
   Action in the same Session State and Replay before sharing.
6. Create a fresh Shared Session for friends. Re-read the latest project version,
   apply `publish_shared_session` with that Room ID, then read the
   `playtest-link` view. Open the stable URL and verify it resolves to the
   selected Room. Publishing a later Room moves only the stable pointer; it
   leaves old Room URLs, Replays, feedback, and already-open sessions unchanged.
7. Tell friends they can claim a seat, play in the browser, and leave a rating
   plus short comment from that same URL. Each browser/client must claim exactly
   one seat before its first Intent; re-read the Shared Session to confirm the
   action and feedback were persisted before using them as design observations.
   When an Experiment Brief exists, the friend should answer its visible
   question; use that Session only with the same Design Hypothesis in a Finding.
8. Return the stable Playtest Link first and state that friends only need this
   browser link. Include the selected immutable Shared Session URL, Build URL,
   provenance, warnings,
   unsupported behavior, feedback count, and the Web Studio URL containing the
   Studio embedded self-play surface as secondary verification links.

Participant feedback is accepted only after that seat completes an action.
When reading it back, verify its Feedback Moment names the expected
`actionSequence` and `actionId` before using the exact snapshot in a Finding.

The Playtest Link is the complete friend handoff; do not give friends plugin
installation steps.
