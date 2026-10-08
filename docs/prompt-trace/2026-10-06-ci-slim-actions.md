# 2026-10-06 CI 瘦身（ci/slim-actions）

## goal

10 月私有 Actions 分钟额度在 10-06 已经用完，godesk 占 1445/2000，之后的 job 被计费拦截。本刀落实 Actions 审计的 G1–G8，目标是把 godesk 的 Actions 分钟减少约 60–70%，同时保证每个 ready PR 合入前，最终 head 都跑过一次全量 Playwright。

## tool

Grok Bot executor（box），主通道 goal-mode。未使用 Codex，box 上的 Codex 额度已耗尽。

## prompts used

- 2026-10-06 19:15，大主管：只读审计 Actions 分钟消耗。报告放在仓外 `/workspace/godesk-actions-audit/REPORT.md`，不入库。
- 2026-10-06 19:28，大主管批准审计建议，原文摘录："Implement them as PRs; do NOT change repo visibility or billing. CI is still billing-blocked … open them and stop (no merge). When CI recovers the godesk slimming PR merges FIRST, before the G3D batch."
- 具体要求：
  - 实施 G1–G7：三条 workflow 忽略纯文档变更；Lighthouse 只在前端 / Worker 路径变更时跑、不在 push main 时跑、PR 上只采样 1 次；deploy 只做 build 和单元测试；草稿 PR 跑快速子集，ready 或带 `full-e2e` 标签时跑全量 Playwright，并保证合入前至少跑过一次全量 e2e。
  - 保留 cancel-in-progress；G8 浏览器缓存。
  - 检查名保持稳定，或者把改名写进文档。
  - 用 actionlint 校验。
  - 文档随代码同一个 commit、一次 push。

## decisions

- **verify.yml 保持单个 job，检查名仍为 "Tests and Playwright"。**
  - 重步骤（Playwright 安装 / e2e / perf:ci / 产物上传）用 `env.FULL_E2E` 控制，条件是：PR 不是草稿，或者带 `full-e2e` 标签。
  - 快速子集和全量共用一次 install，避免拆成两个 job 后多出的 setup 时间和分钟取整。
- **触发类型加 `labeled`。** 只有 `full-e2e` 标签才跑；其他标签的事件放进独立的 concurrency 分组，job 被跳过，计费 0，也不会取消正在跑的 run。
- **全量 e2e 的保证。** 只要 PR 不是草稿，每次 opened / synchronize / reopened / ready_for_review 都跑全量，所以 ready PR 的最终 head 一定跑过全量。合入条件是 e2e 步骤实际执行且通过，写在 `docs/ci/actions-budget.md`。
- **必需检查。** 私有仓库在 GitHub Free 下无法设置分支保护（API 返回 403），纯文档 PR 没有检查也不会挡合入。
  - **故意不加**同名的 always-pass `docs-only` workflow：带镜像 paths 的同名检查在混合 PR 上也会先报绿，可能误放行。
  - 以后如果启用必需检查，改用 workflow 内的变更检测，文档里已写明。
- **deploy.yml。** verify job 改名为 "Build and unit tests"：它是 push main 时的检查，不是 PR 门。
  - 保留的检查：unit、release records、build、Worker tests、typecheck、verify:plugin。
  - 新增 `workflow_dispatch` 输入 `full_e2e`，需要时可以手动在 main 上补跑 e2e。
  - deploy / release 步骤原样保留，因为 `verify-release-records.mjs` 会读取这些步骤。
- **lighthouse.yml。** 用 `paths` 加 `!**/*.md`；跳过草稿；PR 上 `--collect.numberOfRuns=1`；手动触发默认 3 次。不加 schedule，因为它也会花钱。
- **不做的事。**
  - 不分片：分片会让计费分钟变多。
  - 不合并 Record release job：那会牺牲最小权限。
  - 不改仓库可见性和计费设置。
  - 不合入本 PR：CI 仍处于计费拦截。

## outcomes

- 修改：`.github/workflows/{verify,lighthouse,deploy}.yml`、`AGENTS.md`（CI minutes 一节）、`README.md`、`docs/NIGHTLY-E2E.md`、`docs/G3D-STATUS.md`（阻塞表和变更记录）。
- 新增：`docs/ci/actions-budget.md`，内容包括触发矩阵、合入前全量 e2e 保证、必需检查说明、agent 规则和节省估算。
- 校验：
  - `actionlint` 1.7.12（含 shellcheck 0.11.0）：0 errors。
  - `node scripts/verify-release-records.mjs`：通过。
- 预计月度节省，按冲刺口径：
  - G1 约 870 分钟
  - G2 约 1,370 分钟
  - G3 约 600 分钟
  - G4 约 750 分钟
  - G5 约 900–1,170 分钟
  - G6 加 G7 约 1,250 分钟
  - G8 约 150 分钟
  - 合计约省 godesk 的 60–70%。
- 未完成：CI 被计费拦截，新触发条件还没有在 GitHub 上实际跑过；恢复后先合本 PR。

## links

- PR：见分支 `ci/slim-actions` 对应的 PR
- 审计报告：仓外 `/workspace/godesk-actions-audit/REPORT.md`（不入库）
