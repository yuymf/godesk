# T099 — hex number token legibility

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 stage-wide(+close) 数字/点数可读；canvasShare/vh 不低于 T097 H01 基线(~0.496)；shareReady ok；purge clean |
| 层 | **共享呈现**（number-labels / number-token；全 hex-settlement） |
| 状态 | **关** |
| tip | `04449ec` |
| 来源 | 大主管 soft · stage-wide type；T097 后 |

## 问题
H01 stage-wide 点数筹码数字与概率点偏小/对比不足；需共享贴花可读性，无样例特判。

## 拟实现（通用）
放大 LABEL_SIZE / 字重描边 / pip；不 regress T091/T097 canvasShare。
