# 03 — Compile and preview an immutable Playable Build

**What to build:** A creator can compile one Game Definition version into an
immutable Playable Build, see source-linked warnings and unsupported behavior,
and inspect a structured visual preview from the build. Pixel-accurate image
rendering is intentionally outside this MVP contract.

**Blocked by:** 02 — Import sources and version a Game Definition.

**Status:** completed-mvp-structured-preview

- [x] Compilation is deterministic for the same Game Definition version.
- [x] A Playable Build is immutable and records its source definition version.
- [x] Unsupported rules and missing runtime capabilities remain explicit.
- [x] The editor exposes build history, warnings, exact playable route, and a
      structured visual preview inspected through the user-visible seam.
- [x] Structural, compile, browser-render, type, and production-build checks
      pass; no screenshot artifact is claimed.

## Verification

- Worker integration proves deterministic idempotent compilation, immutable
  definition snapshots, versioned changesets, and exact playable routes.
- Browser compiled Definition v1, showed board zones, score track, action cards,
  and explicit unsupported behavior, then confirmed the immutable Build route.
- Repository tests, Worker tests, typecheck, production build, and
  `git diff --check` passed.
