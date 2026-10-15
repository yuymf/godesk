# T081 — pattern contact shadow debt

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04 stage-close vs regress-t079 过 gate（mean≥5 OR ge20≥5%）；T047/T076/T074 仍净 |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `981752c` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t081/` |

## 问题
T079 H04 vs_regress soft mean≈1.83 — pattern factories/tiles/wall 接地弱于 H02/H03。

## 实现（通用）
1. softContactShadow 共享 opacity/boost；glazed-tile / porcelain-plate 加强。
2. mapper 对 tile/plate 发绝对 contact-shadow（小件不被 parent scale 吃掉）。
3. **不**自宣 ≥9。
