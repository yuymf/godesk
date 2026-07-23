# Manila mechanics prototype

Status: superseded

Superseded by `.scratch/manila-creation-flow/spec.md` after the user clarified
that this round is an internal creation-flow validation and must use the real
rulebook and source materials. Harbor 13 remains historical technical-spike
evidence; it is not the current product prototype.

## Purpose

Build a browser-based vertical slice that tests whether the PRD's tabletop runtime can support a game with worker placement, wagering, dice-driven movement, hidden uncertainty, resolution, replay, and rules help.

The prototype is internally described as a Manila mechanics probe, but it must not copy commercial artwork, component scans, or rulebook text. The playable presentation is an original game called **Harbor 13**.

## Slice

- One human and two local bot seats.
- Three ships travel along parallel lanes for three sailing rounds.
- Players pay to place three crew markers on ships or outcome zones.
- Dice rolls move all ships; port, shipyard, and pirate outcomes pay different bets.
- Accepted actions form the canonical event log.
- Undo removes the latest accepted action; replay reconstructs state from the log.
- State persists locally across refreshes.
- A bounded rules helper answers only from the bundled prototype rules and cites a section.

## Explicit exclusions

- No copied Manila artwork, card text, board layout, or complete rules reproduction.
- No accounts, remote multiplayer, uploads, backend, or real LLM integration in this slice.
- No claim that local bots or browser storage prove the PRD's server-authoritative multiplayer acceptance criteria.

## Acceptance

- The app builds and type-checks.
- Domain tests cover placement, deterministic sailing/resolution, replay, and uncertain rules answers.
- A user can finish one voyage using mouse or keyboard-accessible controls.
- Refresh restores the accepted action log.
- Replay never mutates the live state.
