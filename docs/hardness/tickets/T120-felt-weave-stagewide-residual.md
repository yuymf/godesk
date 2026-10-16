# T120 — felt weave stage-wide residual

| 字段 | 值 |
| --- | --- |
| 回归靶 | 绿毡 weave stage-wide 微细节残留 |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `1689f15` |
| 来源 | T117 audit · post T114 |

## 问题
T114 多套 close/wide 过门，但 stage-wide 毡纹仍可能糊（目视债）。需专用 wide 微细节刀，不白洗 T082/T083/T114。

## 拟实现（通用）
共享 felt material weave 远距可读；无样例特判。
