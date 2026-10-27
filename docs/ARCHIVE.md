# Archived / pruned paths

Recover any of these from git history if needed.

## 2026-10-27 (`chore: prune AI-slops and redundant branches`)

- `docs/hardness/runs/` — 314 historical hardness run reports (`2026-10-13` to `2026-10-16`).
- `docs/hardness/tickets/` — 278 historical one-off hardness ticket logs (`T001`–`T276`).
- `docs/hardness-acceptance.md` — legacy fictional hardness acceptance spec; superseded by `docs/hardness/ACCEPTANCE.md` (`suites/_archive-fictional/` remains as reference).
- `docs/tide-arena-trajectory.md` — draft trajectory notes for `feat/tide-arena-v0`.
- `docs/prompt-trace/2026-*.md` — 70 historical prompt-trace files from M0–M4 iterations (`docs/prompt-trace/README.md` convention retained).
- `scripts/*-evidence.mjs`, `scripts/capture-combat-vfx.mjs`, `scripts/hardness-force-inject.mjs`, `scripts/hardness-real-probe.mjs`, `scripts/judge-*.mjs`, `scripts/e2e-watchdog-8844.sh` — one-off local capture and probe scripts whose outputs lived outside the repo (`/workspace/g3d-evidence/`).
- `src/**/*-t[0-9]*.test.ts`, `src/**/*-ui-p[0-9]*.test.ts` (`readFileSync`-only source-grep tests) — 157 ticket-locked source-string assertion files removed; behavioral unit tests retained with clean filenames (`*-tXXX` suffix stripped).

## 2026-10-05 (`chore/cleanup-2026-10`)

- `design-plans/01-home-composition.md` — shipped in #99 (`c2ca105`); the
  resulting home layout is recorded in `DESIGN.md` → Layout. User visual
  acceptance against the reference site was still pending.
- `design-plans/bookmark-gallery-home-audit.md` — historical pre-#99 audit.
- `.scratch/bookmark-gallery-language/` — spec and issues 01/02, all resolved
  in #99.
- `.scratch/rule-system-creator-platform/` — entire tracker tree removed after
  issue 19 (public Plugin sync) was verified resolved; public
  `yuymf/godesk-plugin` matches this repo. Includes the earlier
  `acceptance.md` prune from 2026-09-28.

## 2026-09-28 (`chore/prune-stale-progress-docs`)

- `.scratch/rule-system-creator-platform/acceptance.md` — later superseded by
  the full-directory removal above.
