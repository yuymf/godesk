# Materialize a concise Chinese shared-goal brief without manual repair

Type: bug
Status: resolved

## Question

Can the exact creator brief below produce an executable game directly, even
though it names a role instead of using the word `玩家` and states actions
without `玩家可以`?

> 三名调查员合作在雾港收集线索。调查行动推进 2 点，整理证词推进 1 点。累计 8 点破解案件，最多 12 回合。

## Root cause

Participant inference only accepted generic people or explicit player nouns,
and scored-action extraction required a modal prefix. The brief therefore
collapsed to the conservative two-player fallback and lost its direct action
semantics, leaving a draft Rule System.

## Resolution

The deterministic parser now recognizes a Chinese role noun after `位` or
`名`, accepts direct scored/progress action clauses, and removes the redundant
`行动` suffix from the executable label. A focused regression test asserts the
complete contract: exactly three participants, `shared-goal-v1`, target 8,
maximum 12 turns, and actions `调查 +2` and `整理证词 +1`.

Fresh isolated acceptance created Project
`project_8f323efd-2922-47cb-a5de-936d1b90e638` and directly compiled Build
`build_3000fd76ae6d6d525b9c933e`; no `configure_shared_goal` repair was used.
Seed 42 Playtest `playtest_5d09f881-250f-4d96-8122-86c30457fd63` completed the
target and produced Replay `replay_4decc705-8e2d-474e-b7eb-931b13723289`.
Browser self-play in Room `room_eeb641ef-d3f8-42f5-93ba-b819e2d924b3`
claimed seat 0, submitted `调查`, and advanced from turn 0 / progress 0 to turn
1 / progress 2. Room Replay `replay_6b996486-0afd-403b-88ff-a6a09a5f372e`
retained the accepted action.

This is local automated and agent-operated evidence, not a real-person
playtest or public Codex installation.

The full local matrix passed with frontend 2 files / 24 tests, Worker 4 files /
102 tests, typecheck, production build, local routes, creator loop, 16 MCP
tools / 17 invariants, 11 Plugin Skills, and deployment dry-run. The read-only
public distribution check still fails at the known stale-version boundary.

## Comments

- 2026-08-11: Added the failing parser regression first, repaired the three
  narrow inference seams, and repeated API plus browser acceptance against an
  isolated Worker.
