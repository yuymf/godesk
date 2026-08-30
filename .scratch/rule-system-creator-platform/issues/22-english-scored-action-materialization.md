# 22 — Preserve multiple scored actions from English rule text

Type: task
Status: resolved

Blocked by: None

## Question

Does prompt-first generation preserve every explicitly scored action in an
English rule sentence instead of merging actions and silently applying the
first score to all semantics?

## Answer

Yes. The deterministic extractor now splits clauses joined by `or`, strips the
player subject, preserves each action's `for N points` description, and
recognizes common English victory-target phrasing such as `reach 6 points`.
The existing Kernel gate still requires every extracted action and the target
to be explicit before configuring `score-race-v1`.

## Verification

- Unit coverage preserves `investigate clues = 2` and `organize clues = 1`.
- Durable Worker generation coverage confirms both actions and `victoryTarget`
  enter the executable Kernel.
- HTTP and MCP self-play loops still pass after the parser correction.
