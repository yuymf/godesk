# T014 — hex-settlement 玩家议价交易（通用）

| 字段 | 值 |
| --- | --- |
| 套件 | H01-catan probe3 |
| 层 | **内核**（hex-settlement-v1 同层扩） |
| 状态 | **已关** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H01-probe3/` |
| sha | `f36c659` |

## 现象
H01 绑 hex-settlement-v1；银行/港口交易已有；`player_trade` 为即时 1:1 强换，缺 **议价**（提议 → 对方接受/拒绝）与多资源捆绑。

## 实现
- `propose_trade`：多资源 give/take 袋（≤4）→ `trade_response`
- `accept_trade` / `reject_trade`：对手回应；成交或撤回主动权
- 列表优先「能解锁建造/发展费用」的捆绑，防空转循环
- unsupported：3–4 席多方经纪 / 复杂竞价式国内交易仍 out of scope

未重做强盗/最长路。无样例 IP 特判。Collecta 未动。#179 draft 未合 main。

## 关闭
- regress-t013：H01–H05 无新红（记分板 `docs/hardness/runs/2026-10-14-regress-t013.md`）
- H01-probe3 冷启动：floors passed；记分 **PASS（可玩子集）**
- 单元：`hex-island.test.ts -t negotiated` 2 passed
