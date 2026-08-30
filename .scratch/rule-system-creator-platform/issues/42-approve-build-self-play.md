# Approve, Build, and Self-play as One Studio Action

Type: task
Status: resolved

## Question

Can a Creator move from a reviewed Generation Plan to a tested, shareable
prototype without approving the plan, finding a separate compile control,
starting a bot run, and creating a Room as four disconnected actions?

## Answer

Yes. Web Studio now treats plan confirmation as the start of one bounded
authoritative pipeline using only existing operations:

1. version-checked `approve_generation_plan`;
2. durable `compile-build` job against the approval result's exact version;
3. for a Build with an executable Kernel and a passed Presentation Floor, a
   fixed-seed `bot-playtest` job and one embedded Shared Session.

This follows Tesana's documented `plan -> Approve & Build -> play and iterate`
interaction seam without copying its engine architecture. GoDesk still builds
an immutable Rule System snapshot on its own deterministic runtime. A draft or
visually blocked Build stops honestly after compilation, shows unsupported
behavior, and does not fabricate bot evidence or a Room.

The previous separate compile, bot-playtest, and Room controls remain available
for later focused iterations. No new backend endpoint, orchestration layer, job
kind, or client-side project state was added.

## Acceptance

Fresh browser acceptance at `http://127.0.0.1:8830` used executable Project
`project_e6ed45e4-b165-4ed5-ba3a-b69c02aff8f4`. One click on `确认计划并构建版本`
approved the plan, created Build `build_9a9b6784af7b7c393e663b5e`, completed
fixed-seed Playtest `playtest_aa640270-6fa0-4dbb-8ea7-c370f72b66f8`, and embedded
Room `room_a92cee83-2a7a-49ed-848e-2b1e27ca086b`. The independent invitation
URL opened the same Room; Codex claimed seat 0 and submitted `调查` as Accepted
Action sequence 1. Replay `replay_29843c3b-f191-447e-bbd2-2435eb47374c`
retained turn 1 and shared progress `2 / 8`.

The negative path used Project
`project_e6e36d63-edf2-410a-a78f-63184c54b9f2` from the vague prompt
`做一个有趣、漂亮、充满惊喜的游戏。`. Confirmation created immutable Build
`build_1098026a0f394cdfd80b4fbd` with `rule-execution` unsupported, while the
project retained exactly zero Playtests and zero Shared Sessions.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 28 tests, Worker 105 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks.
