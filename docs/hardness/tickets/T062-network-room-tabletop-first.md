# T062 — network Room tabletop-first

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 before/after stage；像素门；彩色车厢可读；禁 HTML 按钮墙冒充棋盘 |
| 层 | **共享呈现 / force-inject / Room chrome** |
| 状态 | **关** |
| tip | `52d3f21` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t062/` |

## 问题
H02 Room 被 lobby/侧栏淹没；路网呈虚线+灰堡；T049 彩车不占主视。

## 实现（通用）
1. Room play → 3D canvas 主视（≥60% viewport height）；desk immersive。
2. `forceClaimNetwork` 真实 intents；≥1 彩色车厢路线 Room 可见。
3. 禁 pack 硬编码；**不**自宣 ≥9。
