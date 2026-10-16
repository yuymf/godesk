# T026 — 共享 3D 桌面：gem-engine → TabletopStage

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03（presentation / 可分享 3D 链路） |
| 层 | **共享呈现**（`tabletop-kernels` / `TabletopStage` / Room） |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H03-t026/` |

## 现象（Open · post-T025 gap scan）
gem-engine-v1 内核循环 + floors 已过；Room 仍走 DOM `GemEngineBoard`，**无 SceneHost / TabletopStage**。  
记分停在 **PASS（子集）**；总验收要求「中间必须是 3D」。席位 HUD 硬编码 0–1。

## 落地
1. `gemEngineLayout`：银行代币 / 三级市场牌 / 贵族 / 各席标记与代币阵列 → `TabletopLayout`（disc/card/token/building 回退 mesh）。
2. `TabletopKernelType` + `layoutForStage` 纳入 `gem-engine-v1`。
3. `GemEngineBoard` 挂 `TabletopStage`；可访问 DOM 行动保留；席位 HUD 按 `seats.length`。
4. Room 透传 `presentation.render` + `importedModels`。

## 验收对照
- [x] H03 冷启动：floors passed/passed；Room `data-testid=tabletop-stage` + canvas + `data-kernel=gem-engine-v1`
- [x] 记分趋向 **PASS（可玩子集）**（3D 中层已挂；≥9 抛光仍 Open）
- [x] 单测：`tabletop-gem-engine` 2 + 既有 tabletop/gem-engine 绿
- [x] 无样例 IP 特判；未合 #179；Collecta 未动；T021 未排

## Out of scope / 仍 Open
- pattern-draft 3D → T027
- presentationFloor 强制 SceneHost
- 美术抛光到产品 ≥9

## 相关
- gap-scan：`hardness-real/gap-scan-post-t025.md`；ADR 0014
