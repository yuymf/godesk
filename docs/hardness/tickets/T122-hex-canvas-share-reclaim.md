# T122 — hex canvas share reclaim

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 canvasShare≈0.62 仍低于他套≈0.78 |
| 层 | **共享呈现 / chrome** |
| 状态 | **开** |
| 来源 | T117/T118 后 soft 债 |

## 问题
Tidewell/hex 侧栏占位使 canvasShare 偏低。

## 拟实现（通用）
共享 seated chrome compact；无样例特判。不白洗 T100/T103。
