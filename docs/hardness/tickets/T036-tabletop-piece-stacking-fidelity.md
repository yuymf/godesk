# T036 — 共享桌面「占位棋件堆叠」保真

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room `15-room-stage` 堆叠可读 |
| 层 | **共享呈现**（tabletop layout / objects） |
| 状态 | **关** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t036/` |

## 现象
T034 有釉面瓷砖与牌面，但工厂空垫仍占位像假厂；供应/银行常单碟代整堆；墙格偏空框。

## 实现（通用）
1. **factory/region pads**：按 inventory 生成 N 枚 `glazed-tile`（同色可竖堆）；**禁止**空垫冒充工厂。
2. **bank/supply**：同色币小竖堆 + 可读数量 tip；**禁止**单碟代整堆。
3. **pattern wall/rows**：有色格落釉砖，非空墙框。单测覆盖。无样例特判。**不**自宣 ≥9。

## 验收对照
- [x] H03/H04/H05 before(T034)/after `15-room-stage`；H04 一眼可数每厂彩色砖
- [x] 单测不回退；无样例特判
