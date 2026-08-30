# Attribute Participant Feedback to an Accepted Action

Type: task
Status: resolved

## Question

Can a Creator tell which concrete play moment a participant comment describes,
without asking the participant to copy IDs or reconstruct context from memory?

## Answer

Yes. Shared Session feedback now requires the claimed seat to have completed at
least one Accepted Action. GoDesk derives a Feedback Moment from that seat's
latest action and stores its `actionSequence` and `actionId` with the rating and
comment. Updating feedback refreshes the moment to the seat's latest action.

The Room shows the linked action beside the participant's saved feedback, and
Studio shows the same action label in the project's Shared Session evidence.
`participant-feedback` Findings must preserve the exact moment in their
immutable feedback snapshot; changing either the action sequence or ID is
rejected. Replay remains action-only and is not mutated by feedback.

This is deliberately not a general annotation, survey, or analytics system.
One feedback entry per seat points to one latest Accepted Action.

## Acceptance

The HTTP creator loop passed 13 invariants including
`feedback-moment-attribution`. The Streamable MCP loop exposed 17 tools and
passed 21 invariants including `mcp-feedback-moment-attribution`. Worker tests
also prove that an occupied seat without an Accepted Action receives
`feedback_requires_action` and that a tampered moment cannot become Finding
evidence.

Browser acceptance used Project
`project_ab9ee4bb-55e4-411b-9586-b0a1b60add36`, hypothesis
`hypothesis_c0454660-7cbc-4165-94ae-1982fd069990`, Build
`build_bc0776b2672afd0b105b4ac3`, and Room
`room_94f4e3dc-713a-4074-bb5f-7c18e3fb1fbf`. Before acting, the participant saw
the feedback gate. Codex then chose `constraint` as Accepted Action sequence 1,
submitted five-star feedback, and both Room and Studio visibly rendered
`行动 #1 · 加入约束`. Finding
`finding_fb9628a8-d63c-47e0-ba80-90639379f383` retained the exact
`{ actionSequence: 1, actionId: "constraint" }` snapshot.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 24 tests, Worker 104 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.
