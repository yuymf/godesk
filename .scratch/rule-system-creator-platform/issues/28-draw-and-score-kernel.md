# Execute finite shuffled draw-and-score rules

Type: task
Status: resolved

## Question

Can GoDesk turn an explicit finite shuffled-deck rule into a faithful editable,
executable, and shareable project without exposing future card order or reducing
draw-and-score to generic turn taking?

## Answer

Yes. `draw-and-score-v1` stores the card values, copies per value, victory
target, and one draw action. The authoritative runtime reconstructs a seeded
Fisher-Yates shuffle from the immutable Build, draws without replacement,
scores the drawn value, and ends at the target or deck exhaustion. Exhaustion
awards only a unique highest score; a tie remains a tie. Public Session State
contains total/remaining counts and the last draw, never the future deck.

Before this change, the acceptance brief became `turn-taking-v1` with two long
sentence actions, a 12-turn limit, no shuffle, no finite deck, no score changes,
and no winner.

The local Streamable MCP verifier exercised this as its fourteenth invariant.
It produced Project `project_f77efa2a-80d9-437b-a64d-a86823d82fa0`, generation
Job `job_456d2559-b76e-4204-a898-f2b71b267369`, Build
`build_b6f9756998f5a2b161efcee3`, Playtest
`playtest_908b142b-ed99-4ab8-a7de-d00bef70ee3d`, Shared Session
`room_ed6eff22-a186-49b4-aaee-546eacc21ad7`, and Replay
`replay_65309ec8-f964-45bf-aa1d-6b46c184f7c1`.

A separate application-browser run produced Project
`project_b3b17bf6-3526-4f3c-8ef7-1a6b16ac3bae`, Build
`build_d8ee2d26c123cac032bdf375`, Shared Session
`room_00186685-315c-438c-9658-4dd833a626d9`, and Replay
`replay_4711eeb7-d15d-4d79-bf14-75773a17f476`. Claiming seat 0 and clicking
the accessible “行动 1 抽牌” button consumed one card, changed the deck from
12 to 11, drew value 1, and changed seat 0 from 0 to 1. Replay visibly restored
the same state and accepted action. Browser error logs were empty.

This is automated local self-play evidence, not a real-person session or public
Codex installation record.

## Comments

- 2026-08-11: Added `draw-and-score-v1`, `configure_draw_and_score`, explicit
  source extraction, private future-deck semantics, MCP schemas,
  Room/Build/Replay presentation, Skills guidance, and regression coverage.
