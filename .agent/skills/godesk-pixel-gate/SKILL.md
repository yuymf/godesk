---
name: godesk-pixel-gate
description: Use when 改 shader/光照/贴图或跑像素回归门。先证门是准的，再测别人。
version: 1.0.0
author: franky
license: MIT
metadata:
  hermes:
    tags: [godesk, visual-regression, pixelgate, playwright, baseline]
    related_skills: [godesk-deterministic-harness, godesk-ci-gates]
---

# GoDesk 像素门（G3D-PIXELGATE）

正本：`docs/visual-regression-gate.md`（258 行，含每条实测数字与证据路径）。本文件是入口与坑清单。

## 什么时候用

- 改 GLSL / 光照 / 后处理 / 贴图 / 材质，需要证明「视觉没有意外变化」
- 改像素门本身（阈值、基线、冻结口径）—— 改之前先把本文 §自证链 读一遍
- `digest()` 全绿但你怀疑画面坏了：digest 不含像素，见 `godesk-deterministic-harness`

## 跑法（必须用专用 config）

```bash
cd /home/halyu/Downloads/Code/godesk

# 全量 7 个用例，约 8~10 分钟
pnpm exec playwright test --config playwright.pixelgate.config.ts

# 只跑基建自证（证明门是准的）
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "基建自证"

# 按失败模式挑：shader 类 / 不该变类 / 贴图缺失类
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "贴图缺失类"
```

**不要用 `playwright.config.ts`**：默认 config 的 `testDir: ./e2e` 会把这个 spec 一起捡走，跑在别的端口上，`assertPortExclusive()` 必红，整条 `pnpm test:e2e` 变红。归属由 `playwright.spec-ownership.ts` 单一事实来源管，守卫测试 `scripts/ci-config-guards.test.mjs` 证明它没被收集（83→76 tests / 36→35 files）。

## 坑

1. **端口共享会伪造「有像素差异」**。共享 8799 实测 9 绿 1 假红；独占 8823 连跑 10 轮 10/10 绿。机理：`scripts/e2e-webserver.sh` 第一步 `pnpm build`，两个进程抢端口时先到的那轮拿到被换掉的 asset hash / 被掐断的 DO 连接 → `SceneHost` 卸载 → `delete window.__godeskHarness` → 拍到两帧「场景退回墙钟自由跑」。所以 config 钉 `8823`（`GODESK_PIXELGATE_PORT` 可覆盖）+ `reuseExistingServer: false`，宁可多花 40s 构建。
2. **端口自证要查祖先链，不是父进程**。真正 `LISTEN` 的是 `workerd`，链是 `workerd --socket-addr=...:8823` → `wrangler-dist/cli.js`（无 `--port`）→ `wrangler.js dev --port 8823`。只查自己或直接父进程会误判「不独占」。拿不到进程信息时 `verifiable:false` → 用例 FAIL，不许假装验证过。job 里 `ss` 缺了要明确报错（box 的 apt mirror 会 500，不 apt install）。
3. **warmup 不能省**。`WARMUP_FRAMES = 180`（照抄 `src/render3d/perf.ts`）：实测 frame 0 vs frame 180 差 **49.80%** 像素，不丢 warmup 的基线毫无意义。
4. **自证链顺序是硬的**：① 端口独占 → ② harness 稳定（存在 + 等 3 个 rAF 后全局与 `dataset.godeskHarness==="1"` 仍在）→ ③ `isFrozen()` → ④ 连续两次 `digestJson()` 字节级相同 → ⑤ 丢 180 帧 warmup → ⑥ 才 `screenshot()`。② 不是「存在即通过」：实测 1/10 概率 harness 就绪后被 detach 重挂。顺序反了，diff≠0 时分不清是「没冻干净」还是「阈值不对」。
5. **阈值不要抬**。`pixelThreshold 0.1`（容忍 GPU 1/255 取整）、`maxDiffRatio 0`（零容忍）。同环境实测连拍/跨 context/两次独立进程都是 **0/344064**，所以不需要宽容值。抬到 0.81% 就漏掉贴图 404（实测 0.8086%）——这条已钉成测试。
6. **基线是环境绑定的，别跨环境比**。同构建同 seed `20261111` 同冻结帧，CI 镜像 vs 本机差 **1634/344064 = 0.4749%**，集中在 `(91,44)` 346×348 一块（平涂面法线插值/抗锯齿精度）。正解是每渲染栈一条自己的基线 + 仍然零容忍，不是抬阈值。`<env-key>` = `<平台+发行版>-<浏览器>-<大版本>`，浏览器版本取 `browser.version()` 不是 `package.json`；升级 `@playwright/test` 要和基线目录名一起改。
7. **更新基线只有一个合法入口**：`.github/workflows/visual-baseline.yml`（`workflow_dispatch`，只产 artifact，人工看图后手工提交）。默认基线缺失 = FAIL，不自动生成（防「第一次跑就落基线」变成后门）；`verify.yml` 的 pixelgate job 在 `GODESK_UPDATE_BASELINE` 非空时直接 `exit 1`。更新后必须把 `diffRatio` 实测值写进 PR。
8. **失败模式用同一份构建产物做确定性注入**，不要「改 src 再 build」：改 src 每例 40s+ 且无法同进程 A/B。shader 两例 hook 真实 GLSL（`THREE.WebGLProgram` 真的编译失败/产出不同像素），贴图例用 `page.route` 让 `sea-normal*.ktx2` 返回 404。

## 证据

`pixelgate-evidence/<case>/{frame.png,diff.png,*.baseline.png,*.actual.png}` + `evidence.log`；`test-results/` 是易失目录（.gitignore），要留存自己拷走。CI 失败时 `if: always()` 上传这两处，不用重跑就能看哪里变了。

## 边界（别当万能的）

- 只测**冻结的那一帧**：动画中途的透明排序错乱 / 特定 tween 进度的 z-fighting 需另加冻结点（`freezeDeterministic({ extraFrames: N })`）。
- 只测**一个种子 / 一个机位 / `tier=high` 1280×800**：medium/low 档是不同代码路径（shadow map / PBR 分辨率不同）。
- harness 模式下 **pbr 流式替换被跳过**（不启动 PBR 定时器），所以不覆盖 KTX2 PBR 替换后的像素。
- 换显卡驱动可能整帧位移 → 按 §基线管理 处理并给整帧 diff 证据。
