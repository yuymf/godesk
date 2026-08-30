---
name: generate-visual-fill
description: Fill missing GoDesk prototype visuals with host-quota generation or a presentable Presentation Floor kit. Use when a creator asks for generated art or when extracted art is insufficient.
---

# Generate Visual Fill

In Plugin/Codex mode, generative calls consume the host user's available
agent/image quota. GoDesk website subscription credits, metering, plans, and
billing are explicitly out of scope.

## Workflow

1. Read the project's `sources` and Rule System. Keep `visual-reference`
   images as guidance and reuse `project-asset` images directly before
   requesting new art.
2. Save the creator's exact visual direction as a `brief` Source Library entry
   with `creator-authored` provenance. This source is the generation brief, not
   a rules claim.
3. If host capacity is available, generate only the missing visual. Add the
   resulting data-image URL as a Source Library image with
   `imageUse: "project-asset"`, `generative-api` provenance, locator
   `Codex host-user quota`, and `basedOnSourceIds` containing the generation
   brief plus every Visual Reference supplied to generation. Bind it into the entity, play-surface region, or
   presentation, and record a `generated` presentation visual.
4. If capacity is unavailable, exhausted, or denied, do not leave a naked
   placeholder. Apply the Presentation Floor in this order: extracted art;
   then programmatic/typographic visuals suited to the play surface
   (`generated` visual label); then a
   designed theme kit (`kit` visual label).
5. Re-read Sources and the Rule System. Confirm the generated image points to
   the exact brief and reference set, compile the current version, and confirm
   the Build includes the full source dependency closure and passes its
   Presentation Floor. Do not promise a share
   link before those read-backs pass.

Generated output remains replaceable Source Library material; it never rewrites
rules or removes source provenance.
