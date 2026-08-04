---
name: create-shareable-prototype
description: Turn a rulebook into a presentable GoDesk room and return its invitation URL. Use when a creator asks to make or share a playable tabletop prototype from rules text or a rulebook.
---

# Create a Shareable Prototype

The success path is Rulebook → Visual Floor → immutable Build → Room →
invitation URL. The Web Editor is an optional secondary handoff, not the final
destination.

## Workflow

1. Call `create_project`, then submit and track `generate-definition` with the
   rulebook as `sourceContent`/`sourceKind: "rulebook"` and harvested page images
   when available.
2. Read Sources and Definition. Harvest and bind extracted art first. Use
   `generate-visual-fill` for missing art; without host generation capacity,
   apply typographic/programmatic presentation or a theme kit so the Visual
   Floor is never a text-only table.
3. Submit `compile-build` with the latest version and track it to terminal.
   Inspect warnings, unsupported behavior, and `visualFloor`. If the floor is
   unmet, fix presentation and compile again; do not create a room.
4. Call `create_room` with the immutable Build ID, explicit seed, and stable
   idempotency key. Return `roomUrl` as the single invitation URL.
5. Return the room URL first. Include the Build URL, source provenance, warnings,
   unsupported behavior, and Editor URL only as secondary verification links.

The invitation creates no multiplayer UI work beyond the authoritative Room URL.
