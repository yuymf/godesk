# Player-to-playable platform map

Status: active

## Notes

- Ordinary players are the primary users.
- Automatic generation is the main path; clarification is exceptional.
- Preserve source traceability and authoritative runtime boundaries internally.
- Keep capability status honest: a UI label is not implementation evidence.

## Decisions so far

- ADR 0001 supersedes the creator-first and manual-review-first product framing.
- The existing Manila playable voyage is the first partial generated output.
- The default route will become a player upload-to-playable journey; the old
  authoring route may remain as an explicit development-only route.
- Issue 01 replaced the default route with two player inputs, one automatic
  example run, a no-clarification normal path, an honest generated-result
  boundary, and entry into the existing playable voyage. The old authoring UI
  is now development-only. See
  `issues/01-player-entry-and-generation-shell.md`.
- Issue 02 added real browser-local source ingestion: PDF page text and
  previews, image decoding and dimensions, SHA-256 hashes, source anchors,
  IndexedDB recovery, visible limits, and explicit corrupt-input failure. Its
  durability boundary is one browser; cloud storage remains unimplemented. See
  `issues/02-real-source-ingestion.md`.

## Frontier

1. `issues/01-player-entry-and-generation-shell.md` — resolved
2. `issues/02-real-source-ingestion.md` — resolved
3. `issues/03-rule-understanding-and-compiler.md` — next unblocked issue
4. `issues/04-asset-extraction-and-image-generation.md` — also unblocked by 02
5. `issues/05-complete-generated-runtime.md` — blocked by 03 and 04
6. `issues/06-online-room-and-invites.md` — blocked by 05
7. `issues/07-end-to-end-friend-play.md` — blocked by 06

## Fog

- Which uploaded rule formats need structural hints beyond a PDF?
- Which ambiguities merit interrupting a player rather than choosing a safe
  default?
- What runtime schema can express a second game without Manila-specific code?
