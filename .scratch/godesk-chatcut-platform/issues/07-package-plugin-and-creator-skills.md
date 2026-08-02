# 07 — Package the GoDesk Plugin and creator Skills

**What to build:** A creator can install a thin GoDesk Plugin package whose
Skills reliably route creation, editing, compilation, playtesting,
verification, and delivery work to the authenticated remote MCP and visible
editor.

**Blocked by:** 05 — Run playtests, rooms, and replays; 06 — Authenticate
creators and isolate Game Projects.

**Status:** completed

- [x] The plugin manifest, remote MCP configuration, marketplace metadata,
      brand assets, and Skills form a valid installable package.
- [x] Skills define onboarding, project targeting, source import, authoring,
      compilation, bot playtest, balance diagnostics, verification, and
      delivery without duplicating service logic.
- [x] Skills require refresh-before-edit, exact editor handoff, durable job
      tracking, and structural plus visual verification.
- [x] Package and Skill contract validation passes.

## Verification

- Repo Marketplace, Plugin manifest, MCP declaration, brand asset, and five
  workflow Skills pass the official plugin and Skill validators, including the
  export-and-publish delivery workflow.
- The thin package is public at `https://github.com/yuymf/godesk-plugin`.
  Codex Desktop's bundled CLI added that GitHub Marketplace, installed
  `godesk@godesk` as enabled, and copied the complete package into its plugin
  cache.
- A fresh task discovered the Plugin and Skills. It correctly stopped because
  its tested MCP was local. The production remote now exists, but a fresh
  authenticated task still requires the live OTP gate recorded in Issue 08.
