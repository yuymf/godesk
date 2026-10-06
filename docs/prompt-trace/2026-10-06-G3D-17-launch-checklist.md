# 2026-10-06 · G3D-17 预备：上线前清单自动化（warning 模式 + 转阻断开关）

| 字段 | 内容 |
| --- | --- |
| goal | 把 G3D-17 发布门里能机器检查的项做成 CI 里的清单：AI 资产法务待审条数、包体预算、Lighthouse LCP / TBT（现为 warn）、分档 draw call、HUD 不露原始动作 id；现在只出 warning，转阻断的开关写进文档 |
| tool | Track C 手写。box Codex 额度耗尽（至 2026-11-05 02:04 Asia/Shanghai），Track C 执行子代理没有 CloudAgent 工具 |
| model / effort | 不适用（未调用 Codex / Cloud Agent） |
| date | 2026-10-06 12:25 起（Asia/Shanghai） |
| actor | Track C |
| branch | `feat/g3d-17-launch-checklist`（worktree `/workspace/godesk-trackC-g3d17`，基于 `origin/main` @ `2c56f22`） |

## prompts used

- 用户 2026-10-06 12:23 指令：G3D-16 预备被 G3D-13（#138，Track B）挡住，改做 G3D-17 不阻塞的预备——上线前清单自动化（CI job / 脚本检查：资产法务 warning 条数、包体预算、LCP / TBT 阈值（现为 warning）、分档 draw call（来自 perf 采集）、HUD 不露原始动作 id），现为 warning，转阻断开关写清楚；不碰 HUD 文件（#138）与资产文件（Track D）。

## decisions

- **一个汇总脚本，数据各取原处。** `scripts/launch-checklist.mjs` 不重复实现已有的门。
  - 法务：调用 `verify-assets --skip-network --json`，读 `summary.aiPendingLegalReview`。
  - 包体：调用 `size-limit --json` 与 `check-size-budgets.mjs`。超限记 fail，余量 < 2% 记 warn。
  - Lighthouse：读 `lighthouserc.json` 里仍为 `"warn"` 级的断言；有 `.lighthouseci/lhr-*.json` 时按 median-run 对照阈值。
  - draw call 与 HUD：读 `perf:ci` 报告。
  - 评估函数都是纯函数，单测在 `scripts/launch-checklist.test.mjs`。
- **perf:ci 只多记录，不多断言。** `runCi` 新增两段，结果写在 `ci-budgets.json` 的 `launchChecklist`，不进 `pass`，现有 CI 门不变。
  - medium / low 分档采样（`?tier=` 强制），与冷启动 high 采样合成 `tierDrawCalls`。
  - HUD 扫描（桌面 1440×900 + iPhone 12 Pro）。
- **HUD 探针必须入座。** 第一版按旁观者扫描，结果是 0，属于假阴性：旁观者看不到合法动作。改为入座 0（开局放置阶段合法动作最多）再扫。席位凭证存在 sessionStorage，第二个视口用 `addInitScript` 带上同一凭证，避免 409 `seat_claimed`。
- **原始 id 规则**（`scripts/perf/hud-raw-ids.mjs`）：
  - 边坐标串 `x:y|x:y`；
  - 顶点键 `x:y`，排除 24 小时制时刻与两边都小于 24 的比分；
  - `action_…` / `room_…` 等内部 id 与 UUID；
  - snake_case 动作类型（`place_road`）。
  - 扫描范围是可见叶子文本加交互元素的 aria-label / title，排除 perf 浮层与 `aria-hidden`。只读 DOM，不改 HUD 文件。
- **开关。**
  - `GODESK_LAUNCH_GATE`：默认 `warn`；设为 `block` 时任一项非 pass（含 `missing`）即失败。
  - `GODESK_LAUNCH_GATE_BLOCK`：逐项转正。
  - 命令行等价写法：`--mode` / `--block`。
  - 两个 workflow 的清单步骤都显式写出这两个 env，G3D-17 改一行即可。
- **不做**：不改 lighthouserc 阈值级别（G3D-17 前优化后再改 error）；不改 HUD（#138）；不改资产 / LICENSES（Track D）。

## outcomes

- 新增：`scripts/launch-checklist.mjs`、`scripts/launch-checklist.test.mjs`（10 条）、`scripts/perf/hud-raw-ids.mjs`、`docs/perf/launch-checklist.md`；`package.json` 加 `launch:check`。
- 修改：`scripts/perf-emulate.mjs`（`launchChecklist` 记录段）；`.github/workflows/verify.yml`（`perf:ci` 后跑清单）；`.github/workflows/lighthouse.yml`（`lhci autorun` 后跑 Lighthouse 项）。
- 本地基线（端口 8833，SwiftShader）：
  - `asset-legal`：warn，68 项。
  - `size-budgets`：warn，size-limit 首页 168.68 / 170 kB。
  - `lighthouse`：warn，3 条断言仍为 warn 级。
  - `draw-calls`：fail，稳态 / 峰值 high 140 / 140、medium 80 / 140、low 80 / 121。
  - `hud-raw-action-ids`：warn，桌面与 iPhone 各 108 处 / 54 种顶点坐标键。
  - 退出码：warn 模式 0；`--mode block` 1；`GODESK_LAUNCH_GATE_BLOCK=asset-legal` 1。
  - `perf:ci` 本身仍 PASS。
- 证据（仓外）：`/workspace/g3d-evidence/G3D-17-prep/`（`perf-results/ci-budgets.json`、`launch-checklist-{warn,block,block-asset-legal}.{md,json}`、`hud-probe-iphone12pro-seat0.png`）。
