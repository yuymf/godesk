# Preserve Chinese action boundaries and explicit scoring

Type: task
Status: resolved

## Question

Can a creator describe separate actions and scoring in Chinese natural language
and have GoDesk preserve the action boundaries, names, values, and executable
runtime choice in the Generation Plan?

## Answer

Yes. Chinese action clauses separated by `、` or `；` are materialized as
separate actions even when no point value is stated. An explicit Chinese point
value keeps the action phrase as the action label and configures
`score-race-v1`; a target or winner statement without action point values stays
on `turn-taking-v1` with a visible unsupported boundary instead of inventing a
scoring rule.

## Acceptance

The focused Worker suite passed 110/110 tests, including separate coverage for
unscored Chinese alternatives and Chinese scored alternatives. The full local
matrix also passed frontend tests 30/30, typecheck, production build, local
route verification, the 14-invariant HTTP creator loop, the 17-tool / 22-invariant
MCP loop, local Plugin distribution verification, and deployment dry-run.

An isolated browser run on Worker `127.0.0.1:8830` verified the unscored plan
for Project `project_9b7dc922-31da-4c57-9901-9957a3d64c37`: three separate
action labels were visible, the expected result remained `率先达到 8 分的人获胜，最多
18 回合。`, and the plan honestly selected `turn-taking-v1` with the winner/
score limitation visible.

The post-fix scored plan for Project
`project_91df8e83-60e5-4381-936b-2922b0ff0e4d` preserved the three action names
and values, selected `score-race-v1`, and was confirmed into Build
`build_ac8c8f713d360e4903a408b1`. Its fixed-seed 42 automated playtest
`playtest_c6b843f4-0e7b-49c1-9010-408d52418597` completed in 8 turns with
winner seat 1 and final scores `[4, 8]`, replay
`replay_70998666-a6a4-4d3a-bffd-5efed00fdb05`. Studio also created Shared
Session `room_c602b626-bbbf-4b46-af6f-82f5fd7b1dfe` with replay
`replay_c0bdf59c-35b8-47d7-b442-bdf1107132ad`.

This is local automated and agent-operated browser evidence. It is not a
real-person playtest, public deployment, or fresh public Plugin installation.

## Comments

- 2026-08-14: The fix preserves source action names before appending scoring
  text, so the executable Kernel receives the intended labels rather than the
  first character of the scoring clause.
