# ADR 0008: Bind Playtest Feedback to an Experiment Brief

Status: accepted

Date: 2026-08-11

A Shared Session may snapshot one existing Design Hypothesis as its Experiment
Brief. Participants see the exact question and success signal while playing.
When participant feedback or human-session evidence from that Session is used
for a Validation Finding, the Finding must reference the same Design
Hypothesis. Exploratory Sessions remain valid without an Experiment Brief.

## Consequences

- The Experiment Brief is copied into the Shared Session so later project work
  cannot change what participants were asked to observe.
- One Session tests at most one Design Hypothesis; GoDesk does not implement a
  general survey or multi-question form.
- Feedback remains a rating and observation from a claimed seat. Binding it to
  a question improves traceability but does not turn it into independent human
  evidence.
- Feedback requires one Accepted Action from that seat and snapshots the latest
  action as its Feedback Moment. This prevents comments without a replayable
  play context and does not add a general event-annotation system.
- A mismatched Finding is rejected at the authoritative project mutation seam.
