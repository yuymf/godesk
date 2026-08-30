# Restore an Immutable Build as a New Editable Rule System

Type: task
Status: resolved

## Question

Can a Creator return to an exact historical playable version without mutating
the Build, Replay, or validation evidence that established what happened?

## Answer

Yes. Historical revisions are restored from an immutable Playable Build, not
from the Rule System branch list. `restore_build_as_rule_system` copies the
Build's exact Rule System snapshot into a new active Rule System at version 1.
The new Rule System and Changeset both retain `restoredFromBuildId`. The source
Build, Shared Sessions, Replays, Findings, and parallel Rule System branches are
not modified.

The operation requires the latest project version and an idempotency key,
rejects a pending Generation Plan, and rejects restoring the Build already
represented by identical active playable content with `build_already_active`.
After the restored Rule System is edited away from that snapshot, the same
historical Build can be restored again. The existing duplicate and activate
operations retain their branch semantics.

Studio exposes `恢复为新编辑版本` on each historical Build, labels the separate
list as `规则分支`, shows exact restore lineage, and disables a repeated no-op
restore. The Plugin adds a model-invoked `restore-build-version` Skill.

## Acceptance

The actual local Streamable MCP loop exposed 17 tools and passed 19 invariants.
Project `project_c47d0f62-2cba-40b5-959a-036a3bcccdea` restored source Build
`build_11eeed39a373c7bcd4dd2840` into Rule System
`rule_system_8997969b-1596-446a-b1d1-22102da64f6b`. It then reread the source
Build and historical Replay to confirm both remained unchanged.

An isolated browser fixture used Project
`project_9e08944e-041b-4725-8750-636f94d24f31`. Studio visibly replaced the
deliberately changed pitch with the exact source Build pitch, created Rule
System `rule_system_a67e6001-968a-4a56-a6d3-450a284327fb`, and showed
`恢复自 Build build_fdfa37bab7cc808b9e78eaf1`. It compiled new Build
`build_2d848b81840675cd7d72e6cf` and completed seed 42 bot Playtest
`playtest_418f0d65-8525-40ad-af9e-0853ae5ba996` in 10 turns with scores
`8 / 5 / 4`. Replay `replay_f3cbc936-a454-47ce-9672-d578dee616fe` visibly
reconstructed all 10 accepted actions and retained the automated-evidence
disclaimer.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 24 tests, Worker 104 tests, typecheck,
build, local routes, creator loop, 17-tool / 19-invariant MCP loop, 12-Skill
Plugin verification, deployment dry-run, and diff whitespace checks. The
separate read-only public distribution check still fails exactly with
`public plugin version is stale`.
