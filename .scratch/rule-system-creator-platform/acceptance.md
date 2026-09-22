# Acceptance

Live acceptance is the user-visible charter path, not this directory.

- Playwright: `pnpm test:e2e` (`e2e/charter-playable-output.spec.ts`)
- CI: `.github/workflows/verify.yml` (unit, Worker, typecheck, Plugin bundle,
  Playwright)
- Local HTTP/MCP loops: `pnpm verify:local-loop`, `pnpm verify:local-mcp`

Share gate is the Playability Floor (ADR 0012), not a dated evidence log.

The previous ~1380-line snapshot of IDs and one-off browser runs lived on this
path. Recover it from git history if needed. Do not treat those IDs as current
acceptance.

Remaining human gates stay open:

- Production OAuth / fresh-task install
- Real two-person playtest
- Public Plugin publication (`issues/19-public-plugin-distribution-sync.md`)
