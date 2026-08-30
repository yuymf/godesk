# Execute bounded turn-taking without inventing score semantics

Type: task
Status: resolved

## Question

Can a natural-language Rule System that explicitly says players take turns,
but does not define points, a shared target, or a winner, still become an
editable, executable, shareable GoDesk prototype?

## Answer

Yes. `turn-taking-v1` executes a source-derived action list in round-robin seat
order until an explicit or conservatively inferred turn limit. Session State,
bot Playtests, Shared Sessions, MCP output, Build previews, Rooms, and Replays
all expose the turn limit while keeping scores at zero and `winnerSeat: null`.
The Kernel explicitly leaves winners, scores, resources, and other rule
resolution unsupported instead of fabricating them.

Prompt-first generation now selects this Kernel only when turn-taking is
explicit, at least one non-scored action is preserved, no competing shared-goal
or score-race semantics are complete, and the action list is within the
twelve-action Kernel limit. Short Chinese action lines such as `扩展创意。` and
`加入约束。` are retained as source actions.

The real local Streamable MCP loop generated, approved, compiled, bot-tested,
shared, acted, and replayed a fresh turn-taking project. A separate browser
run completed four ordered actions across three automated clients and visibly
showed `回合上限已到` without a score or winner. This is automated local
self-play evidence, not real-person or public deployment evidence.

## Comments

- 2026-08-10: Added `turn-taking-v1`, `configure_turn_taking`, MCP schemas,
  Room/Build/Replay presentation, Skills guidance, and full regression coverage.
  Worker suite is 4 files and 81 tests.
