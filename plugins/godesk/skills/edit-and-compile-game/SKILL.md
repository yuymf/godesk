---
name: edit-and-compile-game
description: Revise an existing GoDesk Rule System and compile an immutable Playable Build. Use when a creator changes participants, rules, entities, actions, play surface, outcomes, scoring, shared progress, duration, goal target, or turn limit, or asks to rebuild after Web Studio edits.
---

# Edit and Compile a Game

Keep Codex edits and manual Web Studio edits on the same optimistic-version path.

## Workflow

1. Identify the exact project with `list_projects`; never rely on hidden session
   state.
2. Call `read_project` for `overview` and the smallest affected `rules`,
   `entities`, `surface`, `outcomes`, or `entity` view before planning a
   change.
3. Open the exact Web Studio URL if it is not already visible.
4. Translate the requested revision into the smallest supported
   `apply_project_patch` operations. Choose the Executable Kernel with the
   table in `$godesk-plugin-basics`; do not substitute a score-track
   `configure_*` for a genre Kernel. Use `configure_score_race` for per-seat
   scoring, `configure_shared_goal` for one explicit cooperative progress
   track, or `configure_turn_taking` for an explicit bounded round-robin
   action loop without inferred scoring or a winner. Use
   `configure_take_away` for an explicit initial shared pool, legal take
   amounts, and last-taken-wins condition. Use `configure_roll_and_move` for
   explicit die sides, movement by the result, target position, and safety
   turn limit. Use `configure_draw_and_score` for explicit card values, copies
   per value, target score, and one draw action; preserve finite-deck and
   exhaustion semantics. Use `configure_push_your_luck` for explicit die,
   bust face, banked-score target, safety limit, and the canonical `roll` and
   `bank` actions. Use `configure_hidden_role` for secret roles
   (culprit/town), player count, and majority-reveal play. Use
   `configure_hand_play` for shuffled deck, hidden hands, hand size,
   play-to-score, and first-to-target (canonical `play` action). Use
   `configure_conversation_relay` for speech acts recorded into the
   transcript with a turn budget (no victory points). Use `configure_harbor_voyage`
   for harbor-like corpus (player count 2–3). Use `configure_worker_placement`
   for generic placement with source-derived regions/workers. Do not silently
   change Kernel semantics.
5. Pass the latest version as `expectedVersion` and a stable idempotency key.
6. If the server rejects a stale version, re-read and reconcile. Preserve
   creator changes; do not force an overwrite.
7. Re-read the changed view and confirm Web Studio reflects it. If the project
   has a pending `generation-plan`, review it and approve it before compiling.
8. Submit a `compile-build` job with the new current version and track it until
   succeeded or failed. When the revision applies a persisted Validation
   Finding, pass that Finding as `basedOnFindingId`; otherwise leave the field
   absent.
9. Read and open the immutable build from the terminal result. Report its
   Rule System version, warnings, `presentationFloor`, `playabilityFloor`, and
   unsupported behavior. Share gate is playability + genre fidelity (ADR 0012),
   not kit cosmetics. If Presentation Floor cites "桌子好看但还不是那款游戏",
   add/fix transcript, hand/play areas, named regions, or seat roles — do not
   tell the creator to paste another kit or change the theme.

## 3D render declaration (GameSpec v2)

- GameSpec is `schemaVersion: 2`. Spatial play surfaces (`table`, `scene`,
  `hybrid`) carry `presentation.render`: the data-only Three.js declaration
  (`preset`, `camera`, `lighting`, `water`, `materials`, `bindings`, `motion`,
  `audio`). GoDesk fills a Kernel-specific default and projects it into
  `gameSpec.render`; the Executable Kernel stays the only rules authority.
- New spatial projects get an explicit render at generation time; when the
  Generation Plan binds a spatial Kernel (`hex-settlement-v1`,
  `disc-flipping-v1`, `harbor-voyage-v1`, `worker-placement-v1`,
  `network-route-v1`), an untouched default is swapped for that Kernel's preset
  and bindings. An edited render is kept.
- To change the look, send one `configure_render` operation with a partial
  `patch` through `apply_project_patch`. Sections merge one level deep
  (`camera`, `lighting.sun` / `hemisphere` / `shadow`, `water`, `motion`,
  `audio` levels); `materials` merges per key (a new key must be a complete
  material: `base`, `roughness`, `metalness`, `pattern`); `bindings` and
  `audio.cues` replace wholesale. Prefer one focused patch per creator request
  and re-read the `rule-system` view after each.
- A patch is rejected (400, nothing changes) when a value is out of range, a key
  is unknown, `bindings[].material` is not a `materials` key,
  `camera.minPolarDeg >= camera.maxPolarDeg`, or an asset id is not
  licence-cleared in the asset manifest. Never send scripts or shader source.
- `update_rule_system` with a whole `presentation` still works; omitting
  `render` keeps the current one, and `presentation.theme` no longer exists (a
  legacy value is ignored).
- Non-spatial surfaces (`cards`, `conversation`, `screen`) have no render;
  `configure_render` on them is rejected.

### Example: three render edits in a row

Each step re-reads the project version and uses a new idempotency key.

1. "海水再浅一点"
   `{"op":"configure_render","patch":{"water":{"enabled":true,"shallow":"#3fa7c9"}}}`
2. "太阳低一点，像傍晚"
   `{"op":"configure_render","patch":{"lighting":{"sun":{"elevationDeg":24}}}}`
3. "棋子换成深色金属"
   `{"op":"configure_render","patch":{"materials":{"piece":{"base":"#222831","roughness":0.3,"metalness":0.2}}}}`

After each step, confirm the changed field in `presentation.render` (and the
projected `gameSpec.render`), then compile a new Build when the creator wants to
play it.

## Build discipline

- A build snapshots one Rule System version. Later project edits must not change
  it.
- To revise from a historical Build, call `restore_build_as_rule_system` with
  the latest project version, re-read the new active Rule System and its
  `restoredFromBuildId`, then apply focused edits and compile a new Build.
- A successful compile may still contain warnings or unsupported behavior.
- Never substitute a new project for a requested revision unless the creator
  explicitly asks to branch or duplicate it.
