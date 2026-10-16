# T006 — 星港物流核心规则超出 network-route-v1（内核能力缺口）

| 字段 | 值 |
| --- | --- |
| 套件 | H02-starport-convoy |
| 层 | **内核配置 / 内容**（network-route 能力边界） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H02-run3/` |
| 裁定 | 大主管选 **(A)** 扩 network-route-v1 最小可玩子集 |

## 实现（A）

在 **不扭曲占线语义** 的前提下，把物流三支柱落到 claim-graph 货运子集（Ticket-to-Ride 式合约，而非逐步航行模拟）：

| 支柱 | 落地 |
| --- | --- |
| 货运合约 | 市场 3 张 + `accept_contract`；占线连通起终点即交付 |
| 船型 | content 4 船；`cargo` = 并发合约槽（起步驳船） |
| 信誉 | 开局资金/信誉；交付加信誉；先到 `winReputation`（默认 10）胜 |

诚实 unsupported：逐步航行 / speed·armor 战斗 / 海盗·风暴。边通行费以 claim toll 表达。

## 状态

**已实现**；H02-run3 **全过**（SUCCESS 反假阳性 + 三支柱可玩子集 + 呈现 freight HUD）。
