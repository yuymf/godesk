# Persist Finding-to-Build iteration lineage

Type: task
Status: resolved

## Question

Can GoDesk prove which Validation Finding motivated a revised immutable Build,
without inferring causality from timestamps or adjacent versions?

## Answer

Yes. A Finding-driven compile accepts an explicit `basedOnFindingId`. The
Worker verifies that the Finding belongs to the same Project and that the
active Rule System is newer than the Build cited by that Finding. It rejects a
compile before a rule revision with `finding_revision_missing`.

On success, both the immutable Build and its compile Changeset preserve the
exact Finding ID. Studio reads only that persisted relation to show an
`迭代依据` card beside the same-seed Build comparison, including the Finding's
next change and an anchor to the authoritative record. Builds that were not
motivated by a Finding remain valid and do not receive inferred lineage.

Browser acceptance used Project
`project_a36f45ec-4b4c-4dd3-aa43-2a0fd2ed2b31`. Compile Job
`job_2cd6676d-6db6-4e6c-8ddb-cbf2c1a7891c` was rejected with
`finding_revision_missing` before a rule revision. After Finding
`finding_9f2243df-ae7e-4c79-8da7-46d6a0da7ccd` motivated a focused action
change, Build `build_aa30644e2f5e03ae51679cd7` and Changeset
`changeset_5f75d2c9-0e1d-4052-8eca-bafb569f30cf` both preserved that ID.

The old and new Builds were self-played with seed 42. Both ended in 10 turns,
so Studio truthfully displayed `回合数变化：无变化`; final scores changed from
`8 / 5 / 4` to `8 / 7 / 5`. This is useful automated evidence that the stated
hypothesis was not supported by this run, not a human-playtest claim.

## Comments

- 2026-08-11: Added the persisted contract, Worker validation, MCP schema and
  verifier, Studio lineage card, Skill workflow, focused regression coverage,
  and a real browser/self-play acceptance run.
