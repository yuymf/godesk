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
| 代码基线 | `yuymf/godesk` `main` @ `254384c`（含 Track B 素材轨收官与 #119） |
| 状态文件维护人 | 劳埃德(工程) / Track B（素材） |
| 最近更新 | 2026-10-06（Asia/Shanghai） |

## 硬约束（三条）

1. **最终验收 ≠ 仅汐屿可玩。** 验收标准是：带着 GoDesk 插件，创作者能做出与本 SPEC 同类型、同品质的游戏。汐屿是案例研究与默认底座演示。插件路径（生成 / 编辑 / 导入）必须复用同一套 3D 底座与 GameSpec v2 字段，并经实机 / 模拟 live 测试证明。
2. **Prompt 轨迹入库。** 每一次关键 C2C / Codex / goal-mode 提示词与决策轨迹写入仓内 `docs/prompt-trace/`，不得只留在聊天记录。约定见 [`docs/prompt-trace/README.md`](./prompt-trace/README.md)。
3. **状态继承文件。** 本文件（`docs/G3D-STATUS.md`）是唯一程序状态入口。每次合并或里程碑结束必须更新：当前里程碑、已完成 G3D id、进行中、阻塞、下一刀、开着的 PR/分支。

## 审查与合入口径（2026-10-06）

C2C ChatGPT 审查闸门已由用户于 2026-10-06 作废；审查与写码均用 box Codex 高档 gpt-5.5；合入授权：满足 CI/本地测试/活测证据后按序 squash。**Codex 额度耗尽（至 2026-11-05 02:04 Asia/Shanghai）时，按站立刀序改 Cursor Cloud Agent 兜底写码。**

## 当前里程碑

| 项 | 值 |
| --- | --- |
| 里程碑 | **M1 最小端到端 3D 切片**（进行中）+ **M3 素材管线并行**（Track B） |
| 本阶段出口 | G3D-02 → G3D-03 → G3D-04 → G3D-18：六角岛 Room 在 3D 中与 AI 打完一整局（EP-D + EP-I）；`CatanBoard.tsx` 删除且 `rg CatanBoard` 在 `src e2e` 为 0；e2e 全绿 |
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

| G3D-24 | 资源/发展卡插画×8（Track B） | PR [#113](https://github.com/yuymf/godesk/pull/113) squash `fd3f54e` |

| G3D-25 | 座位徽记、岛名花饰、加载画（Track B） | PR [#114](https://github.com/yuymf/godesk/pull/114) squash `93e5adb` |

| G3D-19 | 地形 decor.glb + 海面/泡沫 T-12/13（Track B） | PR [#115](https://github.com/yuymf/godesk/pull/115) squash `97eb027` |

| G3D-22 | PBR×11 KTX2 双分辨率（Track B） | PR [#116](https://github.com/yuymf/godesk/pull/116) squash `5063607` |

| G3D-20 | pieces.glb + sheep.glb（Blender bpy，Track B） | PR [#117](https://github.com/yuymf/godesk/pull/117) squash `4cb6f37` |

| G3D-21 | props.glb（码头/船/骰子/托盘/边框，Track B） | PR [#118](https://github.com/yuymf/godesk/pull/118) squash `b86dff6` |

仓外已完成（不记入上表）：SPEC v0.2 起草与 §9 拍板修订；Notion 项目与任务卡建立。

## 进行中

| 项 | 负责人 | 分支 / PR | 说明 |
| --- | --- | --- | --- |
| G3D-05：Chrome 模拟 harness | Track C | `feat/g3d-05-perf-harness` / [PR #110](https://github.com/yuymf/godesk/pull/110) | Track C 拥有 |
| G3D-10：howler 音效引擎 | Track C | `feat/g3d-10-audio` / [PR #120](https://github.com/yuymf/godesk/pull/120) | Track C 拥有 |
| G3D-09：动效 | Track A | （未开） | M1 后；Track A 拥有 |

## 阻塞

| 项 | 原因 | 解除条件 |
| --- | --- | --- |
| box Codex 用量上限 | 至 2026-11-05 02:04 Asia/Shanghai；Cloud Agent 兜底（本席无该工具时手写） | 用量恢复 |
| **G3D-08（Track B）** | 依赖 G3D-07 ← G3D-06 ← G3D-05（#110）+ G3D-04（已合） | #110 → G3D-06 → G3D-07 后开工 |
| **G3D-13（Track B）** | 依赖 G3D-07/08/09/10 + 素材 19–25；素材已齐，缺 07–10 | 07+08+09+#120 上 main |
| GitHub Actions | 现 **operational**。deploy @ `41e352b` 生产 smoke 曾失败（ChatGPT Connector heading）；后续 deploy 通过 → 瞬时 | 禁无绿合入 |

## 下一刀

> Track A：拥有 **18（已合）/ 09 / 06 / 07**。Track C：**05 / 10 / 15 / 14**。Track B 素材轨 **G3D-11、19–27 已全部合入**。

1. Track C：合入 **G3D-05 #110**、**G3D-10 #120**。
2. Track A：M1 后 **G3D-09 →（等 G3D-05）G3D-06 → G3D-07**。
3. Track B：**G3D-08 与 G3D-13 均阻塞**；解阻后先 08 再 13。

## 开着的 PR / 分支

| 分支 | PR | 范围 | 状态 |
| --- | --- | --- | --- |
| `feat/g3d-05-perf-harness` | [#110](https://github.com/yuymf/godesk/pull/110) | perf harness | open · Track C |
| `feat/g3d-10-audio` | [#120](https://github.com/yuymf/godesk/pull/120) | howler 引擎 | open · Track C |
| `docs/g3d-status-asset-track-done` | [#121](https://github.com/yuymf/godesk/pull/121) | STATUS 收官 | open · 本 PR |

## 修订记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
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
