# 07 - Reproducible local creator loop

Type: verification
Status: resolved

Blocked by: 06

The product loop had successful one-off black-box records, but no repeatable
command that exercised the same project from prompt generation through a
revision, Shared Session, and Replay. Add an isolated Worker verifier so
future Rule System and Kernel changes cannot silently break the learning loop.

## Acceptance

- A temporary Worker state is created on a free local port without touching the
  user-owned development service.
- A natural-language brief enters Source Library and materializes an executable
  `shared-goal-v1` Rule System.
- The same project persists a Design Hypothesis and automated Validation Finding.
- Fixed-seed self-play succeeds before and after a focused Rule System change.
- The old immutable Build remains unchanged while a new Build snapshots the
  change.
- Shared Session seat isolation, an accepted intent, and Replay reconstruction
  are checked through public HTTP routes.

## Answer

`pnpm verify:local-loop` now builds the client, starts an isolated Wrangler
Worker, runs the full chain, prints the durable IDs, and tears down only its
own temporary state. The evidence is automated local self-play; it does not
claim public OAuth reachability or human playtest evidence.
