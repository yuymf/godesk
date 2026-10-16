# T034 — 共享桌面「瓷砖/牌面插画」保真

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 桌面可读插画 |
| 层 | **共享呈现**（tabletop-objects / materials / 程序化贴图） |
| 状态 | **关** |
| tip | `9b834a2dfb68eca4ea6c6cafd254c75abcb5d0ec` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t034/` |

## 现象
T033 抬了毡面/牌面基线，但 pattern 色块仍偏素色碟；牌面缺边框/费用行/声望徽；贵族/拍品仍像纯文字条。

## 实现（通用）
1. `glazed-tile`：斜边釉面 + clearcoat 釉面；工厂垫改为彩垫盘，禁止米色 region 方块作主棋子。
2. `card`：边距框 + 层级色带 + 费用宝石行 + 声望徽（程序化 canvas）。
3. `plaque`：贵族/匾额镜框。单测 `tabletop-glaze-card-t034.test.ts`。**不**自宣 ≥9。

## 验收对照
- [x] H03/H04/H05 before(T033)/after；单测不回退；无样例特判
