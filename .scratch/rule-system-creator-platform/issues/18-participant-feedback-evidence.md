# 18 — Turn Shared Session feedback into traceable evidence

Type: task
Status: resolved

Blocked by: 17

## Question

Can a persisted Shared Session rating/comment become an auditable observation
for the same Build and Design Hypothesis without being mislabeled as a human
playtest?

## Answer

Validation Findings now support `participant-feedback`. The creator or Codex
must reference the same Room and submit the exact current feedback entries as a
snapshot. GoDesk verifies the Room/Build relationship and every feedback ID,
seat, rating, and comment before persisting the Finding. Later edits to the
Room's updatable feedback do not rewrite the Finding's snapshot. This evidence
type remains distinct from creator-attested `human-session` evidence.

## Verification

- Worker regression coverage accepts a matching snapshot, rejects a tampered
  snapshot, and proves later Room feedback edits do not mutate the Finding.
- `pnpm verify:local-loop` records participant feedback, creates a Finding from
  it, and continues to a new immutable Build in the same project.
- `pnpm verify:local-mcp` writes feedback through the public URL, reads it back
  through MCP, records the same evidence type, and reads it from the validation
  view.
- Current evidence remains automated/local; it does not claim real-person
  participation or public OAuth success.
