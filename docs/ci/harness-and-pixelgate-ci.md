# 确定性 harness + 像素门接进 Actions（交付报告）

> 卡：`t_57c01185`。前置：`t_9077dba6`（harness 四件套）、`t_9077dba6` 子卡像素门、
> `t_1e1cf982`（harness 假红三修）。
> 本文只写**实测过的东西**；没跑成的部分在 §6 明确写出来。

## 0. 结论

| 项 | 结论 |
|---|---|
| 默认 config 捡走像素门 spec | 已修，`testIgnore` 生效（83→76 tests / 36→35 files） |
| 跨环境差异 | **1634/344064 = 0.4749%**，集中在 (91,44) 346×348 一块区域 |
| 同环境内可复现性 | **0 px**（连拍 / 跨 context / 两次独立进程） |
| 基线策略 | **(b) 环境专属基线 + 零容忍**（`e2e/visual-baselines/<env-key>/`） |
| 阈值守卫 | 贴图 404 = 0.8086%；`maxDiffRatio` 抬到 0.81% 即漏检 —— 已钉成测试 |
| 像素门整套（CI 等价镜像） | **7 passed (9.5m)** |
| harness 3 轮连跑（CI 等价镜像） | **6 passed (1.5m)**，`--retries=0` 无假红 |
| CI 实跑 | **卡在 runner offline**（唯一 runner `box-godesk` 离线），见 §6 |

## 1. spec 归属：默认 suite 不许收像素门 spec

像素门要求独占 `:8823` 并在 spec 内自证 `ownership.portMatches`。默认 `playwright.config.ts`
的 `testDir: "./e2e"` 会把它一起捡走 → 跑在 `:8799` → 自证必红 → `pnpm test:e2e` 整条变红。

实测（把 `testIgnore` 临时清空后跑像素门单条）：

```
✘ ① 基建自证：同冻结状态连拍两次 diff 必须为 0（端口独占 + 冻结自证链） (265ms)
  Error: pixel gate must not share port with other e2e suites (got :8799, want :8823)
```

修法：`playwright.spec-ownership.ts` 作为单一事实来源，默认 config 的 `testIgnore` 与
像素门 config 的 `testMatch` 都从它取；守卫测试用 `playwright test --list` 证明生效。

```
修前：Total: 83 tests in 36 files      （含 visual-regression-gate 7 条）
修后：Total: 76 tests in 35 files      （grep -c visual-regression-gate = 0）
harness-determinism.spec.ts 仍在列表里（2 条）
```

## 2. 跨环境实测（原始输出）

同一份构建、seed `20261111`、冻结帧 768×448、`gameTimeMs=3000.00000006`、
digest `112e78f6e0afec28`（两环境相同 —— 说明**状态是确定的，只有光栅化不同**）。

| 组合 | 原始输出 |
|---|---|
| 本机基线 vs CI 等价环境 | `diffPixels=1634/344064 diffRatio=0.00474912 (0.4749%)` `bbox=(91,44) 346x348` |
| CI 环境内 连拍 | `diffPixels=0/344064 diffRatio=0.00000000` |
| CI 环境内 跨 context | `diffPixels=0/344064 diffRatio=0.00000000` |
| CI 环境内 两次独立进程 | `diffPixels=0/344064 diffRatio=0.00000000`（`-g 基线门` 各跑一次，两次都 0） |
| 本机 自身基线 | `diffPixels=0/344064`（`[baseline-env] key=<dev env> browser=google-chrome/152.0.7977.82`） |

环境定义：

- 本机：Ubuntu 22.04.4 + Google Chrome **152.0.7977.82** + SwiftShader
- CI 等价：`mcr.microsoft.com/playwright:v1.63.0-noble` = Ubuntu 24.04 + Playwright
  chromium **153.0.8010.12** + SwiftShader（`@playwright/test 1.63` 自带的那颗）

## 3. 为什么选 (b)：环境专属基线 + 零容忍

实测把阈值抬起来会怎样（真实证据帧，非构造数据）：

| `maxDiffRatio` | 贴图 404（2782/344064 = **0.8086%**） |
|---|---|
| `0`（默认） | FAIL（抓到） |
| `0.008`（0.80%） | 仍 FAIL（0.8086% > 0.8000%） |
| `0.0081`（0.81%） | **PASS（漏检）** |

任务卡里写的是「≥0.008 会漏检」，实测边界比这更窄一点：真正的失明阈值是 **0.81%**。
而"用一个容差同时吸收跨环境噪声"只剩 `0.8086% − 0.4749% = 0.33pp` 余量。

所以：

- `e2e/visual-baselines/<env-key>/<case>.png`，`env-key = <平台+发行版大版本>-<浏览器>-<浏览器大版本>`
- 由**实际在跑的浏览器**推出（`browser.version()`），不是 `package.json`：
  系统 Chrome 兜底与 Playwright 自带 chromium 是两条渲染栈，混用会拿错基线
- 基线缺失 = 用例 FAIL（报错列出已提交环境 + 生成命令）；**永不自动落基线**
- 生成只在手工 workflow（`visual-baseline.yml`）里，且只上传 artifact 交人 review

### 失败模式与代价（说清楚）

- 换 runner / 换底 / chromium 大版本升级 → 基线"缺失" → 像素门红 → 必须人工跑一次
  `Generate visual baseline (manual)` 并提交 PNG（人工看图）。
- 代价：每次渲染栈变动一次人工确认。
- 换来的：**任何阈值放宽都不可能悄悄发生**（守卫测试会在 `pnpm test` 里红）。

## 4. 守卫测试（`scripts/ci-config-guards.test.mjs`，10 条）

跑在 `pnpm test` 里，零额外 CI 成本：

1. 默认 config `--list` 不含像素门 spec，且**仍含** `harness-determinism.spec.ts`
   （防止有人把 `testIgnore` 写成 `**/*`）
2. 像素门 config `--list` 只收它
3. `e2e/` 下每个 spec 都恰好归一份 config（没有孤儿、没有被两份收）
4. 环境键推导（linux/ubuntu/darwin/override）
5. 每条已提交基线都是 768×448（截图口径不变）
6. 基线缺失 → `action="missing"`；开 `GODESK_UPDATE_BASELINE=1` 才 `write`
7. `DEFAULT_MAX_DIFF_RATIO === 0`、`DEFAULT_PIXEL_THRESHOLD === 0.1`
8. 0 → FAIL；0.008 → FAIL；0.0081 → PASS（漏检）
9. 噪声量级容差（0.004749）只剩 0.33pp 余量

反向对照（实测）：

```
清空 testIgnore               → FAIL: expected [...] to not include 'visual-regression-gate.spec.ts'
DEFAULT_MAX_DIFF_RATIO=0.0081 → FAIL: expected 0.0081 to be +0
两者恢复                      → Tests 10 passed (10)
```

## 5. CI 接入

`verify.yml`：

- `Playwright e2e`：补 `timeout-minutes: 25`
- 新增 `Harness determinism (3 consecutive rounds)`：
  `--repeat-each=3 --retries=0`，`timeout-minutes: 12`。
  `retries=0` 是刻意的 —— 这个 step 就是查假红，retry 会把假红藏起来。
- 新增独立 job `Pixel gate (visual regression)`：只在 PR 带 `full-e2e` label 时跑，
  `timeout-minutes: 30`（step 20），失败时 `if: always()` 上传
  `pixelgate-evidence/` + `test-results/`；第一步在 `GODESK_UPDATE_BASELINE` 非空时 `exit 1`。

`visual-baseline.yml`（新增，`workflow_dispatch`）：唯一允许 `GODESK_UPDATE_BASELINE=1` 的地方，
只产出 artifact，不自动提交。

### 跟随 #187 的适配

变基到 `origin/main` 时发现 CI 现状已变（#187）：`verify`/`deploy` 改用
`[self-hosted, linux, X64, box]`，hosted minutes 被 billing 封，`FULL_E2E` 改为 label-only，
Playwright 不再 `--with-deps`。因此像素门 job：

- 跑在**同一台 box**上（hosted runner 起不来；也不引入 Docker 依赖）
- `if:` 改成 label-only，与 verify job 一致
- 不 `apt install iproute2`，改为 `command -v ss` 自检 + 明确报错（box 的 apt mirror 会 500）
- `setup-node` 去掉 `cache: pnpm`（#187 实测会 Path Validation Error）
- `pnpm exec playwright install chromium`（不带 `--with-deps`）

## 6. 本地实测 / CI 等价命令结果

| 命令 | 结果 |
|---|---|
| `pnpm test` | `Test Files 123 passed (123)`，`Tests 807 passed \| 1 skipped (808)` |
| `pnpm typecheck` | clean（无输出） |
| `pnpm build` | `✓ built in 4.96s` |
| `pnpm size` | 全部 `OK`（homepage 202.10/210KB、render3d core 190.57/200KB、…） |
| 像素门整套（CI 等价镜像） | **`7 passed (9.5m)`** |
| harness 3 轮（CI 等价镜像） | **`6 passed (1.5m)`** |

像素门整套（`mcr.microsoft.com/playwright:v1.63.0-noble`，`CI=1`）：

```
[consecutive-shots]          diffPixels=0/344064      PASS
[cross-context-same-seed]    diffPixels=0/344064      PASS
[baseline-vs-frozen-frame]   diffPixels=0/344064      PASS   ← 环境专属基线生效
[shader-pattern-strength]    diffRatio=0.15720622     FAIL   ← 期望 FAIL（抓到）
[shader-compile-error]       diffRatio=0.57271612     FAIL   ← 期望 FAIL（抓到）
[unrelated-logic-unchanged]  diffPixels=0/344064      PASS   ← 没有误报
[texture-404-sea-normal]     diffRatio=0.00808570     FAIL   ← 期望 FAIL（抓到）
7 passed (9.5m)
```

### CI 实跑：没跑成，卡在哪

- 仓库唯一的 runner `box-godesk` 现在是 **offline**（`gh api repos/yuymf/godesk/actions/runners`
  → `"status":"offline"`；最后一次成功 PR run 是 2026-11-02）。
- 所以本 PR 的 Actions run 只会排队，**拿不到真实 run id**。没有假装跑过。
- 解除需要：`box` runner 上线 → 本 PR 打 `full-e2e` label。
- 首轮预期：像素门以 `no baseline for env <box env-key>` 失败（**设计如此**）→
  跑一次 `Generate visual baseline (manual)`（同一台 box）→ 人工看图 → 提交 PNG → 重跑转绿。
- 另注：`docs/ci/actions-budget.md` 已在 #186（public release scrub）里被删除，
  但 `verify.yml`/`deploy.yml` 的注释仍引用它。本卡没有重建这份文档（属于那次裁剪的决定）。
