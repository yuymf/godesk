# T035 — 共享 Room「入座后收起邀请条、3D 台面铺满视口」

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 入座后台面高度 |
| 层 | **Room 壳 / 呈现**（tabletop-3d / SceneHost） |
| 状态 | **开** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t035/` |

## 现象
入座后仍常留大块邀请/席位条，3D 台面偏矮，未铺满视口。

## 实现（通用）
1. 入座后：收起/折叠邀请大卡（tabletop-3d / SceneHost）；台面高度明显抬升。
2. 未入座：仍可复制邀请链接。无题材特判。
3. H03/H04/H05 before/after 台面像素高度对比。

## 验收对照
- [ ] 三套 before/after 高度抬升；无样例特判；不自宣 ≥9
