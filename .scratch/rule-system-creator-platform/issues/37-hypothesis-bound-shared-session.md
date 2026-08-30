# Bind a Shared Session to One Experiment Brief

Type: task
Status: resolved

## Question

Can a friend see the exact design question a Creator wants to test, and can
their feedback return to that same question without being attached to a newer
or unrelated hypothesis?

## Answer

Yes. A Shared Session may snapshot one Design Hypothesis as an immutable
`Experiment Brief`: `hypothesisId`, question, and success signal. Exploratory
Sessions remain valid with `experiment: null`; one Room never carries multiple
questions.

Studio lets the Creator select the hypothesis before creating the Room. The
Room shows the exact question and success signal to participants. Its return
link carries the bound `hypothesisId`, Build, evidence type, and Room ID, so a
multi-hypothesis project opens the correct validation form. The Worker rejects
participant-feedback or human-session Findings that try to attach a bound Room
to a different hypothesis.

This is a feedback attribution guarantee. Participant feedback remains
qualitative evidence and does not become real-person or `human-session` proof.

## Acceptance

Local HTTP and Streamable MCP loops assert the exact Experiment Brief snapshot
and reject cross-hypothesis feedback attribution. The browser acceptance used
Project `project_62618792-4c86-486c-88b9-40a285359c19`, Build
`build_e1cc30ae43551531a057a8dd`, Room
`room_1d0db801-e4ac-4ac1-b895-e79fa3695cf3`, and two Design Hypotheses. Although
the second hypothesis was the latest default, the Room return link selected its
original `hypothesis_fca42d33-fa26-44e1-84bd-58ed7c4046a7` and saved Finding
`finding_0a69076b-3046-4c72-9375-2413bb6fa25f` with the exact immutable feedback
snapshot.

Codex then applied the Finding's focused action-copy change. The first revised
Build correctly refused bot play with `runtime_not_executable` after the action
change invalidated the old Kernel. After explicit `score-race-v1`
reconfiguration, Build `build_22a6c8b8f5bc18fd1ee98c9a` completed seed 42 bot
Playtest `playtest_686bb058-a39f-4ddc-906b-2afdcd18c5ea` in 10 turns with scores
`8 / 5 / 4`.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 24 tests, Worker 104 tests, typecheck,
production build, local routes, 12-invariant HTTP creator loop, 17-tool /
20-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.
