# GoDesk 3D 程序状态（G3D）

任何人打开本仓库即可从本文件判断当前进度。每次里程碑结束或相关 PR 合并后必须更新本文件。

## 元信息

| 项 | 值 |
| --- | --- |
| 程序代号 | G3D |
| 招牌演示 | 汐屿 / Tidewell Isles（`tidewell-isles`） |
| SPEC | 仓外 `/workspace/godesk-3d-spec/SPEC.md`（v0.2）；指针见 [`docs/G3D-SPEC-POINTER.md`](./G3D-SPEC-POINTER.md) |
| Notion 项目 | https://app.notion.com/p/3f05fabdfe81810e90ade6b4fe2de7c2 |
| 任务范围 | G3D-01 至 G3D-27；里程碑 M0–M5；人日上限 91 |
| 代码基线 | `yuymf/godesk` `main` @ `902075e`（#137 G3D-ART AI；#132 G3D-04b；#131 G3D-08；#134 G3D-15 第二刀；#133 G3D-14） |
| 状态文件维护人 | 劳埃德(工程) / Track B（素材） |
| 最近更新 | 2026-10-06（Asia/Shanghai）· G3D-16 开工 |

## 硬约束（三条）

1. **最终验收 ≠ 仅汐屿可玩。** 验收标准是：带着 GoDesk 插件，创作者能做出与本 SPEC 同类型、同品质的游戏。汐屿是案例研究与默认底座演示。插件路径（生成 / 编辑 / 导入）必须复用同一套 3D 底座与 GameSpec v2 字段，并经实机 / 模拟 live 测试证明。
2. **Prompt 轨迹入库。** 每一次关键 C2C / Codex / goal-mode 提示词与决策轨迹写入仓内 `docs/prompt-trace/`，不得只留在聊天记录。约定见 [`docs/prompt-trace/README.md`](./prompt-trace/README.md)。
3. **状态继承文件。** 本文件（`docs/G3D-STATUS.md`）是唯一程序状态入口。每次合并或里程碑结束必须更新：当前里程碑、已完成 G3D id、进行中、阻塞、下一刀、开着的 PR/分支。

## 审查与合入口径（2026-10-06）

C2C ChatGPT 审查闸门已由用户于 2026-10-06 作废；审查与写码均用 box Codex 高档 gpt-5.5；合入授权：满足 CI/本地测试/活测证据后按序 squash。**Codex 额度耗尽（至 2026-11-05 02:04 Asia/Shanghai）时，按站立刀序改 Cursor Cloud Agent 兜底写码。**

## 当前里程碑

| 项 | 值 |
| --- | --- |
| 里程碑 | **M1 最小端到端 3D 切片**（**Done** 2026-10-06，真 AI 座位：G3D-04b #132 `0c4ac5a`）+ **M3 素材管线并行**（Track B）+ **M4 平台化**（G3D-12 / 14 / 15，**Done** 2026-10-06） |
| 本阶段出口 | G3D-02 → G3D-03 → G3D-04 → G3D-18：六角岛 Room 在 3D 中与 AI 打完一整局（EP-D + EP-I）；`CatanBoard.tsx` 删除且 `rg CatanBoard` 在 `src e2e` 为 0；e2e 全绿 |
| M1 出口证明 | **Done** 2026-10-06（真 AI 座位）。更正记录：此前一次标 Done 不成立，因为当时 Room 没有 AI 座位，座位 1 由第二个浏览器脚本驱动（main `d7dd1a5`：EP-D 640 次 / EP-I 541 次，证据 `/workspace/g3d-evidence/M1/`），只能算部分证明。现证明：G3D-04b #132 squash `0c4ac5a`。只开一个浏览器，座位 1 = 服务器端 Room AI（DO alarm + `pickBotIntent` + `acceptIntent`）。EP-D 1440×900 鼠标 13.7m、EP-I iPhone 12 Pro 390×844 触摸 12.9m，均为 683 手（人 342 / AI 341），打到「对局结束 · 获胜者 0」；AI 动作覆盖弃牌、强盗、骑士、银行 / 玩家交易、发展卡。跑在 PR head `48646eb` 上（3 passed / 27.0m）；`rg CatanBoard` 0；合入前 e2e 54 passed / 4 skipped，CI run 37407433885 绿。证据：`/workspace/g3d-evidence/M1-ai/`（`ep-*-winner.png`、`run.log`）|
| M4 平台化 | **Done** 2026-10-06（Track C）。已合入：G3D-12 [#106](https://github.com/yuymf/godesk/pull/106) `15fdad5`；G3D-14 [#133](https://github.com/yuymf/godesk/pull/133) `28792e0` + 后续修补 [#139](https://github.com/yuymf/godesk/pull/139)（翻转棋圆子实例化、2D 棋子随座位材质、390 px 溢出、毡面）；G3D-15 第一刀 [#123](https://github.com/yuymf/godesk/pull/123) `31cc0df` + 第二刀 [#134](https://github.com/yuymf/godesk/pull/134) `98f5de0`。出口：一句 NL「做一款两人翻转棋」→ 3D Room，MCP `configure_render` 3 轮可见生效（e2e `nl-othello-render-rounds`）；四个棋盘 Kernel 走通用 3D 桌面 mapper |
| M0 | 已完成：Bootstrap #102（`f13c8ce`）、G3D-01 #103（`332275d`） |

## 已完成

| G3D id | 说明 | 证据 |
| --- | --- | --- |
| Bootstrap | 状态骨架 + prompt-trace 约定 | PR [#102](https://github.com/yuymf/godesk/pull/102) squash `f13c8ce` |
| G3D-01 | ADR 0014 + 删除旧 2D 限定常量与技能措辞 | PR [#103](https://github.com/yuymf/godesk/pull/103) squash `332275d` |
| G3D-02 | three / SceneHost / size-limit | PR [#104](https://github.com/yuymf/godesk/pull/104) squash `aa48c2a` |
| G3D-03 | 六角岛状态 → 场景映射与基础渲染 | PR [#107](https://github.com/yuymf/godesk/pull/107) squash `5b85159` |
| G3D-12 | GameSpec v2 render schema / RuleSystem 存储 / v1 惰性迁移 | PR [#106](https://github.com/yuymf/godesk/pull/106) squash `15fdad5` |
| G3D-11 | 资产清单、LICENSES、CI 许可证门、KTX2/meshopt；`render-asset-registry` ← `ASSET_MANIFEST` | PR [#105](https://github.com/yuymf/godesk/pull/105) squash `8fbbc6c` |
| G3D-23 | UI 羊皮纸皮肤、墨线图标、Fraunces、风格指南（Track B） | PR [#108](https://github.com/yuymf/godesk/pull/108) squash `f2bb555` |
| G3D-26 | SFX sprites×30 + ambient×2（Track B） | PR [#111](https://github.com/yuymf/godesk/pull/111) squash `41e352b` |
| G3D-27 | 音乐循环×3 CC0 120s（Track B） | PR [#112](https://github.com/yuymf/godesk/pull/112) squash `757c9bc` |
| G3D-04 | 拾取 → 合法动作、HUD、HexSettlementBoard（Track A） | PR [#109](https://github.com/yuymf/godesk/pull/109) squash `6d4db72` |
| G3D-18 | 删除 2D 六角盘面路径；预览/回放/大厅 3D（Track A） | PR [#119](https://github.com/yuymf/godesk/pull/119) squash `d7dd1a5` |
| G3D-09 | 动效：tween.js 放置 280 / 删除 160 / 强盗 420 / 骰子 900 / 回合镜头 600；reduced motion 0（Track A） | PR [#129](https://github.com/yuymf/godesk/pull/129) squash `d2f58ab` |
| G3D-04b | Room AI 座位：DO alarm 驱动 `aiSeats`，复用 `pickBotIntent`（与 `runBotSimulation` 同一选手），只经 `acceptIntent`；思考 900 ms；同事务 pending 防重复落子；大厅「和电脑对战」（Track A） | PR [#132](https://github.com/yuymf/godesk/pull/132) squash `0c4ac5a` |

| G3D-24 | 资源/发展卡插画×8（Track B）**shipped；G3D-ART 2D 回炉 #125 `465f7fa`（分层插画+Cycles）— 仍待 G3D-13 接线入局** | PR [#113](https://github.com/yuymf/godesk/pull/113) squash `fd3f54e` + G3D-ART PR |

| G3D-25 | 座位徽记、岛名花饰、加载画（Track B）**shipped；G3D-ART 2D 回炉 #125 `465f7fa` — 仍待 G3D-13 接线入局** | PR [#114](https://github.com/yuymf/godesk/pull/114) squash `93e5adb` + G3D-ART PR |

| G3D-19 | 地形 decor.glb + 海面/泡沫 T-12/13（Track B） | PR [#115](https://github.com/yuymf/godesk/pull/115) squash `97eb027` |

| G3D-22 | PBR×11 KTX2 双分辨率（Track B） | PR [#116](https://github.com/yuymf/godesk/pull/116) squash `5063607` |

| G3D-20 | pieces.glb + sheep.glb（Blender bpy，Track B） | PR [#117](https://github.com/yuymf/godesk/pull/117) squash `4cb6f37` |

| G3D-21 | props.glb（码头/船/骰子/托盘/边框，Track B） | PR [#118](https://github.com/yuymf/godesk/pull/118) squash `b86dff6` |

| G3D-05 | Chrome 模拟 harness / Lighthouse CI（Track C） | PR [#110](https://github.com/yuymf/godesk/pull/110) squash `254384c` |
| G3D-10 | 音效：howler 2.2.4 core、`PlayEvent` → 16 cue 映射与变体、§4.8 分阶段加载、声音设置（总开关 / 音乐 60% / 音效 80% / 3 首曲目）、首次手势解锁；轨迹 [`docs/prompt-trace/2026-10-06-G3D-10.md`](./prompt-trace/2026-10-06-G3D-10.md) | PR [#120](https://github.com/yuymf/godesk/pull/120) squash `67e5383` |

| G3D-06 | 质量分级：自动检测、省电、运行时降级、设置覆盖（Track B） | PR [#122](https://github.com/yuymf/godesk/pull/122) squash `96a9d70` |
| G3D-15 第一刀 | 生成写 render、MCP `configure_render` 局部 patch、skills（Track C）；第二刀见下方「G3D-15 第二刀」行 | PR [#123](https://github.com/yuymf/godesk/pull/123) squash `31cc0df` |
| G3D-07 | 光照 / PBR / 软阴影 / AgX 色调映射 + CSS 实阴影 tokens（Track C）：`tokens.ts`、`lighting.ts`、`materials.ts`；程序化 pattern 首帧 + G3D-22 KTX2 套件可交互后按档流式替换（512 / low 256）；`PCFShadowMap` 紧贴岛屿包围球，静止复用阴影贴图；渐变天空穹顶；`design-tokens.css` §3.7；轨迹 [`docs/prompt-trace/2026-10-06-G3D-07.md`](./prompt-trace/2026-10-06-G3D-07.md) | PR [#128](https://github.com/yuymf/godesk/pull/128) squash `52d6e9a` |
| G3D-14 | 通用 3D 桌面 mapper（平台默认底座，Track C）：`mappers/tabletop.ts`（RenderSpec bindings / materials / camera + 公开状态 → SceneModel，回退内置图元）、`mappers/tabletop-kernels.ts`（翻转棋 / 线路 / 工人放置 / 港口）、`tabletop-objects.ts`；四个棋盘 Room / 预览 / 回放挂 3D 舞台（DOM 动作盘保留），LegalAction 经 3D 拾取发出；懒加载 `TabletopScene3D` 5.3 KB 不计入核心（206.88 / 210 KB）；轨迹 [`docs/prompt-trace/2026-10-06-G3D-14.md`](./prompt-trace/2026-10-06-G3D-14.md) | PR [#133](https://github.com/yuymf/godesk/pull/133) squash `28792e0` |
| G3D-15 第二刀 | 生成默认集成验收（Track C）：e2e `nl-othello-render-rounds`——「做一款两人翻转棋」→ Studio 确认 → 3D Room，再经 MCP `apply_project_patch` 做 3 轮 `configure_render`（水面色 / 太阳高度角 / 棋子材质），每轮 compile-build + 新开一局，断言 3D 舞台 DOM 生效值与截图像素差；轨迹 [`docs/prompt-trace/2026-10-06-G3D-15-part2.md`](./prompt-trace/2026-10-06-G3D-15-part2.md) | PR [#134](https://github.com/yuymf/godesk/pull/134) squash `98f5de0` |
| G3D-08 | 自研水体 shader + 海岸距离场（Track B）：`src/render3d/water/` Gerstner / DT / foam / sea KTX2；懒加载 `tide-water-*`；替换灰石板 surround；轨迹 [`docs/prompt-trace/2026-10-06-G3D-08.md`](./prompt-trace/2026-10-06-G3D-08.md) | PR [#131](https://github.com/yuymf/godesk/pull/131) squash `e8b59e8` |
| G3D-ART | 美术 AI 生图（Track D；用户 2026-10-06 11:08 决定允许 AI 生图，**G3D-17 前法务审查**）：地形 PBR 7 套 + 筹码面 t11（512/256，albedo 无缝化，normal/ORM 由 albedo 推导）、资源/发展卡 6 张原位替换；新增资源图标×5（128/64）、HUD 面板框 / 卡框 9-slice、筹码面 UI（`assets/ui/ai/`，待 G3D-13 接线）；新 SPDX `LicenseRef-AI-Generated`（CI warning 列出待法务资产，不失败）；提示词全文 [`docs/art/ai-provenance.md`](./art/ai-provenance.md)；轨迹 [`docs/prompt-trace/2026-10-06-G3D-ART.md`](./prompt-trace/2026-10-06-G3D-ART.md)。已知：`t04-wheat` 平铺条纹过于规整（建议重生成）；3D 模型网格仍为 bpy 自制 | PR [#137](https://github.com/yuymf/godesk/pull/137) squash `902075e` |
| G3D-14 后续修补 | 翻转棋圆子按座位材质 `InstancedMesh` 合批（满盘 64 子 low / medium 档 68 → 6 draw call）；2D 棋盘 / 计分面板棋子随编译后的 `materials.seat0/1`；iPhone 12 Pro 390 px 横向溢出（391）修复；毡面（`cloth`）不再挂单级 mip 的 t10-canvas PBR；单测 `tabletop-draw-calls.test.ts` + e2e `nl-othello-render-rounds` 加断言；轨迹 [`docs/prompt-trace/2026-10-06-G3D-14-followups.md`](./prompt-trace/2026-10-06-G3D-14-followups.md) | PR [#139](https://github.com/yuymf/godesk/pull/139) squash（合入 SHA 下次 STATUS 更新回填） |
| G3D-ART-2 | Track D 跟进：`t04-wheat` 改用 T3b 不规则麦丛（无缝，2×2 平铺检查）；**点数筹码数字修复**（原先只有圆柱、没有数字网格；新增 `number-labels.ts` Canvas 图集合并网格 +1 draw call，6/8 赤陶色、羊皮纸筹码面，筹码放大 1.6×；e2e `hex-number-tokens.spec.ts` 桌面/iPhone 断言 18 个贴花可见且有墨色像素）。**地形 3D 小道具（第 3 步）等 #138 G3D-13 合入后基于 InstancePools 另开 PR**；main 上 medium/low draw calls（144/125）已超出 100/60 目标，待 #138 降低 | PR [#142](https://github.com/yuymf/godesk/pull/142) |

仓外已完成（不记入上表）：SPEC v0.2 起草与 §9 拍板修订；Notion 项目与任务卡建立。

## 进行中

| 项 | 负责人 | 分支 / PR | 说明 |
| --- | --- | --- | --- |
| G3D-13 Tidewell 集成 | Track B | `feat/g3d-13-tidewell` [#138](https://github.com/yuymf/godesk/pull/138) @ `29d9c03` | 本地门禁已过；**合入阻塞：GitHub Actions billing/spending limit**（禁无绿合入 / 禁 workaround） |
| G3D-16 首页汐屿 showcase | Track B | `feat/g3d-16-homepage` [#146](https://github.com/yuymf/godesk/pull/146) draft | 海报 + `GODESK_FEATURE_TIDEWELL` 默认关；base=`feat/g3d-13-tidewell`；#138 合入后 rebase→main |

## 阻塞

| 项 | 原因 | 解除条件 |
| --- | --- | --- |
| box Codex 用量上限 | 至 2026-11-05 02:04 Asia/Shanghai；Cloud Agent 兜底（本席无该工具时手写） | 用量恢复 |
| **G3D-13（Track B）** | 依赖齐；#132 已合。PR [#138](https://github.com/yuymf/godesk/pull/138) @ `29d9c03` 本地 typecheck/unit/e2e/size/perf:ci 全绿。**合入阻塞：GitHub Actions billing/spending limit**（jobs ~2s 失败） | 账单限额恢复 + CI 绿后 squash；**禁止无绿合入 / 禁 workaround** |
| **G3D-16（Track B）** | 叠在 #138 上；draft PR base=`feat/g3d-13-tidewell`。#138 合入前不改 base、不合入 | #138 squash 后 rebase→main、retarget base=main |
| GitHub Actions | **billing/spending limit blocked**（2026-10-06）。deploy 历史曾有瞬时失败，当前以 billing 为准 | 限额恢复后重跑；禁无绿合入 |

## 下一刀

> G3D-10 备注：① 带声录屏（EP-D、EP-I）未交付：box 无声卡，Playwright 录像不含音轨，需在有音频设备的机器补录。② e2e 覆盖 9 个 cue（dice / hover / illegal / panel / place / road / select / toggle / turn），win / lose / upgrade / move / steal / trade / gain 由 Kernel 整局自动对局测试覆盖。③ low 档只加载海浪的判定等 G3D-06 档位接入（引擎已支持 `lowTier`）。④ 曲目顺序（tide-harbor = 主题，crystal-shore = 平稳，observing-star = 终局）按 #112 清单顺序推断，待 Track B 确认。

> G3D-05 备注：① 120 秒对局后 draw call 为 162–170，超过 high 档 ≤ 150（初始局面为 140），G3D-07 需要实例化或合批（G3D-04 已合入，其拾取热点叠加层另计）。② 移动画像按 low 档评估，要等 G3D-06 自动分级。③ 测量时（G3D-04 合入前）2D `CatanBoard` 在 412 px 下横向溢出到 451 px，G3D-18 删除 2D 盘面后复测。④ box 无 GPU（llvmpipe / SwiftShader），帧率只是代理值，桌面门需要有硬件 GPU 的机器（A7）。⑤ **§9 已决（劳埃德，2026-10-06）**：Lighthouse 基线中首页 LCP（本机 3 173 ms / CI 3 499 ms，阈值 2 500）、Room TBT（本机 4 697 ms，阈值 600；CI 上为 SwiftShader 持续渲染造成的无效值）、Room CLS（CI 0.132，阈值 0.1）未达 §4.6.3。**决定（LCP / TBT）：阈值不变，现阶段保持 warn；在 G3D-17（模拟画像终验）前完成优化，届时改为阻断（error）。** Room CLS 本机已回到 0（见 ⑥），级别仍为 warn。 Performance 仍按「不低于基线」取 CI 3 次最低值（首页 0.81 / Room 0.52）。⑥ rebase 到 G3D-04 后 Room CLS 回归（0 → 0.243，懒加载盘面把反馈面板下推，Room Performance 跌到 0.43）已在 #110 用同外框占位修复，本机 Room 回到 0.56–0.59、CLS 0，门槛未改（协议 §6.2）。

> G3D-07 备注：① draw call：静止帧复用阴影贴图（场景 / 档位变化后 1.5 s 内逐帧重绘），固定局面稳态 82、含阴影重绘帧峰值 145（high / medium）/ 126（low），G3D-07 前每帧 140。high ≤ 150 稳态与峰值均达标；medium ≤ 100 仅稳态达标；low ≤ 60 稳态与峰值均未达标（G3D-07 前三档每帧 140，同样未达标）；实例化 / 合批留给 G3D-13 换 GLB 时一起做。CI 新增 `drawCallsPeak(high)` 断言。② 环境反射只挂光泽材质（棋子 / 雾灯 / 骰子）：`scene.environment` 会把地块软阴影冲淡。③ 座位棋子只用彩漆木的 normal + ORM，不用 baseColor（木纹底色会把座位色压成棕色）。④ `--surface-raised` 改为 §3.7 的白色后，原「浅灰填充」角色改名 `--surface-sunken`（`#f5f5f5` 不变），45 处 CSS 引用随之改名；`--canvas` / `--paper` 不变（页面与房间仍为白底），房间头部随 `--surface-paper` 变为纸色 #fbf8f1（charter e2e 同步），DESIGN.md 同步。⑤ 运行时降档到 low 会重建 SceneHost（MSAA 只能构造时设）：KTX2 字节跨挂载缓存，low 复用降档前已下载的 512 套件，perf:ci 首局请求 80 → 51；`leak.memoryDriftAfter10Remounts` 改为同档位比较（high 多一张 PMREM 环境贴图）。⑥ box 无 GPU：截图与帧率来自 SwiftShader。

> G3D-14 备注：① draw call（medium，`?perf=1`）稳态 / 含阴影重绘峰值：翻转棋 9 / 9（5 子）、线路 19 / 29、工人 8 / 10、港口 48 / 51；扁平件不投影。翻转棋满盘上界约 70–80，medium ≤ 100 达标；low ≤ 60 在翻转棋后盘（> 55 子）会超 → **已由后续修补 #139 实例化解决**（见下方「G3D-14 后续修补备注」）。② 泄漏：四个 Kernel 各原地重建 10 次，几何 / 纹理回到同档基线，卸载残留 0 几何 / 1 纹理（three 内部 emptyShadowTexture，与 perf:ci 同口径）。③ 水面 Kernel（港口）的桌面是水色平面（`water.shallow`），不是 G3D-08 水体 shader。④ 首页 165.22 / 170 KB、size-limit 168.88 / 170 kB，余量约 1.1 kB：懒加载 chunk 不要再引用首页 chunk 内被摇掉的导出（例如 `defaultRenderSpec`）。⑤ 工人 / 港口的 3D 座位色来自 RenderSpec seat0–3，与 DOM 盘的商会色不同（G3D-13 HUD 重做时统一）。⑥ box 无 GPU：截图来自 SwiftShader。

> G3D-14 后续修补备注（#139）：① 翻转棋圆子（`disc`）改为每种材质一个 `InstancedMesh`（容量 64，满了翻倍，`DynamicDrawUsage`），节点本身是不渲染的代理 `Object3D`，拾取仍走格子热点。满盘 64 子实测（`?perf=1`，SwiftShader，桌面 1440×900 与 iPhone 12 Pro 一致）：low 68 → **6**、medium 68 → **6**（稳态 = 峰值；三角形不变 8 744）；开局 4 子重着色局 8 → 6。单测按「天空穹顶 + 可绘制网格 + 投影网格」估算并断言满盘 low ≤ 60 / medium ≤ 100。② 2D 棋盘与计分面板的棋子颜色改读编译后的 `render.materials.seat0/1.base`（CSS 变量 `--othello-seat0/1`，缺省回退原黑白），`configure_render` 改酒红 / 金后 2D 同步。③ iPhone 12 Pro 横向溢出：`.othello-grid` 是 content-box，宽 100% 再加 12 px 内边距与 1 px 边框，右缘 391 > 390；改 `border-box`。④ 毡面噪点是产品问题，不是 SwiftShader：t10-canvas KTX2 只有 1 级 mip（levelCount 1），盒体 UV 按面归一、repeat 0.5，粗布纹被放大成约 2 px 的硬边块，低太阳下更明显（`?pbr=0` 对照平滑）。本刀让 `cloth` pattern 保留程序化布面，不挂 t10-canvas；**带 mip 重烘 KTX2（`toktx --genmipmap`）属 Track B（G3D-22），box 无 toktx**。

> Track A：拥有 **18（已合）/ 09**；G3D-06 → Track B（已合 #122）、G3D-07 → Track C（2026-10-06 再平衡）。Track C：**05 / 10 / 15 / 07 / 14**。Track B 素材轨 **G3D-11、19–27 已全部合入**。

1. Track C：G3D-14 `28792e0`、G3D-15 第二刀 `98f5de0` 已合入，M4 平台化 Done；G3D-14 后续修补 #139 合入后 Track C 队列清空，待派。
2. Track A：G3D-09 已合入 `d2f58ab`；Track A 队列清空（G3D-07 由 Track C）。
3. Track B：G3D-13 #138 本地就绪、合入等 Actions billing；并行 **G3D-16** 首页 showcase（叠分支 `feat/g3d-16-homepage`）。G3D-ART #137 已合；`assets/ui/ai/` 已在 #138 HUD 接线。

## G3D-17 上线前清单（发布闸门）

- [ ] **法务审查：`assets/LICENSES.md` 中每一行 `LicenseRef-AI-Generated`（当前 68 行，`pnpm verify:assets` 的 warning 会列出）必须由法务审查通过**，通过后把该行 `法务审查: 待 G3D-17` 改为 `法务审查: 已通过 <日期/审查人>`、manifest `legalReview` 改为 `"cleared"`；未通过的资产须替换（委托 / CC0 / 购买）。warning 清零前不得上线。
- [ ] G3D-05 备注 ⑤：Lighthouse LCP / TBT 由 warn 改为 error（见上）。


## 开着的 PR / 分支

| 分支 | PR | 范围 | 状态 |
| --- | --- | --- | --- |
| `feat/g3d-13-tidewell` | [#138](https://github.com/yuymf/godesk/pull/138) | G3D-13 Tidewell 集成（Track B）@ `29d9c03` | open · 合入等 Actions billing |
| `feat/g3d-16-homepage` | [#146](https://github.com/yuymf/godesk/pull/146) | G3D-16 首页汐屿 showcase；base=`feat/g3d-13-tidewell` @ `ef3c97f` | draft · 叠分支；#138 后 rebase→main；**不合入**（Actions billing） |

## 修订记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| 2026-10-06 | G3D-16 开工：叠分支 `feat/g3d-16-homepage` off #138；draft PR base=`feat/g3d-13-tidewell`；Actions billing 阻塞合入；轨迹 `docs/prompt-trace/2026-10-06-g3d-16.md` | Track B |
| 2026-10-05 | 初创：硬约束三条、M0 未开始、bootstrap 进行中、C2C bridge 阻塞行、下一刀指向 G3D-01 | 劳埃德(工程) |
| 2026-10-05 | 回填开着的 PR：#102 | 劳埃德(工程) |
| 2026-10-06 | G3D-01 开工；回填 #103；#102/#103 合入；G3D-02 开工；Codex 用量上限 | 劳埃德(工程) |
| 2026-10-06 | G3D-02 合入；G3D-03 开工 | 劳埃德(工程) |
| 2026-10-06 | G3D-12（Track C）#106 合入；资产登记表备注 | Track C |
| 2026-10-06 | Track B：G3D-11 #105 / G3D-23 #108；rebase 含 G3D-03/12；registry 接线计划；toktx / Codex 阻塞 | Track B |
| 2026-10-06 | G3D-03 已合入；G3D-04 开工（pick + HUD + HexSettlementBoard） | 劳埃德(工程) |
| 2026-10-06 | STATUS rebase：合并 G3D-11/12 行；G3D-11 标 Done `8fbbc6c`；调度 G3D-05→Track C；M1 后 G3D-09→06→07 | Track A |
| 2026-10-06 | 外部阻塞：GitHub Actions major_outage（约 03:12 CST）；禁无绿合入与循环 rerun | Track A |
| 2026-10-06 | Track B：G3D-11 #105 合入 `8fbbc6c`；G3D-23 #108 rebase；toktx / Codex 阻塞 | Track B |
| 2026-10-06 | G3D-04 iPhone 触控修复；G3D-18 PR #119 开出；Actions 降为 degraded、CI 恢复 | Track A |
| 2026-10-06 | Track B：G3D-26 #111 / G3D-27 #112 / Track A G3D-04 #109 合入；Track B 队列 #113–#118 rebase 合入中；Actions degraded | Track B |
| 2026-10-06 | G3D-18 #119 合入 main 最新（G3D-24 #113）；大厅缩略图登记 manifest | Track A |
| 2026-10-06 | #119 合入 main（G3D-25 #114 / G3D-19 #115）；LICENSES 行移至 G3D-11 区段避免尾部冲突 | Track A |
| 2026-10-06 | Track B 素材轨收官 #113–#118；#119 G3D-18 合入；G3D-08/13 阻塞；deploy smoke 瞬时失败记入 | Track B |
| 2026-10-06 | STATUS：并入 Track C G3D-05 #110 `254384c`；G3D-08 阻塞改为仅等 06→07 | Track B |
| 2026-10-06 | G3D-10（Track C）PR #120 合入：已完成加一行；下一刀加 G3D-10 备注（录屏缺口等）；恢复 #121 重排时丢失的 G3D-05 备注（含 Lighthouse §9 待决问题） | Track C |
| 2026-10-06 | G3D-15 第一刀（Track C）PR #123：进行中加一行；阻塞加 G3D-14 / G3D-15 第二刀；回填 G3D-10 #120 合入 SHA `67e5383` | Track C |
| 2026-10-06 | Track B：#122 merge-main（无 rebase）同步 #123 STATUS；G3D-06 待 squash | Track B |
| 2026-10-06 | G3D-06 #122 合入 `96a9d70`；卡面/品牌 bitmap 去 CJK tofu；G3D-ART 仍待品质回炉 | Track B |
| 2026-10-06 | G3D-ART 2D：卡/品牌/ink 分层插画回炉；G3D-13 HUD 备注（iPhone 合法动作坐标按钮）；等 G3D-07→08 | Track B |
| 2026-10-06 | G3D-ART 2D #125 合入 `465f7fa`；contact sheet `/workspace/g3d-evidence/G3D-ART/`；等 G3D-07→08 | Track B |
| 2026-10-06 | G3D-ART artifact clip fix（hatch 裁剪/去叠层、loading 去朱印）；STATUS：ART Blocked(user decision)；此后不再 art pass | Track B |
| 2026-10-06 | M1 出口 Done（整局 EP-D/EP-I、rg 0、e2e 45/4，证据 `/workspace/g3d-evidence/M1/`）；G3D-09 PR；再平衡 06→Track B、07→Track C | Track A |
| 2026-10-06 | G3D-09 #129 合入 `d2f58ab`；G3D-13 依赖剩 07+08 | Track A |
| 2026-10-06 | G3D-07（Track C，改派自 Track A）PR #128：已完成加 G3D-07 与 G3D-15 第一刀（回填 #123 `31cc0df`）；进行中改为 G3D-15 第二刀 / G3D-14；G3D-05 备注 ⑤ 记为劳埃德已决（LCP / TBT 保持 warn，G3D-17 前优化后改 error）；加 G3D-07 备注 | Track C |
| 2026-10-06 | G3D-14（Track C）PR：已完成加 G3D-14；回填 G3D-07 #128 合入 SHA `52d6e9a`；G3D-08 阻塞行移除（G3D-07 已合入）；进行中只留 G3D-15 第二刀；加 G3D-14 备注（draw call / 泄漏 / 水色平面 / 首页余量 / 座位色） | Track C |
| 2026-10-06 | G3D-15 第二刀（Track C）PR：已完成加 G3D-15 第二刀；回填 G3D-14 #133 合入 SHA `28792e0`；进行中移除 G3D-15 第二刀；下一刀 Track C 队列清空 | Track C |
| 2026-10-06 | G3D-08（Track B）水体 + 海岸距离场：替换灰石板；懒加载 tide-water；证据 `/workspace/g3d-evidence/G3D-08/`；rebase main（#133/#134）；下一刀 G3D-13（合入等 #132） | Track B |
| 2026-10-06 | G3D-08 #131 合入 `e8b59e8`；STATUS 回填；开 G3D-13（合入等 #132） | Track B |
| 2026-10-06 | 更正：M1 没有 Room AI 座位，Done 撤回（脚本第二浏览器只是部分证明）；G3D-04b Room AI 座位 PR | Track A |
| 2026-10-06 | G3D-04b #132 合入 `0c4ac5a`；M1 用真 AI 座位重跑通过，重新标 Done；Track B G3D-13 可解锁 | Track A |
| 2026-10-06 | G3D-ART（Track D）AI 生图美术 PR #137：已完成加 G3D-ART；进行中 / 阻塞移除 G3D-ART；新增「G3D-17 上线前清单」法务审查项（LicenseRef-AI-Generated 全部清零） | Track D |
| 2026-10-06 | G3D-ART #137 合入 `902075e`；STATUS 回填 SHA；Notion G3D-ART → Done（AI 法务审查闸门在 G3D-17） | Track D |
| 2026-10-06 | G3D-14 后续修补 + M4 收官（Track C）PR：回填 G3D-15 第二刀 #134 合入 SHA `98f5de0`；开着的 PR 移除 #134；当前里程碑加 M4 平台化 Done（合入 PR 列表）；已完成加 G3D-14 后续修补；加后续修补备注（实例化 draw call / 2D 棋子色 / 溢出 / 毡面 mip）；代码基线 → `902075e`；开着的 PR 移除已合入的 #132 | Track C |
| 2026-10-06 | G3D-ART-2 #142：T3b 麦田、点数筹码数字贴花（6/8 赤陶）；地形道具暂缓到 #138 之后 | Track D |
