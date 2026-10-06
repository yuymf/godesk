# G3D-04c：Room 内核状态增量化（Track A）

## 目标
修复后盘变慢：Room DO 每次落子都把整条行动日志交给 Executable Kernel 重放。改为在内存中缓存当前 Kernel 状态，再每 N 手持久化一个快照；落子只应用新的这一手，DO 重启时用最新快照 + 尾部重建。Kernel 仍是唯一权威。

## 工具
- 手写实现（box 上 Codex 用量已到上限，约 2026-11-05 恢复）。
- vitest-pool-workers（Worker 测试、延迟基准）、Playwright（端口 8811）、gh。

## 使用的提示词（来自调度方）
> Next knife on Track A (port 8811, fresh worktree off origin/main): fix the late-game slowdown you found — every move replays the full log. Implement incremental kernel state in the Room Durable Object: keep the current kernel state cached in memory and persist periodic snapshots (e.g. every N actions) so a move applies only the new action, and DO restart rebuilds from the latest snapshot + tail. The Executable Kernel stays the sole authority — add a test that snapshot+tail replay equals full replay (state hash) over a full ~865-action seeded game, and a test for DO restart mid-game. Measure per-move latency early vs late game before/after (report numbers). Restore the worker full-game test to the full-length seed if it now fits CI time.

> Decisions (mine, no user question needed): keep Studio auto-opened rooms human-vs-human by default; the lobby '和电脑对战' button is the AI entry point. Record this in STATUS.

## 决定
- **N = 50**（`SESSION_SNAPSHOT_EVERY`）。快照 `session-snapshot:<id>` = `{count, lastIntentId, state}`，和触发它的那一手写在同一个存储事务里。
- **存储格式不变**：会话 / 回放仍存 slim 日志，快照是新增键。没有快照的老房间先全量重放一次，从下一个 50 的整数倍起开始写快照。
- **缓存校验**：内存缓存（LRU 16）只有在日志长度、最后一个 intentId、buildId、seed 全部一致时才使用；快照对不上日志就退回全量重放。所以事务回滚、或者其他路径改写了日志，都不会读到陈旧状态。
- **只对三个 Kernel 启用**（hex-settlement / disc-flipping / network-route）：这三个的 Room 输出里每手的 per-action state 本来就是 slim，客户端也不读。其余 Kernel 保持原有全量路径，因为客户端会读它们每手的 state。
- Studio 自动开的房间默认保持人对人；大厅「和电脑对战」是 AI 入口（调度方决定，已记入 STATUS）。
- **内存缓存只缓存快照 Kernel 的房间**（`09064ab`）：其他 Kernel 的日志每手都带完整 state，在一个 DO 里缓存 16 个这样的房间会撑爆 isolate 内存。本机 e2e 曾 3 次在 charter 港口十三号用例附近断开，wrangler 日志为「Network connection lost」；改完后 e2e 全过。
- 基准文件（`_bench-latency.test.ts`）不提交，放在 `/workspace/g3d-evidence/g3d-04c/`。

## 结果
每步意图延迟（Worker 测试运行时，种子 42 共 865 手；先注入前 k 手的日志，再连走 10 手。first = 冷启动，warm = 后 9 手）：

| k（已有手数） | main `8b33099` first / warm 均值 / 重启后 | G3D-04c first / warm 均值 / 重启后 |
| --- | --- | --- |
| 0 | 8 / 8.9 / 8 ms | 8 / 5.8 / 9 ms |
| 390 | 45 / 36.9 / 36 ms | 23 / 10.0 / 12 ms |
| 790 | 3568 / 4114 / 4481 ms | 3874* / 112.7 / 106 ms |

\* 注入的日志不带快照（模拟老房间），所以第一次是一次性全量重放；此后走缓存或快照。「重启后」是逐出 DO 后的第一手，由第 400 / 800 手的快照 + 尾部重建。

后盘剩余约 110 ms 的来源：每手要把整条 slim 日志写三次（session、replay、project record），再加上后盘 Kernel 单步本身的成本。这和存储格式有关，可以作为后续一刀（日志分块存储）。

测试：`worker/room-snapshot.test.ts`（状态哈希对比 + 中途 3 次 DO 重启）；`worker/room-ai-seat.test.ts` 整局测试恢复为种子 42（本机 56 s）。

## 合入状态
- 本机门禁（head `09064ab`，已合入 main 的 #139 / #142，并含缓存范围修复）：typecheck 0；unit 430 passed；worker 212 passed；e2e（端口 8811）56 passed / 4 skipped（10.7m）。
- 在 `09064ab` 上复测延迟：k=0 warm 8.2 ms；k=390 warm 11.1 ms；k=790 warm 105.4 ms，重启后 161 ms。
- CI：`1c65f4d` 时 Tests and Playwright（run 37411963017）与 Lighthouse（run 37411963086）全绿。合入 main 之后的 head 上 CI 没有启动：GitHub Actions 账户付费失败 / 支出上限（约 12:54 起全仓库都失败）。按规则，CI 恢复变绿后再 squash 合入；不使用任何绕过手段。

## 链接
- PR [#141](https://github.com/yuymf/godesk/pull/141)
- 证据：`/workspace/g3d-evidence/g3d-04c/`（`bench-before.log`、`bench-after.log`、门禁日志）
