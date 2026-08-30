# Execute finite shared-pool take-away rules

Type: task
Status: resolved

## Question

Can GoDesk turn an explicit rule such as “start with 15 stones, take 1 or 2
each turn, and the player taking the last stone wins” into a faithful editable,
executable, and shareable project instead of reducing it to generic turn
taking?

## Answer

Yes. `take-away-v1` stores an initial finite shared pool and explicit positive
take actions. The authoritative runtime rejects wrong-seat, unknown, and
overdraw intents; accepted actions decrement the pool, rotate the active seat,
and award the win to the seat that reaches zero. Fixed-seed bots choose only
legal actions and terminate with a winner. Session State, Playtest metrics,
MCP output, Build preview, Room, and Replay all expose the pool.

Prompt-first generation selects this Kernel only when the source explicitly
provides a shared object count, per-turn take amounts, and a last-taken-wins
condition. Before this change, the same Chinese brief incorrectly produced
`turn-taking-v1` with two long-text actions, no pool mutation, and no winner.

The real local Streamable MCP verifier generated, approved, compiled,
self-played, shared, acted, and replayed a fresh take-away project as its
twelfth invariant. A separate application-browser run completed the full
15 → 0 game in eight accepted actions across two automated clients. At one
remaining object the “take 2” button was disabled while “take 1” remained
available; seat 1 took the last object and the Replay reconstructed 15/15 →
0/15 with no browser errors.

This is automated local self-play evidence, not a real-person session or
public Codex installation record.

## Comments

- 2026-08-10: Added `take-away-v1`, `configure_take_away`, source extraction,
  MCP schemas, Room/Build/Replay presentation, Skills guidance, and regression
  coverage.
