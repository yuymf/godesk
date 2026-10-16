# T119 — station plaque stage-wide residual

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 stage-wide 站牌；T115 close 过、wide 仍 soft |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `1689f15` |
| 来源 | T117 audit |

## 问题
T115 close ge20≈5.49% 过门；wide mean≈2.79 / ge20≈3.35% 仍 soft。

## 拟实现（通用）
共享 opaque plaque stage-wide 尺度/对比微调；不白洗 T051/T115。
