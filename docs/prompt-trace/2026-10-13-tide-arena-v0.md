# Prompt trace — Tide Arena / 潮阵 `auto-battler-v1` (2026-10-13)

## Goal
First knife for Tide Arena / 潮阵: Executable Kernel `auto-battler-v1` end-to-end as far as the platform allows in one pass. Product name only — never third-party auto-battler brands.

## Constraints (from 大主管)
- Worktree `/workspace/godesk-tide-arena`, branch `feat/tide-arena-v0`, base `fa4adcb`
- Priority: game loop + deterministic combat + registration wiring first; then tabletop/HUD
- Do **not** add `auto-battler-v1` to `SHAREABLE_KERNELS` until decision density is ready
- Screenshots only under `/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/`
- No Cloud Agent / Collecta / merge to main

## Loci (M1 map)
See `/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/00-kernel-loci.md`.

## Implementation notes
- Adapter: `src/runtime/adapters/auto-battler.ts` — shop → place → combat → resolve; 6-unit roster; 3 traits; seeded combat
- Wire: `KERNEL_CAPABILITIES`, `project-contract`, `job-runner` thin bind (beats hand-play on tide cues), `worker/runtime` acceptIntent + bot, plugin basics
- UI: `TideArenaBoard` DOM HUD + lobby mark; SceneHost/tabletop mapper left for later
- ★2 merge: unsupported / OOS

## Tests
- Unit: `src/runtime/adapters/auto-battler.test.ts` (determinism + replay)
- Worker: runtime Shared Session bot simulation
- e2e: `e2e/tide-arena-board.spec.ts` (NL → configure_auto_battler → shop/place/combat)

## Knife 2 — Step 6 gate + Step 3 3D board (same day)
Prompt (大主管): reference mockup `/workspace/ui-refs/tide-arena/` approved. Step 6 first — a generic form-like DOM HUD-only game must not be reported playable (gate + unit test + SKILL.md line). Step 3 — replace the DOM-only board with a 3D tabletop per ref (wooden table, 7×4 board split by a tide line teal/coral, recessed 5-slot bench, ~45° camera, tier-coloured base discs, own/enemy rings, HP bars + star pips, pointer drag bench→cell / cell↔cell / sell zone, drag locked in combat, DOM overlay HUD). Five notes: unique silhouettes; stacked floaters; shop lock icon + 「战斗中」; mobile board fills width / ≥44px targets; single-char trait glyphs. Budgets triangles ≤300k, drawCalls ≤80, firstGameRequests ≤80.

Decisions:
- Gate: `KERNEL_PRESENTATION` typed registry in `presentation-floor.ts`; unknown/generic-hud kernels fail closed with 未呈现. auto-battler flipped to `dedicated-board` only in the commit that ships the 3D board.
- Dedicated lazy three.js scene (`src/render3d/tide-arena/`) instead of SceneHost: SceneHost adapters are click-pick only (no drag). Reuses render tiers (`resolveTier`).
- Instancing: one InstancedMesh per unit type (merged vertex-coloured geometry incl. tier base) + one ring mesh + instanced tiles/wells/highlights; render on demand. Measured 16 draw calls / 13.5k triangles in e2e.
- Kernel: own half 7×2 + bench 5; place/move/recall/sell legal in both prep phases; combat still is a client-side 7s hold (kernel resolves instantly).
- Palette split into a three-free module so the eager HUD chunk does not pull three.js.

Evidence (not committed): `/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/step3/` (place/combat at 1440×900 and 390×844, cmp-place/cmp-mobile/cmp-combat). Iteration: wood was dark red (base colour × texture) → untinted light planks; mobile fit was height-bound → fit by frame footprint.

## Knife 3 — Step 2 combat replay (same day)
Prompt (大主管, approved Step 6+3 @ 17f8222): turn the deterministic combat log into a client-side timeline replay in the three scene (lunge, projectile arc, hit flash, stacked floaters, death fade; ~8–15s; 1x/2x/skip; no per-frame allocations); right-hand log synced by timestamp (「0:04 飞鱼弓 射击 鲸盾 −18」) with numbers equal to floaters; worker stays authoritative and replay ends in the resolved state. Fold-ins: closer camera (board ≈55–60% width), tide line + 「潮线」/「备战席」 labels, bench tray same dark wood as rim, e2e mid-combat ≠ resolve frame + log value = floater. Out of scope: shop art/level/XP, top-bar timer/names/HP scale (Step 4), ★2 (Step 5).

Decisions:
- `src/render3d/tide-arena/timeline.ts` (pure): strike spacing `clamp(10s/n, 180, 1500)ms`, hit lands 360ms after swing; log line text and floater share `floaterText`; unit test asserts final HP equals `combatDigest(log).hp` on a real autoplay log.
- Scene owns the replay clock (rAF while playing, render-on-demand otherwise); per frame it only rewrites cached instance matrices (token slot cache, pooled 12-instance projectile mesh, reused temps). React is notified only when an event boundary is crossed.
- Ranged = archer / witch / spirit (projectile arc); others lunge.
