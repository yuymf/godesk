# T124 — auction canvas share residual

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 canvasShare≈0.71 仍低于他套≈0.78 |
| 层 | **共享呈现 / chrome** |
| 状态 | **闭** |
| 来源 | T121 soft |

## 问题
T107 抬到 ≈0.71；suite-wide 仍低于 tabletop ≈0.78。

## 拟实现（通用）
共享 auction immersive chrome 再收；无样例特判。

## 落地
见 `docs/hardness/runs/2026-10-15-t124.md`。
