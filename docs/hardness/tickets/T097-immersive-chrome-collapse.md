# T097 — immersive chrome collapse

| 字段 | 值 |
| --- | --- |
| 回归靶 | 入座后顶栏 share/seat 条进一步折叠；canvas 占屏↑；延续 T084/T091 |
| 层 | **Room chrome** |
| 状态 | **关** |
| 来源 | T093 respotcheck |

## 问题
stage-wide 顶部分享条+座位 pill 仍夺桌；hex/tabletop immersive 未完全收。

## 拟实现（通用）
seated immersive：shareReady 单行/折叠；座位条入抽屉；无样例特判。
