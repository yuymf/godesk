# 10 — Prove install-to-playtest acceptance

**What to build:** The complete GoDesk creator journey is exercised from one
installation sentence through a visible project edit, immutable build,
rendered preview, deterministic playtest, and room/replay handoff, with
independent evidence locating every user-facing feature.

**Blocked by:** 08 — Install with one sentence and hand off to creation; 09 —
Retire the player-first product route.

**Status:** production-surface-verified-live-auth-and-human-pending

- [x] Focused tests, full tests, typecheck, production build, package checks,
      MCP contract checks, and `git diff --check` pass.
- [x] Browser acceptance records the exact route and observed behavior for
      project creation, editor mutation, conflict, build, preview, playtest,
      room, and replay.
- [x] Installation evidence distinguishes local package validation, actual
      desktop install, live OAuth, deployment, and public marketplace status.
- [x] An independent subagent identifies each required feature's location,
      access path, observed behavior, and remaining evidence gap.
- [x] No automated result is promoted to human or production evidence.

## Evidence

See [`../acceptance.md`](../acceptance.md). Local implementation and browser
acceptance are complete. Production publication, public Plugin installation,
Access protection, and OAuth discovery are independently verified. A completed
OTP session, authenticated remote MCP tool call, automatic fresh-task handoff,
and human playtest evidence remain explicit gates.
