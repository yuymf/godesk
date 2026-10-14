# T037 — 共享「牌面可读 schema」

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 近距可读牌面 |
| 层 | **共享呈现**（tabletop-objects 程序化 atlas） |
| 状态 | **开** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t037/` |

## 现象
牌面仍可能露出 `T1+0|green` 类调试串；费用/声望/奖励色不够一眼可读；贵族/拍品偏 raw id。

## 实现（通用）
1. 仅程序化 canvas atlas；**禁止**外部版权插画。
2. **禁止**牌面调试串（如 `T1+0|green`）；schema：大号声望数 + 费用宝石点 + 奖励色角 + 层级水印。
3. 贵族/拍品：标题文 + 需求点，非 raw id。card/plaque 不另挂调试名牌。无样例特判。**不**自宣 ≥9。

## 验收对照
- [ ] H03/H04/H05 before/after 近距可读；无调试串
- [ ] 单测不回退；无外部版权图
