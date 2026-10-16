# T051 — 共享 network 站名可读 + 未占轨长度刻度

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 before/after close（站名+长度）；他套 smoke |
| 层 | **共享呈现**（station plaque + unclaimed length slots） |
| 状态 | **关** |
| tip | `d630c40` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t051/` |

## 问题
站名半透明糊成一团；未占边无长度/费用刻度。

## 实现（通用）
1. 站/枢纽不透明名牌（hub:Name）；禁浮动稀薄羊皮纸站名。
2. 未占边 ghost 车厢槽 = 可数长度刻度；已占仍用 T049 分色车厢。
3. **不**自宣 ≥9。

## 验收
- [x] H02 before/after close
- [x] unit station tags + rails
- [x] 他套 smoke
