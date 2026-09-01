---
name: godesk-plugin-basics
description: Operate GoDesk from Codex to turn an idea into a playable, shareable game. Use when creating, compiling, opening a joinable session, publishing a friend URL, or inspecting a Replay. Validation Findings are optional follow-up tools, not the destination.
---

# GoDesk Plugin Basics

Use Codex as the control plane and GoDesk as the authoritative project service,
deterministic runtime, and visible Web Studio. The product output is a
playable, shareable Shared Session. Validation Findings are optional
iteration tools, not the destination.

## Required workflow

1. Call `list_projects` or `create_project`. Never invent a project ID.
2. Open the exact URL from `get_studio_url` early so the creator can see and
   manually edit the same project.
3. Before every mutation, call `read_project` and use its current project
   version as `expectedVersion`.
   For list views, request a bounded `limit` and follow `page.nextCursor`
   instead of assuming the first page is complete.
   Use `generation-plan`, `rules`, `constraints`, `entities`, `surface`, `outcomes`, `validation`, or `entity` views for
   focused inspection instead of loading the whole Rule System.
4. After `generate-rule-system`, read `generation-plan`. A pending plan is the
   creator's review gate; use `approve_generation_plan` with the current
   project version only after its summary, actions, assumptions, and
   unsupported behavior are acceptable.
5. Apply focused operations with `apply_project_patch`. Never rewrite a whole
   project to change one field.
6. Re-read the affected project view after a mutation. Tool success alone does
   not prove the Web Studio result.
   Treat `visual-reference` images as generation guidance only and
   `project-asset` images as bindable Rule System material. A generated Project
   Asset must retain its creator brief and every influencing Visual Reference
   in `basedOnSourceIds`.
7. Submit compilation, bot playtest, preview, and export work with `submit_job`.
   The Web Studio also exposes a bounded `iterate-rule-system` job for one
   explicit action-description rewrite; it records the prompt as a creator
   source, applies one versioned patch, and must be followed by compile and
   fixed-seed playtest tracking. It does not interpret rule numbers, action
   additions, or victory conditions.
   Keep the returned job ID and use `track_job` until it is terminal.
   If transport or execution fails, call `retry_job` so GoDesk reuses the
   persisted input, job ID, and underlying idempotency keys.
8. Treat each returned Build as immutable.
9. For playable claims, open the returned Build, Shared Session, or Replay URL
   and inspect the visible state. After compiling an executable Build, open Web
   Studio and use its embedded Shared Session for the Creator's first action.
   Verify that Studio stays on the same project URL and that the Accepted Action
   appears in the same Session State and Replay. The embedded Room is not a
   second runtime; it is the authoritative Shared Session shown inside Studio.
10. After a pending Generation Plan is approved, use `duplicate_rule_system`
    before a risky rules experiment that should keep the same project's Source
    Library. Use `activate_rule_system` through `apply_project_patch` to switch
    variants; pending plans intentionally block both operations so the approved
    plan cannot drift away from the Rule System that will be compiled. Duplicate
    the whole project only when the creator asks for a separate
    access-control/versioning aggregate.
    To return to an exact historical revision, use
    `restore_build_as_rule_system` on its immutable Build. This creates a new
    active editable Rule System with `restoredFromBuildId`; it does not mutate
    the old Build, Shared Sessions, Replays, or Findings.
11. Give friends a stable Playtest Link. Create a fresh Shared Session, then
    apply `publish_shared_session` with the latest project version and read the
    `playtest-link` view. Verify that URL resolves to the selected Room. A later
    publication moves the pointer without changing old Room URLs or Replays.
    When the Creator
    has a named Design Hypothesis, pass its ID to `create_shared_session` and
    verify the returned Experiment Brief before sharing. Friends see that
    question in the browser and do not install Codex.
12. Read `SharedSession.feedback` through `read_shared_session` or the project's
    `sessions` view after a friend submits feedback from that URL. Friends do
    not need an MCP write tool: the invitation URL is the write surface for
    seat claims, intents, and feedback.

## Executable Kernel choice

- `hidden-role-v1` executes secret roles, one public speech per seat, one
  accusation per seat, and majority reveal. Use it for 剧本杀 / hidden-role
  sources. Do not substitute a score race.
- `hand-play-v1` executes a shuffled deck, hidden hands, play-to-score, and
  first-to-target or highest score when hands empty.
- `conversation-relay-v1` records required speech into the transcript and
  scores the chosen action.
- `harbor-voyage-v1` executes worker placement on a harbor table.
- `score-race-v1` executes explicit per-seat point actions, a victory target,
  and a turn limit. Use it only when the source itself is a point race.
- `shared-goal-v1` executes explicit turn-taking actions that add to one shared
  progress track, a shared target, and a turn limit. It has no winner seat;
  completion means the shared target was reached.
- `turn-taking-v1` executes an explicit bounded action list in round-robin seat
  order until its turn limit. It exposes turn state but does not infer a
  winner, score, resources, or other rule resolution.
- `take-away-v1` executes an explicit finite shared pool, legal positive take
  amounts, round-robin turns, and a last-taken-wins condition. Do not select it
  when the source omits any of those semantics.
- `roll-and-move-v1` executes one explicit die, deterministic fixed-seed rolls,
  movement by each result, round-robin turns, and a first-to-position target.
  Its safety turn limit ends without a winner when nobody reaches the target.
- `draw-and-score-v1` executes a finite shuffled deck, deterministic fixed-seed
  top-card draws without replacement, score by card value, first-to-target
  victory, and unique-high-score deck exhaustion. Public Session State exposes
  only counts and the last draw; an exhaustion tie has no winner seat.
- `push-your-luck-v1` executes repeated deterministic rolls, one bust face,
  an unbanked turn score, voluntary banking, round-robin turns, and a
  banked-score victory target. Empty banking is illegal; its action safety
  limit ends without a winner.
- Keep unsupported source behavior visible. Do not convert a cooperative goal
  into a competitive score race merely because both actions carry numbers.

## Authority boundaries

- Let Codex interpret the creator's intent and propose content.
- Let GoDesk validate versions, persist project state, compile builds, accept
  Shared Session intents, and reconstruct replays.
- Do not use an LLM as a rules engine or update Shared Session state outside GoDesk.
- Treat `automated-bot-simulation` as automated evidence only. Never call it a
  human playtest.
- Treat a claimed-seat rating/comment as participant feedback, not independent
  human evidence. It remains separate from a creator-attested `human-session`
  Finding.
- When a persisted rating/comment is the observation being tested, record it as
  `participant-feedback` with the exact feedback snapshot and Feedback Moment;
  verify its `actionSequence` and `actionId` against the Replay, and never
  relabel it as `human-session` without creator attestation.
- Record a Validation Finding only against a named Design Hypothesis, immutable
  Build, and persisted playtest or Shared Session; include one concrete
  `nextChange` so Codex can return to the same project with a focused patch.
- Evidence from a Session with an Experiment Brief belongs only to that
  Session's snapshotted Design Hypothesis.
- When a creator asks to apply that feedback, use `iterate-from-finding` and
  preserve the motivating Build, Replay, and Finding as immutable evidence.
- Report unsupported behavior and build warnings exactly as returned.

## Conflicts and destructive actions

On a version conflict, re-read the project, preserve the creator's visible
changes, and construct a new focused patch. Do not silently retry stale input.

Before `delete_project`, state the exact project name and ID and obtain explicit
confirmation. Pass the same ID as `confirmationProjectId`.
