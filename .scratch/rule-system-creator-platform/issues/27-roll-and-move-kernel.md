# Execute seeded roll-and-move rules

Type: task
Status: resolved

## Question

Can GoDesk turn an explicit rule such as “take turns rolling a six-sided die,
move by the result, and win by reaching space 20” into a faithful editable,
executable, and shareable project instead of reducing it to generic turn
taking?

## Answer

Yes. `roll-and-move-v1` stores die sides, target position, safety turn limit,
and one explicit roll action. The authoritative runtime derives each roll from
the immutable Build seed and accepted-action sequence, advances only the active
seat, caps movement at the target, and awards victory only when a seat reaches
that target. The same Build and seed reconstruct the same rolls. Reaching the
safety limit ends without inventing a winner.

Prompt-first generation selects this Kernel only when the source explicitly
provides turn taking, die sides, movement by the roll, and a first-to-position
condition. Before this change, the Chinese acceptance brief incorrectly became
`turn-taking-v1` with one long action, a 12-turn default, no random result, no
positions, and no winner.

The local Streamable MCP verifier generated, approved, compiled, self-played,
shared, acted, and replayed a fresh project as its thirteenth invariant. It
produced Project `project_38723d61-0bbc-4bfb-bfe4-4fbc5b5b5b3c`, generation Job
`job_fe009048-5e36-4444-96a5-23957f63fdea`, Build
`build_567ac9efb31919141cf7b93a`, Playtest
`playtest_b128c8f5-5755-4385-b2a9-8ae09dea4050`, Shared Session
`room_2c537a60-a270-40e3-91eb-ea69aa2b715f`, and Replay
`replay_b31f4666-078c-4fee-88b5-ead37cd736de`.

A separate application-browser run used Project
`project_666bc2dd-7433-42ba-b598-be8e19244e37`, Build
`build_47a4a7eda8dda90bce7e67b6`, Shared Session
`room_c278bb69-052f-4d9c-a58d-19402e42cdba`, and Replay
`replay_5fc7d4c0-8789-47fe-8894-5f8819017876`. The first self-play exposed a
seat-correlated 4/1 sequence, so roll derivation was changed to advance one
seeded random stream by action sequence. The final two-client run completed in
ten accepted actions with rolls `[1, 5, 4, 3, 1, 1, 1, 5, 2, 6]`; the visible
Room ended at 9/20 versus 20/20 with seat 1 as winner, and Replay reconstructed
the same sequence. Browser error logs were empty.

This is automated local self-play evidence, not a real-person session or
public Codex installation record.

## Comments

- 2026-08-10: Added `roll-and-move-v1`, `configure_roll_and_move`, explicit
  source extraction, MCP schemas, Room/Build/Replay presentation, Skills
  guidance, and regression coverage.
