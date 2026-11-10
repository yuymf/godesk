# 像素门交付报告（t_27f6e061）

分支 `feat/visual-regression-gate`，HEAD `8aa2340`（父卡 `a346e4a` 是它的祖先）。
未碰 `security/secret-gate`，无部署动作，未改 `wrangler.jsonc` / `.dev.vars`。

## 一、五件交付逐项核销

| # | 要求 | 状态 | 运行态铁证 |
|---|---|---|---|
| 1 | 像素比对基建 `e2e/helpers/visual-diff.ts`，返回 `{diffPixels, diffRatio, diffImagePath}`，阈值可配且写清默认值 | ✅ | `comparePng()` 返回三字段；默认 `pixelThreshold=0.1` / `maxDiffRatio=0` 写死为具名常量并有注释理由；越界值直接抛错 |
| 2 | 确定性截图流程 + 连拍两次 diff 必须为 0 + 丢弃 warmup | ✅ | 连拍 `diffPixels=0/344064`；跨 context 同 seed 也是 `0/344064`；`WARMUP_FRAMES=180` 照抄 `perf.ts` |
| 3 | 基线管理写进文档（存哪/怎么更新/何时允许） | ✅ | `docs/visual-regression-gate.md §基线管理`；代码层强制：无 `GODESK_UPDATE_BASELINE=1` 时基线缺失 = FAIL（已实测拒绝自动创建） |
| 4 | ≥3 个真用例覆盖不同失败模式，每个给真实 diff 图与 diffRatio | ✅ | 4 类（shader 常量 / shader 编译失败 / 不该变反例 / 贴图 404），见 §二 |
| 5 | 分支正确、没往 `security/secret-gate` 提交 | ✅ | `git rev-parse --abbrev-ref HEAD` = `feat/visual-regression-gate`；`security/secret-gate` HEAD 仍是 `be49c36` |

**五件全交，无缺失项。**

## 二、实测数字（连跑两轮完全一致）

`pnpm exec playwright test --config playwright.pixelgate.config.ts` → **7 passed (9.8m)**

| 用例 | diffPixels | diffRatio | 判定 |
|---|---|---|---|
| ① 同冻结帧连拍两次 | **0** / 344064 | 0 | PASS（硬判据：必须 0） |
| ① 跨 context 同 seed 重跑 | **0** / 344064 | 0 | PASS |
| ② 冻结帧 vs 已提交基线 | **0** / 344064 | 0 | PASS |
| ③ shader 改真实 GLSL 常量 | 54090 / 344064 | **0.15720912（15.72%）** | 必须 > 0 ✅ |
| ④ shader 编译失败 | 196918 / 344064 | **0.57232957（57.23%）** | 必须 > 0 ✅ |
| ⑤ 改无关逻辑（不该变） | **0** / 344064 | 0 | PASS（硬判据：必须 0） |
| ⑥ 贴图 404（sea-normal.ktx2） | 2782 / 344064 | **0.00808570（0.81%）** | 必须 > 0 ✅ |

阈值全程未改动：`pixelThreshold=0.1` / `maxDiffRatio=0`，从第一轮到最后一份证据都是这个值。

## 三、diff 图（请直接打开看，不只信数字）

```
pixelgate-evidence/shader-pattern-strength/diff.png    141186 B  15.72%
pixelgate-evidence/shader-compile-error/diff.png       120761 B  57.23%
pixelgate-evidence/texture-404/diff.png                182317 B   0.81%
```

三张 md5 互不相同（`4786e98e…` / `16dd7563…` / `6505d855…`），不是同一张图存三遍。

我逐张看过内容，确认差异落在**该落的地方**：

- **shader 常量**：差异集中在六角地块的**面内**（大面积连续块），不是满屏噪点 —— 符合
  "terrain pattern 的 albedo 混合式被改"的预期。bbox `x=66 y=55 w=655 h=352`。
- **shader 编译失败**：整帧几乎全变（57%），实际渲染成**空白底色**（只剩左下角缩放 UI）。
  这就是"静默 fallback"最严重形态：场景没崩、无 pageError，但画面全没了。
- **贴图 404**：差异在**四角/边缘**（水面区域，岛在中央），中心棋盘几乎不变 ——
  符合"水面法线贴图缺失"。看图确认：404 帧的水面**平坦无波纹**，基线有波纹。

## 四、连拍为 0 是硬判据，不是"小于阈值"

`expect(selfProof.diffPixels).toBe(0)`，不是 `toBeLessThan(阈值)`。
不为 0 时抛的错会明说"回去找 harness 拥有者，别调阈值"。

## 五、chief 两条前置情报都已落成代码门禁

**① 端口独占（chief 实测：共享 8799 → 9绿1假红；独占 8811 → 10/10）**

我没有沿用 8799，另起 `playwright.pixelgate.config.ts`：

- 专用端口 `8823`，`reuseExistingServer: false`（永不复用别人构建的产物）
- `assertPortExclusive()` 每次 capture 前从 OS 层自证，实测输出：
  `exclusive: pid 3097572 (workerd serve --binary --experimental --) owns :8823`

踩到的坑（已修）：真正 `LISTEN` 的是 `workerd` 子进程，它的 argv 是
`--socket-addr=entry=127.0.0.1:8823`，而 `--port 8823` 在**祖父进程** `wrangler.js dev` 上。
最初只查 `--port` → 把"确实独占"误判成"不独占"；改成向上遍历祖先链（≤5 层）后正确。

**② 冻结自证链（顺序不许换）**

```
① 端口独占自证
② harness 稳定：存在 → 等 3 个 rAF → 复查全局 + dataset.godeskHarness === "1" 仍在
③ freeze() 后断言 isFrozen() === true
④ 连续两次 digestJson() 字节级相同（实测 sha256 112e78f6e0afec28… 两次相等）
⑤ 丢弃 WARMUP_FRAMES=180 帧
⑥ 以上全过才 screenshot()
```

第 ⑥ 步之后**再查一次**冻结态：截图期间 harness 若被摘掉，抛的错会明说
"这是共享端口故障，不是像素回归"。

## 六、我自己发现的三个真缺陷（都已修）

1. **warmup 不是可选项**：frame 0 vs frame 180 差 **49.80%** 像素。不丢 warmup 的基线毫无意义。
2. **`diffBounds` 在 0 差异时报了整帧 bbox**：pixelmatch 默认模式会把未变化像素也写成带 alpha 的
   暗淡副本，于是"0 像素差异"算出一个整帧假边界。改用 `diffMask: true` 后正确返回 `null`。
3. **证据写进 `test-results/` 会被下次运行清空**：报告里的 diff 图路径变成死链。
   改落 `pixelgate-evidence/`（命中 `.gitignore` 的 `*-evidence/`，不入 git 但留存）。

## 七、边界（如实写，不埋雷）

1. **只测冻结的那一帧**。动画中途的透明排序错乱 / 只在特定 tween 进度出现的 z-fighting
   需要另加冻结点（`freezeDeterministic({extraFrames: N})`）。
2. **只测一个种子 / 一个机位 / 一个档位**（`tier=high`，1280×800，canvas 768×448）。
   medium/low 的 shadow map 与 PBR 分辨率是不同代码路径，要另加用例。
3. **harness 模式跳过 PBR 流式替换**（父卡有意为之，避免异步状态），所以这道门
   **不覆盖 KTX2 PBR 套件替换后的像素**。那一层需在正常模式下等 `data-pbr` 落地再截图。
4. **GPU 相关**：本机是 SwiftShader / 系统 Chrome。换驱动后可能全帧整体位移，
   按文档 §基线管理 第 3 条处理并给整帧 diff 证据。
5. 浏览器二进制用 spec-local fallback（只在 r1243 缺失时启用），**未动共享
   `playwright.config.ts`**，与父卡同一模式。

## 八、怎么跑（chief 验收用）

```bash
cd /home/halyu/Downloads/Code/godesk
git switch feat/visual-regression-gate

# 验收第 1 条：连拍两次必须 0
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "基建自证"

# 验收第 2 条：shader 变 / 无关逻辑不变
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "shader 类"
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "不该变类"

# 全量 7 用例（约 10 分钟）
pnpm exec playwright test --config playwright.pixelgate.config.ts
```

**必须用 `playwright.pixelgate.config.ts`**（专用端口 8823 + 不复用 server）。
用共享 config 会退回 8799，那正是假红的来源。

## 九、环境提示

跑之前请确认 8823 上没有残留 wrangler（我收尾时已清空，`8823=000`）。
`8811` 是 luffy 父卡修复卡 `t_1e1cf982` 的 server，我全程没碰。
