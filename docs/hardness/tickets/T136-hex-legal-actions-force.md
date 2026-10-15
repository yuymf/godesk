# T136 — hex legal-actions force path

| 字段 | 值 |
| --- | --- |
| 回归靶 | force 仍靠枚举 vertex/edge；应走 listLegalActions 加速满 setup（≥2 settle） |
| 层 | **工具** |
| 状态 | **闭** |
| 来源 | T133 soft · min1 PASS / full-setup still fragile |

## 拟实现（通用）
共享 legal-actions 驱动 force；无样例特判。

## 落地
见 `docs/hardness/runs/2026-10-15-t136.md`。
