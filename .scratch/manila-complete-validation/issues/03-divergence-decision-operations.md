# Operable divergence decisions

Type: prototype
Status: resolved
Blocked by: 02

## Question

Can a user identify why a candidate is unsafe, compare evidence and
interpretations, make a real decision, see its downstream impact, and undo it?

## Acceptance

- Divergence cards expose question, alternatives, anchors, confidence,
  flagging reason, downstream impact, and primary action.
- The prototype supports accept, edit, choose A/B, reject, defer-and-block,
  source replacement, source opening, consequence preview, and undo.
- Compilation cannot silently pass an unresolved blocking rule.
- Accepted facts remain distinguishable from AI candidates.

## Comments

- 2026-07-23: Claimed after the canonical guided-step contract passed.

## Answer

Implemented a real, reversible decision boundary around a source/runtime
divergence:

> Does a punt moved to space 13 by a pilot trigger an immediate pirate attack?

The card compares the over-broad AI candidate with the explicit p.5–6
source-backed exception and exposes confidence, flag reason, anchors, runtime
impact, and blocking status.

Supported operations:

- accept the current AI candidate;
- edit the rule and accept it;
- choose interpretation A or B;
- reject the required candidate and retain the block;
- mark it unresolved and retain the block;
- attach or replace a source;
- open p.3, p.5, or p.6;
- preview the authoritative runtime consequence;
- undo the latest source or decision mutation.

Compilation enforcement:

- The top playable entry, step 4, step 5, and the compile button remain disabled
  while the required rule is pending, rejected, or unresolved.
- A human-accepted decision enables compilation.
- The exact accepted decision appears in the compiled project summary.

Verification:

- Added `src/manila/authoring.test.ts`.
- `pnpm test` — 18/18 passed across 5 files.
- `pnpm typecheck`, `pnpm build`, and `git diff --check` — passed.
- Desktop browser verified initial blocking, source attachment, undo,
  interpretation A, runtime preview, compilation unlock, and compiled summary.
- 390×844 verified the divergence surface at 362 px card width without
  horizontal overflow.
- Fresh desktop browser console had no warnings or errors.
