---
name: harvest-rulebook-images
description: Extract usable rulebook images into a GoDesk project's Source Library and bind them to its presentation. Use when a creator provides a PDF or rulebook images and asks to reuse its visual material.
---

# Harvest Rulebook Images

Treat extracted material as creator-supplied evidence, never as generated art.

## Workflow

1. Read the target project and its current version. If the rulebook has not yet
   been materialized, submit `generate-rule-system` with `sourceKind: "rulebook"`,
   `sourceContent`, and up to eight `visualInputs` (`name`, base64 data-image
   URL, one-based `pageNumber`, and `imageUse: "project-asset"`), then track it
   to terminal. Read the
   resulting `generation-plan` before compiling and approve it only after the
   generated interpretation is acceptable.
2. For an existing project, use `apply_project_patch` to add every usable image as
   `kind: "image"`, `imageUse: "project-asset"`,
   `provenance.origin: "creator-upload"`, and a locator such as
   `rules.pdf page 3`.
3. Re-read `sources`, then patch the affected entity, play-surface region, or
   presentation image with that exact `sourceId`, URL, and alt text. Mark the
   presentation visual `provenance: "extracted"`.
4. Re-read the Rule System and report the stored source IDs and provenance.

Do not claim that a page was harvested when it has no usable image bytes. If no
image can be extracted, continue through the Presentation Floor kit path.
