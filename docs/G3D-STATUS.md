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
| 代码基线 | `yuymf/godesk` `main` @ `8fbbc6c`（#105 G3D-11；含 #106/#107/#104） |
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
| G3D-11 | 资产清单、LICENSES、CI 许可证门、KTX2/meshopt；接线 `render-asset-registry` | PR [#105](https://github.com/yuymf/godesk/pull/105) squash `8fbbc6c` |

仓外已完成（不记入上表）：SPEC v0.2 起草与 §9 拍板修订；Notion 项目与任务卡建立。

## 进行中

| 项 | 负责人 | 分支 / PR | 说明 |
| --- | --- | --- | --- |
| G3D-04：拾取 → 合法动作、HUD、可访问动作列表，Room 替换 SVG | Track A · 劳埃德(工程) | `feat/g3d-04-pick-hud` / [PR #109](https://github.com/yuymf/godesk/pull/109) | M1 第三刀；本地门已绿；**等 Actions 恢复后合入（不循环 rerun）** |
| G3D-18：删除 2D 盘面路径（预览/回放/大厅缩略图/组件） | Track A · 劳埃德(工程) | `feat/g3d-18-delete-2d`（叠在 #109） | M1 第四刀；本地完成，PR base=`feat/g3d-04-pick-hud` |
| G3D-05：Chrome 模拟 harness（并行） | Track C | [PR #110](https://github.com/yuymf/godesk/pull/110) | Track A 不做 |
| G3D-23：UI 羊皮纸皮肤等 | Track B | [PR #108](https://github.com/yuymf/godesk/pull/108) | Track A 勿动 |

## 阻塞

| 项 | 原因 | 解除条件 |
| --- | --- | --- |
| **GitHub Actions 重大故障（外部）** | githubstatus.com「Incident with Actions」自约 **2026-10-06 03:12 Asia/Shanghai**；组件 Actions=`major_outage`。此后 Verify/deploy 排队后约 15min **0-step cancel**（`runner=null`），含 main deploy。**禁止无绿 CI 合入；禁止循环 rerun。** | Actions 恢复为 `operational` 后，按序对 #109 → G3D-18 PR 各 rerun **一次** 并 squash |
| box Codex 用量上限 | `codex exec` gpt-5.5 于 2026-10-06 报 usage limit（约至 2026-11-05 02:04 Asia/Shanghai）；写码改 Cursor Cloud Agent / 人工 diff | 用量恢复或继续 Cloud Agent |
| toktx（Basis CLI） | 本环境未预装 `toktx`；`scripts/compress-assets.mjs --texture` 显式失败。GLB meshopt 可用 | CI/开发机安装 `toktx`，或 G3D-22 在有 toktx 的环境烘焙 |

## 下一刀

> Track A 调度：M1 合入顺序 **#109 → G3D-18**（等 Actions）→ M1 出口证明 → **G3D-09** →（等 G3D-05/#110 on main）**G3D-06** → **G3D-07**。

1. Actions 恢复后合入 **G3D-04 #109** → **G3D-18** → M1 出口。
2. 并行本地推进 **G3D-09**（不依赖 Actions）。
3. Track B / C：#108 / #110（勿动）。

## 开着的 PR / 分支

| 分支 | PR | 范围 | 状态 |
| --- | --- | --- | --- |
| `feat/g3d-04-pick-hud` | [#109](https://github.com/yuymf/godesk/pull/109) | pick、HUD、HexSettlementBoard | 本地绿；等 Actions |
| `feat/g3d-18-delete-2d` | TBD | 删 2D 盘面路径；大厅 WebP | 叠 #109 |
| `feat/g3d-23-ui-parchment` | [#108](https://github.com/yuymf/godesk/pull/108) | UI parchment | Track B |
| `feat/g3d-05-perf-harness` | [#110](https://github.com/yuymf/godesk/pull/110) | perf harness | Track C |

## 修订记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| 2026-10-05 | 初创：硬约束三条、M0 未开始、bootstrap 进行中 | 劳埃德(工程) |
| 2026-10-06 | #102/#103/#104/#107/#106/#105 合入；M1 进行中；C2C 作废；Codex 上限 | 多 Track |
| 2026-10-06 | G3D-04 #109 / G3D-18 开工；调度 G3D-05→Track C；M1 后 G3D-09→06→07 | Track A |
| 2026-10-06 | 外部阻塞：GitHub Actions major_outage（约 03:12 CST）；禁无绿合入与循环 rerun | Track A |
