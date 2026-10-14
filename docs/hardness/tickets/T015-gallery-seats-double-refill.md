# T015 — gallery 席位 / 双画固定 / 补牌时序

| 字段 | 值 |
| --- | --- |
| 套件 | H05-modern-art probe4 |
| 层 | **内核**（auction-bidding-v1 gallery 同层扩） |
| 状态 | **已关** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H05-probe4/` |
| sha | `0410664` |

## 现象（T012 后 Open）
gallery 子集已有 open/sealed/fixed + 行情卖出；仍缺 3–5 席、双画固定价、精确补牌时序。

## 实现
- gallery `playerCount` **2–5**（classic/harbor 仍强制 2）
- mode **`double`**：同画家两张一并定价（fixed 相位）；成交计入 2 售
- **轮初补牌**：行情阶段全员 pass 后、新一轮 offer 前 `refillGalleryHands` 至 `handSize`；流拍回牌库底
- playability floor：gallery 允许 2–5
- unsupported 收窄为：同时实时密封 / 多方经纪

未扭曲 harbor。无样例 IP 特判。Collecta 未动。#179 draft 未合 main。

## 关闭
- H05-probe4：floors passed；记分 **趋向 SUCCESS（可玩子集）**；kernel playerCount=3
- 烟测 H01/H03/H04：floors passed
- 单元：auction-bidding 20 passed（含 T015 4 例 + harbor 绿）
