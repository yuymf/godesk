# T018 — pattern-draft：行/列/颜色套终局奖励

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04（harness only） |
| 层 | **内核**（pattern-draft-v1 同层扩） |
| 状态 | **已关** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H04-t018/` |

## 现象（Open · regress-t015）
pattern-draft-v1：工厂草稿 / 准备行 / 墙贴邻接计分 / 地板扣分已有；诚实 unsupported：**行·列·颜色套终局奖励**（及 3–4 席 → T019）。

## 实现（通用 · 可配置 endBonuses）
- 完整行：`perCompleteRow`（默认 2）
- 完整列：`perCompleteColumn`（默认 7）
- 颜色套：`perCompleteColorSet`（默认 10）
- 触发：任一方墙上有完整行 → 本轮墙贴后对**双方**结算终局奖励再比分
- unsupported 收窄为 **3–4 席**（→ T019）

未推翻准备行/邻接即时分。无样例 IP 特判。Collecta 未动。#179 draft 未合 main。

## 关闭
- H04-t018：floors passed；趋向 SUCCESS（可玩子集）
- H03 smoke（含 reserve）：无回归
- 单元：pattern-draft 9 passed（含 T018 行/列/颜色套 3 例）
