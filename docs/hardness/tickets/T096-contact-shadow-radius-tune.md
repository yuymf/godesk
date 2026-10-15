# T096 — contact shadow radius tune

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03/H04 stage-close：牌堆/厂牌下 soft contact 半径与不透明度可调；不砍 T079/T081 |
| 层 | **共享呈现**（contact shadow disc） |
| 状态 | **关** |
| tip | `4f4b8e2` |
| 来源 | T093 respotcheck |

## 问题
H03 牌堆下大圆 soft blob 偏大/偏深，伤材质可信；需共享半径/强度规范。

## 拟实现（通用）
按 footprint 缩放 contact disc；默认参数对全 tabletop kernel。
