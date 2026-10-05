# ADR 0014: Three.js 3D 桌面是 GoDesk 的默认渲染面

Status: accepted

Date: 2026-10-05

Supersedes: ADR 0012 中的以下两条 Consequences（其余全部保留）：
- 「GameFactory-3A is a process reference (plan, mechanic/UI contract, play to validate). It is not a 3D engine target.」中「It is not a 3D engine target.」一句；
- 「`港口十三号` / settlecoast visual quality is the **2D presentation bar** for harbor Room tables ... It is not a settlecoast port and not a GameFactory-3D build.」整条。

## Context

1. GoDesk 的产品定位自始是 Three.js 3D 桌游平台。ADR 0012 在 2026-08-31 写入的 2D 限定条款与 `src/creator/harbor-presentation-bar.ts`（`dimensionality: "2d"`、`never: ["WebGL", "3D engine", "GameFactory-3D", "build settlecoast in 3D"]`）是误写的产品约束；同一轮 2D 化调整中 `src/components/HarborScene.tsx`（R3F 3D 场景）在 `3e930fd`（2026-08-30）被删除。
2. 视觉审计确认：首页三案例与仓内六角岛盘面在材质、光影、动效、音效四个维度全部缺失；根因直接来自「GameSpec 无视觉字段」「tokens 阴影全 none」「政策禁止 3D」。
3. 可行性研判确认：Cloudflare Worker 静态资产单文件 25 MiB、Worker 64 MiB 的上限可承载 Three.js 量级前端。
4. settlecoast 在手机上可玩，证明移动端 WebGL2 3D 桌游可行。移动端是必达性能目标，不是回避 3D 的理由。

## Decision

1. **Three.js（WebGL2）3D 桌面是空间类体裁（Play Surface `table` / `scene` / `hybrid`）的默认渲染面。** 平台提供一套默认 3D 底座：渲染、拾取交互、HUD、动效、音效。
2. **Executable Kernel 仍是唯一权威（ADR 0002 不变）。** 3D 渲染层是纯视图 + 输入适配器：只读 Kernel 公开状态，只发出 Kernel `listLegalActions` 已列出的动作；Accepted Actions 仍由 Kernel 校验。
3. **视觉由 GameSpec 数据声明。** GameSpec 新增 `render` 字段（材质、光照、水体、相机、动效、音效、对象绑定），只允许引用资产清单中带许可证记录的资产；不执行生成方提供的脚本或 shader 源码。
4. **移动端是必达目标。** 每个渲染 PR 都须通过性能预算（CI 门 + 桌面 Chrome 模拟门）；预算失败视同测试失败。
5. **权利边界不变。** 资产只允许自制、程序化、CC0-1.0 公共领域素材、已购买并持有授权四类，每个资产文件登记于 `assets/LICENSES.md`；禁止拷贝 settlecoast.com 的任何代码、shader、模型、音频、插画、文案。
6. 删除 `HARBOR_PRESENTATION_BAR.dimensionality` 与 `HARBOR_PRESENTATION_BAR.never`；`HARBOR_LANDMARK_TEST_IDS` 与 `HARBOR_DOCK_GROUP_KIND` 保留（它们是可访问性与 e2e 地标，与维度无关）。

## 保留自 ADR 0012 的内容

| 条款 | 状态 |
|---|---|
| Playability Floor 是 Shared Session / Playtest Link 的分享门 | 保留，原文不改 |
| Genre fidelity / Decision density / Surface fidelity / Session completeness | 保留 |
| Presentation Floor 仍是视觉下限 | 保留；3D 体裁额外要求 `gameSpec.render` 通过 schema 校验 |
| Playwright 必须执行体裁动作（放置、发言、出牌） | 保留；3D 盘面通过可访问动作列表执行 |
| GameFactory-3A 作为流程参考（plan → contract → play to validate） | 保留 |

## Consequences

1. 新增依赖 `three`（MIT），以动态 import 隔离在 Room 路由的 3D chunk 中，首页首屏 JS 不增加 three。
2. 新增 `src/render3d/` 模块与 `gameSpec.render` 字段；`GameSpec.schemaVersion` 由 1 升为 2。
3. `plugins/godesk/skills/create-shareable-prototype/SKILL.md` 与 `plugins/godesk/skills/playtest-and-verify-game/SKILL.md` 中「settlecoast 2D presentation bar」措辞改为指向本 ADR。
4. 新增 Chrome 模拟性能 harness（Playwright + CDP）与 Lighthouse CI；CI 增加包体、渲染统计、Lighthouse 与许可证登记门。
5. 维护成本上升：每个空间体裁需要一个 scene mapper（或使用通用桌面 mapper）。
6. `docs/adr/README.md` 的 Current contracts 表新增 0014 行，并在 0012 行注明「3D 条款被 0014 取代」。
7. 2D 六角盘面（`src/creator/CatanBoard.tsx` 的 SVG 渲染及其在 Room、预览、回放、大厅缩略图中的用法）删除，不保留 2D / 3D 切换开关或回退路径（由后续 G3D-04 / G3D-18 落地；本 ADR 确立无回退政策）。
