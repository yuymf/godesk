# Current baseline and first stranger feedback

Type: task
Status: resolved

## Question

Which prior engineering and browser checks still pass now, what has drifted,
and what exactly did the first unfamiliar participant fail to understand?

## Required evidence

- Preserve and record the dirty worktree.
- Read the repository contract, prior creation-flow effort, handoff, source
  provenance, original PRD, and relevant implementation.
- Run tests, typecheck, and production build.
- Open authoring variants A/B/C and the playable route.
- Record route-level visual, interaction, responsive, and console observations.
- Record the first unfamiliar-user session as unresolved usability evidence.
- Distinguish prior recorded evidence from current verification.

## Acceptance

- A baseline section lists commands, date, result, and relevant output.
- A route matrix lists every checked route and viewport.
- Known drift and unverified claims are explicit.
- The first participant's observed confusion is converted into one unresolved
  issue statement that directly feeds issue 02.

## Comments

- 2026-07-23: Claimed at the start of the continuation effort.

## Answer

Baseline reproduced on 2026-07-23 in
`/Users/halyu/Documents/Code/godesk`.

### Worktree preservation

The effort started from a dirty worktree containing modified tracked prototype
files and untracked creation-flow, source, asset, public, Manila, and handoff
paths. No reset, clean, checkout, rebase, commit, or unrelated rewrite was
performed. The new effort files were added alongside that work.

### Product-boundary check

The original 12-page DOCX PRD was rendered and its full paragraph structure was
extracted. It confirms that P0 is a general designer loop covering project and
asset setup, table editing, a 2–4 player browser room, server-authoritative
state, source-bounded rules help, action records, replay, feedback, and
revision. Complete automatic rule execution is explicitly not required by P0.
The Manila complete build therefore remains an internal validation fixture.

The local DOCX render lacked Chinese glyphs because the rendering environment
did not have the document's expected CJK font. Structural extraction remained
readable, so the product-boundary check was completed without editing the PRD.

### Engineering commands

- `pnpm test` — passed: 4 files, 14 tests.
- `pnpm typecheck` — passed.
- `pnpm build` — passed with Vite 7.3.6; 34 modules transformed.
- `git diff --check` — passed.

### Current browser route matrix

The dev server selected `http://127.0.0.1:5175/` because ports 5173 and 5174
were already occupied.

| Route | 1280×720 | 390×844 | Console | Current observation |
| --- | --- | --- | --- | --- |
| `?variant=A` | opened; no horizontal overflow | opened; no horizontal overflow | no warnings/errors | Shows sources, candidates, and output, but the conflict action is inert. |
| `?variant=B` | opened; no horizontal overflow | opened; no horizontal overflow | no warnings/errors | Shows provenance, but does not provide authoring decisions. |
| `?variant=C` | opened; no horizontal overflow | opened; no horizontal overflow | no warnings/errors | Starts at step 3; “确认并继续” advances without recording a decision. |
| `?variant=C&view=play` | opened; no horizontal overflow | opened; no horizontal overflow | no warnings/errors | Playable controls are present; a full visible-control voyage was not rerun in this baseline. |

The document title is still `Harbor 13 · 桌游机制测试台`, which has drifted
from the Manila/Godesk Forge product shown in the UI.

### Interaction evidence

- Clicking `打开冲突检查` on variant A changed neither URL, dialog count, nor
  main content. It currently performs no user operation.
- Clicking `确认并继续` on variant C advanced from step 3 to step 4, but the UI
  never asked the user to choose an interpretation, edit or reject a candidate,
  preview an impact, or create an undoable project decision.
- The mobile guided route puts the decision card below the rulebook image and a
  fixed development-variant switcher obscures part of the viewport.

### First unfamiliar-user failure

Unresolved issue statement:

> An unfamiliar designer cannot independently progress because the interface
> presents source artifacts and status labels without defining the user's job.
> It does not keep the overall output, current goal, required operation,
> divergence question, decision consequence, done condition, or recovery path
> visible, and its apparent review actions do not create authoritative,
> reversible project decisions.

This is the input contract for issue 02, not a request for copy-only changes.

### Evidence boundary

Prior records say a browser-driven full voyage passed. That result was not
rerun here and is not claimed as current browser evidence. No unfamiliar-user
session was simulated or replaced by automation.
