# T046 — 共享 network-route 车厢段

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 wide+close；他套 smoke |
| 层 | **共享呈现**（network-route claim → 车厢段网格） |
| 状态 | **开** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t046/` |

## 现象
H02 仍偏浅垫+细线图，缺火车线路段感。

## 实现（通用）
1. 已占边：彩色可数车厢/货车段；未占：弱轨槽；枢纽可读。
2. 非单游特判。**不**自宣 ≥9。

## 验收
- [ ] H02 before/after wide+close
- [ ] 他套 smoke 无回退
