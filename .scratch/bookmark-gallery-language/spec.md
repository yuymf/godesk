# Bookmark.gallery design language

Use https://bookmark.gallery/ as the reference for GoDesk's visual language.
Follow the user's frontend-design skill and the product charter in CONTEXT.md
and ADR 0011 / 0012. See DESIGN.md for the reviewed direction and tokens.

Deliver a neutral shared UI language, a focused home composer, visible original
playable examples, and a content-led game gallery. Keep the actual game colors
and authoritative play/share flow. Remove obsolete home styling rather than
layering a second theme over it.

Acceptance: desktop and narrow-screen Playwright must create or pick a source,
open a Shared Session, join from an invitation, and perform a game action.
Run the full `pnpm test:e2e`, build, and inspect desktop/mobile screenshots.

Use the approved two-card GoDesk mark at every brand entry: Web Studio, Room,
Replay, loading state, install guide, browser favicon, repository README, and
Codex Plugin assets. Remove the obsolete G glyph and GD placeholders. Keep the
Plugin copy identical to the source artwork and verify the real play/share path.
