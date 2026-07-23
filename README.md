# Harbor 13

Harbor 13 is a local, browser-based tabletop mechanics prototype built from the platform MVP PRD. It uses an original presentation to probe the auction-adjacent worker placement, wagering, dice movement, outcome resolution, replay, and rules-help interactions associated with a Manila-style voyage.

It does **not** include commercial artwork, component scans, or copied rulebook text.

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

## What this slice proves

- Three.js can render a readable 2.5D board while React provides accessible mirrored controls.
- A pure TypeScript reducer can validate intents and rebuild the tabletop from accepted actions.
- Undo, local persistence, and replay can share the same action log.
- A bounded rules helper can cite known rules and explicitly refuse unsupported questions.

## What it does not prove

- Server-authoritative multiplayer, private-state isolation, reconnection, or 500 ms synchronization.
- Long-session stability or the PRD's two-hour runtime criterion.
- Retrieval over uploaded rulebooks or real LLM answer quality.
- The complete rules or commercial play experience of *Manila*.

See [the prototype spec](.scratch/manila-mechanics-prototype/spec.md) for the acceptance boundary.
