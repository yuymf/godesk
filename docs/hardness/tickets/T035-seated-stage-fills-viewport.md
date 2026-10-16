# T035 — 共享 Room「入座后收起邀请条、3D 台面铺满视口」

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 入座后台面高度 |
| 层 | **Room 壳 / 呈现**（tabletop-3d / SceneHost） |
| 状态 | **关** |
| tip | `f16dcc350886e5d050f5f1a5935d1805a6ac71f8` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t035/` |

## 现象
入座后仍常留大块邀请/席位条，3D 台面偏矮，未铺满视口。

## 实现（通用）
1. desk tabletop（gem/pattern/auction 等）挂 `room-view-tabletop-immersive`；入座后 `room-view-seated` + 邀请条 `is-collapsed`。
2. 未入座仍可复制链接；台面 CSS 抬至 ~64vh。无题材特判。
3. H03/H04/H05 高度对比（约 506→704px）。

## 验收对照
- [x] 三套 before/after 高度抬升且 invite collapsed；无样例特判；不自宣 ≥9
