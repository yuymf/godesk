# T041 — 共享「毡面台盘产品框」

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 同机位近距毡面框 |
| 层 | **共享呈现**（tabletop board rim / felt / vignette） |
| 状态 | **关** |
| tip | `2993ffd19fdf8fcf57e172b14c1b446a1332260c` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t041/` |

## 现象
毡面 inset 已有，但缺木缘斜边/缝线产品框；桌角偏「整板木地板」感；与 T038 接触影需共存。

## 实现（通用）
1. cloth inset + wood-edge bevel/stitch；棋件落在毡面而非整板木地板。
2. 轻 vignette / 桌缘暗角。
3. 与 T038 contact shadow 共存。无样例特判。**不**自宣 ≥9。

## 验收对照
- [x] H03/H04/H05 before(T039)/after 同机位近距
- [x] 单测不回退
