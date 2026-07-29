# 05 — Run playtests, rooms, and replays

**What to build:** A creator can run a deterministic bot playtest and create an
authoritative room from one immutable Playable Build, then inspect metrics,
accepted actions, reconnectable Table State, and a non-mutating replay.

**Blocked by:** 03 — Compile and preview an immutable Playable Build.

**Status:** completed

- [x] Bot playtests persist fixed seeds, metrics, terminal status, and
      representative replay identifiers.
- [x] Automated evidence is visibly distinct from human playtest evidence.
- [x] Room clients submit intents; only validated accepted actions enter the
      Action Log.
- [x] Reconnect reconstructs Table State and replay cannot mutate live state.
- [x] The editor and MCP surface return exact playtest, room, and replay
      handoffs.

## Verification

- The versioned `score-race-v1` prototype kernel repeats the same accepted
  actions and terminal Table State for a fixed seed.
- Worker integration proves illegal-seat intents return 409 without entering
  the log, accepted intents persist, reconnect returns the same Table State,
  and replay reads leave the room unchanged.
- MCP integration configures the runtime, compiles, runs a bot playtest,
  creates a room, submits an intent, and reads the resulting replay.
- Browser enabled the runtime in the Editor, compiled Definition v8, ran seed
  42 for 11 turns, entered a room, accepted one action, refreshed to the same
  state, opened read-only replay, then returned to an unchanged live room.
- Automated results are labelled `automated bot simulation · 非真人验收`.
