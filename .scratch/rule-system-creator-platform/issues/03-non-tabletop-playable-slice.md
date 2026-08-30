# 03 - Prove a non-tabletop playable slice

Type: task
Status: resolved

Blocked by: 02

Add one rights-safe conversation or screen-based game example that uses the
generic deterministic kernel, compiles into a Playable Build, opens a Shared
Session, accepts intents, and reconstructs a Replay without board semantics.

## Acceptance

- The example appears in the creator surface with a non-table Play Surface.
- Worker and browser acceptance cover build, invitation, two clients, action,
  and replay.

## Answer

`灵感接力` is a rights-safe conversation game with no board or physical
component requirement. Contract acceptance compiles it, creates a Shared
Session, claims creator/friend seats, accepts two authoritative actions, and
reconstructs the Replay as turn 2 with scores `[3, 2, 0]`. Browser acceptance
is reserved for Issue 06.
