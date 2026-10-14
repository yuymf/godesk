# T057 — hex 强制落子 Room 成对（对齐 T049/T053）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 force-build ≥2 road + ≥2 settlement before/after；他套 smoke |
| 层 | **共享呈现 / force-inject** |
| 状态 | **关** |
| tip | pending-feat |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t057/` |

## 问题
H01 冷启岛上空无一物；缺强制落子成对 Room 实证。

## 实现（通用）
1. `forceBuildHexSetup`：setup 期 place_settlement/place_road intents（固定 radius-2 图探测，无 pack 硬编码）。
2. Unit：≥2 settle + ≥2 road → scene nodes。
3. **不**自宣 ≥9。

## 验收
- [x] H01 before empty / after stage-close 可见聚落+路
- [x] unit + generic intents
