# Rule System creator acceptance

Date: 2026-08-10 (Asia/Shanghai)

## Automated evidence — passed

- Frontend/domain tests: 2 files, 19 tests.
- Worker/API/MCP tests: 4 files, 92 tests.
- Typecheck, production build, local OAuth/MCP route verification, Cloudflare
  deploy dry-run, Skill validation, and diff whitespace checks passed.
- The Plugin bundle now verifies 11 Skills, including the model-invoked
  `iterate-from-finding` follow-up workflow.
- The current loop verifier also requires every Validation Finding to carry one
  executable `nextChange` for the same Rule System; an empty or missing change
  cannot be saved.

## Feedback-to-Codex handoff — passed locally (2026-08-10)

An isolated application-browser fixture closed the shortest handoff after a
friend leaves feedback:

- Project `project_5a104520-63c3-471b-ba8a-788ef554a032`, Build
  `build_262657de62465401161c6e62`, Shared Session
  `room_e0e72d04-4fbd-4b66-a657-9bed86d5c456`, Replay
  `replay_ba14b9f2-8ab1-43a1-8cb4-ac6abe158b69`, and feedback
  `feedback_9b7b410c-9dd1-454d-8746-bd5b4f134772` were created through the
  authoritative local HTTP surface.
- The Room's Web Studio URL used `evidenceType=participant-feedback` and the
  exact Room evidence ID. Studio opened with the exact Build, evidence type,
  and one-feedback Session preselected instead of incorrectly entering the
  human-attestation form.
- Finding `finding_07484b97-729f-4f41-ac36-1ea6526e635d` visibly exposed its
  exact ID and a `Copy for Codex` control. The deterministic prompt names the
  same project and Finding, quotes the actionable next change, and requests a
  new immutable Build plus same-seed automated comparison.
- The copy control reached its visible success state, browser error logs were
  empty, and the exact prompt formatter is covered by the nineteenth frontend
  test.

This is automated local browser and HTTP evidence. The feedback fixture was
not submitted by a real friend, and it does not satisfy public installation,
OAuth, or human-playtest acceptance.

## Shared-pool take-away Kernel — passed locally (2026-08-10)

A black-box prompt exposed a semantic failure in the prior generation path:

> 两名玩家轮流从桌上的15枚石子中拿走石子。每回合可以拿1枚或拿2枚。拿到最后一枚石子的人获胜。

Before the correction, this became `turn-taking-v1`: the two source sentences
were clickable actions, but no stone ever left a pool and no winner could be
declared. The same prompt now selects `take-away-v1` with `initialPool: 15` and
source-derived take actions `[1, 2]`.

- The runtime rejects overdraw and wrong-seat actions, decrements one shared
  pool, rotates seats, and awards the win to the last taker. Fixed-seed bot
  runs are reproducible and finish at zero.
- The actual Streamable MCP verifier passed 12 invariants. Its take-away path
  produced Project `project_0c460e76-87df-41d1-8911-102eb132dd51`, generation
  Job `job_1f7508cb-b648-4bea-828b-95cf6d9d7826`, Build
  `build_854dbb6cb95c92f258799394`, Playtest
  `playtest_030c5bf7-dc7c-44a6-86ba-4b55c45c6054`, Shared Session
  `room_e5de1e2d-8409-444b-b699-c9fb7f7fed86`, and Replay
  `replay_c0793d33-abc4-4e40-81d1-7cee3098ea3e`.
- A separate browser fixture used Project
  `project_e0b7eef4-4beb-46fe-b377-22fea75bc274`, Build
  `build_2dd41a5f0289b976f57b61ec`, Shared Session
  `room_e6ab6c9c-b151-44aa-8b1a-d82a64277502`, and Replay
  `replay_529f33c5-af77-42ac-b24a-fecc427cd18c`. Two automated clients
  completed 15 → 0 in eight accepted actions. With one object remaining, the
  two-object action was visibly disabled and the one-object action completed
  the game with seat 1 as winner. Replay visibly reconstructed 15/15 → 0/15;
  browser error logs were empty.

The final-source MCP rerun after mapping stone and match sources to a table
Play Surface passed at `http://127.0.0.1:49917`. Its take-away path produced
Project `project_443f23d5-8d55-4ad6-8080-3244806f949b`, generation Job
`job_95272d36-dff0-42e3-8497-800f07131d09`, Build
`build_f4790b23834749f0e0ce58fc`, Playtest
`playtest_466a9f9b-a31a-459a-ae29-391a752ebede`, Shared Session
`room_93c9ca22-62a8-4b16-8b51-670f2c0e1841`, and Replay
`replay_5b7f1d79-0ad4-4c5c-8a7d-2529cf8ee3df`; all 12 MCP invariants passed.

This is local automated self-play and browser evidence. It does not prove a
public Plugin install, OAuth, or a real-person playtest.

## Seeded roll-and-move Kernel — passed locally (2026-08-10)

The acceptance prompt is:

> 两名玩家轮流掷一颗六面骰子，并按点数前进相应格数。率先到达20格的玩家获胜。

Before the correction, generation reduced it to `turn-taking-v1` with a
12-turn default, one long-text action, no roll result, no player positions,
and no winner. It now selects `roll-and-move-v1` with `dieSides: 6`,
`targetPosition: 20`, and a visible 80-turn safety limit.

- The authoritative runtime derives each roll from Build seed and action
  sequence, advances only the active seat, reaches the target exactly, and
  reproduces the same complete fixed-seed game. The safety-limit regression
  terminates with `winnerSeat: null`.
- The actual Streamable MCP verifier passed 13 invariants. Its new path
  produced Project `project_38723d61-0bbc-4bfb-bfe4-4fbc5b5b5b3c`, generation
  Job `job_fe009048-5e36-4444-96a5-23957f63fdea`, Build
  `build_567ac9efb31919141cf7b93a`, Playtest
  `playtest_b128c8f5-5755-4385-b2a9-8ae09dea4050`, Shared Session
  `room_2c537a60-a270-40e3-91eb-ea69aa2b715f`, and Replay
  `replay_b31f4666-078c-4fee-88b5-ead37cd736de`.
- A separate application-browser run used Project
  `project_666bc2dd-7433-42ba-b598-be8e19244e37`, Build
  `build_47a4a7eda8dda90bce7e67b6`, Shared Session
  `room_c278bb69-052f-4d9c-a58d-19402e42cdba`, and Replay
  `replay_5fc7d4c0-8789-47fe-8894-5f8819017876`. The first self-play exposed a
  seat-correlated 4/1 sequence, so roll derivation was changed to advance one
  seeded random stream by accepted-action sequence. The final two-client run
  used rolls `[1, 5, 4, 3, 1, 1, 1, 5, 2, 6]` and ended after ten actions at
  9/20 versus 20/20 with seat 1 as winner. Replay visibly reconstructed every
  roll; browser error logs were empty.

This is local automated self-play and browser evidence. It does not prove a
public Plugin install, OAuth, or a real-person playtest.

## Iteration evidence — prompt fidelity and self-play (2026-08-10)

Following the [Tesana prompt → build → play → iterate loop](https://docs.tesana.ai/quickstart),
the local black-box path found and fixed a silent rule-drift bug in the
prompt-first seam. A Chinese prompt describing three players, two scored
actions, an 8-point target, and an 18-round limit now produces:

- 3 participants, two editable actions (`扩展创意` = 1 and `加入约束` = 2),
  and an executable `score-race-v1` with `maxTurns: 18`;
- Project `project_f4cad795-6c1e-4bce-9ae5-a53c17613271`, Build
  `build_261a6e87d28a468d6ec68588`, and two fixed-seed 42 bot runs;
- Replays `replay_0fa3b792-247b-4164-911f-48a7dfcde885` and
  `replay_6b64c2eb-15a6-41ad-a313-a8753777d9ee`;
- both runs terminal-succeeded at 15 turns, winner seat 2, scores `[6, 5, 9]`,
  with identical accepted-action logs in their Replays.

The evidence type remains `automated-bot-simulation`; it is not human
playtest evidence. Text materialization is still deterministic extraction,
not a universal prose interpreter, and unsupported behavior remains visible.

## Iteration evidence — shared-goal Kernel and independent self-play (2026-08-10)

To keep the Tesana-style `describe → build → play → iterate` loop moving
without waiting for a person, an explicit cooperative source prompt was run
through a fresh isolated Worker at `http://127.0.0.1:8801`:

> 三位玩家合作收集线索。玩家可以调查线索推进 2 点，也可以整理线索推进 1 点。累计达到 6 点完成目标，最多 12 回合。

- Project `project_67e2c762-d60b-43ce-9546-3fe01f3fe46e` and generation Job
  `job_50db445a-5e9a-44bf-915f-1b5dce68eaef` succeeded.
- Generated Rule System selected `shared-goal-v1` with `goalTarget: 6`,
  `maxTurns: 12`, and editable actions `调查线索` = 2 / `整理线索` = 1.
- Immutable Build `build_6b141da2b17e77bdfcfc949a`, Rule System version 2.
- Fixed-seed bot runs all completed the shared target: seed 17 reached `6 / 6`
  in 4 turns; seed 42 reached `7 / 6` in 4 turns; seed 99 reached `6 / 6`
  in 5 turns. Every run retained `winnerSeat: null` and exposed
  `sharedGoal` metrics. A repeated seed 42 run reproduced the same metrics.
- Shared Session
  `http://127.0.0.1:8801/room/room_c5be8f15-1cb0-404d-b6b9-bd4b2418285c`
  started at shared progress `0 / 6`; wrong-seat Intent returned HTTP 409;
  legal seat-0 `source-action-1` advanced it to `2 / 6`.
- Bot Replay
  `http://127.0.0.1:8801/replay/replay_06fa389e-5522-4731-9e23-6ac7ebfbeeea`
  reconstructed `0 / 6 → 7 / 6`, four accepted actions, and no winner seat.
- Application-browser DOM inspection passed for the Build preview, Shared
  Session, and Replay routes: the visible surfaces showed `shared-goal-v1`,
  shared-progress action cards, the shared target track, and the automated
  evidence disclaimer.

This is independent automated HTTP/browser evidence, not human playtest
evidence. It proves the second Kernel is executable and shareable, while the
source's unsupported behavior remains visible.

## Iteration evidence — same-project feedback loop and evidence deep links (2026-08-10)

An isolated Worker run completed the full local loop without waiting for a
person: describe → generate → add a Design Hypothesis → compile → fixed-seed
self-play → record an automated Finding → reconfigure the same Rule System →
compile a new immutable Build → self-play again → open a Shared Session.

- Project `project_5151ff24-cb98-4b3d-a2eb-262a0eff911d` advanced from v2 after
  generation to v7 after the Finding, reconfiguration, and second compile.
- Hypothesis `hypothesis_7a4c046b-471b-4b76-b0f2-7e65e04e7311` and automated
  Finding `finding_4213cdf9-17a0-4eb0-8028-2378f27aa370` remain attached to
  the same project.
- Build 1
  `build_bd3cfd2f821b3a1c41c6eabc` kept `shared-goal-v1` with
  `调查线索 = 2`; seed 42 reached `7 / 6` in 4 turns.
- The Finding's next-change note reconfigured the same Rule System so Build 2
  `build_04aaa026a21a425659f866d1` uses `调查线索 = 3`; the old Build still
  reads `2`, while seed 42 on the new Build reached `6 / 6` in 2 turns.
- The new Shared Session
  `http://127.0.0.1:8801/room/room_2f9e0724-a7f0-4fda-b35a-8a319e7caa69`
  started at `0 / 6`, accepted one legal action to `3 / 6`, and wrote Replay
  `replay_f52013d6-472a-484a-8fee-66de7a81771f`.
- Browser DOM inspection confirmed that the new `带入验证` links carry the
  exact project, Build, evidence type, and evidence ID. A Studio deep link
  opened with the correct Build and automated playtest preselected; the Room
  link preselected the human-session path; the Replay link returned to the
  same project with its Build and validation section.

This is automated local self-play and browser evidence, not human playtest
evidence. It proves the learning loop is executable and navigable while
preserving the human evidence boundary.

## Reproducible local creator loop — passed (2026-08-10)

`pnpm verify:local-loop` now starts a free-port isolated Worker and runs the
same HTTP control-plane chain on fresh temporary Durable Object state:

`brief → Source Library → pending Generation Plan → approval → shared-goal-v1 →
Hypothesis → Build 1 → fixed-seed Playtest → automated Finding → focused Rule
System reconfiguration → Build 2 →
old Build immutability check → Shared Session seat isolation → accepted Intent
→ participant feedback → Replay`.

The verifier asserts the original source text, pending-and-approved Generation
Plan, target/action values, automated evidence label, same-project
Hypothesis/Finding references, the Finding's actionable `nextChange`,
changed-vs-unchanged Build snapshots, rejected unclaimed-seat Intent, persisted
Shared Session feedback, and reconstructed Replay state.
It prints the fresh project, Build, Playtest, Finding, Session, and Replay IDs;
its evidence remains automated local self-play, not public OAuth or human
playtest evidence.

Fresh run IDs from the isolated Worker at `http://127.0.0.1:57239`:

- Project `project_8ac49afa-d9f0-4fe6-84d7-66a922bba4d2`;
  Hypothesis `hypothesis_7a05b61d-45c5-4dab-841f-a573b7a4f434`;
  Finding `finding_0f42f63a-4220-473a-8882-5f775ad373ed`.
- Build 1 `build_bfd89dc4b9e9423953e935c0` and Playtest
  `playtest_d07d68c6-585b-4aa3-9a44-8c0811a3f3cd`.
- Build 2 `build_3d907df6f436f92e5401c9e6` and Playtest
  `playtest_6c1b6294-99fa-4552-8a6a-c2c9f372b8cf`.
- Shared Session `room_1af7f43b-e41d-4039-af35-8ef3e5329115` and Replay
  `replay_f7e288bf-6301-41e6-a6f3-6b641f733658`.

The verifier was rerun after the visual-material change at
`http://127.0.0.1:61018`, producing Project
`project_9de73d80-46e0-4418-b6be-7c35b32e13b5`, Build 1
`build_5759eace79487f30c78763cd`, Build 2
`build_0cbcfcf46699e622d3891c71`, Shared Session
`room_b3bf3ea3-3725-4e95-9792-b40d10f03406`, and Replay
`replay_ef79238e-650c-4520-b2c5-185b4de7af17`.

The final-source rerun after the provenance correction passed at
`http://127.0.0.1:63047`, producing Project
`project_f256ab8a-9427-41d9-9c86-f0abc60584d6`, Hypothesis
`hypothesis_2cb52ad8-9a18-4d45-86e7-9d02c2d930a8`, Finding
`finding_f80b006a-f400-434f-8333-f379efffe40e`, Build 1
`build_719fc83d2486e3d950372bc8`, Playtest
`playtest_5ae9e84e-8e65-4c54-a8a9-c64acc3d0780`, Build 2
`build_2567355ae8ce35ba0d6ec4f7`, second Playtest
`playtest_79c34767-2114-4ff6-91c7-a1c01720b401`, Shared Session
`room_a855b3cf-9945-45e4-a264-9ac33008ae52`, and Replay
`replay_679b792c-0503-46a1-9f50-74bb9251c6b1`. All eight verifier invariants
passed, including source provenance, immutable Build revision, seat isolation,
and Replay reconstruction.

The current-source rerun after making the Finding next change mandatory passed
at `http://127.0.0.1:58701`, producing Project
`project_1118e3af-3426-4ddc-8d0b-f313a3e1e84f`, Hypothesis
`hypothesis_89dc246d-845b-4451-be94-e3ea5c8f2866`, Finding
`finding_bfb396cd-319b-44e1-a4f6-01f934922017`, Build 1
`build_ca72e99f34c1951469c31268`, Playtest 1
`playtest_d7fbb3ae-332f-48db-b61b-c2d0677096fb`, Build 2
`build_148f817e4fc833617efddcd6`, Playtest 2
`playtest_9ebff696-fa33-4d36-acc8-b9dc9d038517`, Shared Session
`room_426b4325-8a0b-49ce-a2b6-87ca0926492c`, and Replay
`replay_154471c3-c885-402e-a866-182b43fb752e`. All eight invariants passed;
the Finding's next change was preserved while the same project returned to a
focused Rule System reconfiguration and a new immutable Build.

The application-browser run on isolated `http://127.0.0.1:8805` exercised the
same seam through visible UI: prompt-only creation produced Project
`project_48fb8276-ec06-4e8d-9685-2507f3d7211a` and Build
`build_881c99a87f15730513d9a85a`; Room
`room_dd35c558-190b-47c4-9d1a-a1b5ef863d7e` accepted seat-0 Action 1 and
advanced shared progress `0 / 6 → 2 / 6`; fixed-seed 19 produced automated
Playtest `playtest_f97d7913-5587-4164-8ee4-1504b9fab3ff` with `6 / 6` in four
turns; and the Studio saved one supported Finding. After reload, the visible
Finding included the exact actionable text “把调查行动从 +2 调到 +3，再用相同
seed 重编译并重跑试玩。” and the evidence label remained automated. The Room
Replay was `replay_8bc7910e-46f1-4331-bbe1-ffd9bc9b9d46`.

This is automated local self-play and browser evidence, not human playtest
evidence. It demonstrates the focused follow-up seam benchmarked against
Tesana's prompt → build → play → iterate flow while preserving the human
evidence boundary.

## Codex follow-up Skill — passed (2026-08-10)

`iterate-from-finding` is now the explicit Codex seam for a creator request
such as “apply the feedback from this replay” or “continue from the next
change.” It requires the same project ID, reads the old evidence, applies one
version-checked focused patch, compiles a new immutable Build, reruns and
compares fixed-seed self-play, and optionally records the next
evidence-labelled Finding. The validation and basics Skills route explicit
follow-up requests to it.

The Skill passes the repository Skill Creator validator, and
`pnpm verify:plugin` passes with 11 Skills. The local loop remains the runtime
evidence for the same-project patch, immutable Build, Replay, and evidence
boundaries; the Skill itself adds no server-side prose interpreter.

The current-source loop rerun after adding the Skill passed at
`http://127.0.0.1:62647`, producing Project
`project_4d2f58d2-b149-4add-ab27-6af668a5a887`, Finding
`finding_58ce1687-0539-4810-b5ef-8765078c0d29`, Build 1
`build_13e97ffc0705d100ef77e821`, Build 2
`build_48a73b4523f445b0b16bf7d2`, Playtests
`playtest_94378d88-aa65-47fc-a8fe-27d776f42495` and
`playtest_bcf93aa2-f224-4f5d-8b1f-2e08e14d880d`, Shared Session
`room_ef9cbc67-559c-4670-8b68-d833c5105b65`, and Replay
`replay_d4f48400-c0b7-4be0-9905-7161c0a49d90`; all eight invariants passed.

The latest current-source rerun after adding persisted Shared Session feedback
passed at `http://127.0.0.1:50034`, producing Project
`project_b1f2bd51-62a3-4dbf-b61e-e777169e19a8`, Hypothesis
`hypothesis_29463840-6ae0-40a3-8e3b-46352421e006`, Finding
`finding_730f4d71-edaa-40f0-81c1-12921ba15271`, Build 1
`build_2d1a4deaa8782fac28379e7c`, Build 2
`build_da542222c51f1bc0d3bafcdf`, Playtests
`playtest_98ae1b12-5859-4f45-ba40-ea3e7e4ae122` and
`playtest_feb103c0-def5-4a7a-945d-8ebf417f8fdd`, Shared Session
`room_5d096d77-9811-454f-b30c-7cfde0a0feb8`, and Replay
`replay_6e4e115f-8672-41c4-b311-ff458f26cf85`; all nine invariants passed,
including `shared-session-feedback`.

## Natural-language participant ranges — passed (2026-08-10)

Prompt-first materialization now preserves a player range instead of reducing
`2–4` players to a single inferred seat count. English forms such as `2 to 4
players` and Chinese forms such as `二至四位玩家` produce editable
`participants.min = 2`, `participants.max = 4`, and conservative default `2`.
An explicit participant object supplied by the Creator or MCP still wins over
inference.

The unit and durable Worker generation-job regressions passed. This remains
deterministic source extraction with an explicit support boundary; it is not a
universal prose interpreter.

## English scored-action materialization — passed (2026-08-10)

The prompt-first extractor now handles an English rule sentence with multiple
explicit scored actions, for example `investigate clues for 2 points or
organize clues for 1 point`, without merging it into one action. It also
recognizes `reach 6 points` as a competitive victory target. The durable
generation job only configures `score-race-v1` after both actions and the target
are present; otherwise the Rule System remains draft.

Unit and Worker generation tests passed, followed by the current HTTP and MCP
self-play loops. This remains deterministic extraction with visible source
and runtime limits, not a universal prose interpreter.

## Runtime action completeness — passed (2026-08-10)

The previous six-action extraction ceiling could silently discard later source
actions before generation decided whether a Kernel was safe to configure. The
materializer now preserves all candidate actions, and the generation job checks
the full set against the existing twelve-action Kernel limit:

- twelve English scored actions remain editable and are eligible for automatic
  Kernel configuration;
- thirteen actions retain the thirteenth source action and remain `draft`, with
  an explicit warning that the Kernel limit was exceeded;
- no partial action list is compiled as if it were the source rule system.

Worker regression coverage is now 4 files / 76 tests. The current-source HTTP
and MCP loops were run in parallel after this change and both passed:

- HTTP at `http://127.0.0.1:51326`: Project
  `project_197741b8-46af-4b79-89fc-8844c4583c8b`, Build 1
  `build_49cf170103054831f9630d19`, Build 2
  `build_dad90f306fb1083cf79f0e8c`, Shared Session
  `room_2016fb49-8bb0-4cdc-b8aa-3e96b075981c`, Replay
  `replay_f3b15054-4ef4-4e3a-abf1-95d92b377b71`; all 11 HTTP invariants
  passed.
- MCP at `http://127.0.0.1:51327`: Project
  `project_aa5b1ec1-245a-4fed-ae9c-1540a9ee1e19`, Build
  `build_0ec3b01e8d5bf69902efc646`, iterated Build
  `build_3d041eda5860fabbbec197e4`, Shared Session
  `room_563db2dd-7d31-459c-9afc-9f55e8d409ab`, Replay
  `replay_c83a62ac-ebce-4142-860a-bd322c195573`; all 10 MCP invariants
  passed with 16 discovered tools.

The two verifier scripts now pass `--inspector-port 0`, so concurrent isolated
Wrangler runs do not contend for the default Inspector port. This is local
automated evidence, not public OAuth or real-person playtest evidence.

## Turn-taking Kernel — passed (2026-08-10)

GoDesk can now turn an explicitly bounded turn-taking idea into an executable
prototype even when the source defines no points, shared target, resources, or
winner. `turn-taking-v1` preserves the source action list, advances the active
seat in round-robin order, completes at `maxTurns`, and keeps scores at zero
with `winnerSeat: null`. Unknown outcome and resource semantics remain visible
as unsupported behavior.

The current Worker suite passes 4 files / 81 tests. Coverage includes short
Chinese action lines, prompt-first Kernel selection, direct
`configure_turn_taking` through MCP, deterministic bot execution, Shared
Session intents, turn-taking metrics, and Replay reconstruction.

The actual local Streamable HTTP MCP route passed at
`http://127.0.0.1:61128` with 16 discovered tools and eleven invariants,
including the new `mcp-turn-taking-loop`:

- Project `project_6c4d99af-a3ba-4b81-9ec5-8e69407a5d00` and generation Job
  `job_4331512f-a6fc-4175-99e0-c5d32644851f` produced a pending Generation
  Plan and `turn-taking-v1` with two source-derived actions and `maxTurns: 4`.
- Approved immutable Build `build_e5123b8526741024d5cfa09a` completed bot
  Playtest `playtest_68f14e66-0bfe-4d1a-888c-337f2759014c` at `turn-limit`
  after four turns without a winner.
- Shared Session `room_a09cbad5-d807-4489-bdb7-998450c22c7c` accepted a legal
  zero-point turn action, advanced seat 0 to seat 1, and reconstructed Replay
  `replay_f5c4b05a-efd5-4b3a-9655-eb24713d9862`.

A separate application-browser run at `http://127.0.0.1:57401` inspected
Project `project_008e25b8-52d1-4ede-89b9-4c926eac99d0`, Build
`build_2462caed9b0ed95f5fac9da5`, Shared Session
`room_935eb179-8e64-43db-bc05-fe884dbfd550`, and Replay
`replay_2bd4968f-257e-420d-b9a0-5a2819eea06f`. Three automated clients
completed four ordered actions. The visible Room showed `回合 4 / 4` and
`回合上限已到`; the Build preview said `不自动判定胜负`; the Replay showed
initial `0 / 4`, final `4 / 4`, and all four Accepted Actions. No browser
console errors were recorded.

The normal HTTP creator loop also reran successfully at
`http://127.0.0.1:61127` with Project
`project_bce0b0c7-1e63-4e1e-af80-5c3208d5ee6f`, Builds
`build_a742e0d232ed209bd3b4ccde` and
`build_4b2948a64dac247969d33edc`, Shared Session
`room_35758f3e-df4d-4d58-b177-b101516454aa`, Replay
`replay_cec1babb-8a02-4c32-aaf2-8cef5290d20b`, and all eleven existing
source, plan, immutable Build, self-play, feedback, seat-isolation, and Replay
invariants. These are automated local transport and browser records. They do
not prove public Plugin installation, production OAuth, or a real two-person
playtest.

## URL-only participant feedback — passed (2026-08-10)

The current source was run through a fresh isolated Worker at
`http://127.0.0.1:8807`. The browser opened one exact invitation URL for
Project `project_82660aa8-9618-4cbe-b21a-a71228ea618b`, Build
`build_c07c8b24217ccf2c0be3033e`, Shared Session
`room_19206ee7-11b3-41e9-a244-4eb488fed2d4`, and Replay
`replay_4746ae26-4a26-44aa-aca4-664e9e808b72`.

- The application browser selected seat 0 and submitted `加入约束`; the Room
  advanced to turn 1 with 2 creative points.
- The visible `试玩反馈` panel exposed five rating buttons and a comment field;
  selecting 5/5 and entering “目标很清楚，但第二回合还可以更有张力。” enabled
  `提交反馈`.
- After submission, the visible Room showed `反馈已保存 · ★★★★★` and the exact
  comment. A fresh HTTP read of the same Room returned one feedback entry,
  rating 5, while the accepted action log remained one action.
- Worker regression tests also cover public invitation feedback writes, one-seat
  upsert semantics, MCP read projection, and Replay immutability.

This is automated local browser/self-play evidence. The comment is participant
feedback input, not proof of a real person or a `human-session` attestation.

## Public invitation seat boundary — passed (2026-08-10)

The public invitation path now enforces the minimum participant boundary at the
authoritative Worker: a client cannot submit its first Intent before claiming a
seat, and one `clientId` cannot claim a second seat. The two-browser invitation
regression proves both `seat_not_claimed` and `client_already_seated` rejections,
then claims distinct seats and completes the same ordered actions and feedback
path. Local/MCP headless self-play remains available through its non-public
control-plane route.

This protects the meaning of a Shared Session without calling synthetic clients
human evidence; human attestation remains an explicit separate gate.

## Generation Plan review gate and browser self-play — passed (2026-08-10)

To match Tesana's visible `prompt → plan → build/test → play → focused
follow-up` seam, source-driven generation now persists a bounded Generation
Plan. The creator can inspect the proposed summary, actions, assumptions, and
unsupported behavior, but Build creation returns `generation_plan_pending`
until the creator records `approve_generation_plan` against the current project
version.

The pending gate also rejects Rule System duplication or active-version
switching, so the reviewed Generation Plan cannot be silently detached from
the candidate that will be compiled. Focused source/rule corrections remain
allowed before approval, and the approval records the resulting Rule System
version.

The latest isolated `pnpm verify:local-loop` run at `http://127.0.0.1:64996` passed
11 invariants, including `generation-plan-approval` and
`participant-feedback-finding`, and then continued through
 fixed-seed self-play, an actionable Finding, a revised immutable Build, Shared
 Session seat isolation, participant feedback, and Replay reconstruction:

- Project `project_0401cadc-c941-47b8-9cd8-1eb09949f7c6`, Hypothesis
  `hypothesis_020def05-1a7b-4a00-a382-63fd3c5f846f`, and Finding
  `finding_d0058b5a-c9b7-4495-98b1-2e8c1a18fbbe`.
- Build 1 `build_074d006ed2f38a111c770dfd` and Playtest 1
  `playtest_5b9d221d-5036-4f9e-8214-1edd15b4f18b`.
- Build 2 `build_8116d7c82e0f4e81573a3f2f` and Playtest 2
  `playtest_b37286d3-2331-4b67-946d-64728b5b1ff1`.
- Shared Session `room_9c4b3695-acb4-4583-a099-48baaa3ffc31` and Replay
  `replay_dfe0a307-d90e-483c-8add-15f240044621`.
- Feedback Room `room_55d08fe6-0536-4660-b648-0a3a33e46838` produced the
  `participant-feedback` snapshot used by the Finding before the second Build.

An application-browser run on isolated `http://127.0.0.1:8808` exercised the
same seam through the visible Web Studio. Prompt-only creation opened Project
`project_42862b09-db06-429b-9e77-8a67596f07c5` with a visible pending plan;
the Compile button was disabled until `确认计划，进入编辑器` was clicked.
After approval, Build `build_6911e0d28f8143c6453697b4` compiled successfully,
Room `room_e87257ca-5b39-4d31-a891-6bcd5ca62779` accepted seat-0 Action 1 and
advanced shared progress `0 / 6 → 2 / 6`, and Replay
`replay_2ad3cbb4-75bd-4256-8b66-e9454633a46e` persisted the action. The same
Room saved a 5/5 rating and the comment “计划里的共同目标很清楚，行动反馈也很直接。”
under feedback ID `feedback_c599d254-5b0b-4c13-acbb-5e412e41d1d7`.

The current-source browser rerun on isolated `http://127.0.0.1:8810` repeated
the gate on a fresh project `project_716a5df2-3e52-4503-bc1d-0fbe21630b55`:
the pending plan made Compile and current-version duplication visibly
unavailable; approval enabled the editor and persisted completed job
`job_a47b38d5-dfe0-4d2d-8452-08f6ecb19ba7`, which produced Build
`build_ebac822d98f40d22a2433915`. Shared Session
`room_d07fe87b-f22f-4b6f-bb5d-40e8239bbd4d` then accepted seat-0 `行动 1`,
advanced `0 / 6 → 2 / 6`, and visibly saved a 5/5 rating plus the comment
“共同目标清楚，行动反馈很直接。”; a fresh HTTP read confirmed the same
action and feedback persisted in the Room and project session view.

Both runs are automated local HTTP/browser self-play. They prove the creator
review gate, executable handoff, sharing, feedback persistence, and Replay
continuation; they are not public OAuth/deployment evidence and not a real
two-person human playtest.

## MCP executable-state contract — passed (2026-08-10)

The MCP output contract now exposes the complete `state.voyage` payload for the
`harbor-voyage-v1` kernel, including phase, active seat, placements, cargo
positions, settlement fields, and action log. A regression route creates the
rights-safe `港口十三号` example through MCP, compiles it, creates a Shared
Session, submits `place:cedar`, and reads the same voyage state and accepted
action through the MCP Replay.

This closes a control-plane visibility gap: the Worker HTTP route already
executed the voyage, but the previous MCP schema omitted its domain state.
The evidence is automated local MCP/runtime coverage, not human playtest
evidence.

## MCP Streamable HTTP control-plane loop — passed (2026-08-10)

`pnpm verify:local-mcp` now drives an isolated full Worker through the actual
`/mcp` route. It performs MCP initialize and tool discovery, then uses only
MCP tools to create a prompt-and-source project, read and approve its pending
Generation Plan, compile and preview an immutable Build, run fixed-seed bot
self-play, create a Shared Session, submit one legal action, persist participant
feedback, record a Finding, apply its focused next change to the same project,
compile a second immutable Build, rerun the same seed, and read both Replays.
The verifier discovered 16 current tools and rejected stale protocol names.

Latest run at `http://127.0.0.1:65074` passed these invariants:
`mcp-initialize`, `mcp-tool-discovery`, `mcp-prompt-source-generation`,
`mcp-generation-plan-approval`, `mcp-build-preview`,
`mcp-automated-playtest`, `mcp-shared-session-intent`,
`mcp-participant-feedback-finding`, `mcp-feedback-driven-iteration`, and
`mcp-replay-reconstruction`.

- Project `project_0d1b7833-02b8-4533-a621-205b127ca700`, Studio
  `http://127.0.0.1:65074/studio/project_0d1b7833-02b8-4533-a621-205b127ca700`.
- Generation Job `job_abbebb18-6178-4ce8-b290-e4fc1c1b3a08`, Build 1
  `build_f657d5ef1b5e749220d9d478`, and Playtest 1
  `playtest_0e925cf1-1b54-4154-a577-bf93019b67e0`.
- Build 2 `build_1cb778a8e07673923317bc60` and Playtest 2
  `playtest_ec16fae5-a657-40a0-abcb-c58b1f7f0ce6`.
- Shared Session `room_780e2f93-1c62-4bc7-8bdf-fdcd91c40b6b` and Replay
  `replay_a250c672-8ed6-452b-9355-9b3e42b5faa1`.
- MCP Hypothesis `hypothesis_bf899835-24fc-40fa-b118-3f0413e81a72` and
  participant-feedback Finding `finding_62ed2b15-c401-441f-8afc-dcb22cbb2770`.

This is local MCP/control-plane evidence. The public workers.dev endpoint
still fails from this host at TLS connection setup, so it is not public OAuth,
deployment, fresh-Codex-task, or human-playtest evidence.

## Participant-feedback evidence — passed (2026-08-10)

Shared Session ratings and comments can now close the evidence seam without
pretending to be human playtest proof. The authoritative Worker requires the
Finding's Room and Build to match, verifies every feedback ID/seat/rating/comment
against the current Room, and persists the exact snapshot. Later edits to the
Room's one-per-seat feedback do not mutate the Finding.

The local HTTP loop records a feedback snapshot before the focused same-project
Rule System revision. The MCP loop writes feedback through the invitation URL,
reads it through MCP, records a `participant-feedback` Finding, and reads it
back from the validation view. This is automated participant-observation
evidence, not a `human-session` attestation.

## Visual material input — passed (2026-08-10)

The creator home now accepts standalone JPG, PNG, WebP, and GIF material in
addition to a prompt, pasted text, or rulebook. Browser-side validation limits
the upload to eight images, resizes them to bounded WebP data URLs, and sends
them through the current `visualInputs` contract. The Worker persists each
image in Source Library with creator-upload provenance and binds only the
presentation image; image-only input remains an honest draft unless text or an
explicit supported Kernel supplies executable semantics.

Browser run on isolated `http://127.0.0.1:8802` created Project
`project_a637fc51-7d8c-49d7-8c18-3ddae08bec3b` from one `loading-icon.gif` input.
The Studio DOM and screenshot showed `v2`, two sources, zero Builds, and
`需要配置`; the image source was `origin: creator-upload` with a compressed
`data:image/webp` URL.

## Public invitation route — passed locally (2026-08-10)

The invitation contract is now exercised on a non-local host without an OAuth
header. Shared Session, Build, and Replay URLs carry a `creator` routing value
so the Worker can locate the owning Durable Object while exposing only the
share-scoped surfaces. The existing two-client acceptance test loaded the Room
from `friend.godesk.example`, read the session and Build, claimed both seats,
submitted two authoritative turns, and read the Replay. Removing the routing
value returned the normal login redirect.

The public share surface does not expose creator project mutations or MCP. This
is local Worker evidence of the URL contract; the deployed hostname and actual
friend identity remain separate production/human gates.

The final-source local-loop rerun at `http://127.0.0.1:52200` produced Project
`project_14f78a4c-5046-4872-84b2-aecfef596f52`, Hypothesis
`hypothesis_69cb0c61-5067-46fc-a7de-82e7ac9ea5ab`, Finding
`finding_d928dee0-b397-4768-84ec-cd09a1d72a6d`, Build 1
`build_5df89f73631644fa74b6174c`, Build 2
`build_da421be65d48b6e194a52e67`, Shared Session
`room_6b7efca5-32bd-4c3c-83e2-deab17179131`, and Replay
`replay_f18019d6-efe8-4642-8e23-5c45cda52974`; all eight invariants passed.

An application-browser run on isolated `http://127.0.0.1:8803` opened the
invitation URL for Room `room_e50f521c-21fa-440d-afc1-03b63475bce3`, showed the
copyable URL and no-install friend handoff, claimed seat 0, accepted one action,
and opened Replay `replay_12d2fb98-2ece-48d2-9b5a-3c930c3040a7`. This remains
browser automation evidence, not a real-person session.

The current-source rerun after stale-record isolation passed at
`http://127.0.0.1:56196`, producing Project
`project_135798bf-7ffc-4e71-97d3-96502c6c5549`, Hypothesis
`hypothesis_1770bd9f-a96c-404e-8dc9-16a405fba558`, Finding
`finding_1cef09d7-cee1-4e48-a154-081831f2e7b6`, Build 1
`build_2bcdcb8055ca193cc90c8ccb`, Build 2
`build_fc0e860948d16d48f41a5906`, Shared Session
`room_7eeec59b-1f6f-4d09-9cf4-d46113c68d2e`, and Replay
`replay_5f4efa6c-7dfb-4e27-b844-736e3650ed1d`; all eight invariants passed.

## Stale project isolation — passed locally (2026-08-10)

The local creator service had an old pre-refactor record under the default
development identity. The direct old-project route correctly returned HTTP 410,
but listing projects previously let that record throw `unsupported_project_shape`
and surfaced a generic service error on the creator home. The current list now
keeps valid Rule System projects visible and excludes stale records without
migrating, synthesizing, or deleting them. Worker coverage combines one current
project with one stale record and returns only the current project.

## Local browser evidence — passed

Origin: `http://127.0.0.1:8801` using isolated local Durable Object state.

- Draft project: `project_be28e5f9-fa6c-4a14-b318-edbd6c6e9f91`
- Draft Rule System: `rule_system_3ed795ee-844e-4bfb-b187-8d6aee52a95a`.
  An underspecified prompt landed at the exact `/studio/:projectId` route with
  runtime status `draft`, the full Rule System JSON editor, and no fabricated
  Build.
- Executable project: `project_b7b5b84e-6a38-45bf-b96d-6272b87224be`
- Rule System: `rule_system_7f7788b0-c658-47ca-8caf-d6fef1cef600`,
  `灵感接力`, Play Surface `conversation`
- Build: `build_e94aa34f90b41cd8b9aa2608`
- Shared Session:
  `http://127.0.0.1:8801/room/room_6108386c-b5a1-46c0-8c48-04b1d0ea0afe`
- Session Replay:
  `http://127.0.0.1:8801/replay/replay_ad4c7b53-7689-40df-8a3e-92efd8c8d761`
- Accepted action 1: seat 0, `constraint`, +2.
- Accepted action 2: seat 1, `connect`, +3.
- Reconstructed final state: turn 2, scores `[2, 3, 0]`.
- The Shared Session used conversation-specific presentation and contained no
  gemstone, development-card, noble, or other inherited story UI.
- Browser console: no warnings or errors.

## Final contract-review evidence — passed

- The installable Plugin bundle is versioned with the Rule System contract and
  passes `pnpm verify:plugin`: manifest paths, hosted MCP declaration, local
  Marketplace source, brand asset, eleven Skill entrypoints, and current-vs-stale
  protocol terms are checked without a second compatibility contract.

- Rule Systems now carry first-class, source-aware `constraints`; the Worker,
  MCP bounded view, Web Studio summary, examples, and Skills expose them.
- Prompt generation does not use brand keywords to inject hard-coded rules or
  claim false source anchoring.
- The Codex control plane uses `get_studio_url`, `apply_project_patch`,
  `duplicate_rule_system`, `create_shared_session`, `read_shared_session`, and
  `submit_session_intent`; structured action payloads pass end to end.
- Legacy bare projects and legacy Build shapes return 410 instead of being
  synthesized or migrated.
- Third-party rulebooks and game-specific kernels are not part of the
  distributable Plugin or production assets.

The second session client was an automated local HTTP client, not a person.
This proves authoritative sharing, seat isolation, intent ordering, and Replay
reconstruction. It is not human playtest evidence.

## Finite draw-and-score Kernel — passed locally (2026-08-11)

The prompt-first brief for two players drawing from a shuffled twelve-card deck
now selects `draw-and-score-v1` with values 1–6, two copies each, and a
15-point target. Fixed-seed draws are authoritative and without replacement.
Public Session State exposes only total/remaining counts and the last draw;
future order stays private. Deck exhaustion awards a unique high score and
preserves ties without inventing a winner.

The local MCP loop passed 16 discovered tools and 14 invariants. Worker tests
passed 4 files / 96 tests; frontend tests passed 2 files / 19 tests. A separate
browser Room changed the deck 12→11 and seat 0 score 0→1 after one accessible
draw action, and its Replay restored the same draw. Browser errors were empty.
This is automated local evidence, not a real-person playtest.

## Push-your-luck decision Kernel — passed locally (2026-08-11)

The prompt-first brief now selects `push-your-luck-v1` with D6, bust face 1,
20-point banked target, `roll` / `bank` decisions, and a visible 200-action
safety limit. Safe rolls preserve the active seat and accumulate unbanked
score; busts clear and pass; positive banking transfers the score and passes.

The local MCP loop passed 16 discovered tools and 15 invariants. Worker tests
passed 4 files / 100 tests; frontend tests passed 2 files / 19 tests. Browser
acceptance proved disabled empty banking, bust feedback and turn pass, safe-roll
accumulation, enabled banking, total-score transfer, turn pass, and Replay.
Browser errors were empty. This is automated local evidence, not a real-person
playtest.

## Durable agent activity — passed locally (2026-08-11)

Studio now receives every authoritative Job snapshot while polling and shows
the active operation with its durable state and exact Job ID. If no Job is
active, the newest `succeeded` or `failed` result remains visible. The UI does
not invent progress percentages or phases that are absent from the Worker.

Browser acceptance created Project
`project_67af3075-cc6c-4eec-881a-d8931977283f`, approved its Generation Plan,
and compiled Build `build_d076acfa1a95dcf80dc7f04f`. The persisted activity
row showed compile Job `job_b0018333-11b1-4159-952b-02ad839dacdc` as completed.
The same project then completed bot playtest Job
`job_279c6e9d-a70b-4411-a591-ccac5568b78c`, Playtest
`playtest_6fb62b51-7491-4376-bba9-173dbefd8a1d`, and Replay
`replay_ea086a39-3d97-4cf9-89df-d2e74f46d4e9`. The fixed-seed run ended after
11 turns with seat 1 at 22 points. This is automated local evidence, not a
real-person playtest or public Codex installation.

## Same-seed Build comparison — passed locally (2026-08-11)

Studio now combines the latest two immutable Builds with their same-seed bot
Playtests. It displays each Rule System version, Kernel, turn count, outcome,
final scores, and Replay, plus the turn delta. Different seeds produce no
comparison, and the UI explicitly avoids treating automated metric movement as
proof of improvement.

Browser acceptance used Project
`project_82aa8eb5-dcd9-48b0-8ed0-b81517353bf4`. Rule System v2 Build
`build_fb3e9f161a2a7b6dc41a4b47` reached `10 / 9` after 19 turns with seed 42
and Replay `replay_c6f50310-0c68-4563-a49a-0f222bc5c4e4`. A version-checked
same-project patch changed the score target from 10 to 6. Rule System v3 Build
`build_b68d98d6d48f10b58f32c25a` reached `6 / 5` after 11 turns with the same
seed and Replay `replay_66fbcd3e-3f38-45f1-9b17-4b33131446fa`. Studio showed
both Runs and the turn delta `-8`. This is local automated evidence, not a
real-person playtest or public Codex installation.

## Finding-to-Build lineage — passed locally (2026-08-11)

Finding-driven compilation now requires an explicit persisted causal link. The
Worker rejects a linked compile until the active Rule System is newer than the
Build cited by that Finding, then stores `basedOnFindingId` on both the new
immutable Build and its compile Changeset. Studio renders that exact relation;
it does not infer motivation from timestamps or neighboring versions.

Browser acceptance used Project
`project_a36f45ec-4b4c-4dd3-aa43-2a0fd2ed2b31`. Premature compile Job
`job_2cd6676d-6db6-4e6c-8ddb-cbf2c1a7891c` failed with
`finding_revision_missing`. After a focused revision based on Finding
`finding_9f2243df-ae7e-4c79-8da7-46d6a0da7ccd`, Build
`build_aa30644e2f5e03ae51679cd7` and Changeset
`changeset_5f75d2c9-0e1d-4052-8eca-bafb569f30cf` both retained that ID.

Seed 42 completed in 10 turns on both the old and new Builds; scores changed
from `8 / 5 / 4` to `8 / 7 / 5`. Studio showed both Replays, the Finding's
focused next change, and `回合数变化：无变化`. The Finding anchor navigated to
the authoritative validation record. This is automated local evidence, not a
real-person playtest or public Codex installation.

The full local matrix passed: frontend 2 files / 24 tests, Worker 4 files / 100
tests, typecheck, production build, local routes, the creator loop, Plugin
bundle verification, and deployment dry-run. The MCP control-plane loop passed
16 discovered tools and 16 invariants, including
`mcp-finding-build-lineage`. The separate read-only public Plugin check still
fails exactly with `public plugin version is stale`.

## Generated asset lineage — passed locally (2026-08-11)

GoDesk now stores a natural-language visual direction as a creator-authored
Source and requires every `generative-api` image to point to that exact Source
through `basedOnSourceIds`. A missing same-project brief is rejected with
`source_dependency_not_found`. Compilation includes both the bound image and
its transitive source brief in the immutable Build.

Browser acceptance used Project
`project_973d28a1-e98c-40b6-9801-4f7b373670ac`, visual brief
`source_acceptance_visual_brief`, generated image
`source_acceptance_generated_card`, and Build
`build_448a8550935bc549e1277384`. Studio showed the actual image and its exact
generation basis. The Build passed its Presentation Floor and displayed the
same image in its immutable preview.

Seed 42 bot simulation completed in 5 turns with Playtest
`playtest_23177c92-5082-4c26-aae7-240e1900f710` and Replay
`replay_953db0bf-598c-4547-b98c-005c0670aef9`. Browser self-play in Shared
Session `room_08f424b2-0ce3-4043-8264-b455fd48eb89` then claimed seat 0 and
advanced authoritative shared progress from 0 to 2; Replay
`replay_f0924083-97f2-4738-a473-35cf7f8bcd16` retained the action. This is
local automated and agent-operated evidence, not a real-person playtest or
public Codex installation.

The full local matrix passed: frontend 2 files / 24 tests, Worker 4 files / 102
tests, typecheck, production build, local routes, creator loop, Plugin bundle,
and deployment dry-run. The MCP loop passed 16 discovered tools and 17
invariants, including `mcp-generated-asset-lineage`. The separate read-only
public Plugin check still fails exactly with `public plugin version is stale`.

## Concise Chinese shared-goal generation — passed locally (2026-08-11)

The exact creator brief `三名调查员合作在雾港收集线索。调查行动推进 2 点，整理证词推进 1 点。累计 8 点破解案件，最多 12 回合。`
now materializes directly as an executable `shared-goal-v1` Rule System: three
participants, target 8, maximum 12 turns, and actions `调查 +2` and
`整理证词 +1`. No manual `configure_shared_goal` operation was used.

Fresh isolated acceptance at `http://127.0.0.1:8814` used Project
`project_8f323efd-2922-47cb-a5de-936d1b90e638`, Build
`build_3000fd76ae6d6d525b9c933e`, seed 42 Playtest
`playtest_5d09f881-250f-4d96-8122-86c30457fd63`, and bot Replay
`replay_4decc705-8e2d-474e-b7eb-931b13723289`. The same Build retained its
generated-image and visual-brief Source closure and passed the Presentation
Floor.

Studio showed the 3–3 participant range and exact generated-asset lineage. The
Build preview displayed the bound harbor image. Browser self-play in Shared
Session `room_eeb641ef-d3f8-42f5-93ba-b819e2d924b3` claimed seat 0 and
submitted `调查`; authoritative state advanced from turn 0 / progress 0 to turn
1 / progress 2, and Replay
`replay_6b996486-0afd-403b-88ff-a6a09a5f372e` retained the action. This is
local automated and agent-operated evidence, not a real-person playtest or
public Codex installation.

After the parser repair, the full local matrix passed again: frontend 2 files /
24 tests, Worker 4 files / 102 tests, typecheck, production build, local routes,
the creator loop, 16-tool / 17-invariant MCP loop, 11-Skill Plugin bundle, and
deployment dry-run. The separate read-only public Plugin check still fails
exactly with `public plugin version is stale`.

## Visual Reference / Project Asset separation — passed locally (2026-08-11)

Source Library images now declare `visual-reference` or `project-asset` use.
The home composer defaults uploads to Visual Reference and explains that the
image guides generation without entering the game. A Project Asset may bind to
the Rule System. The Worker rejects a direct Visual Reference binding with
`visual_reference_not_bindable` without changing the project version.

Built-in ImageGen used `godesk-harbor-clue-card-v1.jpg` only as a style and mood
reference to create the distinct
`godesk-harbor-investigation-card-v2.jpg` Project Asset. Fresh isolated
acceptance at `http://127.0.0.1:8814` used Project
`project_5affe4fc-4475-4c34-9d30-d1095d051efa`, reference Source
`source_job_34c556f1-d6f2-47c2-a454-d0bba16b5f60_image_1`, creator brief
`source_acceptance_reference_visual_brief`, generated Project Asset
`source_acceptance_generated_project_asset`, and Build
`build_a09f6450ed1c2631fdca938f`. The Build retained all three IDs in its
transitive provenance closure and passed the Presentation Floor.

Seed 42 Playtest `playtest_dd9e7fc6-d99f-42c9-81bb-85045988e9df` completed the
target with Replay `replay_04732034-0f76-43d0-856f-5a16ca63bc46`. Browser
self-play in Shared Session `room_75123999-eb19-46a4-9d98-4c2e0ba41f7e`
claimed seat 0 and advanced from turn 0 / progress 0 to turn 1 / progress 2;
Replay `replay_ec146440-fb26-403e-b187-744cd25cb0b7` retained the action. Studio
showed both image roles and both generation dependencies; the Build preview
showed only the generated Project Asset. This remains local automated and
agent-operated evidence, not a real-person playtest or public installation.

The full local matrix passed: frontend 2 files / 24 tests, Worker 4 files / 103
tests, typecheck, production build, local routes, creator loop, Plugin bundle,
and deployment dry-run. The MCP control-plane loop passed 16 discovered tools
and 18 invariants, including `mcp-visual-reference-separation`. The separate
read-only public Plugin check still fails exactly with
`public plugin version is stale`.

## Safe historical Build restore — passed locally (2026-08-11)

GoDesk now distinguishes Rule System branches from historical playable
versions. Restoring a version copies the exact immutable Playable Build into a
new active editable Rule System and records `restoredFromBuildId` on both the
Rule System and Changeset. The old Build, Shared Sessions, Replays, and Findings
remain unchanged.

- The Streamable MCP loop exposed 17 tools and passed 19 invariants. Project
  `project_c47d0f62-2cba-40b5-959a-036a3bcccdea` restored Build
  `build_11eeed39a373c7bcd4dd2840` into Rule System
  `rule_system_8997969b-1596-446a-b1d1-22102da64f6b`, then reread the old
  Build and Replay to prove they were unchanged.
- An isolated Studio run restored Build
  `build_fdfa37bab7cc808b9e78eaf1` in Project
  `project_9e08944e-041b-4725-8750-636f94d24f31` into Rule System
  `rule_system_a67e6001-968a-4a56-a6d3-450a284327fb`. The visible pitch
  returned from the deliberately changed text to the exact Build snapshot, and
  Studio showed the source Build under the new `规则分支` list.
- The restored Rule System compiled as new Build
  `build_2d848b81840675cd7d72e6cf`. Seed 42 Playtest
  `playtest_418f0d65-8525-40ad-af9e-0853ae5ba996` completed in 10 turns with
  scores `8 / 5 / 4`; Replay
  `replay_f3cbc936-a454-47ce-9672-d578dee616fe` visibly reconstructed all 10
  accepted actions and retained the bot-simulation disclaimer.

The Plugin now verifies 12 Skills, including `restore-build-version`. This is
local automated and agent-operated evidence, not a real-person playtest, public
deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 2 files / 24 tests, Worker 4 files /
104 tests, typecheck, production build, local routes, creator loop, 17-tool /
19-invariant MCP loop, 12-Skill Plugin bundle, deployment dry-run, and diff
whitespace checks. The read-only public distribution check still fails exactly
with `public plugin version is stale`.

## Hypothesis-bound Shared Session — passed locally (2026-08-11)

GoDesk now snapshots one optional Design Hypothesis into each Shared Session as
an immutable Experiment Brief. The friend-facing Room shows the exact question
and success signal. Participant-feedback and human-session Findings from a
bound Room must use that same hypothesis; exploratory Rooms remain unbound.

The local HTTP creator loop passed 12 invariants and the real Streamable MCP
loop exposed 17 tools and passed 20 invariants, including exact Experiment Brief
snapshot checks. Worker regressions also reject an attempt to record the Room's
feedback against a second hypothesis.

Browser acceptance used Project
`project_62618792-4c86-486c-88b9-40a285359c19`, original hypothesis
`hypothesis_fca42d33-fa26-44e1-84bd-58ed7c4046a7`, Build
`build_e1cc30ae43551531a057a8dd`, and Room
`room_1d0db801-e4ac-4ac1-b895-e79fa3695cf3`. Codex claimed seat 0, chose
`加入约束`, advanced the authoritative state from turn 0 / score 0 to turn 1 /
score 2, and left one five-star feedback observation. A second, newer hypothesis
was then added deliberately. The Room's Studio link still selected the original
hypothesis and saved `participant-feedback` Finding
`finding_0a69076b-3046-4c72-9375-2413bb6fa25f` with the exact feedback snapshot.

The Finding was applied to the same Rule System. Changing the action correctly
invalidated the old runtime and the first bot attempt failed with
`runtime_not_executable`; after explicit Kernel reconfiguration, immutable Build
`build_22a6c8b8f5bc18fd1ee98c9a` completed seed 42 bot Playtest
`playtest_686bb058-a39f-4ddc-906b-2afdcd18c5ea` in 10 turns with scores
`8 / 5 / 4`.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 24 tests, Worker 104 tests, typecheck,
production build, local routes, 12-invariant HTTP creator loop, 17-tool /
20-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.

## Feedback Moment attribution — passed locally (2026-08-11)

Participant feedback now requires an Accepted Action from the same seat and
stores that seat's latest action as a Feedback Moment. The exact
`actionSequence` and `actionId` travel through Shared Session reads, MCP,
Studio, and immutable `participant-feedback` Finding snapshots. The Worker
rejects feedback before an action and rejects altered moments in a Finding.

The HTTP creator loop passed 13 invariants and the real Streamable MCP loop
exposed 17 tools and passed 21 invariants. Browser acceptance used Project
`project_ab9ee4bb-55e4-411b-9586-b0a1b60add36`, Build
`build_bc0776b2672afd0b105b4ac3`, Room
`room_94f4e3dc-713a-4074-bb5f-7c18e3fb1fbf`, and hypothesis
`hypothesis_c0454660-7cbc-4165-94ae-1982fd069990`. Before acting, the Room
showed the feedback gate. After Codex chose `constraint`, both Room and Studio
visibly showed `行动 #1 · 加入约束` beside the five-star observation. Finding
`finding_fb9628a8-d63c-47e0-ba80-90639379f383` retained the exact
`{ actionSequence: 1, actionId: "constraint" }` feedback snapshot, matching the
Room's Accepted Action.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 24 tests, Worker 104 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.

## Authoritative Studio embedded self-play — passed locally (2026-08-11)

Following Tesana's documented Studio pattern of keeping chat/workflow and a
playable preview in one workspace, GoDesk now embeds the latest executable
Build's real Shared Session inside Web Studio. This is not the static Build
preview and not a second runtime: seat claims, Intents, Accepted Actions,
Session State, feedback, and Replay all remain owned by the existing Room.

Browser acceptance used Project
`project_aa9dfc0b-9e92-4fd2-94e3-94e7a2e3e839`, hypothesis
`hypothesis_140bb3cd-5f87-4051-9560-18786de4c748`, Build
`build_76d0c82a2cfc026af7957065`, and embedded Room
`room_0237d05c-fde3-49c0-9bd4-334c188410d5`. Studio stayed on the same URL
while Codex claimed seat 0 and submitted `constraint` as Accepted Action
sequence 1. Session State advanced to turn 1 with scores `2 / 0 / 0`, and
Replay `replay_a69de5dd-8f3e-4ecb-9b67-beab9b72085b` retained the same action
and final state. Feedback `feedback_89007644-82e2-4450-b247-88ab95f6761d`
retained `{ actionSequence: 1, actionId: "constraint" }`. `新开一局` then
selected Room `room_c35c4c9f-857e-4461-85dc-aa66be086e83` in both the Studio
notice and independent invitation link without navigating away.

The Skills contract now directs Creator self-play through the Studio embedded
Shared Session and keeps the independent invitation URL as the complete friend
handoff. The local Plugin version is `0.2.0+codex.20260811`.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 25 tests, Worker 104 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.

## Bounded Studio activity refresh — passed locally (2026-08-11)

Web Studio no longer rereads every project view every two seconds while the
Creator is watching or playing an embedded Room. One Worker `activity` view
returns the Game Project version, persisted Jobs, and reconstructed Shared
Sessions. Studio reads it every five seconds, updates active evidence directly,
and performs a full authoritative reload only after project or Job activity
changes.

Browser acceptance used Project
`project_b0ca290f-8acd-4cd7-9d32-5934c933d8b1`, Build
`build_f40467382ff9a06e9d0c75c0`, Room
`room_e0134934-6dc3-4027-af8e-aa75587722eb`, and Replay
`replay_1d2772c4-8778-4a9a-a6b5-18988fbd03c4`. After twenty seconds of stable
background refresh, Codex claimed seat 0 and submitted `connect` as Accepted
Action sequence 1. Session State and Replay both retained turn 1 and scores
`3 / 0 / 0`.

External Room `room_6755e0ef-ca5d-4f89-8548-a20a7e466220` was then created
through HTTP rather than the open Studio tab. Studio selected it within one
activity interval without navigation, proving that request reduction did not
hide Codex-side or friend-side session changes.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 26 tests, Worker 104 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.

## Authoritative Room WebSocket broadcast — passed locally (2026-08-11)

Room collaboration no longer reads the complete Shared Session once per
second. `/api/sessions/:id/events` upgrades to a Cloudflare Durable Object
Hibernation WebSocket. A connecting browser requests one current persisted
snapshot; successful seat, Intent, and feedback transactions persist first and
then broadcast only to connections whose serialized attachment names that
Room. Game actions remain on the existing authoritative HTTP seam, and there
is no polling fallback or second state owner.

The Worker contract opened two Rooms on the same creator object, verified their
distinct hibernation-safe attachments, and proved that seat and action updates
did not cross Room boundaries. The current Vitest eviction helper did not
return for this stateful object, so forced runtime eviction is not claimed;
normal browser disconnect and reconnect is covered below.

Fresh browser acceptance at `http://127.0.0.1:8829` used Project
`project_b4a1d516-6f3d-4124-995e-9788d026ad31`, Build
`build_be2b681fd380a50bce8d6644`, Room
`room_5b6fa495-1052-421e-9300-7042606a2c62`, and Replay
`replay_3504c62c-965a-480f-a9a6-79bb5e4697e5`. Wrangler recorded one
`101 Switching Protocols` request and one Build read on initial load, followed
by no Session GET polling during the observation window. A separate HTTP
client claimed seat 0 and submitted `connect`; within the next 250 ms browser
observation, the already-open Room showed turn 1, scores `3 / 0 / 0`, and
Accepted Action sequence 1. A full Room reload opened a new socket and restored
the same state. The Replay retained the exact action and final state.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 27 tests, Worker 105 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks. The separate read-only public distribution check still
fails exactly with `public plugin version is stale`.

## Approve, Build, and self-play — passed locally (2026-08-11)

Web Studio now closes the gap between plan review and play. One click confirms
the pending Generation Plan against the current project version and submits the
existing durable compile job. An executable Build that passes the Presentation
Floor continues through one fixed-seed bot Playtest and one embedded Shared
Session. Draft or visually blocked Builds stop after compilation and retain
their unsupported behavior without bot evidence or a Room.

Fresh browser acceptance at `http://127.0.0.1:8830` used executable Project
`project_e6ed45e4-b165-4ed5-ba3a-b69c02aff8f4`. `确认计划并构建版本` created
Build `build_9a9b6784af7b7c393e663b5e`, Playtest
`playtest_aa640270-6fa0-4dbb-8ea7-c370f72b66f8`, and embedded Room
`room_a92cee83-2a7a-49ed-848e-2b1e27ca086b`. Codex then opened the independent
invitation URL, claimed seat 0, and submitted `调查`. Replay
`replay_29843c3b-f191-447e-bbd2-2435eb47374c` preserved Accepted Action
sequence 1, turn 1, and shared progress `2 / 8`.

The negative browser path used Project
`project_e6e36d63-edf2-410a-a78f-63184c54b9f2` generated from
`做一个有趣、漂亮、充满惊喜的游戏。`. Confirmation created Build
`build_1098026a0f394cdfd80b4fbd` with explicit `rule-execution` unsupported and
left the project with zero Playtests and zero Shared Sessions.

This follows the interaction seam documented in Tesana's public Quickstart:
describe, review a plan, approve and build, then play and iterate. GoDesk keeps
its distinct Rule System, immutable Build, authoritative Session, and Replay
model rather than claiming equivalent engine breadth.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 28 tests, Worker 105 tests, typecheck,
production build, local routes, 13-invariant HTTP creator loop, 17-tool /
21-invariant MCP loop, 12-Skill Plugin verification, deployment dry-run, and
diff whitespace checks.

## Stable Playtest Link — passed locally (2026-08-11)

Game Projects now separate private iteration from the friend-facing pointer.
`publish_shared_session` version-checks and pins one explicit Shared Session;
the `playtest-link` view returns a stable `/try/:projectId` URL through both
HTTP and MCP. New Builds and Rooms do not publish themselves.

Fresh browser acceptance used Project
`project_c6284be7-2891-4b66-8f57-807201dabd61`, Build
`build_374c8030a26ed817f21da8a0`, and stable URL
`http://127.0.0.1:8830/try/project_c6284be7-2891-4b66-8f57-807201dabd61?creator=local-creator`.
The first publication resolved to Room
`room_b460d506-cf1c-407c-a16d-80c5d1639b80`. Codex claimed seat 0 and
submitted `constraint`; Replay
`replay_8a19e35d-5472-42c5-97ef-f1b0869ac09a` retained Accepted Action 1 and
scores `[2, 0, 0]`.

Studio then republished fresh Room
`room_8ddc73bb-c937-4c93-bb4f-36393850e18c`. The stable URL remained byte-for-
byte identical, a new visit entered the new zero-action Room, and the original
Room and Replay still exposed their prior action. Browser validation caught a
real deployment seam absent from the in-process tests: Assets intercepted
`/try/*` until that path was added to Worker-first routing.

The local Skills package now directs Codex to publish and verify the stable
link after creation or Finding-driven iteration. This follows Tesana's public
pattern of iterating privately and sharing an intentional version, while
GoDesk retains immutable Builds, Sessions, Replays, and explicit evidence.

This is local automated and agent-operated evidence, not a real-person
playtest, public deployment, or fresh public Plugin installation.

The final local matrix passed: frontend 28 tests, Worker 107 tests, typecheck,
production build, Worker route verification, 14-invariant HTTP creator loop,
17-tool / 22-invariant MCP loop, 12-Skill Plugin verification, deployment
dry-run, and diff whitespace checks.

## Feedback Inbox to Validation Finding — passed locally (2026-08-12)

Web Studio now closes the remaining UI handoff between persisted Shared Session
feedback and the next Validation Finding. The Feedback Inbox shows the exact
rating, comment, seat, action sequence, action label, Experiment Brief, and
Replay link. One action carries the same Design Hypothesis, Playable Build,
`participant-feedback` evidence type, Shared Session, and immutable feedback
snapshot into the Finding form. The Creator supplies the verdict and one
actionable `nextChange`; the UI keeps the evidence boundary visible.

Fresh isolated browser acceptance at `http://127.0.0.1:8830` used Project
`project_365f3945-878d-435d-81c6-fd5365dd704a`, hypothesis
`hypothesis_38941e3d-bb54-4ab3-8749-084ac1a996ce`, Build
`build_aae3859678bfb2c89e2905e3`, and Room
`room_85c4a718-f18c-46f9-9347-3480a4c5ddbe`. The agent claimed seat 0 and
submitted `constraint` as Accepted Action sequence 1. It then saved feedback
`feedback_12da1857-74b2-4b8d-b069-c0a49a15e750` with rating 4 and comment
`目标清楚，但第二个选择还不够有张力。`.

Studio showed `1 条待归纳` and the exact Feedback Moment
`座位 0 · 行动 #1 加入约束`. Clicking `用这局反馈记录结论` selected the same
hypothesis, Build, `participant-feedback`, and Room and prefilled the exact
feedback note. Saving next change `把行动 2 的说明提前，并用相同 seed 重测。`
created Finding `finding_9b97b996-964d-434c-adc7-a696304cc712`, changed the
inbox to `0 条待归纳`, and displayed `参与者反馈（非真人验收）`.

This is local automated and agent-operated evidence, not a real-person
playtest, human attestation, public deployment, or fresh Plugin installation.

The final local matrix passed: frontend 2 files / 30 tests, Worker 4 files /
107 tests, typecheck, production build, Worker route verification, 14-invariant
HTTP creator loop, 17-tool / 22-invariant MCP loop, 12-Skill Plugin
verification, deployment dry-run, and diff whitespace checks. The separate
read-only public distribution check remains an external publication gate.

## Public Plugin distribution — blocked on external publication (2026-08-10)

The local distribution contract passes with `pnpm verify:plugin`, covering
`0.2.0+codex.20260811`, 12 Skills, the hosted MCP declaration, Studio embedded
self-play, and the `participant-feedback` workflow. The
read-only remote check `pnpm verify:plugin:public` intentionally fails because
the separately published [`yuymf/godesk-plugin`](https://github.com/yuymf/godesk-plugin)
repository still exposes the older `0.1.0` tabletop-only bundle. Local source
and public distribution are therefore reported separately.

Local browser acceptance at `http://127.0.0.1:8799/chatgpt-plugin` rendered the
one-sentence install prompt, all five install states (host, Marketplace/Plugin,
OAuth, capability verification, and new-task handoff), and the explicit
failure boundary that reading the page is not installation proof. The copy
button changed to `已复制`; this verifies the local install surface only and
does not claim a Codex Desktop install, OAuth, public reachability, or remote
MCP discovery.

This gate needs an explicitly authorized publication of the current thin
Plugin, then a fresh remote contract check and Codex Desktop install/tool
discovery. No Git or public deployment mutation was performed here.

## Production install and OAuth — ready-for-human

1. Publish the thin `plugins/godesk` bundle and deploy this Worker revision.
2. In a fresh Codex Desktop task, open `/chatgpt-plugin` and follow its install
   sentence.
3. Complete `codex mcp login godesk` through the real Cloudflare Access OTP.
4. Confirm the fresh task discovers the GoDesk Skills and MCP tools, then call
   `list_projects` and create one prompt-only project.
5. Record the public project, Web Studio, Build, Shared Session, and Replay URLs.

Local route verification and dry-run do not satisfy this gate.

Read-only reachability from this host on 2026-08-10 also failed at the TLS
connection with `curl: (35) LibreSSL SSL_ERROR_SYSCALL` for the public
`workers.dev` install page and `/mcp` endpoint. This is a network-path
failure, not evidence that the public Worker or OAuth configuration is
correct or incorrect.

## Real two-person playtest — ready-for-human

1. Creator opens a public Shared Session and claims one seat.
2. A second person opens only the invitation URL in another browser/device,
   claims another seat, and completes at least one accepted action.
3. The friend leaves a rating and short comment from the same invitation URL.
4. Creator and friend play long enough to answer one pre-recorded Design
   Hypothesis, then inspect the Replay together.
5. Creator explicitly attests that both named participants were real people,
   then records a `human-session` Validation Finding with
   `creatorAttested: true` and observation notes.
6. Preserve the public Shared Session, Replay, hypothesis, and finding IDs as the human
   acceptance record.

## Descriptive action iteration keeps the runtime executable — passed locally (2026-08-12)

During a fresh isolated browser loop, Project
`project_2def510c-46ef-4a85-ac5f-a7d067d0714c` received Room feedback
`feedback_0eeaf88b-d00b-48e9-974b-127e9537f2b1`, saved as participant-feedback
Finding `finding_c69216cf-ecc7-46ff-8a7f-7fd0c1aa88aa`. The agent-operated Room
selected seat 0, accepted `constraint` as action 1, and submitted rating 3/5
with comment `说明有用，但行动 2 的重点没有先出现。` Studio's Feedback Inbox
carried the exact Feedback Moment into the Finding, with verdict `证据不足` and
next change `把行动 2 的说明改成“先说明新增约束，再说明获得 2 分”，保留相同
seed 重测。`.

The first focused action-copy revision exposed the broad runtime invalidation
boundary: Playtest Job `job_ad3a3606-fcc3-436b-9f07-2c8260c919d7` stopped with
`runtime_not_executable`. Explicit `score-race-v1` reconfiguration restored the
executable Kernel. Finding-driven Build `build_8fa095e814021453ae25d41f`
(Rule System v3) and a same-project follow-up Build
`build_d11f19f51e1d7ddf5a0255d0` (Rule System v4) both compiled with no
unsupported behavior and completed seed 42 bot Playtests in 10 turns with
scores `8 / 5 / 4`. Studio showed the same-seed comparison, exact Finding
lineage, and Replays `replay_2484fe5a-726c-44a4-be0c-c3bd5f674e8f` and
`replay_a4b40c26-38c8-4b82-8418-f397e26ea7e5`.

This is local automated and agent-operated evidence. The Replay explicitly
labels itself `automated-bot-simulation`; it is not a real-person playtest,
public deployment, or fresh public Plugin installation. The corresponding
runtime boundary is tracked in issue `45-descriptive-action-edits.md`.

## Chinese natural-language action materialization — passed locally (2026-08-14)

An isolated browser run on Worker `127.0.0.1:8830` verified the prompt-first
Generation Plan seam for both explicit and incomplete Chinese scoring
semantics. Project `project_9b7dc922-31da-4c57-9901-9957a3d64c37` used an
unscored prompt with three alternatives. The Plan showed separate actions
`扩展一个已有点子`, `加入一个之后必须遵守的限制`, and `把两个元素连接起来`, kept
the expected result `率先达到 8 分的人获胜，最多 18 回合。`, and selected
`turn-taking-v1` while visibly preserving the unsupported winner/score boundary.

Project `project_91df8e83-60e5-4381-936b-2922b0ff0e4d` used the same three
alternatives with explicit values 1, 2, and 3. The Plan preserved the action
names and descriptions, showed the expected result, and selected
`score-race-v1`. After confirmation, Build
`build_ac8c8f713d360e4903a408b1` was executable. Fixed-seed 42 automated
Playtest `playtest_c6b843f4-0e7b-49c1-9010-408d52418597` completed in 8 turns,
with winner seat 1 and final scores `[4, 8]`, and produced Replay
`replay_70998666-a6a4-4d3a-bffd-5efed00fdb05`. Studio created Shared Session
`room_c602b626-bbbf-4b46-af6f-82f5fd7b1dfe` with Replay
`replay_c0bdf59c-35b8-47d7-b442-bdf1107132ad`.

The focused Worker suite passed 110/110 tests. The full local matrix also
passed frontend tests 30/30, typecheck, production build, local route
verification, the 14-invariant HTTP creator loop, the 17-tool / 22-invariant
MCP loop, local Plugin distribution verification, deployment dry-run, and
whitespace checks.

This is local automated and agent-operated browser evidence. It does not prove
a real-person playtest, public deployment, OAuth installation, or fresh public
Plugin discovery. Those remain the external gates listed in the project docs.

## Same-project natural-language Studio iteration — passed locally (2026-08-14)

The Studio now exposes `下一版聚焦改动` inside the existing Build / Playtest
workflow. A creator can write one explicit action-description rewrite, optionally
select a persisted Validation Finding, and submit it without leaving the same
Game Project. The Worker stores the exact prompt in Source Library, creates a
versioned Rule System patch, and returns the interpreted action and summary in a
durable `iterate-rule-system` Job. Studio then compiles the next immutable Build
and runs fixed-seed `42` bot self-play when the resulting Kernel is executable;
an unsupported request fails without changing the project.

The isolated Worker HTTP acceptance passed the complete vertical slice:
baseline executable Build → natural-language iteration Job → new executable
Rule System → distinct immutable Build → seed `42` automated Playtest. It also
passed the negative boundary: `把胜利目标改成 12 分。` produced
`iteration_unsupported` and left the project version unchanged. The focused MCP
acceptance confirmed the same job is discoverable through `submit_job` and
trackable through `track_job`, so the Web Studio and Codex control plane share
one bounded contract.

This aligns with Tesana's documented describe → build → play → iterate loop and
its one-focused-follow-up/version model, while keeping GoDesk's stronger
provenance and evidence boundary. It is local automated and agent-operated
evidence, not a real-person playtest, public deployment, OAuth installation, or
fresh public Plugin discovery. The latter remain the external gates listed
above.

## Missing Studio project error boundary — passed locally (2026-08-14)

The reported Studio link `project_365f3f08-5a9e-4db6-9085-1c352ab7bddd` is not
in the current `/api/projects` list and returns `404 没有找到这个 Game Project。`.
It was a stale isolated-test link, not a failure to load a current Game Project.

Studio now distinguishes this state from a service failure. A fresh isolated
Worker browser check rendered `这个项目已不存在。` and explained that the link
may come from an isolated test, while a current project link rendered `游戏概览`
and `直接写下一版聚焦改动` with no error heading. The old record was not
recreated, consistent with the current project model's stale-record boundary.
Failed initial loads also stop the five-second activity retry loop; the loop
starts only after the first project load succeeds. The initial authoritative
project lookup now gates the dependent reads, so this stale ID does not fan out
into repeated dependent 404 requests.

The local regression matrix passed: frontend tests 30/30, Worker tests 115/115,
typecheck, production build, local route verification, the HTTP creator loop,
the MCP control-plane loop, Plugin verification, deployment dry-run, and
`git diff --check`. This is local/browser evidence only; public OAuth and real
two-person playtesting remain separate gates.
