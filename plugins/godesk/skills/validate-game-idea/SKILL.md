---
name: validate-game-idea
description: Test one GoDesk Design Hypothesis against a specific immutable Build and persisted play evidence. Use when a creator asks whether an idea works, wants to validate an assumption, compare a rule change, learn from playtesting, or record a supported, refuted, or inconclusive finding.
---

# Validate a Game Idea

Turn one uncertain design claim into a traceable learning record.

## Workflow

1. Read `overview`, `rule-system`, `builds`, `playtests`, `sessions`, and
   `validation` for the exact project. Identify one decision-changing question
   and one observable success signal.
2. Add one `add_design_hypothesis` operation with the current project version.
   Re-read `validation` and retain the returned hypothesis ID.
3. Choose evidence that answers the question:
   - For automated evidence, run a fixed-seed `bot-playtest` against one
     immutable Build and retain its playtest ID.
   - For participant feedback, use a Shared Session with a claimed seat,
     require at least one Accepted Action from that seat, then read its
     persisted rating/comment and Feedback Moment. Record the exact snapshot as
     `participant-feedback`. This is a participant observation, not proof that
     a real person played.
   - For human evidence, create a Shared Session, give friends its exact URL,
     and use a session with at least two claimed seats and one accepted action.
     Set `creatorAttested: true` only after the Creator confirms the named
     participants were real people.
4. Inspect the Replay before interpreting the result. Separate observed actions
   from creator inference. If the Shared Session has participant feedback,
   read the persisted rating/comment and quote it as an observation input.
5. Add one `record_validation_finding` operation referencing the hypothesis,
   Build, evidence, verdict, concise observation notes, and one concrete
   `nextChange` for the next focused iteration.
6. Re-read `validation` and report the question, success signal, evidence type,
   exact source ID or URL, verdict, and next rule change.
7. If the creator asks to act on that change immediately, use
   `iterate-from-finding` so the same project is patched, rebuilt, and
   compared against the motivating evidence.

## Evidence boundary

- Label bot evidence `automated-playtest`.
- Label a feedback snapshot `participant-feedback`; keep the session ID and
  exact feedback entries, including `actionSequence` and `actionId`, so the
  observation can be checked against the Replay without turning it into a
  `human-session` claim.
- Label a qualifying Shared Session `human-session` and state that participant
  names are creator-attested unless independently observed.
- Treat Room feedback as participant-reported qualitative input. It can sharpen
  the Finding's notes and `nextChange`, but it does not by itself prove that a
  real person played or replace `creatorAttested: true`.
- Never set `creatorAttested: true` for bots, scripted clients, or assumed
  participants.
- Use `inconclusive` when the evidence does not answer the success signal.
- `nextChange` must describe one actionable revision to the same Game Project;
  do not leave the feedback loop as an unbounded request for improvement.
- Treat a new rule version as a new test: compile a new Build and record a new
  Finding rather than rewriting the previous result.
