# T067 — hex Room tabletop-first

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 stage before/after；canvas share≥0.60；岛面可读；T064 sidecar 拒错壳 |
| 层 | **共享呈现 / Room chrome** |
| 状态 | **开** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t067/` |

## 问题
H01 「棋盘落点」全屏模态长期盖住岛屿（对称 T062 lobby）。

## 实现（通用）
1. 落点辅助默认折叠；打开为侧栏非居中遮罩。
2. 3D canvas 主视 ≥60% viewport。**不**自宣 ≥9。
