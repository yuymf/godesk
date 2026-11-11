---
name: godesk-deterministic-harness
version: 1.0.0
author: luffy
license: MIT
description: Use when extending GoDesk deterministic regression harness.
metadata:
  hermes:
    tags: [godesk, threejs, testing, determinism, playwright]
    related_skills: [godot-mcp-playtest, playtest-and-verify-game, game-coding-standards]
---

## When to Use

Load this when adding or changing GoDesk's browser-side deterministic regression
capability: fixed-dt clock, seeded RNG, `digest()`, `step`/`stepUntil`, the
conditional `window.__godeskHarness` global, or the harness e2e spec. Also load
it before running the harness verification loop on the Ubuntu host.

# GoDesk deterministic harness (G3D-HARNESS)

Repo: `/home/halyu/Downloads/Code/godesk`. Never commit to `security/secret-gate`. Local regression only: NO `wrangler deploy`, NO `wrangler.jsonc`, NO `.dev.vars` edits, NO `publish:plugin:public`.

## Architecture (do not deviate)
- `src/render3d/harness/mode.ts` = always-on tiny slice: `harnessModeEnabled()` reads `?harness=1`, virtual clock, `wallOrHarnessNow()` (normal mode === `performance.now()`), fixed-step 60 Hz accumulator.
- `src/render3d/harness/rng.ts` = `harnessRandom()`; boot-seeds mulberry32 from `?seed=N` at MODULE EVAL (before any geometry/texture is built). No seed => plain `Math.random()`.
- `src/render3d/harness/tuning.ts` = inject gameplay constants (`motion.placeMs` etc.) via query param or `setTuning()`. `motion.ts`'s `motionDurationMs()` reads it, so it is behaviourally identical to editing `MOTION_MS`.
- `src/render3d/harness/api.ts` = LAZY chunk (`g3d-harness-*.js`). `window.__godeskHarness` is created ONLY inside `attachHarness()` behind `harnessModeEnabled()`, and deleted on detach. Mirror `?perf=1` / `?poster=1`.
- `vite.config.ts` chunkFileNames must name `/src/render3d/harness/` as `g3d-harness-[hash].js`, otherwise it lands in `render3d-*` and burns the 200 KB core budget. Add a matching line in `scripts/check-size-budgets.mjs`.

## SceneHost integration
- Split the rAF `tick(wallNow)` into `frame(now, delta)` (state advance) + a driver. Harness mode: rAF only `presentOnly()` (re-render for pixel gate), stepping calls `frame()` synchronously with virtual `now` and injected `dtMs`.
- Disable wall-clock heuristics in harness mode: runtime downgrade, `minFrameMs` cap skip, PBR streaming timeout, boot reveal veil. Route `markShadowsDirty`, `MotionController({now})`, water `t0` through `wallOrHarnessNow()`.
- `digest()` must be a PURE read: no wall clock, no `renderer.info`, no pixels. Normalise (sort keys + 6-dp round) so `JSON.stringify` is byte-stable.
- `step({frames:N})` === N x dt (NOT godot-mcp's variable-duration real frames). `physicsTicks` is a real 60 Hz accumulator, decoupled from frames.

## Verification loop (all must be green)
```
pnpm typecheck && pnpm test
pnpm build && node scripts/check-size-budgets.mjs
pnpm exec playwright test e2e/harness-determinism.spec.ts --reporter=list
```
Also run an EXISTING spec with harness OFF (e.g. `e2e/hex-settlement-motion.spec.ts -g "reducedMotion=no-preference"`) to prove the normal path is untouched. Run `node scripts/secret-scan.mjs staged` before committing — the pre-commit gitleaks hook is installed.

## Pitfalls
- Playwright 1.63 expects chromium r1243; this host caches r1208/r1248 + system Chrome 152. Add a SPEC-LOCAL `test.use({launchOptions:{executablePath}})` fallback that activates only when r1243 is missing. Do NOT edit the shared `playwright.config.ts` or `pnpm exec playwright install` (task forbids downloading browsers). Existing specs need a temp `--config` override on this host.
- `Easing.Back.Out` overshoots > 1. `MotionController.describe()` must report the RAW eased value; clamping to 1 breaks analytic regression assertions.
- `elapsedMs` from `stepUntil` is RELATIVE to that call; absolute game time lives in `report.clock.gameTimeMs`.
- `setDt(25)` + `step({frames:8})` = 200 ms = **12** physics ticks, not 8. Assert the accumulator, not the frame count.
- Never wire `precomputeDiceTumble` (own `diceSeedRef`), `terrain-props.ts` / `island.ts` (per-tile `mulberry32(hash(q,r))`) to the global RNG stream — it destroys determinism/spatial stability.
- Shader/visual changes are INVISIBLE to the digest (state only, no pixels). Pixel gate is a separate card (seika). Harness only makes screenshots comparable by freezing dt + RNG + shader time origin.
