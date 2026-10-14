# T046 — 共享 network-route 车厢段

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 wide+close；他套 smoke |
| 层 | **共享呈现**（network-route claim → 车厢段网格） |
| 状态 | **关** |
| tip | （feat commit 后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t046/` |

## 实现（通用）
1. 默认 binding：station + rail-track；已占边彩色可数车厢段；未占弱轨槽。
2. 非单游特判。**不**自宣 ≥9。

## 验收
- [x] H02 before/after wide+close
- [x] 他套 smoke 无回退
- [x] 单测 rail-track / station bindings
