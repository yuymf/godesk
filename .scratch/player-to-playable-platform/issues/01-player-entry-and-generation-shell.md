# Player entry and generation shell

Type: prototype
Status: resolved

## Question

Can the default route communicate “upload rules and assets, get a playable game”
and lead into the existing Manila playable output without exposing the manual
authoring workflow?

## Acceptance

- Rulebook and asset inputs are first-class and clearly labeled.
- There is one primary generation action.
- The pipeline communicates rule understanding, asset handling, prototype
  assembly, verification, and room preparation.
- Optional clarification is shown as an exception, not a normal step.
- The Manila example reaches the existing playable voyage.
- Missing real ingestion, generation, complete rules, and networking are
  explicitly marked as not implemented.
- The old authoring UI is available only through a development query.

## Comments

- 2026-07-23: Claimed after product-owner correction.

## Answer

The default route now expresses the player promise directly: add a rulebook and
asset package, let the platform handle the work, then enter a playable game.

Implemented:

- a rulebook PDF input and a PDF/image asset-package input;
- one primary action using the seeded Manila fixture;
- an automatic progress surface for rule understanding, asset handling, missing
  image handling, and playable assembly;
- an explicit “no clarification needed” result, with clarification described as
  an exceptional grouped interruption;
- a generated-game summary that opens the existing Manila single-voyage game;
- an intentionally disabled online-room action labeled as not implemented;
- an honest capability summary for real ingestion, image generation, complete
  rules, and networking;
- a development-only escape hatch at `?devAuthoring=1&variant=A/B/C` for the
  superseded authoring experiments.

The progress animation is explicitly labeled as an internal fixture
demonstration. It does not claim to process user-selected files.

Current verification on 2026-07-23:

- `pnpm test` — 5 files, 22 tests passed.
- `pnpm typecheck` — passed.
- `pnpm build` — passed; 37 modules transformed.
- `git diff --check` — passed.
- Desktop 1440×900 — player promise, both inputs, one primary action, and
  capability boundary visible.
- Mobile 390×844 — upload and generated-result routes have no horizontal
  overflow.
- Example generation reaches the generated result and existing playable route.
- Development authoring route remains explicitly reachable.
- Browser console — 0 errors, 0 warnings after adding the favicon.

Real file processing, image generation, complete rule compilation, and online
rooms remain issues 02–06 and are not claimed by this issue.
