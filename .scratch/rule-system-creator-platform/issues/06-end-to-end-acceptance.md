# 06 - End-to-end acceptance

Type: task
Status: resolved

Blocked by: 05

Run the full automated matrix, local Worker, browser creation/share/replay/
validation journey, Plugin contract checks, and diff hygiene. Record production
and real-human gates separately.

## Acceptance

- Tests, Worker tests, typecheck, build, local-route verification, dry-run, and
  diff checks pass.
- Browser evidence proves both honest draft handoff and the non-tabletop path
  through one exact project, Build, Shared Session, two clients, and Replay.
  Worker and MCP acceptance cover Validation Findings.
- Any gate requiring live OAuth or real people remains `ready-for-human` with an
  exact procedure and is not reported as complete.

## Answer

All agent-executable checks passed. One local browser journey proved that an
underspecified prompt lands in Web Studio as a draft without a fabricated
Build. A second journey created the non-tabletop `灵感接力` conversation game,
landed directly in a Shared Session, accepted two ordered actions from separate
client identities, and reconstructed the Replay. Worker and MCP tests prove the
automated and creator-attested Validation Finding contracts. During acceptance,
the browser also exposed and we fixed an empty optional-source payload that
unit and contract tests had not exercised.

Production OAuth/fresh-task installation and real two-person playtesting remain
`ready-for-human`. They are exact external acceptance procedures, not failed
agent implementation tasks. See `../acceptance.md` for IDs, URLs, evidence, and
procedures.

## Verification

- `pnpm test`: 2 files, 17 tests passed.
- `pnpm test:worker`: 4 files, 66 tests passed.
- `pnpm typecheck`, `pnpm build`, `pnpm verify:local-routes`,
  `pnpm deploy:dry-run`, and `git diff --check`: passed.
- All 10 repo-local Skills pass `quick_validate.py`.
- Browser console: zero errors or warnings during final acceptance.
