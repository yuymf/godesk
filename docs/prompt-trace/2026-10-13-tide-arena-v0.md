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

## Knife 4 — Step 4 HUD + Step2 leftovers (same day)
Prompt (大主管 Step4 裁定): shop cards with identifiable portraits (tier stripe, name, cost, trait chips); level/XP + teal 升级 button (separate from 准备完毕/锁定); top bar timer + both player name slots + HP ticks keeping `START_HP = 20`; left synergy panel with 2/4/6 (or real tiers) ladder. Fold-ins from Step2: floaters follow lunge pose; death = sink + soft fade (not shrink-in-place); mobile keep 潮线/备战席 labels (smaller); mobile camera closer (FOV 50, wider fit). Out of scope → Step5: ★2 merge, stronger AI, 10–12 units, synergy combat events.

Decisions:
- Kernel: `SeatState.level` + `xp`; `buy_xp` costs 4 gold → +4 XP → auto level-up; board cap = level; `START_LEVEL = 3` for round-1 playability; no compat layer.
- Shop art: inline SVG silhouettes from mockup (paper card + tier top stripe + gold cost chip).
- Scene: live anchor emit each replay frame so floaters/HP track lunge; death sinks Y ~1.05 with mild scale dissolve; mobile `fov=50`, `mx=1.22`.
- Evidence (not committed): `/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/step4/` (`cmp-place`, `cmp-mobile`, `cmp-combat-mid` + raw shots). Perf e2e: 17 draw / 13.5k tri.


## Knife 5 — Step 5 玩法深度（same day）
Prompt（大主管 Step5）: ★2 合成；基础对手 AI 稳定上阵；单位池 10–12 + 羁绊≥4；战斗 heal / trait-trigger + 绿字飘字；备战计时服务端权威到 0 自动锁定；拖拽高亮按 level 禁超限格；手机 XP 条一行可见。不合 main；不碰 Collecta；证据 step5/。

Decisions:
- Kernel `Piece.stars` + board+bench 三合一 ★2（×1.8）；卖价按 stars；★3 仅类型预留。
- 扩到 12 海主题原创单位；`runCombat` 发 `heal` / `trait_trigger`（潮汐护盾、珊瑚愈伤、硬壳反射、远航追击）；timeline/floaters 同源绿字。
- `prepEndsAt` 权威字段；`applyAutoBattlerPrepTimeout` + worker acceptIntent/bot 到期先 ready；客户端只显示剩余秒。
- `legalDrops(..., { boardFull })`；scene 满编不亮上场格。
- Bot 优先 place/buy，空板不 ready。
- Codex gpt-5.5 high 卡在 stdin（已知）；本刀 box 本地手写。

Evidence (not committed): `/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/step5/`
