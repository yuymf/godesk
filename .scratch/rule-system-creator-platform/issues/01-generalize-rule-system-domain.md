# 01 - Generalize the Rule System domain

Type: task
Status: resolved

Blocked by: None

Replace tabletop-required fields with participant, Game Entity, stage, outcome,
and Play Surface concepts. Rename Table State and Visual Floor language at the
public seams. Migrate current examples and kernels directly; do not add aliases,
fallback shapes, or data migrations.

## Acceptance

- Contract and Worker tests prove a non-table Play Surface is valid.
- Existing score and harbor kernels compile against the new model.
- No active product contract requires `board`, `components`, or `TableState`.

## Answer

The public model now uses participants, Game Entities, stages, outcomes, Play
Surface, Session State, and Presentation Floor. Existing score and harbor
kernels use the new root model, while old persisted Build shapes return 410 and
must be recompiled. `pnpm test` and `pnpm test:worker`,
`pnpm typecheck`, and `git diff --check` pass.
