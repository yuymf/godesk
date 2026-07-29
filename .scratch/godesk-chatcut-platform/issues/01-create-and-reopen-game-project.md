# 01 — Create and reopen a Game Project

**What to build:** A creator can enter GoDesk's canonical creator route, create
a durable Game Project, receive its exact editor URL, and reopen the same
project in the Web Editor with authoritative project identity and version
visible.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] The canonical GoDesk route creates a Game Project through the service
      boundary and opens its exact editor route.
- [x] Refreshing or reopening the editor reads the same durable project rather
      than reconstructing browser-local state.
- [x] The editor displays project identity, active Game Definition, project
      version, and capability status.
- [x] Service, UI, type, build, and persistence-path tests pass.

## Verification

- Worker integration: create and reopen passed through the public HTTP API with
  isolated Durable Object storage.
- Browser: created `雾港创作台`, opened its exact editor route, refreshed, and
  observed the same project ID and authoritative version.
- Responsive inspection: the editor remained usable at 390 px.
- Repository tests, Worker tests, typecheck, production build, and Wrangler
  dry-run passed.
