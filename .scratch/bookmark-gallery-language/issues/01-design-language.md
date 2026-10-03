# Apply the reference design language

Status: resolved
Type: task

Implement the reviewed DESIGN.md in the home, gallery, shared navigation,
installation guide, and Shared Session chrome. Retain genre-specific play
surfaces and colors. Add responsive interaction coverage and screenshot evidence.

## Result

Implemented the neutral token sheet, self-hosted Manrope (OFL license included),
shared original game mark, focused composer, visible playable-example gallery,
recent-project links, and game-led lobby. Removed obsolete home/sidebar CSS and
its ambient/dealt-card animation rules. Shared Session chrome uses the same
neutral controls; its main play column no longer reserves an empty sidebar.
Game-specific art, resources, and player colors remain distinct.

## Verification

- `pnpm test:e2e`: 40 passed, 4 existing human/live-proof rows skipped.
- `pnpm test`: 244 tests passed across 30 files.
- Build passed through the Playwright web server's `pnpm build`.
- `git diff --check`: passed.
- New desktop (1440px) and mobile (390px) specs pick a source, open a Shared
  Session, join from a separate browser context, submit two turns, and reach
  the lobby. Screenshots inspected for home, gallery, and Shared Session.
- Othello's lobby spec checks that its thumbnail stays within its gallery
  frame; absolute image sizing prevents the grid row from cropping the board.
- Screenshots are outside the repository at
  `/Users/halyu/Documents/Codex/artifacts/godesk-gallery-20261003/`.
- Local preview: `http://127.0.0.1:8800/chatgpt-plugin/new` using isolated
  `.wrangler/design-preview` state. No production deployment was performed.
- Worker WebSocket-close errors were logged during test teardown; all play,
  sharing, and reconnect-related assertions still passed. No Worker code changed.
