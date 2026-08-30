---
name: playtest-and-verify-game
description: Play, share, and inspect a GoDesk game. Use when a creator wants a friend invitation URL, bot self-play, or a Replay. Automated evidence is not a human playtest.
---

# Playtest and Verify a Game

Separate structural, deterministic, visual, and human evidence in every report.

## Automated playtest

1. Read the requested immutable build with `read_build`.
2. Check that its runtime support is executable and report build warnings.
3. Submit a `bot-playtest` job with an explicit fixed seed and track the job to
   a terminal result.
4. Record the terminal status, turns, winner seat/final scores for a
   `score-race-v1` build, shared progress/target for a `shared-goal-v1`
   build, or turn/max-turn state and the absence of a winner for a
   `turn-taking-v1` build. For `take-away-v1`, report the initial and remaining
   shared pool, terminal winner seat, and any rejected overdraw, plus the replay ID and `automated-bot-simulation`
   evidence label.
   For `roll-and-move-v1`, report die sides, target position, every accepted
   roll, final positions, winner seat or safety-limit termination, and confirm
   that the Replay reconstructs the same seeded rolls.
   For `draw-and-score-v1`, report total and remaining cards, every accepted
   draw and score change, target or exhaustion result, and confirm that Replay
   reconstructs the same draws while public Session State omits future order.
   For `push-your-luck-v1`, report every roll/bust/bank decision, unbanked and
   total-score transitions, winner or safety-limit result, the bot banking
   policy, and same-seed Replay reconstruction.
   For `harbor-voyage-v1`, inspect and report the returned `state.voyage`
   phase, active seat, placements, cargo positions, log, and final settlement;
   do not reduce a voyage to its derived score array.
5. Open the replay URL and inspect its visible initial state, accepted actions,
   and final state.
6. Re-run with the same build and seed when reproducibility is material.
7. When comparing the latest two Builds, use the same seed on both and inspect
   Web Studio's version comparison. Verify both Rule System versions, terminal
   metrics, and Replay links; treat the displayed delta as automated evidence,
   not proof that one design is better.

## Shared Session verification

1. Read the project's Design Hypotheses. Create a Shared Session from one
   immutable Build and an explicit seed; pass the exact `hypothesisId` when the
   creator is testing a named question, or leave it absent for exploratory play.
   Re-read the Session and verify the Experiment Brief is an exact snapshot.
2. For Creator self-play, open Web Studio and use its embedded Shared Session;
   for a friend handoff, open or return the exact independent Shared Session
   URL. Both surfaces must name the same Room ID.
3. Claim one seat per browser/client before submitting an Intent. Submit only
   legal active-seat intents. Treat rejected pre-claim, wrong-seat, and illegal
   intents as evidence that authority is working, not as accepted actions.
4. Re-read the Shared Session and verify ordered Accepted Actions and current
   Session State. Read the Replay and verify the same sequence, action ID, and
   resulting state before claiming that Studio self-play is authoritative.
5. Refresh or reopen the Shared Session to verify reconnect behavior when requested.
6. For a repeatable friend handoff, create a fresh Room, re-read the project
   version, apply `publish_shared_session`, and read `playtest-link`. Verify the
   stable URL redirects to that exact Room before returning it. Repointing the
   link must not mutate previous Rooms or Replays. After their seat is
   claimed, they can submit one 1–5 rating and a short comment; re-read the
   Shared Session and the project's `sessions` view to verify that the feedback
   is attached to the same Room. For a hypothesis-bound Room, verify the visible
   question and success signal, then record any Finding against that same
   hypothesis; a mismatched hypothesis must be rejected.
7. Read the replay and verify that replay access does not mutate the live Shared Session.

## Evidence labels

- Structural evidence: stored IDs, versions, sources, and schemas.
- Deterministic evidence: fixed-seed build/runtime results.
- Visual evidence: inspected pixels in Web Studio, Build, Shared Session, or Replay routes.
- Participant feedback: a persisted rating/comment from a claimed Room seat;
  use it as qualitative observation input, but do not call it independent human
  acceptance proof.
- Human evidence: an actual recorded human session. Never infer this from bot
  output or from opening a Shared Session.
