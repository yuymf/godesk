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
