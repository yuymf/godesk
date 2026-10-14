# T033 — 共享桌面「毡面+牌面」保真

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 观感（相对 T030） |
| 层 | **共享呈现**（tabletop-objects / materials / camera） |
| 状态 | **开** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t033/` |

## 现象
T030 抬了材质基线，但桌心仍偏整板木板；牌面缺色板/可读标记；宝石币缺清漆切面感。

## 实现（通用）
1. 桌心毡面 inset（外圈木边）；牌面色板+标记；宝石币 clearcoat/切面；默认机位框住牌区。
2. 单测 + H03/H04/H05 同机位 before/after。**不**自宣 ≥9。

## 验收对照
- [ ] before/after 可辨抬升；单测不回退；无样例特判
