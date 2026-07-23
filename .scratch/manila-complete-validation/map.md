# Manila complete-validation map

Status: superseded

This effort was stopped on 2026-07-23 after the product owner corrected its
designer-first premise. Completed engineering artifacts remain as historical
evidence, but the stranger authoring gate and Track A → B → C ordering no longer
control product development. Continue from
`.scratch/player-to-playable-platform/map.md`.

## Notes

- Execute Track A before Track B.
- Only issue 01 is initially claimed.
- Preserve the dirty worktree and report only verification run in the current
  effort as current evidence.
- The source fixtures remain internal-only.

## Decisions so far

- Treat the first unfamiliar-user session as a failed product gate, not a
  copy-edit request.
- Use one canonical guided route for participants; A/B/C may remain available
  only as development comparisons.
- Keep the rules-complete Manila build as an internal pressure-test fixture,
  because the PRD's P0 does not require complete automatic rule execution.
- Require real operations and reversible decisions in every substantive
  authoring step.
- Issue 01 reproduced tests, typecheck, build, A/B/C, playable, desktop, and
  390 px route availability. The decisive usability defect is structural:
  `打开冲突检查` is inert and `确认并继续` advances without creating a decision.
  See `issues/01-current-baseline-and-stranger-feedback.md`.
- Issue 02 made the guided route canonical, starts it at source registration,
  exposes the six-field job contract at every step, and removes the development
  variant selector from normal product navigation. See
  `issues/02-guided-step-contract.md`.
- Issue 03 added source comparison, A/B choice, accept, edit, reject, defer,
  source replacement, impact preview, undo, and a compile guard. The accepted
  human decision is carried into the compiled project summary. See
  `issues/03-divergence-decision-operations.md`.
- Issue 04 created a deterministic source, component, rule, asset, unsupported
  runtime, and licensing exercise. Source/component/rule gates now control
  compilation, and the compile and playable surfaces expose the remaining
  coverage report. See `issues/04-seeded-usability-fixture.md`.

## Frontier

1. `issues/01-current-baseline-and-stranger-feedback.md` — resolved
2. `issues/02-guided-step-contract.md` — resolved
3. `issues/03-divergence-decision-operations.md` — resolved
4. `issues/04-seeded-usability-fixture.md` — resolved
5. `issues/05-stranger-usability-round.md` — ready for human sessions
6. Issues 06–15 remain blocked by the Track A gate.

## Fog

- Which terms and consequences remain confusing after the task-led redesign?
- Whether 2 of 3 unfamiliar users can compile and open the playable build
  without facilitator rescue.
- Which rules-complete abstractions survive transfer to a second game.
