# T063 — card face illustration panels

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03+H05 stage/close before/after；unit；不与 T048 打架 |
| 层 | **共享呈现**（card-face zones） |
| 状态 | **关** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t063/` |

## 问题
H03/H05 卡面仍是薄图标条，远产品桌面。

## 实现（通用）
1. illustration 区占比↑；border/cost 不得吞掉画芯；禁单主题贴图特例。
2. 扩展 T048 zone schema；**不**自宣 ≥9。
