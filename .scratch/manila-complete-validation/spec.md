# Manila complete-validation effort

Status: superseded by product correction

> Superseded on 2026-07-23 by
> `.scratch/player-to-playable-platform/spec.md` and ADR 0001. The product owner
> clarified that ordinary players, not tabletop designers, are the primary
> users. The manual candidate-review journey described below must not remain the
> product's main path.

## Design question

Can an unfamiliar tabletop designer independently turn source fixtures into a
reviewed, playable project, understand every blocking decision, and then use a
rules-complete internal Manila fixture to expose gaps in that creation flow?

## Ordered evidence gates

### Track A — understandable authoring

The creation journey must become task-led instead of artifact-led. Every
substantive step must expose:

1. the goal;
2. why the step is needed now;
3. its inputs;
4. the required user action;
5. the downstream consequence;
6. the done condition.

Any candidate that cannot safely become authoritative is a divergence point.
The user must be able to inspect its evidence, choose or edit an interpretation,
reject or defer it, preview the consequence, and undo the decision.

Track A passes only after at least three unfamiliar participants attempt the
seeded exercise and the criteria in
`docs/MANILA-NEXT-PHASE-HANDOFF.md` section A4 are met.

### Track B — rules-complete Manila validation fixture

After Track A passes, convert every normative rule in the accepted eight-page
rulebook into a coverage ledger and implement the complete 3–5 player,
multi-voyage economy as source-linked authoritative transitions.

The Manila implementation remains an internal validation fixture. It is not a
licensed product and completing it does not complete the platform MVP.

### Track C — platform transfer

After Track B, import a second authorized or original game and return to the
PRD's actual platform loop: project and asset setup, browser room, private and
server-authoritative state, rules helper, action log, replay, feedback, and
revision.

## Trust boundaries

- AI produces candidate facts; only explicit human decisions promote them.
- Clients and bots submit intents; authoritative rules accept or reject them.
- Accepted actions retain source anchors and reconstruct table state.
- The rules helper never mutates table state.
- The licensing blocker cannot be converted into a passed check.
- Automated browser traversal is not unfamiliar-user evidence.
- Bot play is not human playtest evidence.

## Current starting evidence

- The previous effort recorded a source-linked, playable single-voyage slice.
- The current worktree contains substantial uncommitted prototype work and must
  be preserved.
- One unfamiliar user could not explain the overall flow, the current step,
  divergence points, required operations, downstream effects, done conditions,
  or recovery path.
- The original PRD explicitly does not require complete automatic rule
  execution for P0.

## Acceptance

- Issue 01 records a currently reproduced engineering and browser baseline.
- Issues 02–04 produce one canonical guided authoring exercise with real,
  reversible decisions and seeded imperfections.
- Issue 05 records three consented unfamiliar-user sessions and either passes
  Track A or creates ranked follow-up issues.
- Track B remains blocked until issue 05 is resolved with passing human
  evidence.
- Each later rule is tracked by source anchor, branch scenarios, accepted
  actions, replay evidence, and human-play evidence.
- The effort reports completed, blocked, deferred, and single next priority
  separately.

## Non-claims

- A passing test/build/browser baseline does not prove usability.
- A seeded exercise does not prove real extraction quality.
- A complete Manila fixture does not prove general platform transfer.
- Recorded prior evidence is not current verification until rerun.
