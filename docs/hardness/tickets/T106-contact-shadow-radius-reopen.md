# T106 — contact shadow radius reopen（T096 续）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03/H04 stage-close：牌堆/厂站下 soft contact 半径/不透明度与 footprint 匹配 |
| 层 | **共享呈现**（contact shadow disc） |
| 状态 | **关** |
| tip | `d508ead` |
| 来源 | T105 audit · T096 仍软 |

## 问题
T096 已关但 H03 牌列/meeple 下 soft disc 仍偏大；需共享半径·强度再调。

## 实现（通用）
softContactShadow 更紧 footprint boost/opacity；card/tile/plate/meeple 半径收紧；阴影仍在（T079/T081）。
