# T066 — card face art fill

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03+H05 card-close；像素门或 art-fill unit；与 T048/T063 共存 |
| 层 | **共享呈现**（illustration fill） |
| 状态 | **开** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t066/` |

## 问题
T063 放大了插画区，内里仍接近纯色/淡噪。

## 实现（通用）
1. 区内 procedural 填色：色相+明度结构、主题色块可读；cost 不吞画芯。
2. 禁单主题位图特例。**不**自宣 ≥9。
