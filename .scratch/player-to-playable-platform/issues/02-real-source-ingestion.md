# Real source ingestion

Type: task
Status: resolved
Blocked by: 01

## Question

Can a host upload a rulebook PDF plus PDF/image assets and create a durable,
private generation run with extracted text, pages, images, hashes, and source
anchors?

## Acceptance

- Real files, not filenames or seeded fixture data, are processed.
- Supported types, limits, failures, privacy, and retention are visible.
- Each extracted artifact keeps file and page provenance.
- Corrupt and unreadable inputs fail without silently continuing.

## Comments

- 2026-07-24: Claimed. Implementing the smallest honest browser-local ingestion
  slice before rule compilation: real byte reads, PDF page/text/image
  extraction, image metadata, SHA-256 hashes, source anchors, private durable
  storage, visible limits, and explicit failures.

## Answer

Yes, within the current browser-only prototype boundary. A host can now select
one real rulebook PDF plus real PDF/image assets and create a private generation
run stored in IndexedDB.

Implemented:

- real byte reads rather than filename-only state;
- PDF.js parsing with per-page text extraction and rendered WebP previews;
- standalone image decoding and dimensions;
- SHA-256 for every source file;
- source anchors carrying file identity, filename, and PDF page number;
- original blobs and extracted artifacts stored in the generation run;
- refresh recovery and a visible “查看导入结果” action;
- supported types and limits shown before import: one PDF rulebook up to 25 MB,
  PDF/JPG/PNG/WebP/GIF assets, up to 40 assets, 25 MB each and 100 MB total;
- browser-local privacy and retention wording;
- all-or-nothing failure status for invalid headers, unreadable PDFs, damaged
  images, page limits, and browser persistence failures.

The private/durable claim is intentionally scoped to the same browser until the
player deletes its data. Accounts, server storage, cross-device recovery, OCR
for scanned pages, rule understanding, and game compilation remain unimplemented.

Verification on 2026-07-24:

- `pnpm test` — 6 files, 26 tests passed.
- `pnpm typecheck` — passed.
- `pnpm build` — passed; PDF parser and worker emitted as separate chunks.
- `git diff --check` — passed.
- Browser import using the real 8-page Manila PDF plus two real JPGs produced
  8 PDF page artifacts, 2 image artifacts, and 29,577 extracted characters.
- Source detail showed distinct real SHA-256 values for all three files.
- Reload restored the generation run; “查看导入结果” reopened the full result.
- A deliberately truncated PDF with a valid `%PDF-` header stopped with
  `Invalid PDF structure` and did not continue as success.
- Success and failure results at 390×844 had no horizontal overflow.
- Browser console reported 0 warnings and 0 errors.
