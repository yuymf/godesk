# 49 — Distinguish missing Studio projects from service failures

Type: bug
Status: resolved

## Question

Why did an old `/studio/:projectId` link show “这个项目打不开” when the
project ID no longer existed, and can first-load failures reach the visible
error boundary without masking the current project page?

## Answer

The old link was a real 404 for a project ID that is absent from the current
project list. It was not a Worker or current-project loading failure. Studio
now records the HTTP status for the initial load: a 404 shows “这个项目已不
存在” with a direct explanation that the link may come from an isolated test;
other initial-load failures keep the “项目打不开” message and their service
error. Successful loads clear the stale error state. Existing-project
background refresh behavior remains unchanged, while a failed initial load no
longer starts a five-second retry loop. Studio also gates the remaining project
reads behind the authoritative project lookup, so a stale ID produces one
meaningful 404 instead of a fan-out of dependent 404s.

## Acceptance

- The old ID `project_365f3f08-5a9e-4db6-9085-1c352ab7bddd` returns API 404 and
  is absent from `/api/projects`.
- A fresh isolated Worker browser check renders “这个项目已不存在” and no
  longer renders “这个项目打不开”.
- A current project link renders the Studio overview and the natural-language
  iteration entry point without an error heading.
- The initial project lookup precedes dependent reads, so a stale ID does not
  fan out into repeated dependent 404 requests.
- `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm test:worker`,
  `pnpm verify:local-routes`, `pnpm verify:local-loop`,
  `pnpm verify:local-mcp`, `pnpm verify:plugin`, and
  `pnpm deploy:dry-run` pass.

This closes the local UI bug. It does not restore a project record that is no
longer present, and it is not evidence for public deployment or human
playtesting.
