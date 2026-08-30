# 13 — Persist participant feedback on the shared experiment

Type: task
Status: resolved

Blocked by: 12

## Question

Can a friend finish a browser playtest with a small, durable piece of feedback
that returns to the same Game Project, without changing the authoritative
Replay or requiring Codex/MCP access?

## Answer

Each Shared Session now owns `feedback`, with one 1–5 rating and 2–1000
character comment per claimed seat. The friend invitation URL exposes the
feedback POST route alongside seat claims and intents. Re-submitting from the
same claimed seat updates that entry in place; it does not create a second
review. Web Studio, the project `sessions` view, and MCP read tools expose the
stored entries. Replay remains an action-log-only artifact.

Participant feedback is explicitly qualitative input. It can inform a Finding's
notes and `nextChange`, but it does not prove that a real person played and does
not set `creatorAttested` or change the evidence type.

No compatibility layer or migration was added. A persisted project record must
already use the current Shared Session shape with a feedback array.

## Verification

- Worker regression coverage validates invalid input, claimed-seat authority,
  one-entry upsert behavior, project/session projection, Replay immutability,
  public invitation writes, and MCP reads.
- The isolated local loop includes a `shared-session-feedback` invariant.
- Browser self-play on the current source verified the rating controls, comment
  field, and saved feedback on Room `room_19206ee7-11b3-41e9-a244-4eb488fed2d4`
  at isolated port 8807; this remains automated local evidence, not the real
  two-person acceptance gate.
