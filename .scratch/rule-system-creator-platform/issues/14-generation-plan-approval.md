# 14 — Review and approve the generated Generation Plan

Type: task
Status: resolved

Blocked by: 13

## Question

Does source-driven generation give the creator a visible, durable review seam
before GoDesk creates an immutable playable Build?

## Answer

`generate-rule-system` now persists a bounded `GenerationPlan` for the same
Game Project. It summarizes the extracted loop, proposed actions, outcomes,
assumptions, unsupported behavior, and source IDs. Web Studio exposes the plan
as a first-class review panel; MCP exposes the `generation-plan` view and the
`approve_generation_plan` mutation. Build creation rejects a pending plan with
`generation_plan_pending` and only proceeds after a version-checked approval.
While the plan is pending, Rule System duplication and active-version switching
are also rejected; source-anchored corrections may still update the current
candidate before approval. The approval result includes the exact MCP
`generationPlan` payload and records the Rule System version that was actually
reviewed.

The current vertical slice keeps generation deterministic and honest: the Rule
System is materialized first, while the plan makes its interpretation visible
and prevents an unreviewed draft from being called playable.

When a pending candidate receives a focused Rule System or runtime correction,
GoDesk rebuilds the bounded plan snapshot against the new candidate version
before approval. The plan ID and generation provenance remain stable, while its
summary, loop, actions, outcomes, assumptions, unsupported behavior, and
reviewed Rule System version no longer describe stale content.

## Verification

- `pnpm test:worker` passes 4 files and 69 tests, including pending-plan Build
  rejection, pending-plan version-switch rejection, approval after a focused
  correction with refreshed plan content, MCP output schema exposure, and
  generated-project compilation paths.
- `pnpm verify:local-loop` passes 10 invariants, including
  `generation-plan-approval`, then continues through self-play, Finding,
  revised Build, Shared Session, feedback, and Replay.
- Browser self-play at isolated `http://127.0.0.1:8808` showed the pending
  plan, disabled Compile action, approval transition, compiled Build, shared
  Room action, persisted feedback, and Replay.
- A fresh current-source browser rerun at `http://127.0.0.1:8810` also showed
  pending-plan Compile/current-version-duplication restrictions, approval,
  Build `build_ebac822d98f40d22a2433915`, Room
  `room_d07fe87b-f22f-4b6f-bb5d-40e8239bbd4d`, an accepted seat-0 action, and
  persisted 5/5 participant feedback.

All evidence is automated local evidence. It does not assert public OAuth,
deployment reachability, or real-person human playtest acceptance.
