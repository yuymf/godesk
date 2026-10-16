# T139 — contact shadow pixel residual

| 字段 | 值 |
| --- | --- |
| 回归靶 | T138 opacity/color 抬升后 stage-wide ge20 仍近似持平 |
| 层 | **共享呈现** |
| 状态 | **关（H03/H04 过门；H02 soft）** |
| 来源 | T138 soft |

## 拟实现（通用）
共享 contact shadow 尺度/对比；不白洗 T106/T135/T138。
