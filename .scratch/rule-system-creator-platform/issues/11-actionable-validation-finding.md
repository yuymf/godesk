# 11 — Make validation findings actionable

Type: task
Status: resolved

## Question

Does a validation record tell Codex what focused change to make next in the
same Game Project, while preserving the distinction between evidence and
interpretation?

## Answer

`ValidationFinding` now stores a required `nextChange` alongside the evidence,
verdict, and observation notes. HTTP, MCP, Web Studio, the validation Skill,
and the repeatable local-loop verifier all use the same field. The Worker
validates its length and rejects an empty change proposal. The Studio displays
it separately from observed notes so a bot result is not confused with a human
claim or with an implementation instruction.

The contract intentionally has no migration or fallback for findings created
under the previous shape: a project containing an old finding is treated as an
unsupported old project shape, consistent with the repository's no-compatibility
policy.
