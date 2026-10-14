# T016 — network-route：目的车票副牌 / 多色认领 / 计分表

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02（harness only） |
| 层 | **内核**（network-route-v1 同层扩 · tickets 子集） |
| 状态 | **已关** |
| sha |  |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H02-t016/` |

## 现象（Open · regress-t015）
`route-network` → network-route-v1 可执行；当前为固定图 + 轮流认领 + 先连通枢纽，或 freight 合约子集。诚实 unsupported：**tickets deck / multi-color routes / scoring table**。

## 实现（tickets 子集 · 并行于 freight / classic）
- cue：`TICKETS_ROUTE_CUES`（车票/车厢牌/彩色路线/长度表…）；freight 优先
- **Destination tickets**：开局抽留；`draw_tickets` 中盘再抽（保留高分）
- **Multi-color claim**：边色+长度；手牌色/万能支付；灰边单色付
- **Scoring table**：长度表累计路线分；终局 ± 车票；车厢耗尽触发末轮
- unsupported 收窄：3–5 席 / face-up rainbow 拿取限制 / 最长路奖励

未扭曲 freight/classic。无样例 IP 特判。Collecta 未动。#179 draft 未合 main。

## 关闭
- H02-t016：tickets executable；floors passed；记分趋向 SUCCESS（可玩子集）
- 单元：network-route 17 passed（含 T016 tickets 5 例）
