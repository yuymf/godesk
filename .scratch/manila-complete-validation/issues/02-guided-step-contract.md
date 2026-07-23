# Canonical guided-step contract

Type: prototype
Status: resolved
Blocked by: 01

## Question

Can one canonical route make the overall objective, current job, required
action, consequence, progress, blockers, and done condition understandable
without facilitator explanation?

## Acceptance

- Every substantive step renders the six-field contract from the spec.
- Overall objective, current step, unresolved blockers, and next consequence
  remain visible.
- The end-user route no longer asks participants to choose A/B/C.
- Existing development variants remain reachable without becoming the primary
  product navigation.

## Comments

- 2026-07-23: Claimed after issue 01 reproduced the current baseline.

## Answer

Implemented one canonical task-led authoring route.

- `/` now opens guided variant C at step 1 instead of workbench A at step 3.
- The overall target remains visible: an internal playable voyage whose
  rule-bearing behavior can return to sources and whose blockers cannot be
  skipped.
- All five steps define goal, why now, inputs, required action, decision
  consequence, and done condition.
- Progress and unresolved counts remain visible above the current task.
- Generic `确认并继续` was replaced with step-specific action labels.
- The normal product route no longer renders the A/B/C development switcher.
  Explicit `?variant=A/B/C&devVariants=1` routes preserve comparison access.
- Keyboard variant switching is active only in that explicit development mode.
- The stale Harbor 13 page title and description now identify Godesk Forge.

Current verification:

- `pnpm test` — 14/14 passed.
- `pnpm typecheck` — passed.
- `pnpm build` — passed.
- `git diff --check` — passed.
- Desktop default route — guided layout, all five contract labels present, no
  horizontal overflow.
- 390×844 default route — guided layout, all contract labels present, no
  horizontal overflow.
- Fresh browser route — no warnings or errors.

This issue establishes comprehension and navigation structure. Real,
authoritative divergence operations remain issue 03.
