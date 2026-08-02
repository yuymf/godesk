---
name: export-and-publish
description: Export an immutable GoDesk Playable Build and hand the resulting artifact or exact build URL to a creator. Use when a creator asks to deliver, download, archive, or publish a tabletop build.
---

# Export and Publish

Deliver the exact immutable build that the creator inspected. Export is a
delivery operation, not a substitute for compilation, visual inspection, or
human playtesting.

## Workflow

1. Read the requested project and build. Confirm the build ID, Definition
   version, warnings, and `unsupportedBehavior` before exporting.
2. If the creator wants the latest Definition, compile it first and use the
   returned immutable build rather than guessing a build URL.
3. Submit an `export-build` job with the exact `buildId` and a stable
   idempotency key. Track the job until it is terminal; retry only through
   `retry_job` when transport or execution failed.
4. Open the returned artifact URL and verify it is the expected build export.
   Also return the exact playable URL and editor URL so the creator can keep
   working in GoDesk.
5. State warnings and unsupported behavior exactly. Do not call an exported
   mechanics slice a complete or human-validated game.

## Delivery boundary

- `export-build` produces a recoverable GoDesk JSON artifact for this MVP.
- Publishing to a public catalog or distributing third-party assets requires
  a separate creator confirmation and rights review.
- The artifact is immutable; later Definition edits require a new build.
