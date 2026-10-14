# T027 — 共享 3D 桌面：pattern-draft → TabletopStage

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04（presentation / 可分享 3D 链路） |
| 层 | **共享呈现**（复用 T026 舞台约定） |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H04-t027/` |

## 落地
1. `patternDraftLayout`：工厂圆盘、中心堆、准备行、纹样墙、地板 → TabletopLayout（disc/cell/token/building）。
2. `TabletopKernelType` + `layoutForStage` 纳入 `pattern-draft-v1`。
3. `PatternDraftBoard` 挂 `TabletopStage`；席位 HUD 按 `seats.length`；Room 透传 render。

## 验收对照
- [x] H04 冷启动：floors passed/passed；Room hasStage+canvas+`data-kernel=pattern-draft-v1`
- [x] 记分趋向 **PASS（可玩子集）**
- [x] H03 smoke：T026 不回退（stage+canvas+gem-engine）
- [x] 无样例 IP 特判；未合 #179；Collecta 未动；T021 未排
