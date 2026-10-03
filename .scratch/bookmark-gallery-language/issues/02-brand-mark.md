# Unify the approved GoDesk brand mark

Status: resolved
Type: task

The user approved the new two-card icon and requested replacing every project
brand icon with it. Source artwork is `src/assets/godesk-mark.svg`; Vite, the
shared GameMark component, and repository README use it directly. The Plugin
has an identical distributable copy checked by `pnpm verify:plugin`.

## Result

- Replaced the old G artwork in the Plugin; updated its brand color to ink.
- Removed the duplicate documentation logo and pointed README at the source.
- Replaced Replay and Studio loading GD placeholders with GameMark.
- Added the shared favicon and white browser theme color.
- Updated the public Plugin README and documented the source/copy workflow.
- Extended desktop/mobile Playwright through installation, source selection,
  Room actions, friend join, Replay, Studio, brand-link navigation, gallery,
  and settings. Each brand surface checks the shared image loads; the favicon
  must return SVG artwork identical to the source.

## Verification

- `pnpm test:e2e`: 40 passed, 4 existing human/live-proof rows skipped (50.3s).
- `pnpm verify:plugin`: bundle and local distribution checks passed.
- TypeScript/Vite build passed through the Playwright web server.
- `git diff --check`: passed.
- Desktop and mobile tests verified the shared mark, SVG favicon, two-player
  actions, Replay transcript, Studio, brand-link navigation, gallery, settings.
- Desktop/mobile screenshots inspected; evidence lives outside the repository
  at `/Users/halyu/Documents/Codex/artifacts/godesk-icons-20261003/`.
- The existing preview was refreshed; both page marks and favicon resolve to
  the same built SVG asset and the images have loaded at their intended sizes.

## Comments

Local implementation only; production and the public Plugin repository were
not published. Preview remains `http://127.0.0.1:8800/chatgpt-plugin/new`.
