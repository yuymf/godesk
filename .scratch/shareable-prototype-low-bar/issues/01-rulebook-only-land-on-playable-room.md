# 01 — 规则书单独输入 + 生成后直达可玩桌

**What to build:** A stranger can paste or upload only a rulebook, run one
generation, and land on a playable Room table. Experience description is
optional. The Web Editor is a secondary link, not the success screen.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Home accepts rulebook-only input (paste / PDF / md / txt); experience text is optional
- [x] One generation run still creates Game Project, Source Library rulebook entry, Definition, and Playable Build
- [x] Ready primary CTA opens an authoritative Room for that Build (not the dense Editor)
- [x] Editor and Build preview remain reachable as secondary actions
- [x] Unsupported behavior remains visible on the playable surface
- [x] Automated tests cover optional experience text and Room-first ready path at the project/job seam

## Done

- Implementation: `f904c4b` on `ticket-01-rulebook-room`
- Verification: `pnpm typecheck`, `pnpm test`, and `pnpm test:worker` passed.
- Gaps: Visual Floor/share gating and asset harvesting are intentionally left to tickets 02–06.
