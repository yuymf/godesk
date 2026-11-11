# GoDesk 浏览器侧确定性回归四件套（G3D-HARNESS）

> 本地回归能力，**不是部署**。等价 godot-mcp 的 `freeze / step / step_until / digest`，但跑在浏览器里。
> 分支：`feat/deterministic-harness`（**严禁**往 `security/secret-gate` 提交）。

## 一句话命题

**改一处常量 → 自动证明行为按预测量变了**，而不是靠肉眼看截图。
证据：`e2e/harness-determinism.spec.ts` 的第二个用例，改 `motion.placeMs`
280 → 560 → 840，`stepUntil` 到同一条件后 digest 里的 `linearProgress`
按 1 : 1/2 : 1/3 变化（ratio=2.0000），`easedProgress` / 世界坐标 `y` /
`scale` 都与 `Easing.Back.Out` 解析式吻合（容差 1e-3）。

## 怎么开

在任意挂载 `SceneHost` 的页面加查询参数：

```
/chatgpt-plugin/play/<buildId>?harness=1&seed=20261111
```

| 参数 | 含义 |
| --- | --- |
| `harness=1` / `harness=true` | 进入 harness 模式；**只有此时**才 `dynamic import("./harness/api")` 并挂 `window.__godeskHarness` |
| `seed=N` | 模块求值期就装好 mulberry32 流，早于任何纹理/几何生成 |
| `motion.placeMs=560` 等 | 启动期注入 gameplay 常量（等价改源码 `MOTION_MS.place`） |

**正常玩家零开销**：`harness/mode.ts` 是常驻的极小切片（一个布尔分支；
`wallOrHarnessNow()` 在正常模式就是 `performance.now()`）；API 主体只在
`?harness=1` 时懒加载，被打进独立 `g3d-harness-*.js`（不计入 render3d 核心预算）。
不带该参数时 `window.__godeskHarness === undefined`，`document.documentElement.dataset.godeskHarness` 不存在。

## 四件套语义

### 固定 dt 时钟
`SceneHost` 的 `tick(rAF 时间戳)` 被拆成 `frame(now, delta)`：rAF 只负责呈现，
状态推进由 harness 的虚拟时钟驱动。`harness` 模式下 `now` 一律是虚拟时间
（`harnessNowMs()`），`delta` 一律是注入的 `dtMs`（默认 `1000/60`）。
`setDt(ms)` 可改（0 < ms ≤ 1000）。阴影刷新窗口、`MotionController` 的
tween 起点、水体 shader 时间原点都改走同一虚拟时钟 —— 墙钟不再参与。

- **`step({frames:N})` 就是 N × dt**，不是"真实帧数、时长不定"。这是对
  godot-mcp 那个坑的修正（那边 frames 只能靠 `duration_ms` 绕开）。
- `step({durationMs:T})` 量化为 `round(T/dt)` 帧，返回**实际** `elapsedMs = frames × dt`。
- `physicsTicks` 是真正的固定步累加器（60 Hz），与帧数解耦：
  `setDt(25)` + `step({frames:8})` → 200 ms → **12** 个 tick，不是 8。
  GoDesk 没有刚体引擎，这个计数代表固定步模拟 tick。

### 可播种 RNG
`setSeed(n)` / `?seed=n` 装 mulberry32；同 seed 序列逐字节相同。
`randomSequence(n)` 消耗**活流**，`seededSequence(n, count)` 是纯函数（不扰动流）。
`digest().rng.sequenceFingerprint` 是 seed 前 32 个值的 FNV-1a，便于比对。

**接进来的（4 个原 `Math.random` 调用点，全部收敛到 `harnessRandom()`）：**
- `src/render3d/tabletop-objects.ts`（8 处：gravel/sleeper/wood/cloth 高度噪声、pile speckles）
- `src/render3d/audio/engine.ts`（`random` 默认值）
- `src/render3d/audio/cues.ts`（`pickVariantIndex` 默认 random）
- `src/render3d/tide-arena/scene.ts`（相机 shake 抖动）

**故意不接的：**
- `motion.ts#precomputeDiceTumble` —— 已由自己的 `diceSeedRef` 确定性播种，
  必须独立于场景 RNG，否则骰子曲线会被场景消费顺序带偏。
- `terrain-props.ts` / `island.ts` —— 已是逐格 `mulberry32(hash(q,r))`，
  接到全局流会破坏空间稳定性（同一格在不同加载顺序下长相不同）。
- three.js / React 内部、会话 id、`crypto.randomUUID` —— 不在 digest 观察的渲染状态里。
- `tide-arena/scene.ts` 自带 rAF 循环：RNG 接了，但它的**时钟**不在本 harness 的固定 dt 范围内
  （`SceneHost` 管的是 hex 岛 / 桌面路径）。需要它确定性时另开一张卡。

无 seed 时 `harnessRandom()` 就是一个布尔分支后的 `Math.random()`，行为逐字节不变。

### 状态 digest
`digest()` 返回结构化 JSON（key 排序 + 6 位小数归一，`digestJson()` 是它的
`JSON.stringify`）：

- `clock`：mode / dtMs / gameTimeMs / frames / physicsTicks / frozen
- `rng`：seeded / seed / draws / sequenceFingerprint
- `tuning`：已注入的 gameplay 常量
- `scene.objects[]`：id / kind / visible / **世界** position / rotation(Euler) / quaternion / scale
- `animations`：busy / tweens[]（durationMs、elapsedMs、linearProgress、easedProgress、playing）
- `camera`：type / position / quaternion / target / zoom / fov / aspect
- `subsystems`：physics / render / water / dressing / hex / dice / motionLog / dataset

`digest()` 是纯读，不改状态、不读墙钟、不读像素。
**冻结期间连续两次 `JSON.stringify(digest())` 字节级相同**（硬判据），
spec 里同 seed 两个独立 browser context 的 sha256 也相同：
`9225a872d35a084ab25f9fd603dd978b1da80a2cd4371c18831eaaf57de29b0d`。

### step / stepUntil
```js
h.freeze(); h.setSeed(42); h.setDt(1000/60);
h.step({ frames: 8 });            // { elapsedMs, frames, physicsTicks, report: digest }
h.step({ durationMs: 100 });      // 帧数量化，返回实际 elapsedMs
h.stepUntil("d.clock.gameTimeMs >= 400", { timeoutMs: 2000 });
// -> { predicateMet, elapsedMs, frames, physicsTicks, predicate, report }
```
`predicate` 是页面内可求值表达式（`new Function("h","d", ...)`，本仓无 CSP），
`d` 是本次 digest，`h` 是 harness API。`elapsedMs` 是**本次调用**推进的时长，
绝对时间在 `report.clock.gameTimeMs`。超时返回 `predicateMet:false, error:"timeout"`。
`freeze()` 下 rAF 只 re-present 上一帧（给像素门截图用），不推进任何状态。

## 复现命令

```bash
cd /home/halyu/Downloads/Code/godesk
git switch feat/deterministic-harness

# 五件事一把验（约 45 s）
pnpm exec playwright test e2e/harness-determinism.spec.ts --reporter=list

# 关掉 harness 再跑，确认正常路径不受影响（既有 motion spec）
pnpm exec playwright test e2e/hex-settlement-motion.spec.ts -g "reducedMotion=no-preference"

# 条件挂载 grep
grep -rn "window.__godeskHarness" src/

pnpm typecheck && pnpm test && pnpm exec playwright test ... # 见上
node scripts/check-size-budgets.mjs
```

日志会打印：
```
[harness-idempotency] run1=<sha256> run2=<sha256> frozen=<sha256>   // 三者相同
[harness-regression] id=tile:-1,-1 280ms{lp=0.535714, y=0, s=1.096415} ... ratio=2.0000
```

> 本机 Playwright 1.63 期望 chromium r1243，缓存只有 r1208/r1248 + 系统 Chrome 152。
> 新 spec 内置了**仅当 r1243 缺失时**才生效的 `launchOptions.executablePath` 回退
> （spec-local，不影响任何其它 spec）。既有 spec 若也要在这台机跑，需
> `pnpm exec playwright install chromium`，或临时用 `--config` 指系统 Chrome。
> 这是宿主环境问题，与本卡改动无关。

## 端口隔离与并发纪律（别退回硬编码 8799）

`playwright.config.ts` 不再写死 `8799`，而是调用 `scripts/pick-e2e-port.mjs`：
空闲就给熟悉的 **8799**，被占就顺延 **8801 / 8803 / …**（上限 8879）。
`GODESK_E2E_PORT=<port>` 仍然可以显式钉住。

**为什么**：`webServer` 跑的是 `bash scripts/e2e-webserver.sh`，它第一步就是
`pnpm build`，然后直接读磁盘上的 `./dist`。两个 Playwright 进程共用 8799 时，
后来的那个会命中 `reuseExistingServer` **静默接管**前一个的 server —— 于是它可能
在别人的 build 上跑，而那个 build 正被并发 `pnpm build` 重写。本 spec 因此在
10 次里出现过 1 次假红（`__godeskHarness.freeze()` 撞上 undefined）。

`reuseExistingServer` 现在**只在显式钉住端口时**才为 true。自动选端口时，
端口上已有监听者就说明那是别人的 run，绝不接管。

**为什么不是「探测一下端口空不空」**：那是 TOCTOU 竞态 —— 同一毫秒启动的两个进程
都看到 8799 空闲，然后都去抢，实测真的撞上了 `Address already in use`。
所以**选择动作本身**用 `mkdir` 加锁（POSIX 上原子，只有一个进程能建成同名目录），
赢家把端口写进 `.wrangler/e2e-port-locks/<owner-pid>-<port>.lock`，**预留会活到该 run
结束**，于是后启动的 run 即使 wrangler 还没 bind 也能看到这一格已被占。
owner 进程已死或预留超过 60s 会被自动回收，被杀掉的 run 不会把整套测试永久卡死。

同一 run 里配置会被求值多次（主进程 + 每个 worker），所以预留**按 owner pid 复用**，
不会给 worker 分配第二个端口 —— 否则 `baseURL` 会指向没人服务的端口
（实测报错：`net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8801`）。
另外 `execFileSync` 读回端口时要 `FORCE_COLOR=0` 并剥掉 ANSI 转义：
Playwright 的 TS loader 会给子进程 stdout 注入颜色码，`Number("\u001b[33m8811")` 是 `NaN`。

**纪律**：同一个 checkout 优先串行跑。独立端口只解决 server 抢占，两个 run 仍共享
一份 `./dist`，并发 build 依然能换掉对方的 asset（实测：并发跑时后启动的那轮
第 1 个用例 1.2 分钟超时）。要真并行，请用独立 checkout（`git worktree`）。

## 等待就绪的正确姿势（别退回「存在即通过」）

`waitHarnessReady()` 要求 **两个信号同时连续稳定 `HARNESS_STABLE_MS`(250ms)**：
`window.__godeskHarness` 全局 + `documentElement.dataset.godeskHarness === "1"`，
并且必须是**同一个 API 实例**（换实例 = 发生了 detach/re-attach，计时重置）。
随后再跨 2 个 rAF + 一个延迟窗口复查一次。

「现在存在」不足以交给下一个 `evaluate`：poll 与下一次 CDP 往返之间文档可能已经
被拆掉重建，调用方就会读到 `undefined`。这就是本 spec 曾 1/10 假红的形态。

**为什么不在 `harness/api.ts` 里改**：实测过，不需要。给 `attachHarness` / `detach`
埋点后连跑 4 轮，每轮都只有一次 `attach:enter` → `attach:done`，**`detach` 从未被调用**；
另外在页面就绪后从外部触发一次并发 `pnpm build`（workerd `--live-reload` 默认开启），
45 秒采样窗口内全局与文档标记**零变化**、无 `beforeunload`。所以竞态在**测试观测层**，
不在产品运行时 —— 产品代码保持零改动，正常路径零开销。

## 独立可跑（别退回模块级串行依赖）

`previewPath` 曾由第 1 个用例赋值、第 2 个用例断言非空，于是
`-g` / `--grep` / `--only` / IDE 单跑第 2 个用例必然假失败
（`serial dependency: previous test must run first`）。

现在改成按需构建（`ensurePreviewPath(page)`，每个 worker 只付一次约 15s），
并且**每个用例自己 `goto` 后自己 `waitHarnessReady`**。三条命令都必须绿：

```bash
pnpm exec playwright test e2e/harness-determinism.spec.ts                            # 全量 2 passed
pnpm exec playwright test e2e/harness-determinism.spec.ts -g "regression closed loop"  # 单跑第 2 个
pnpm exec playwright test e2e/harness-determinism.spec.ts -g "four-piece"              # 单跑第 1 个
```

## 边界 —— 能不能测 shader / 视觉改动？

**不能。** 这是本卡最重要的诚实结论：

- `digest()` 只有**状态**：坐标、旋转、可见性、动画进度、游戏时钟、子系统计数。
  它不含任何像素、颜色、法线、亮度、gl_FragColor，也没有截图哈希。
- 因此改 GLSL、改水体波形、改 tone mapping、改材质颜色、改阴影软化，
  只要不挪动 Object3D 的 transform / visible，digest **完全不变** → 这套东西会
  误报"行为没变"。
- 它只能测"状态/时序/数值逻辑"类回归：动画曲线、移动速度、播种随机序列、
  dt 语义、放置/移除时序、子系统计数。
- 反过来，它给像素门打了地基：冻结 + 固定 dt + 播种 RNG + 虚拟 shader 时间原点
  （`water/mesh.ts` 的 `t0` 在 harness 下为 0）让**同一状态的截图可比**。
  真正的像素门（基线 PNG / 感知哈希 / 容差阈值）**由 seika 那张卡补**，
  在 `freeze()` + `step()` 到固定帧后截图比对，而不是靠人眼猜。
- 结论一句话：**状态门 = 本卡，像素门 = seika；两者都不能单独证明"视觉没退化"。**

## 交付边界

- 这是**本地回归能力**。禁止 `wrangler deploy` / `publish:plugin:public` / 任何上线动作。
- 未改 `wrangler.jsonc`、未碰 Cloudflare 凭据、未动 `.dev.vars` 里的真实 secret。
- 未放宽任何既有 e2e 断言、未删任何 spec；新增 spec 1 个、单测全绿（797 passed）。
- 新增 `g3d-harness-*.js` 懒加载 chunk 并加了独立 12 KB 预算（不计入 render3d 核心）。
