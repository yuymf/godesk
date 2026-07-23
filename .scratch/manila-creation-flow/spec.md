# Manila AI-native creation-flow prototype

Status: accepted

## Design question

Can a designer turn a real rulebook and component photography into a traceable
tabletop project—without trusting AI extraction as authority—and reach a
source-linked playtest surface faster than manually rebuilding the game?

## Validation fixture

- Accepted English *Manila* rulebook: 8 pages, rendered and visually inspected.
- Seven product/setup/component photographs.
- Every file has a source URL and SHA-256 in
  `sources/manila/PROVENANCE.md`.
- User authorized these commercial materials for this internal validation only.
  Publishing, redistribution, and commercial use remain blocked.

## Workflow under test

1. Ingest sources and record provenance, rejection, and usage boundaries.
2. Extract component inventory, rule facts, constraints, and phase graph as
   candidates.
3. Attach a source anchor and confidence to every candidate.
4. Require human review for uncertain combinations; do not silently infer.
5. Compile accepted candidates into runtime tabletop objects.
6. Generate a directly playable tabletop, not a component inventory or static
   preview.
7. Let a human complete one voyage against two automated seats, then record
   covered, pending, and unimplemented rules.

## Prototype variants

- A — four-column workbench for side-by-side source, document, review, and
  tabletop comparison.
- B — provenance graph for finding broken source-to-runtime links.
- C — guided human review for testing a lower-cognitive-load authoring path.

All variants use one project model and are switchable on the same route through
`?variant=A/B/C`.

## Acceptance

- The valid PDF has page renders and all eight were visually inspected.
- Provenance includes accepted and rejected source files with hashes.
- Core Manila identity is explicit: four goods, three punts, 20 shares, 20
  accomplices, harbor-master auction, start positions totaling 9 with each at
  most 5, four placements, three movements, pirates, pilots, and settlement.
- Every structured fact has a page or asset anchor.
- The generated result accepts player decisions, runs two automated opponents,
  follows the actual three-player phase order, performs three dice movements,
  resolves payouts, declares a voyage leader, and can restart.
- The authoring flow opens this playable result directly; a checklist or
  reference photograph does not satisfy the generated-output gate.
- Typecheck, tests, build, and browser QA pass for all three variants and the
  dry-run surface.

## Explicit non-claims

- This is a playable one-voyage slice, not a rules-complete clone or complete
  multi-voyage game.
- It does not validate real LLM extraction quality, networking, or long-session
  play.
- It does not grant or imply rights to publish the included fixtures.
