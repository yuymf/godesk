---
name: playtest-and-verify-game
description: Run deterministic GoDesk bot playtests, create authoritative rooms, inspect replay evidence, and verify editor-visible or playable results. Use when a creator asks to test, balance, diagnose, preview, verify, share a room, reconnect, or review what happened in a GoDesk game.
---

# Playtest and Verify a Game

Separate structural, deterministic, visual, and human evidence in every report.

## Automated playtest

1. Read the requested immutable build with `read_build`.
2. Check that its runtime support is executable and report build warnings.
3. Submit a `bot-playtest` job with an explicit fixed seed and track the job to
   a terminal result.
4. Record the terminal status, turns, winner seat, final scores, replay ID, and
   `automated-bot-simulation` evidence label.
5. Open the replay URL and inspect its visible initial state, accepted actions,
   and final state.
6. Re-run with the same build and seed when reproducibility is material.

## Room verification

1. Create a room from one immutable build and an explicit seed.
2. Open the exact room URL.
3. Submit only legal active-seat intents. Treat rejected intents as evidence
   that authority is working, not as accepted actions.
4. Re-read the room and verify ordered accepted actions and current Table State.
5. Refresh or reopen the room to verify reconnect behavior when requested.
6. Read the replay and verify that replay access does not mutate the live room.

## Evidence labels

- Structural evidence: stored IDs, versions, sources, and schemas.
- Deterministic evidence: fixed-seed build/runtime results.
- Visual evidence: inspected pixels in editor, build, room, or replay routes.
- Human evidence: an actual recorded human session. Never infer this from bot
  output or from opening a room.
