# 03 — Compile and preview an immutable Playable Build

**What to build:** A creator can compile one Game Definition version into an
immutable Playable Build, see source-linked warnings and unsupported behavior,
and inspect a real rendered preview from the build.

**Blocked by:** 02 — Import sources and version a Game Definition.

**Status:** completed

- [x] Compilation is deterministic for the same Game Definition version.
- [x] A Playable Build is immutable and records its source definition version.
- [x] Unsupported rules and missing runtime capabilities remain explicit.
- [x] The editor exposes build history, warnings, exact playable route, and a
      rendered preview inspected through the user-visible seam.
- [x] Structural, compile, render, type, and production-build checks pass.

## Verification

- Worker integration proves deterministic idempotent compilation, immutable
  definition snapshots, versioned changesets, and exact playable routes.
- Browser compiled Definition v4, then edited the project to v6; the old Build
  still rendered the original v4 pitch and its two missing-capability warnings.
- Repository tests, Worker tests, typecheck, production build, and
  `git diff --check` passed.
