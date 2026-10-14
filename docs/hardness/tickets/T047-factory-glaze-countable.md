# T047 — 共享 pattern 工厂「盘上可数彩釉砖」

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04 before/after wide+close（工厂特写）；T036 守卫；Room guard JSON |
| 层 | **共享呈现**（pattern-draft / tabletop stacking；piece.y = playTop 抬高） |
| 状态 | **关** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t047/` |

## 问题
H04 Room 工厂只见空橄榄色圆盘 +「1st」先手标；2×2 彩釉砖在 T044 抬高 playTop 后仍用绝对世界 Y，埋入毡下。

## 实现（通用）
1. `mapTabletopToScene`：`piece.y` 改为相对 playTop 抬高（非绝对世界 Y）。
2. 工厂 pad 仅在 inventory>0；N 枚分色 glazed-tile 2×2；空 pad = 验收失败。
3. 保持 T036 单测守卫；新增 T047 scene-Y / mesh 守卫。
4. 非 sample 特判。**不**自宣 ≥9。

## 验收
- [x] H04 before/after wide+close（工厂 close）
- [x] vitest T036 + T047
- [x] Room pixel/count JSON under `H0x-t047/`
- [x] 他套 smoke 无回退
