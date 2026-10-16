# T108 — card face motif microcontrast

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 stage-close 牌面 icon/边框对比可读；不砍 T087 |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `d508ead` |
| 来源 | T105 · H03 牌面仍平 |

## 问题
宝石引擎牌面 motif/边框仍偏平，stage-wide 难读。

## 实现（通用）
共享 card-face microcontrast（更深 counter、更亮 parchment、更厚 dual-edge）；无 kernel 特判。
