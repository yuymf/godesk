# T026 — 共享 3D 桌面：gem-engine → TabletopStage

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03（presentation / 可分享 3D 链路） |
| 层 | **共享呈现**（`tabletop-kernels` / `TabletopStage` / Room） |
| 状态 | **开** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H03-t026/`（落地后） |

## 现象（Open · post-T025 gap scan）
gem-engine-v1 内核循环 + floors 已过；Room 仍走 DOM `GemEngineBoard`，**无 SceneHost / TabletopStage**。  
`layoutForStage` 不含 `gem-engine-v1`。总验收要求「中间必须是 3D」；记分停在 **PASS（子集）**。  
席位 HUD 硬编码 0–1，4 席展示不全。

## 实现（通用 · 禁止样例特判）
1. 扩展 `TabletopKernelType` + `gemEngineLayout`：银行代币堆、三级市场牌、贵族、各席代币/阵列 → `TabletopLayout`（复用 `disc`/`card`/`token` 等已有 mesh 回退）。
2. `GemEngineBoard`（或包装）挂 `TabletopStage`；保留可访问 DOM 行动列表（与 NetworkRouteBoard 同模式）。
3. Room / Preview 透传 `presentation.render`；席位 HUD 按 `seats.length` 泛化。
4. 单测：layout 产出非空 pieces + board；不扭曲既有 disc/network/harbor layout。

## 验收对照
- [ ] H03 冷启动：floors 不回退；Room/预览可见 `data-testid="tabletop-stage"` / 3D 桌面
- [ ] 记分趋向 **PASS（可玩子集）**（呈现中层为 3D）
- [ ] 单测 ≥1 绿；邻套 smoke 无新红
- [ ] 无样例 IP 特判；未合 #179；Collecta 未动；T021 未排

## Out of scope
- pattern-draft 3D（→ T027）
- 收紧 presentationFloor 强制 SceneHost（下一批）
- 美术抛光到产品 ≥9 满分（本刀只打通通用 3D 中层）

## 相关
- gap-scan：`hardness-real/gap-scan-post-t025.md`
- ADR 0014；前序内核 T010/T017/T019
