# 02 - Generate a Rule System from an idea or sources

Type: task
Status: resolved

Blocked by: 01

Generalize the durable generation job so a prompt alone is sufficient and
optional source files enrich provenance. Generation must materialize the new
Rule System shape and retain unsupported behavior honestly.

## Acceptance

- Prompt-only HTTP and MCP generation tests pass.
- Source-backed generation still preserves provenance.
- The generated Play Surface is inferred without defaulting every game to a
  board.

## Answer

Generation now accepts `idea` plus optional sources and participant ranges.
The materializer infers conversation, cards, table, scene, or screen surfaces;
HTTP and MCP idea-only job tests pass, while source-backed provenance and image
harvest tests remain green. Brand keywords cannot replace creator-authored
material with a built-in Rule System. Full Worker coverage is 66 tests.
