---
name: restore-build-version
description: Restore an exact historical GoDesk Playable Build into a new editable Rule System in the same project. Use when a creator asks to revert, return to, recover, or continue from an older playable version without changing its evidence.
---

# Restore a Build Version

Create a new editable branch from immutable evidence. Never rewrite the old
Build or call Rule System activation a restore.

## Workflow

1. Resolve the exact Game Project with `list_projects`, then read its `overview`,
   `builds`, active `rule-system`, and the requested historical Build.
2. Confirm the Build belongs to the same project and is the exact snapshot the
   creator wants. Preserve its Build ID, Rule System version, warnings, Shared
   Sessions, Replays, and Validation Findings as immutable evidence.
3. Re-read the current project version. Call `restore_build_as_rule_system`
   with that `expectedVersion`, the exact Build ID, and a fresh idempotency key.
   A pending Generation Plan must be reviewed and resolved first.
4. Re-read `overview`, `rule-system`, `rule-systems`, and `changesets`. Verify
   that the project has a new active Rule System ID, version 1, and
   `restoredFromBuildId` equal to the source Build. Verify the Changeset carries
   the same source Build ID.
5. Read the old Build again and confirm its Rule System snapshot is unchanged.
   Open Web Studio and verify the restored lineage is visible.
6. If the creator requested changes, apply the smallest focused patch to the
   new Rule System, then compile a new immutable Build and run an automated
   playtest. Keep automated evidence distinct from real-person feedback.

## Completion criteria

- Project ID is unchanged and active Rule System ID is new.
- The new Rule System and restore Changeset name the exact source Build.
- The source Build and its existing evidence still read unchanged.
- Any subsequent edit produces a new Build rather than modifying the source.
