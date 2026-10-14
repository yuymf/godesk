# T054 — pattern 墙印花格 + 上墙彩釉可读

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04 before/after wall-close；unit print≠blank；T036/T047/T050 绿 |
| 层 | **共享呈现**（pattern wall print） |
| 状态 | **关** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t054/` |

## 问题
空墙格纯黑圆坑冒充 Azul 墙印；上墙彩釉与空槽难区分。

## 实现（通用）
1. `wallPrintColorAt` + `WALL_PRINT_TINT`；空格 `wall-slot`→`tile-square` 色相印花（禁 #292524 圆坑）。
2. 上墙 glazed-tile 保色可数、与印花底区分。
3. MaterialLibrary `wall-print`；无 H04 pack 特判。**不**自宣 ≥9。

## 验收
- [x] H04 wall-close before/after
- [x] unit 空墙印花≠blank；釉面可数
- [x] T036/T047/T050 守卫绿
