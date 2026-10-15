# T087 — card motif stage-wide contrast

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 (+H05 if cards) stage-wide vs prior tip；motif-canvas 不回退；purge clean |
| 层 | **共享呈现 / card-face** |
| 状态 | **证据齐，待主管裁** |
| tip | `045fdb0` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t087/` |

## 问题
T072/T077 后 stage-wide 字号/对比仍偏软；需共享母题描边/对比，无 gem/auction 特判。

## 实现（通用）
1. paintIllustrationBand 双描边 + 母题外缘加粗。
2. paintCardFace 外框对比加强。
3. **不**自宣 ≥9。
