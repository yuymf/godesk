# T130 — auction stage edge bleed

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 canvas W≈1438 vs viewport 1440；边缝/外壳 residual |
| 层 | **共享呈现 / chrome** |
| 状态 | **闭** |
| 来源 | T127 audit · post T128 |

## 拟实现（通用）
共享 auction immersive 边缝/外壳；无样例特判。不粉饰 T107/T124/T128。

## 落地
见 `docs/hardness/runs/2026-10-15-t130.md`。
