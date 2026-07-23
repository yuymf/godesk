# Godesk — give it rules, get a playable tabletop

Godesk is a player-facing AI-native tabletop platform. A player supplies a
rulebook PDF and a visual asset package; the platform understands the rules,
extracts or generates game art, assembles a playable digital game, creates an
online room, and lets the player invite friends.

The default route is the first player-facing vertical slice:

- add a rulebook and asset package;
- watch one automatic generation run;
- answer only an exceptional high-impact clarification;
- open the generated game;
- create a synchronized room and invite friends when networking is available.

The included rulebook renders and photographs are **internal validation fixtures
only**. They are not cleared for redistribution or publishing. See
[`sources/manila/PROVENANCE.md`](sources/manila/PROVENANCE.md).

## Run

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm test
pnpm typecheck
pnpm build
```

The default route opens the player upload-to-playable experience. Use
`?devAuthoring=1&variant=A`, `B`, or `C` only to inspect the superseded
authoring experiments.

## What this slice currently implements

- A player-first upload and automatic-generation experience shell.
- Real browser-local PDF and image ingestion with per-page text and previews,
  image dimensions, SHA-256 hashes, source anchors, explicit failures, and
  IndexedDB recovery after refresh.
- A seeded Manila generation run using the repository's internal source fixture.
- A source-linked, playable three-player single-voyage output with two local
  automated seats.
- An explicit capability boundary that does not pretend missing services exist.

## What it does not prove

- A complete multi-voyage digital implementation of *Manila*.
- Full settlement for loans, insurance, blind passengers, and final victory.
- OCR for scanned pages, rule understanding, or game compilation.
- Server-side private storage, cross-device recovery, accounts, or cloud
  generation jobs; real ingestion currently stays in one browser.
- Image generation or automatic asset segmentation.
- A complete multi-voyage Manila implementation.
- Online rooms, invite links, reconnect, private state, or multiplayer.
- Publication rights or commercial readiness for the Manila fixture.

See [the current platform spec](.scratch/player-to-playable-platform/spec.md)
and [ADR 0001](docs/adr/0001-player-first-generation-platform.md). The former
designer-first authoring flow and Harbor 13 mechanics probe remain as
superseded development experiments.
