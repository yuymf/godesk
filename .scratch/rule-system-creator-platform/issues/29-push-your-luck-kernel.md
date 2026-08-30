# Execute push-your-luck decisions

Type: task
Status: resolved

## Question

Can GoDesk turn explicit “roll again or bank” rules into a faithful playable
decision loop instead of flattening the whole turn into generic actions?

## Answer

Yes. `push-your-luck-v1` stores die sides, one bust face, a banked-score target,
an action safety limit, and canonical `roll` / `bank` actions. Safe rolls add to
an unbanked turn score without changing the active seat. A bust clears it and
passes the turn. Banking is legal only with positive unbanked score, transfers
that score to the player's total, and passes the turn. Victory is checked only
after banking. The safety limit never invents a winner.

Before this change, the acceptance brief became `turn-taking-v1` with two long
sentence actions, a 12-turn default, and no die, unbanked score, bust, banking,
or winner.

The local MCP verifier exercised the new loop as its fifteenth invariant. It
produced Project `project_b0db09ec-b9ff-4a99-b0ea-d99daa80476f`, generation Job
`job_6f5e999b-2d08-4e79-8b67-fe9b07e37925`, Build
`build_3a483b179e1e7bb8a0705980`, Playtest
`playtest_fa8793a4-c32a-4dd0-b199-bfc25242751b`, Shared Session
`room_f841c570-90bc-417d-8576-fc00766bed9b`, and Replay
`replay_03be869b-0648-4f88-96bc-52f9f864e5ba`.

A separate browser run used Project
`project_33cf13ab-af64-44c4-8257-97658bea0949` and Build
`build_dad387e9957be0ea1836f8df`. Seed 42 visibly rolled bust face 1, cleared
the unbanked score, and passed the turn in Room
`room_4e6f57c6-f8e0-414c-854f-bcb572309f08`. In a seed-1 Room
`room_caf69c8f-e0ac-4540-9cc1-681da6d58b2c`, banking was disabled at zero,
enabled after rolling 4, then moved 4 into seat 0's total and passed the turn.
Replay `replay_de275dab-f678-4f5a-b24e-28d3ebc29ed8` reconstructed `roll 4 ->
bank 4`. Browser error logs were empty.

Automated self-play banks at an unbanked score of 8. That is test policy, not
part of the creator's game rule. This remains local automated evidence, not a
real-person playtest or public Codex installation record.

## Comments

- 2026-08-11: Added `push-your-luck-v1`, `configure_push_your_luck`, source
  extraction, authoritative risk/bank transitions, MCP schemas, Room/Replay
  presentation, Skills guidance, and regression coverage.
