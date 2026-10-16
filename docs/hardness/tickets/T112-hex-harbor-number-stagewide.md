# T112 — hex harbor/number stage-wide legibility

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 stage-wide 港标/号标远距可读；不砍 T099/T101 |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `af03902` |
| 来源 | T111 audit |

## 问题
H01 stage-wide 港标/号标仍软，远距难读。

## 实现（通用）
LABEL_SIZE/font/stroke/pips 抬升；harbor atlas 字号+描边抬升；保留 T099/T101。
