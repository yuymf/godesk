# Seeded end-to-end usability exercise

Type: prototype
Status: resolved
Blocked by: 03

## Question

Can every unfamiliar participant receive the same imperfect source set and
complete a comparable source-to-playable exercise?

## Acceptance

- The fixture contains accepted and rejected sources, high- and low-confidence
  candidates, a direct conflict, a missing asset, an unsupported runtime rule,
  and a non-overridable licensing blocker.
- The participant resolves or defers decisions, observes project updates,
  compiles, opens the playable build, and finds the remaining coverage report.
- Automated tests cover decision transitions, blocking, undo, and compilation.
- Browser QA covers the complete visible-control exercise.

## Comments

- 2026-07-23: Claimed after divergence decisions became authoritative and reversible.

## Answer

Implemented a deterministic five-step exercise with the same imperfections for
every participant.

Seeded evidence:

- accepted, readable eight-page rulebook;
- rejected corrupt mirror retained with provenance;
- 99% confidence three-punt candidate;
- 61% confidence pilot/pirate candidate;
- photo-derived 16 vs source-backed 20 accomplice discrepancy;
- missing port/shipyard high-resolution asset;
- unsupported complete loans, insurance fallback, blind passenger, and
  multi-voyage runtime rules;
- permanent internal-only licensing blocker.

The exercise now requires real user operations before each next step unlocks.
Source, component, and rule decisions are persisted in reducer state and can be
undone. Compilation requires all three gates. Choosing photo-derived 16
accomplices does not satisfy the source-backed component gate. The licensing
blocker never becomes passable.

The compile screen and playable game both expose a validation report showing
accepted evidence, human decisions, missing-asset disposition, unsupported
runtime coverage, and publication status.

Verification:

- `src/manila/authoring.test.ts` now covers source gates, component gates,
  incorrect count blocking, missing-asset disposition, divergence gating,
  compilation, permanent publication blocking, and undo.
- `pnpm test` — 22/22 passed across 5 files.
- `pnpm typecheck`, `pnpm build`, and `git diff --check` — passed.
- Desktop visible-control exercise completed source review, component review,
  source-backed rule choice, compilation, playable opening, and validation
  report discovery with no browser warnings or errors.
- The compiled coverage report contained seven expected records and no
  horizontal overflow.
- The playable validation report contained the same seven boundaries and no
  horizontal overflow.
- 390×844 source step rendered all three seeded source records in a 362 px panel
  without horizontal overflow.

Human unfamiliar-user evidence remains issue 05. The protocol and session
template are:

- `../usability-protocol.md`
- `../usability-session-template.md`
