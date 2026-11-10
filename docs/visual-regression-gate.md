# G3D-PIXELGATE · 像素回归门

> 上游：`docs/harness/deterministic-harness.md`（父卡 `t_9077dba6`，luffy）。
> 那张卡给了"冻结的、可复现的同一帧"；这张卡把**像素**接上去。

## 为什么需要这道门

`window.__godeskHarness.digest()` 是**结构化状态**，没有像素。所以下面这些坏法
digest 一个字节都不会动，但玩家一眼就能看出坏：

| 失败模式 | digest 能测吗 | 像素门能测吗 |
|---|---|---|
| shader 编译失败 / 静默 fallback 到默认材质 | 不能 | **能**（实测 diffRatio 24.06%） |
| 颜色 / 光照 / 后处理参数改错 | 不能 | **能**（实测 15.72%） |
| 贴图丢失变成紫黑格子 / 回退 | 不能 | **能**（实测 0.81%） |
| 透明排序错乱、z-fighting | 不能 | **能** |
| 改一处无关逻辑（不该变） | 能（digest 变） | **能**（必须是 0，见用例⑤） |

最后一行是关键：像素门必须有"不该变就不变"的反例，否则它只是个
"永远报红"的安慰剂。

## 怎么跑

```bash
# 全量（7 个用例，约 8~10 分钟）
pnpm exec playwright test --config playwright.pixelgate.config.ts

# 只跑基建自证（chief 验收第 1 条）
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "基建自证"

# 只跑某一类失败模式
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "shader 类"
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "不该变类"
pnpm exec playwright test --config playwright.pixelgate.config.ts -g "贴图缺失类"

# 显式更新基线（见 §基线管理，别随手用）
GODESK_UPDATE_BASELINE=1 pnpm exec playwright test --config playwright.pixelgate.config.ts -g "基线门"
```

**必须用 `playwright.pixelgate.config.ts`，不要用共享的 `playwright.config.ts`** ——
原因见下一节。

## 端口必须独占（这是最重要的一条）

共享 `8799` 会伪造"像素 diff 不为 0"，实测过：

```
共享 8799（别的 e2e 同时在跑） → 9 绿 1 假红
独占 8811（连跑 10 轮）        → 10/10 全绿
唯一变量就是端口
```

**机理**：`scripts/e2e-webserver.sh` 第一行就是 `pnpm build`。两个进程抢同一端口时，
先到的那轮会拿到被换掉的 asset hash / 被掐断的 Durable Object 连接 → `SceneHost`
卸载 → `delete window.__godeskHarness`。而共享 config 里
`reuseExistingServer: !process.env.CI` 会让本地**静默复用**别人起的 server，连冲突
都不报。

于是像素门会拍到「harness 被摘掉、场景退回墙钟自由跑」的两帧 → diff 必然不为 0 →
人会误判成"像素门基建不准" → **接着去调阈值掩盖真 bug**。这是最坏的结果。

对策（都在代码里，不是文档约定）：

1. `playwright.pixelgate.config.ts` 用专用端口 `8823`（可用 `GODESK_PIXELGATE_PORT` 覆盖），
   且 `reuseExistingServer: false` —— 宁可多花 40s 构建，绝不跑在别人的产物上。
2. `assertPortExclusive()` 在**每个** capture 前从 OS 层自证：该端口只有一个监听者，
   且它的祖先链里有一层是本仓的 wrangler 且绑定了这个端口。
   为什么走祖先链：真正 `LISTEN` 的是 `workerd`，进程树是
   `workerd --socket-addr=entry=127.0.0.1:8823` → `wrangler-dist/cli.js`（无 `--port`）
   → `wrangler.js dev --port 8823`。只查自己或直接父进程会**误判成"不独占"**（实测踩过）。
3. 拿不到进程信息时返回 `verifiable:false`，用例直接 FAIL —— 不许假装验证过。

## 冻结自证链（顺序是硬的，反了会得出错误结论）

顺序反了的话，diff 不为 0 时你分不清是"harness 没冻干净"还是"阈值不对"。

```
① 端口独占自证                     assertPortExclusive()
② harness 稳定：存在 → 等 3 个 rAF → 复查全局 + dataset.godeskHarness === "1" 仍在
③ freeze() 后断言 isFrozen() === true
④ 连续两次 digestJson() 字节级相同
⑤ 丢弃 WARMUP_FRAMES 帧 warmup
⑥ 以上全过，才 screenshot()
```

第 ② 步不是"存在即通过"：父卡实测有 1/10 概率 harness 在就绪后被 detach 重挂。

第 ⑤ 步的 `WARMUP_FRAMES = 180` 照抄 `src/render3d/perf.ts`（shader compile /
layout / GC 预热）。**实测 frame 0 vs frame 180 差 49.80% 像素** —— 不丢 warmup 的
基线毫无意义。

第 ⑥ 步之后还会再查一次冻结态：异步任务可能在截图期间把 harness 摘掉，
那种情况下抛的错会明说"这是共享端口故障，不是像素回归"。

## 像素比对：为什么选 pixelmatch + pngjs（不选 odiff）

- **odiff** 是原生二进制（Rust + 预编译包 / node-gyp），要给 CI 多一份平台矩阵；
  本项目 e2e 跑在 `wrangler dev` + 本地 Chrome 上，纯 JS 依赖能省掉一次原生编译失败面。
- **pixelmatch** 是 Playwright 官方 `toHaveScreenshot` 底层用的同一个算法
  （YIQ 感知距离 + anti-aliasing 抑制），所以这里的 `diffRatio` 与内建快照语义一致，
  阈值经验可迁移。
- 性能足够：768×448（344,064 px）单次 diff < 20ms。像素门的成本大头是浏览器渲染，
  不是比对。

## 阈值（唯一的可配置项，默认值写死在代码里）

| 参数 | 默认 | 含义 |
|---|---|---|
| `pixelThreshold` | `0.1` | pixelmatch 单像素 YIQ 容差。容忍 GPU 1/255 取整抖动，不放过真实色彩改动 |
| `maxDiffRatio` | `0` | 整帧允许的差异像素占比。**零容忍** |

`maxDiffRatio = 0` 不是理想主义：harness 冻结后实测连拍与跨 context 重跑都是 **0 像素**
（见下节）。所以这里不需要"宽容值"。**任何非零差异都必须先被解释**，再决定是改代码
还是改基线。

要放宽必须显式传参，并在 PR 里单独说明理由。**不许为了让测试变绿而调高。**

## 自证（先证明门是准的，再拿它测别人）

用例① 的实测结果：

| 检查 | 结果 |
|---|---|
| 端口独占 | `exclusive: pid 3075173 (workerd) owns :8823` |
| 就绪稳定性 | 3 个 rAF 后全局与 dataset 标记都还在 |
| `isFrozen()` | `true` |
| 两次 digest | `112e78f6e0afec28…` 字节级相同 |
| warmup | 丢弃 180 帧，`gameTimeMs=3000.00000006` |
| **同冻结帧连拍两次** | **`diffPixels=0/344064`（`diffRatio=0`）** |
| **跨 context 同 seed 重跑** | **`diffPixels=0/344064`** |

两条都是 0，不是"小于阈值"。

## 基线管理

**存哪**：`e2e/visual-baselines/<case>.png`，**入 git**（单独目录）。
和测试代码同仓是故意的 —— 基线变化会出现在 code review 的 diff 里，基线悄悄变了
必须被看到。

**怎么更新**：只有显式 `GODESK_UPDATE_BASELINE=1` 才写盘。
默认情况下**基线缺失 = 用例 FAIL**，不是"自动生成基线然后绿"。这条是为了防止
"第一次跑就自动落基线"变成绕过测试的后门。

**什么情况下允许更新**：

1. 有意的视觉改动（改 shader 参数 / 换贴图 / 调光照），且 **diff 图已人工看过**；
2. 有意的截图口径改动（分辨率 / 机位 / 冻结状态），且 PR 里写明；
3. 上游依赖升级导致的全帧位移（浏览器 / three.js 版本），需给出整帧 diff 证据。

**不允许**：

- 为了让红灯变绿而重跑更新；
- 只更新一部分基线而不解释；
- 用"视觉上看起来差不多"当理由。

更新后必须把 `diffRatio` 的实测值写进 PR 说明 —— "我更新了基线"不是理由。

## 三类失败模式用例（每类都有真实 diff 图与数字）

| 用例 | 注入方式 | 期望 | 实测 |
|---|---|---|---|
| ③ shader 类 | hook `shaderSource`，把真实 GLSL 的 `0.52 + 0.96 * gdP` 改成 `0.05 + 0.10 * gdP` | `diffRatio > 0` | 见下 |
| ④ shader 编译失败 | 同上，注入未定义符号让 `WebGLProgram` 编译失败 | `diffRatio > 0` 且日志有 `Shader Error` | 见下 |
| ⑤ 不该变类 | 只改 `motion.placeMs`（digest 会变，渲染输入不变） | **`diffPixels === 0`** | 见下 |
| ⑥ 贴图缺失类 | `page.route` 让 `sea-normal*.ktx2` 返回 404 | `diffRatio > 0` | 见下 |

**为什么不改源码重建**：三种失败模式如果都靠"改 src 再 `pnpm build`"，一次用例要
40s+ 构建，且无法在同一进程里做 A/B。这里用的是**同一份构建产物**上的确定性注入。
shader 那两种是改**真实 GLSL**（GLSL 就在产物里，`THREE.WebGLProgram` 会真的编译
失败或产出不同像素），不是伪造的假变化。

## 证据落在哪

- 每帧截图 / diff 图 / 并排对照：`pixelgate-evidence/<case>/`
  （`frame.png`、`diff.png`、`*.baseline.png`、`*.actual.png`）
- 整份证据日志：`pixelgate-evidence/evidence.log`
- `test-results/` 是易失目录（`.gitignore` 里），要长期留存请自行拷走。

## 已知边界（别把这道门当万能的）

1. **只测冻结的那一帧**。动画中途的透明排序错乱、只在特定 tween 进度出现的
   z-fighting，需要另加冻结点（`freezeDeterministic({ extraFrames: N })`）。
2. **只测一个种子 / 一个机位 / 一个档位**（`tier=high`，1280×800）。
   要覆盖 medium/low 档或别的机位，得另加用例 —— 不同档位的 shadow map / PBR
   分辨率是不同代码路径。
3. **GPU 相关**：本机跑的是 SwiftShader / 系统 Chrome。换显卡驱动后全帧可能整体位移，
   那时要按 §基线管理 第 3 条处理，并给出整帧 diff 证据。
4. **`pbr` 流式替换在 harness 模式下被跳过**（父卡有意为之：`harnessOn` 时不启动
   PBR 定时器，避免异步状态）。所以这道门**不覆盖 KTX2 PBR 套件替换后的像素**。
   那一层要另做用例（正常模式下等 `data-pbr` 落地再截图）。
