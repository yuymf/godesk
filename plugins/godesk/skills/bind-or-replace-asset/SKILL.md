---
name: bind-or-replace-asset
description: Attach or replace a traceable Source Library image on a GoDesk entity, play-surface region, or presentation. Use when a creator wants to change prototype art without rewriting rules.
---

# Bind or Replace an Asset

Assets are first-class, replaceable presentation data. Keep the old source
traceable; never rewrite the rules merely to change art.

## Workflow

1. Read the project Rule System and `sources`; identify the exact entity,
   play-surface region, or presentation target and its current version.
2. Add a new image through `apply_project_patch` when it is not already in Source
   Library. It must use `imageUse: "project-asset"`; a Visual Reference cannot
   be bound directly. Use provenance `creator-upload`, `creator-authored`, or
   `generative-api` as appropriate, with an honest locator. A `generative-api`
   image must set `basedOnSourceIds` to its creator-authored visual brief and
   every Visual Reference that influenced it.
3. In the same focused patch or a subsequent versioned patch, replace only the
   target's bound image (`sourceId`, URL, alt). Set the presentation visual
   provenance to `extracted`, `uploaded`, or `generated` to match the source.
4. Re-read the changed Rule System and Sources, compile a new immutable Build,
   and report the old and new source IDs plus the Presentation Floor result.

Replacing an asset changes a future Build only; existing Builds and Shared Sessions remain
immutable.
