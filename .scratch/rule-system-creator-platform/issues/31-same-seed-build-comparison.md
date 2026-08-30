# Compare immutable Builds with the same self-play seed

Type: task
Status: resolved

## Question

Can a creator see the result of a focused same-project iteration without
manually opening separate Build, Playtest, and Replay records?

## Answer

Yes. Studio derives a comparison from existing authoritative records. It sorts
immutable Builds by creation time, selects the newest two, and renders a
comparison only when both have an automated Playtest with the same seed. No new
backend model or inferred causal link was added.

Each side shows Rule System version, Executable Kernel, turns, terminal result,
final scores, and its own Replay. The comparison also shows the turn delta. It
states that the evidence is bot simulation and does not claim that a metric
change proves the new version is better.

Browser acceptance used Project
`project_82aa8eb5-dcd9-48b0-8ed0-b81517353bf4`. Build
`build_fb3e9f161a2a7b6dc41a4b47` preserved Rule System v2 with a 10-point
target; seed 42 completed in 19 turns at `10 / 9`, with Replay
`replay_c6f50310-0c68-4563-a49a-0f222bc5c4e4`.

A version-checked `configure_score_race` operation changed the same project's
target to 6. Build `build_b68d98d6d48f10b58f32c25a` preserved Rule System v3;
the same seed completed in 11 turns at `6 / 5`, with Replay
`replay_66fbcd3e-3f38-45f1-9b17-4b33131446fa`. Studio displayed the two Runs
side by side and the truthful turn delta `-8`.

This is local automated evidence, not a public installation or human
playtest.

## Comments

- 2026-08-11: Added latest-two-Build same-seed matching, a responsive Studio
  comparison, focused regression tests, and a real same-project two-Build
  browser/self-play run. Updated iteration and playtest Skills to verify the
  visible Studio comparison during Codex-driven follow-up work.
