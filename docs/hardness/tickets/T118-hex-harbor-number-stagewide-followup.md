# T118 — hex harbor/number stage-wide follow-up

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 stage-wide harbor/number；T112 close 已过、wide 仍 soft |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `1689f15` |
| 来源 | T117 audit · T112 H01 stage-wide soft 复判 |

## 问题
T112 后 H01 stage-close ge20≈5.72% 过门；stage-wide mean≈2.05 / ge20≈2.48% 仍 soft。T117 复拍 vs T112 tip wide ge20≈2.34%；vs T112 after ≈0.15（无抬升）。**不**宣称已修。

## 拟实现（通用）
共享港标/号标 stage-wide 对比（albedo/scale/billboard）；无样例特判。不白洗 T099/T101/T112。
