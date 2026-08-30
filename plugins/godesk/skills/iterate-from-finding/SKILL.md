---
name: iterate-from-finding
description: Continue an existing GoDesk Rule System from a persisted Validation Finding or actionable nextChange. Use when a creator asks to apply playtest feedback, balance a rule after a replay, revise the same project, or compare a new Build against the evidence that motivated it.
---

# Iterate from a Finding

Turn one evidence-backed follow-up into one focused, testable revision of the
same GoDesk Game Project.

## Workflow

1. Resolve the exact project with `list_projects`; never create a replacement
   project for an iteration. Read `overview`, `validation`, the active
   `rule-system`, and the referenced immutable Build and evidence.
   When the evidence is a Shared Session, also read its persisted participant
   feedback. For `participant-feedback`, compare the stored snapshot with the
   current Room, resolve every Feedback Moment against the Replay's Accepted
   Action sequence, and use those comments as observations from the same
   experiment, not as automatic human attestation.
2. Select one Validation Finding. Treat its `nextChange` as the design input,
   not as proof that the change is correct. Keep the original question,
   observation, evidence type, and Finding immutable.
3. Translate the next change into the smallest supported
   `apply_project_patch`. Use `update_rule_system` for a focused field change,
   or the matching `configure_score_race` / `configure_shared_goal` /
   `configure_turn_taking` / `configure_take_away` /
   `configure_roll_and_move` / `configure_draw_and_score` /
   `configure_push_your_luck` operation when the
   Executable Kernel values change.
   Preserve source anchors,
   unsupported behavior, and the existing Play Surface unless the Finding
   explicitly tests one of them.
   If the creator is operating the Web Studio composer, its direct
   `iterate-rule-system` path is intentionally narrower: it accepts only one
   explicit action-description rewrite and records the original prompt. Use
   the structured operations above for score, progress, turn-limit, action
   shape, or victory-condition changes.
4. Before mutating, re-read the current project version and use it as
   `expectedVersion` with a fresh idempotency key. Re-read the affected Rule
   System view after the patch. On a version conflict, reconcile the visible
   creator change instead of retrying stale input.
5. Submit a `compile-build` job with `basedOnFindingId` set to the selected
   Finding ID and track it to terminal. The Worker must reject compilation if
   the active Rule System was not revised beyond the Finding's Build. Read the
   returned Build and Changeset; both must preserve the same Finding ID before
   calling the revision playable or reporting warnings and unsupported
   behavior.
6. Run a fixed-seed `bot-playtest` on the new Build. Reuse the motivating
   Finding's seed when a before/after comparison matters, inspect the new
   Replay, and compare the relevant metrics and accepted actions with the old
   Build. Automated evidence remains automated evidence.
7. If the creator asks to close the experiment, use a new
   `record_validation_finding` operation against the new Build and its
   persisted evidence. Reuse
   the original Design Hypothesis when it is the same question; add a new
   Hypothesis only when the question changes. Include one concrete `nextChange`
   for the next iteration.
8. Re-read `overview`, `rule-system`, `builds`, `playtests`, `replays`, and
   `validation`. Open the same Web Studio project and verify its latest-two-
   Build comparison shows the matching seed, both Rule System versions,
   metrics, and Replay links. Then report the same project ID, old/new Build
   IDs, evidence type, comparison, warnings, and exact Web
   Studio/Build/Replay URLs.
9. When the creator wants friends to test the revision, create a fresh Shared
   Session from the new Build, apply `publish_shared_session` with the latest
   project version, and read `playtest-link`. Verify the stable URL now resolves
   to the new Room while the motivating Room and Replay remain readable.

## Completion criteria

- The project ID is unchanged.
- A new Rule System version and immutable Build exist; the motivating Build and
  Finding still read exactly as before.
- The new Build and compile Changeset both read back the selected
  `basedOnFindingId`.
- The new Replay and comparison are inspected, not inferred from a successful
  job submission alone.
- Web Studio visibly matches the old/new Build and same-seed Playtest records.
- A requested friend handoff returns the stable Playtest Link and its selected
  immutable Room, not an inferred latest Session.
- Any new conclusion names its evidence type and keeps human attestation
  separate from automated self-play.
