# 2026-10-06 · G3D-04b Room AI 座位（服务器端电脑对手）

## goal

用户更正：SPEC M1 出口原文是「六角岛 Room 在 3D 中与 AI 打完一整局」，G3D-16 也预设「hex-settlement-v1 + AI 座位」。此前 M1 证据用第二个浏览器脚本驱动座位 1，并不满足出口，M1 实际未达成。
本刀：Room 座位可标为 AI（大厅 / 创建选项）；worker 在服务器端驱动该座位，复用 `runBotSimulation` 的 Catan bot；只走 Executable Kernel（`acceptIntent`）这个唯一权威；有短暂「思考」延迟，让 G3D-09 动效看得见；覆盖弃牌 / 强盗 / 交易阶段；重连与 DO 重启都不重复落子；对所有 hex-settlement-v1 变体通用，不另造引擎。
完成后用真 AI 座位（只开一个浏览器）重跑 M1 出口。

## tool

- 主通道：Track A 人工编码。box Codex 用量上限约到 2026-11-05，未使用；本刀规模 M，没有起 Cursor Cloud Agent。
- 审查：人工 diff，加 `pnpm typecheck` / `pnpm test` / `pnpm test:worker` / `pnpm test:e2e`（`GODESK_E2E_PORT=8811`）门禁。

## prompts used

- 用户指令（摘录）：「New knife for you: G3D-04b 'Room AI seat' … drive that seat server-side using the existing Catan bot logic (the one in runBotSimulation) — legal actions only, through the Executable Kernel as the sole authority, with a small think delay … resilient to reconnects and DO restarts (no double-moves) … don't build a parallel engine.」
- 没有额外的生成式提示词。

## decisions

- **共用选手，不另造引擎**：从 `runBotSimulation` 抽出 `pickBotIntent(state, runtime, seed)`，同时供 `runBotSimulation` 和 Room AI 使用。`runtimeSupportsBotSeat(runtime)` 目前为 `hex-settlement-v1`，所以凡是绑定该内核的规则系统都自动获得 AI 座位。落子只经 `acceptIntent`。
- **阶段覆盖**：弃牌 / 强盗阶段由内核把 `activeSeat` 切到需要行动的座位，因此「`activeSeat` ∈ `aiSeats` 时出手」已覆盖这两个阶段。`player_trade` 在 v1 内核里是即时 1:1 交换，没有报价 / 接受步骤，所以不存在「拒绝交易」阶段；AI 不会被动卷入挂起的报价。
- **调度 = DO alarm**：`ai-turn:<sessionId>` = `{expectedActions, dueAt}`，与「让 AI 轮到」的那次落子写在同一个 storage 事务里。AI 步骤在事务内重新校验：状态为 active、该座位是 AI、`acceptedActions.length === expectedActions`；intentId 固定为 `ai_<sequence>`；pending 记录与 AI 落子同事务删除或改写。因此 DO 重启、重复 alarm、重连都不会重复落子。
- **alarm 合并**：原来任务恢复直接 `setAlarm(now+30s)` / `deleteAlarm()`，会覆盖或删掉 AI 的 alarm。现改为把 `alarm:job-recovery-at` 写入 storage，`rescheduleAlarm()` 取「任务恢复时间」与「所有 AI 待办 dueAt」的最小值。alarm 先跑到期的 AI 回合；任务只在恢复时间到期时跑（30 s 宽限不变；没有记录时按旧逻辑直接跑）。
- **重连自愈**：WebSocket `session.sync` 时调用 `ensureAiTurnScheduled`，补回缺失的 pending 或 alarm（幂等）。
- **思考延迟**：默认 900 ms，可在创建时传 `aiThinkMs`（0–5000），测试用 0 或 5000。另设一个保险：AI 连续 200 手后强制 `end_turn`；找不到合法手时停住该座位并记日志，不让 alarm 空转。
- **API / UI**：`POST /builds/:id/sessions` 新增 `aiSeats`（必须至少留 1 个真人座位）和 `aiThinkMs`；内核不支持时返回 422 `ai_seat_unsupported`。认领 AI 座位、或以 AI 座位提交意图，都返回 409 `seat_is_ai`。大厅中可电脑对战的卡片增加「和电脑对战」，电脑坐最后一席、真人先手。席位栏和下拉框把该席标为「电脑」并禁用；HUD 显示「电脑思考中 · 座位 N」；「等待对手」横幅把 AI 席计为已入座。
- **默认示例的 AI 席（有偏差，需用户确认）**：三个内置默认示例（港口十三号 / 雾岭山庄 / 灵感接力）都不是 hex-settlement，没有可用的 bot。Studio 自动开的房间仍保持真人对真人，因为现有 6 个双浏览器 e2e（motion / touch / 3d-surfaces / nl-catan-share / room-audio / dual-genre）依赖座位 1 是真人。「与电脑对战」的入口是大厅一键按钮。要不要把 Studio 自动房间默认改成 AI，请用户拍板。
- **已知性能边界**：意图路由每次都从精简日志 `reconstructSession` 重放整局；局面后期还有最长道路计算，单手耗时会随局长上升（seed 42 的 bot 对局约 865 手）。worker 全局测试选 seed 7（约 420 手）以保持 CI 快。增量快照另开任务，不在本刀范围。

## outcomes

- 代码：
  - `worker/room-ai.ts`（新增）
  - `worker/runtime.ts`：新增 `pickBotIntent` / `runtimeSupportsBotSeat`；`runBotSimulation` 的六角分支改为调用它
  - `worker/creator-projects-do.ts`：`persistAcceptedAction`、`rescheduleAlarm`、`requestJobRecoveryAlarm`、`ensureAiTurnScheduled`、`runAiTurn`；alarm 合并
  - `worker/job-runner.ts`：可选的 `requestJobRecoveryAlarm`
  - 前端：`GameLobby`「和电脑对战」、`RoomView` 席位「电脑」、`HexSettlementBoard`「电脑思考中」、`project-api` / `project-contract` 的 `aiSeats` / `aiThinkMs`
  - `playwright.config.ts`：`@slow` 只在设置 `GODESK_E2E_SLOW=1` 时运行
- 测试：
  - `worker/room-ai-seat.test.ts` 4 例：参数校验；AI 席认领 / 意图被拒；setup 两回合在 DO 驱逐后经 alarm 只走一次，重复或过期 alarm 不重复落子；真实 alarm 全局到终局，日志与 `runBotSimulation(seed 7)` 完全相同
  - `e2e/room-ai-seat.spec.ts`：默认 CI 跑 1 例（AI 完成 setup 两回合，intentId 为 `ai_<seq>`）；`@slow` 2 例（单浏览器整局，桌面和 iPhone 12 Pro）
- 真 AI 整局（分支，单浏览器，seed 42）：
  - EP-D 1440×900 鼠标：8.9m，共 683 手（人 342 / AI 341）
  - EP-I 390×844 触摸：8.4m，同样 683 手
  - 两局都由座位 0 获胜（10:9）
  - AI 动作覆盖 roll / build / bank_trade / player_trade / buy_dev / play_knight / move_robber / discard / end_turn
  - 首次运行证据在 `/workspace/g3d-evidence/M1-ai/pr-branch/`
- M1 出口复跑（PR head `48646eb`，已含 G3D-07）：3 passed / 27.0m
  - EP-D 13.7m，EP-I 12.9m，均为 683 手
  - 证据在 `/workspace/g3d-evidence/M1-ai/`
- CI 修复：G3D-09 的 motion spec 原用墙钟上限，SwiftShader + G3D-07 下失稳（main 本地也失败）。改为在页面内点击，并断言点击时 tween Group 仍在运行（`__g3dMotionBusy`）。
- 合入前最后一轮本地（`2bdcfae`）：typecheck 0、unit 420、worker 210、e2e 54 passed / 4 skipped；CI run 37407433885 绿。

## links

- PR #132 https://github.com/yuymf/godesk/pull/132 · squash `0c4ac5a` · CI https://github.com/yuymf/godesk/actions/runs/37407433885
- Notion G3D-04b 任务卡
