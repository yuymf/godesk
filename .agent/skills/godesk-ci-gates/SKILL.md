---
name: godesk-ci-gates
description: Use when 改 godesk CI/门禁或在自托管 box runner 上接 e2e。
version: 1.0.0
author: franky
license: MIT
metadata:
  hermes:
    tags: [godesk, ci, github-actions, playwright, self-hosted-runner]
    related_skills: [godesk-pixel-gate, godesk-deterministic-harness]
---

# GoDesk CI 门禁与 spec 归属

正本：`docs/ci/harness-and-pixelgate-ci.md`（221 行，含实跑与失败原始输出）。

## 什么时候用

- 新增/移动 e2e spec、新增一条专用 Playwright config
- 改 `.github/workflows/verify.yml` / `deploy.yml` / `visual-baseline.yml`
- 本地全绿但 CI 红，怀疑「跑到不该跑的环境上」

## 三条硬纪律

1. **一个 spec 只归一份 config**，归属写在 `playwright.spec-ownership.ts`（单一事实来源），默认 config 的 `testIgnore` 与专用 config 的 `testMatch` 都从它取。
2. **接入前先查「收集冲突」**：`pnpm exec playwright test --list` 看默认 config 会不会把专用 spec 也捡走（典型后果：独占端口的 spec 跑在别人的端口上 → 自证断言必红 → 合进 main 后所有人 `test:e2e` 全红，根因只是一行配置）。
3. **守卫必须有正反例**：`scripts/ci-config-guards.test.mjs` 用 `playwright test --list` 证明像素门 spec 没被收集（83→76 tests / 36→35 files），并钉死 `DEFAULT_MAX_DIFF_RATIO === 0`、`DEFAULT_PIXEL_THRESHOLD === 0.1`、`0.0081 → PASS`（漏检）；只加 `testIgnore` 不写测试，下次有人改目录结构就复活。

## Actions 现状（`verify.yml`）

| job | 关键配置 |
| --- | --- |
| `Playwright e2e` | `timeout-minutes: 25` |
| `Harness determinism (3 consecutive rounds)` | `--repeat-each=3 --retries=0`，`timeout-minutes: 12` |
| `Pixel gate (visual regression)` | 独立 job，**只在 PR 带 `full-e2e` label 时跑**，`timeout-minutes: 30`（step 20），失败 `if: always()` 上传 `pixelgate-evidence/` + `test-results/`；第一步 `GODESK_UPDATE_BASELINE` 非空就 `exit 1` |
| `visual-baseline.yml` | `workflow_dispatch`，唯一允许 `GODESK_UPDATE_BASELINE=1` 的地方，只产 artifact，不自动提交 |

## 坑（都在 box runner 上踩过）

1. **hosted Actions minutes 被 billing 封**，CI 全在自托管 `[self-hosted, linux, X64, box]`；`FULL_E2E` 是 **label-only**，draft/ready 不再决定跑不跑。
2. **`retries=0` 是刻意的**：harness job 就是查假红，retry 会把假红藏起来。
3. **box 的 apt mirror 会 500**：不 `apt install iproute2`，改成 `command -v ss` 自检 + 明确安装提示（像素门的端口独占自证要用 `ss`）。
4. **`setup-node` 不要 `cache: pnpm`**：实测 `Path Validation Error`。Playwright 用 `pnpm exec playwright install chromium`，**不带 `--with-deps`**。
5. **基线必须和 CI 同机器生成**：换渲染栈就是 0.4749% 跨环境偏移。首次在新 runner 上跑，像素门会以 `no baseline for env <env-key>` 失败 —— **这是设计好的失败模式，不是 bug**：按报错命令或跑一次 `Generate visual baseline (manual)`，人工看图后提交 PNG。
6. **runner offline 是当前真实约束**：`gh api repos/yuymf/godesk/actions/runners` 查 `status`；job 会 `queued` 而不是 `skipped`（说明 `full-e2e` label 与 `if:` 生效）。runner 不在线时**不要假装跑过**，直接在交付里写明「卡在 runner offline」。
7. **容器里跑默认 suite 有 5 条超时是真·环境问题**，不是回归：`hex-settlement-3d-surfaces`/`room-audio`/`step3-route-wood-chrome`/`tabletop-3d-boards`/`tidewell-hud-polish` 在只有 CPU SwiftShader、无 GPU 无音频设备的容器里时间预算不够（本机同一份 `origin/main` 9 passed / 4.0m）。像素门适合容器（比冻结帧，无时间因素），重 3D 交互用例不适合这样等价验证。

## 本地门禁命令（提交前）

```bash
cd /home/halyu/Downloads/Code/godesk
pnpm typecheck
pnpm test
pnpm build
pnpm size                 # size-limit + scripts/check-size-budgets.mjs
pnpm verify:plugin        # bundle + distribution
pnpm secrets:check        # staged 扫描
```

## 与其他门的关系

- 像素门怎么跑、阈值为什么是 0：`godesk-pixel-gate`
- harness 四件套语义与假红史：`godesk-deterministic-harness`
