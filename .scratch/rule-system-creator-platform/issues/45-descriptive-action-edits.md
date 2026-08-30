# Preserve the Executable Kernel during descriptive action edits

Type: task
Status: resolved

## Question

Can a Finding-driven iteration change an action's explanatory copy without
forcing a manual runtime reconfiguration, while still invalidating the Kernel
when the executable action shape changes?

## Answer

Yes. The Worker now distinguishes executable action shape (`id`, `label`, and
the action list) from descriptive copy. Participant, rule, constraint, and
shape-changing action edits still mark the Rule System `draft`; changing only
an action description keeps the existing executable Kernel. This lets a
feedback-driven wording iteration continue through compile and fixed-seed
self-play without hiding a real rules/runtime change.

## Acceptance

The regression in `worker/projects.test.ts` passes alongside the existing
runtime invalidation tests: 108 Worker tests passed. The isolated browser
iteration used Worker `127.0.0.1:8830`, Project
`project_2def510c-46ef-4a85-ac5f-a7d067d0714c`, and Finding
`finding_c69216cf-ecc7-46ff-8a7f-7fd0c1aa88aa`. The first action-copy revision
correctly exposed the existing overly broad invalidation boundary through
failed Playtest Job `job_ad3a3606-fcc3-436b-9f07-2c8260c919d7` with
`runtime_not_executable`. After Kernel reconfiguration, Build
`build_8fa095e814021453ae25d41f` compiled with runtime `executable`; a
same-project follow-up compile produced Build
`build_d11f19f51e1d7ddf5a0255d0` with the same executable Kernel. The added
regression directly changes an action description and proves that this edit
does not invalidate the Kernel.

Both immutable Builds completed seed `42` `automated-bot-simulation` Playtests
in 10 turns with final scores `8 / 5 / 4`. Studio visibly showed the latest
same-seed comparison, the exact Finding lineage, and both Replay links. This
is local automated and agent-operated evidence, not a real-person playtest,
public deployment, or fresh public Plugin installation.

## Comments

- 2026-08-12: This boundary was discovered during the Feedback Inbox → Finding
  → same-project iteration. No compatibility layer or fallback was added;
  the existing Kernel remains the single runtime source of truth.
