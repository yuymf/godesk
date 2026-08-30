# 20 — Preserve participant ranges from natural-language briefs

Type: task
Status: resolved

Blocked by: None

## Question

Does prompt-first generation keep a natural-language player range as editable
Rule System data instead of collapsing `2–4` players to one seat count?

## Answer

Yes. The deterministic materializer now recognizes English and Chinese range
forms such as `2 to 4 players`, `2-4 player`, and `二至四位玩家`, preserving
`participants.min`, `participants.max`, and a conservative default of the
minimum. An explicitly supplied participant object still takes precedence.

## Verification

- Unit coverage checks both languages and the materialized Rule System.
- Worker coverage runs the durable `generate-rule-system` job without an
  explicit participant override and checks the returned project.
- Existing HTTP/MCP self-play loops remain unchanged because their brief says
  one explicit participant count.
