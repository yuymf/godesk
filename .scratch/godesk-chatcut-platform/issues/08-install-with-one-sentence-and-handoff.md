# 08 — Install with one sentence and hand off to creation

**What to build:** A creator gives Codex one GoDesk installation sentence; the
GoDesk-hosted guide drives desktop host gating, bundled-CLI installation,
OAuth, verification, and an automatic switch into a fresh creation or recovery
task.

**Blocked by:** 07 — Package the GoDesk Plugin and creator Skills.

**Status:** public-flow-complete-live-handoff-pending

- [x] The hosted guide is a complete agent execution contract modeled on the
      verified ChatCut installation journey.
- [ ] Supported desktop setup locates the bundled CLI, installs and enables the
      plugin, completes GoDesk OAuth, and verifies required runtime surfaces.
- [x] Setup creates, seeds, and opens a new GoDesk task after local installation.
- [x] Unsupported hosts receive the exact desktop handoff and no false success.
- [x] Failed setup creates a recovery task with the exact failed step and no
      false editing prompt.
- [x] Acceptance is version- and host-specific rather than a universal CLI
      assumption.

## Published evidence and remaining live gate

The public Marketplace, production Worker, public installer, static assets,
protected creator route, and Managed OAuth discovery are published and
independently verified. The bundled CLI successfully installed from
`yuymf/godesk-plugin`, not from the application checkout.

The current local network cannot reach `workers.dev`, so `codex mcp login
godesk` did not reach the email OTP page. Authenticated tool verification and
the automatic fresh creation task therefore remain pending rather than being
reported as successful.
