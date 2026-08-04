---
name: generate-visual-fill
description: Fill missing GoDesk prototype visuals with host-quota generation or a presentable Visual Floor fallback. Use when a creator asks for generated art or when extracted art is insufficient.
---

# Generate Visual Fill

In Plugin/Codex mode, generative calls consume the host user's available
agent/image quota. GoDesk website subscription credits, metering, plans, and
billing are explicitly out of scope.

## Workflow

1. Read the project's `sources` and Definition; harvest rulebook art before
   requesting new art.
2. If host capacity is available, generate only the missing visual. Add the
   resulting data-image URL with `apply_game_patch` as a Source Library image
   whose provenance is `generative-api` and locator identifies `Codex host-user
   quota`. Bind it into the component, zone, or presentation, and record a
   `generated` presentation visual.
3. If capacity is unavailable, exhausted, or denied, do not leave a naked
   placeholder. Apply the Visual Floor in this order: extracted art; then
   programmatic/typographic cards and table (`generated` visual label); then a
   designed fallback theme (`kit` visual label).
4. Re-read the Definition, compile the current version, and report the Build's
   Visual Floor status. Do not promise a share link until it has passed.

Generated output remains replaceable Source Library material; it never rewrites
rules or removes source provenance.
