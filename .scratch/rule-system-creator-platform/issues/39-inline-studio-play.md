# Play an Authoritative Shared Session inside Studio

Type: task
Status: resolved

## Question

Can a Creator try the latest executable Build immediately without leaving Web
Studio, while preserving the same authoritative Room and friend invitation
model?

## Answer

Yes. Web Studio now selects the newest immutable Build and its newest matching
Shared Session. When none exists, `开始 Studio 试玩` creates one through the
existing Shared Session API and embeds that exact Room. `新开一局` creates and
selects a newer Room without navigating away from the Game Project.

The iframe is only a Studio presentation seam. Seat claims, Intents, Accepted
Actions, Session State, feedback, and Replay remain owned by the existing
Shared Session runtime. `独立打开` exposes the same Room URL for friend sharing;
the static Build preview is not treated as an executable runtime.

## Acceptance

Browser acceptance used Project
`project_aa9dfc0b-9e92-4fd2-94e3-94e7a2e3e839`, hypothesis
`hypothesis_140bb3cd-5f87-4051-9560-18786de4c748`, Build
`build_76d0c82a2cfc026af7957065`, and embedded Room
`room_0237d05c-fde3-49c0-9bd4-334c188410d5`. Studio stayed on the same URL
while Codex claimed seat 0 and submitted `constraint` as Accepted Action
sequence 1. The authoritative state advanced to turn 1 with scores `2 / 0 / 0`;
Replay `replay_a69de5dd-8f3e-4ecb-9b67-beab9b72085b` retained the identical
action and final state. Five-star feedback
`feedback_89007644-82e2-4450-b247-88ab95f6761d` retained Feedback Moment
`{ actionSequence: 1, actionId: "constraint" }`.

`新开一局` then selected Room
`room_c35c4c9f-857e-4461-85dc-aa66be086e83` in both the notice and embedded
invitation link, still without leaving Studio.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 25 tests, Worker 104 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.
