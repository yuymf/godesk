# T033 — 共享桌面「毡面+牌面」保真

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 观感（相对 T030） |
| 层 | **共享呈现**（tabletop-objects / materials / camera） |
| 状态 | **关** |
| tip | `e487f0e235b1995813fbf204867d44cbc0670de1` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t033/` |

## 现象
T030 抬了材质基线，但桌心仍偏整板木板；牌面缺色板/可读标记；宝石币缺清漆切面感。

## 实现（通用）
1. cloth board + wood table → `board-rim` 木边 + 毡面 inset。
2. `card` 挤出体 + 色板/标记贴面；`gem-chip` 切面币 + 高 clearcoat。
3. 桌面机位更近（fov30 / dist≈12.5）。单测 `tabletop-felt-card-t033.test.ts`。**不**自宣 ≥9。

## 验收对照
- [x] H03/H04/H05 before/after；单测不回退；无样例特判
