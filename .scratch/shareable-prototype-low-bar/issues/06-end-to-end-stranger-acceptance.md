# 06 — 端到端陌生人验收（官网路径）

**What to build:** A stranger acceptance run on the website: rights-safe
rulebook in → generation → Visual Floor → invitation → two-browser play of the
executable subset, with evidence recorded separately from bot automation.

**Blocked by:** 04 — 邀请链接 + 第二浏览器入座同桌; 05 — 资产/生图 Skills（Codex 额度）

**Status:** ready-for-human

- [x] Website path completes without requiring Web Editor operation (automated contract evidence)
- [x] Public default example material is rights-safe (Manila remains internal-only evidence)
- [x] Acceptance ledger records upload/generation, Visual Floor, invitation, and two-browser human-capable play separately from bot jobs
- [x] Unsupported behavior and asset provenance remain visible in the accepted run (automated contract evidence)
- [x] Plugin path is smoke-checked for the same Game Project invitation URL, without blocking website acceptance
- [ ] Overall human play gate is not marked passed unless a real two-person session is evidenced

## Done

- Added `.scratch/shareable-prototype-low-bar/acceptance.md`, separating
  automated HTTP/MCP evidence from browser and human evidence.
- Verified `pnpm test` (7 files / 31 tests), `pnpm test:worker` (4 files / 47
  tests), and `pnpm typecheck`.
- Remaining gate: a real two-person, two-browser Room session is not recorded;
  this ticket remains `ready-for-human`.
