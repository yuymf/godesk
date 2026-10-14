# T016 — network-route：目的车票副牌 / 多色认领 / 计分表

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02（harness only） |
| 层 | **内核**（network-route-v1 同层扩 · tickets 子集） |
| 状态 | **开** |
| 证据 | （待冷跑）`…/hardness-real/H02-t016/` |

## 现象（Open · regress-t015）
`route-network` → network-route-v1 可执行；当前为固定图 + 轮流认领 + 先连通枢纽，或 freight 合约子集。诚实 unsupported：**tickets deck / multi-color routes / scoring table**。

## 期望（通用能力）
在 network-route-v1 增加与 freight **并行**的 **tickets 子集**（由规则书 cue 选中，非样例特判）：

1. **Destination tickets deck**：起终点目标副牌；开局抽留；可选中盘再抽；连通则加分、未连通扣分。
2. **Multi-color claim**：边带颜色与长度；手牌色（含万能）按色/长支付认领；灰边可用单色付。
3. **Scoring table**：按长度表计路线分；终局 = 路线分 ± 车票；非「先连通枢纽即胜」为主胜负。

## 验收
- 冷启动 H02：mechanics 含 route-network；kernel=network-route-v1 且 tickets 子集开启；floors passed；unsupported **不再**把上述三项列为缺口（可保留彩虹拿取限制、3–5 席、最长路奖励等诚实缺口）。
- 单元：tickets 抽牌 / 按色认领 / 长度计分 / 车票结算至少各 1 绿。
- freight / classic 路径不回归；无样例 IP 字符串特判。

## Out of scope
- 3–4+ 席（→ T019）
- 完整面朝上彩虹拿取限制 UI、双轨并行、最长连续路奖励
- freight 航行/战斗；Collecta；合 #179

## 相关
- 回归靶：H02
- 前序：T006 freight、T008 route cues
